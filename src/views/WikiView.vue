<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getSkills } from '../api/skills.api'
import { createWikiDocument, getWikiDocument, getWikiDocuments, getWikiRevisions, searchWikiTeams, restoreWikiRevision, submitWikiPlatformReview, updateWikiDocument } from '../api/wiki.api'
import MarkdownView from '../components/MarkdownView.vue'
import type { SkillView, WikiDocument, WikiDocumentType, WikiRevision, WikiTeam } from '../types/skill'

const route = useRoute()
const router = useRouter()
const teams = ref<WikiTeam[]>([])
const skills = ref<SkillView[]>([])
const documents = ref<WikiDocument[]>([])
const selected = ref<WikiDocument | null>(null)
const revisions = ref<WikiRevision[]>([])
const teamId = ref<number | undefined>(undefined)
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const editing = ref(false)
const title = ref('')
const content = ref('')
const type = ref<WikiDocumentType>('SKILL_GUIDE')
const selectedSkillIds = ref<number[]>([])
const selectedTeamId = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const skillLoading = ref(false)
const showPromotionDialog = ref(false)
const promotionComment = ref('')
const promoting = ref(false)
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined
let skillSearchTimer: ReturnType<typeof setTimeout> | undefined

const teamOptions = computed(() => teams.value.map((team) => ({ label: team.name, value: team.id })))
const skillOptions = computed(() => skills.value.map((skill) => ({ label: `${skill.displayName}（${skill.skillKey}）`, value: skill.id })))
const skillSelection = computed<number | number[]>({ get: () => type.value === 'SKILL_GUIDE' ? selectedSkillIds.value : (selectedSkillIds.value[0] ?? undefined) as unknown as number, set: (value) => { selectedSkillIds.value = Array.isArray(value) ? value : typeof value === 'number' ? [value] : [] } })
const documentTypeLabel = (value: WikiDocumentType) => value === 'SKILL_README' ? 'Skill README' : '团队套组说明'
async function searchTeams(keyword = '') { if (teamSearchTimer) clearTimeout(teamSearchTimer); teamSearchTimer = setTimeout(async () => { try { const page = await searchWikiTeams(keyword); const currentIds = new Set([teamId.value, selectedTeamId.value].filter((id): id is number => typeof id === 'number')); teams.value = [...page.items, ...teams.value.filter((team) => currentIds.has(team.id) && !page.items.some((item) => item.id === team.id))] } catch { errorMessage.value = '团队加载失败，请稍后重试' } }, 300) }
async function loadSkills(keyword = '') {
  skillLoading.value = true
  try {
    const page = await getSkills({ keyword: keyword.trim() || undefined, page: 0, size: 50 })
    const currentIds = new Set(selectedSkillIds.value)
    skills.value = [...page.items, ...skills.value.filter((skill) => currentIds.has(skill.id) && !page.items.some((item) => item.id === skill.id))]
  } catch { errorMessage.value = 'Skill 加载失败，请稍后重试' }
  finally { skillLoading.value = false }
}
function searchSkills(keyword = '') { if (skillSearchTimer) clearTimeout(skillSearchTimer); skillSearchTimer = setTimeout(() => { void loadSkills(keyword) }, 300) }

async function loadDocuments() {
  loading.value = true; errorMessage.value = ''
  try {
    const page = await getWikiDocuments({ teamId: teamId.value, keyword: keyword.value.trim() || undefined, size: 50 })
    documents.value = page.items
    const requested = Number(route.query.documentId)
    const currentSelectedId = selected.value?.id
    const nextId = requested && documents.value.some((item) => item.id === requested)
      ? requested
      : currentSelectedId && documents.value.some((item) => item.id === currentSelectedId)
        ? currentSelectedId
        : documents.value[0]?.id
    if (nextId) {
      await selectDocument(nextId)
    } else {
      selected.value = null
      title.value = ''
      content.value = ''
      revisions.value = []
      if (route.query.documentId) await router.replace({ query: { ...route.query, documentId: undefined } })
    }
  } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? 'Wiki 加载失败') : 'Wiki 加载失败' }
  finally { loading.value = false }
}
async function selectDocument(id: number) {
  try { selected.value = await getWikiDocument(id); title.value = selected.value.title; content.value = selected.value.markdownContent; revisions.value = await getWikiRevisions(id); void router.replace({ query: { ...route.query, documentId: String(id) } }) }
  catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '文档加载失败') : '文档加载失败' }
}
function beginCreate() { selected.value = null; editing.value = true; title.value = ''; content.value = ''; type.value = 'SKILL_GUIDE'; selectedSkillIds.value = []; selectedTeamId.value = teamId.value ?? teams.value[0]?.id ?? null }
function beginEdit() { if (!selected.value) return; editing.value = true; title.value = selected.value.title; content.value = selected.value.markdownContent; type.value = selected.value.documentType; selectedSkillIds.value = selected.value.skills.map((item) => item.id); selectedTeamId.value = selected.value.teamId }
function onFileChange(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.name.toLowerCase().endsWith('.md')) { errorMessage.value = '仅支持 .md 文件'; return } const reader = new globalThis.FileReader(); reader.onload = () => { content.value = String(reader.result ?? ''); if (!title.value) title.value = file.name.replace(/\.md$/i, '') }; reader.readAsText(file); (event.target as HTMLInputElement).value = '' }
async function save() {
  if (selected.value && !selected.value.canEdit) { errorMessage.value = '当前文档不可编辑'; return }
  if (!title.value.trim() || !content.value.trim()) { errorMessage.value = '标题和 Markdown 正文不能为空'; return }
  saving.value = true; errorMessage.value = ''
  try {
    const value = selected.value
    const result = value ? await updateWikiDocument(value.id, { title: title.value.trim(), markdownContent: content.value, versionNo: value.versionNo }) : await createWikiDocument({ title: title.value.trim(), documentType: type.value, teamId: type.value === 'SKILL_GUIDE' ? selectedTeamId.value : null, skillIds: selectedSkillIds.value, markdownContent: content.value })
    editing.value = false; await selectDocument(result.id); await loadDocuments()
  } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '保存失败') : '保存失败' }
  finally { saving.value = false }
}
async function restore(revision: WikiRevision) { if (!selected.value || !window.confirm(`恢复到修订 ${revision.revisionNo}？`)) return; saving.value = true; try { await restoreWikiRevision(selected.value.id, revision.id, selected.value.versionNo); await selectDocument(selected.value.id) } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '恢复失败') : '恢复失败' } finally { saving.value = false } }
function openPromotionDialog() { promotionComment.value = ''; showPromotionDialog.value = true }
async function submitPromotion() {
  if (!selected.value || !promotionComment.value.trim()) return
  promoting.value = true; errorMessage.value = ''
  try { await submitWikiPlatformReview(selected.value.id, { versionNo: selected.value.versionNo, comment: promotionComment.value.trim() }); showPromotionDialog.value = false; await selectDocument(selected.value.id); await loadDocuments() }
  catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '提交平台审核失败') : '提交平台审核失败' }
  finally { promoting.value = false }
}
onMounted(async () => { await searchTeams(); await loadSkills(); await loadDocuments() })
watch(() => route.query.documentId, () => { const id = Number(route.query.documentId); if (id) void selectDocument(id) })
watch(type, (next, previous) => { if (next === 'SKILL_README' && previous === 'SKILL_GUIDE' && selectedSkillIds.value.length > 1) { selectedSkillIds.value = selectedSkillIds.value.slice(0, 1); errorMessage.value = 'README 只能关联一个 Skill，已保留第一个关联项' } })
</script>

<template>
  <div class="wiki-page">
    <header class="wiki-heading"><div><p class="eyebrow">TEAM KNOWLEDGE</p><h1>团队 Wiki</h1><p>沉淀 Skill 使用说明，让团队经验可以被持续复用。</p></div><t-button theme="primary" @click="beginCreate">新建 Markdown 文档</t-button></header>
    <div v-if="errorMessage" class="wiki-alert">{{ errorMessage }}</div>
    <div class="wiki-toolbar"><t-select v-model="teamId" clearable filterable placeholder="全部可见范围" :options="teamOptions" @search="searchTeams" @change="loadDocuments" /><t-input v-model="keyword" placeholder="搜索文档标题" clearable @enter="loadDocuments" /><t-button variant="outline" @click="loadDocuments">搜索</t-button></div>
    <div class="wiki-layout">
      <aside class="wiki-list"><div class="wiki-list__head"><strong>文档目录</strong><span>{{ documents.length }}</span></div><div v-if="loading" class="wiki-empty">加载中…</div><button v-for="item in documents" :key="item.id" class="wiki-list-item" :class="{ active: selected?.id === item.id }" @click="selectDocument(item.id)"><strong>{{ item.title }}</strong><small>{{ documentTypeLabel(item.documentType) }} · 修订 {{ item.revisionNo }}</small></button><div v-if="!loading && !documents.length" class="wiki-empty">暂无可见文档</div></aside>
      <main class="wiki-reader">
        <template v-if="editing"><div class="editor-heading"><div><t-input v-model="title" placeholder="文档标题" /></div><div class="editor-actions"><t-button variant="outline" @click="editing = false">取消</t-button><t-button theme="primary" :loading="saving" @click="save">保存</t-button></div></div><div v-if="!selected" class="editor-fields"><t-select v-model="type" :options="[{ label: '团队套组说明', value: 'SKILL_GUIDE' }, { label: 'Skill README', value: 'SKILL_README' }]" /><t-select v-if="type === 'SKILL_GUIDE'" v-model="selectedTeamId" filterable :options="teamOptions" placeholder="所属团队" @search="searchTeams" /><t-select v-model="skillSelection" :multiple="type === 'SKILL_GUIDE'" filterable :loading="skillLoading" :options="skillOptions" placeholder="关联 Skill，支持搜索" @search="searchSkills" /></div><div class="upload-row"><t-button variant="outline" @click="fileInput?.click()">导入 .md 文件</t-button><input ref="fileInput" type="file" accept=".md,text/markdown" hidden @change="onFileChange" /><span>仅支持 UTF-8 Markdown，正文最大 1 MiB</span></div><t-textarea v-model="content" :autosize="{ minRows: 22, maxRows: 40 }" placeholder="输入 Markdown 内容" /></template>
        <template v-else-if="selected"><div class="reader-heading"><div><p class="eyebrow">{{ documentTypeLabel(selected.documentType) }}</p><h2>{{ selected.title }}</h2><p>修订 {{ selected.revisionNo }} · {{ selected.platformVisible ? '全公司可见' : '团队内部可见' }}<span v-if="selected.pendingPlatformReviewId" class="pending-review-badge">平台审核中</span></p></div><div class="reader-actions"><t-button v-if="selected.canEdit && !selected.platformVisible" theme="primary" variant="outline" @click="openPromotionDialog">推送到全平台</t-button><t-button v-if="selected.canEdit" theme="primary" variant="outline" @click="beginEdit">编辑文档</t-button></div></div><div class="reader-links"><RouterLink v-for="skill in selected.skills" :key="skill.id" :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }">{{ skill.displayName }}</RouterLink></div><MarkdownView :content="selected.markdownContent" class="markdown-content" /><section v-if="selected.canEdit" class="revision-panel"><div class="revision-heading"><strong>修订历史</strong><span>{{ revisions.length }} 个修订</span></div><div v-for="revision in revisions" :key="revision.id" class="revision-row"><span>修订 {{ revision.revisionNo }} · {{ revision.createdByName }}</span><time>{{ new Date(revision.createdAt).toLocaleString() }}</time><t-button v-if="revision.revisionNo !== selected.revisionNo" size="small" variant="text" @click="restore(revision)">恢复</t-button></div></section></template>
        <div v-else class="wiki-empty wiki-empty--large">选择左侧文档开始阅读</div>
      </main>
    </div>
    <div v-if="showPromotionDialog" class="promotion-mask"><div class="promotion-dialog" role="dialog" aria-modal="true"><h2>推送到全平台</h2><p>审核通过后，所有用户都可以查看此 Wiki；后续团队编辑会继续同步到全平台。</p><textarea v-model="promotionComment" rows="5" placeholder="请填写推送理由（必填）"></textarea><div class="promotion-actions"><t-button variant="outline" :disabled="promoting" @click="showPromotionDialog = false">取消</t-button><t-button theme="primary" :loading="promoting" :disabled="!promotionComment.trim()" @click="submitPromotion">提交审核</t-button></div></div></div>
  </div>
</template>

<style scoped>
.wiki-page{padding:30px 34px;color:#172033}.wiki-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.wiki-heading h1{margin:5px 0 8px;font-size:28px}.wiki-heading p:not(.eyebrow){margin:0;color:#64748b;font-size:13px}.wiki-alert{margin:18px 0;padding:12px 14px;border-radius:8px;color:#9a3412;background:#fff1e0}.wiki-toolbar{display:flex;gap:10px;margin:24px 0}.wiki-toolbar .t-select{width:220px}.wiki-toolbar .t-input{width:300px}.wiki-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px;min-height:570px}.wiki-list,.wiki-reader{border:1px solid #eadfce;border-radius:12px;background:#fff}.wiki-list{padding:12px}.wiki-list__head,.revision-heading,.reader-heading,.editor-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}.wiki-list__head{padding:8px 8px 14px;border-bottom:1px solid #f1e8dc}.wiki-list__head span,.revision-heading span{color:#94a3b8;font-size:12px}.wiki-list-item{display:grid;width:100%;gap:5px;margin-top:6px;padding:12px 10px;border:0;border-radius:8px;color:#475569;background:transparent;text-align:left;cursor:pointer}.wiki-list-item:hover,.wiki-list-item.active{color:#c95100;background:#fff1e0}.wiki-list-item small{color:#94a3b8}.wiki-empty{padding:30px 10px;color:#94a3b8;font-size:13px;text-align:center}.wiki-empty--large{padding-top:220px}.wiki-reader{padding:26px}.reader-heading h2{margin:5px 0;font-size:24px}.reader-heading p{margin:5px 0;color:#94a3b8;font-size:12px}.reader-actions{display:flex;gap:8px;flex-wrap:wrap}.pending-review-badge{display:inline-block;margin-left:8px;padding:3px 7px;border-radius:5px;color:#8a5b16;background:#fff4d9}.reader-links{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.reader-links a{padding:5px 9px;border-radius:5px;color:#c95100;background:#fff1e0;font-size:12px;text-decoration:none}.markdown-content{min-height:280px;margin:0;padding:20px;border-radius:8px;color:#334155;background:#fffaf4;overflow:auto}.revision-panel{margin-top:24px;padding-top:18px;border-top:1px solid #f1e8dc}.revision-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f6efe5;color:#475569;font-size:12px}.revision-row time{margin-right:auto;color:#94a3b8}.editor-heading{margin-bottom:16px}.editor-heading .t-input{width:420px}.editor-actions{display:flex;gap:8px}.editor-fields{display:flex;gap:10px;margin-bottom:14px}.editor-fields .t-select{min-width:200px}.upload-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;color:#94a3b8;font-size:12px}.promotion-mask{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:rgb(15 23 42 / 45%)}.promotion-dialog{width:min(100%,520px);padding:24px;border-radius:14px;background:#fff;box-shadow:0 20px 60px rgb(15 23 42 / 20%)}.promotion-dialog h2{margin:0 0 8px}.promotion-dialog p{margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.6}.promotion-dialog textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #d9e0ea;border-radius:8px;resize:vertical}.promotion-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}@media(max-width:800px){.wiki-page{padding:20px}.wiki-layout{grid-template-columns:1fr}.wiki-toolbar{flex-wrap:wrap}.wiki-toolbar .t-input,.wiki-toolbar .t-select{width:100%}.editor-heading .t-input{width:100%}.editor-heading{align-items:stretch;flex-direction:column}.editor-fields{flex-direction:column}}
</style>
