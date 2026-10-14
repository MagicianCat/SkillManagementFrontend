<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '../utils/markdown'
import { getSkillCategories } from '../api/skills.api'
import { searchWikiTeams } from '../api/wiki.api'
import type { SkillCategory, WikiTeam } from '../types/skill'
import {
  downloadExternalZip, getExternalDocument,
  importExternalSkill, listExternalDocuments, listExternalImports, listExternalResources,
  listExternalRoles, listExternalVersions, prepareExternalSkill,
  type DocumentEntry, type ExternalImport, type ExternalResource,
  type ExternalRole, type ExternalVersion, type SkillPreparation,
} from '../api/external-resources.api'

const router = useRouter()
const roles = ref<ExternalRole[]>([])
const resources = ref<ExternalResource[]>([])
const versions = ref<ExternalVersion[]>([])
const imports = ref<ExternalImport[]>([])
const categories = ref<SkillCategory[]>([])
const teams = ref<WikiTeam[]>([])
const teamLoading = ref(false)
const roleId = ref<number | null>(null)
const type = ref('')
const keyword = ref('')
const page = ref(0)
const selected = ref<ExternalResource | null>(null)
const versionId = ref<number | null>(null)
const preparation = ref<SkillPreparation | null>(null)
const entries = ref<DocumentEntry[]>([])
const checked = ref<string[]>([])
const previewPath = ref('')
const preview = ref('')
const safePreview = computed(() => DOMPurify.sanitize(renderMarkdown(preview.value), { FORBID_TAGS: ['img', 'iframe', 'script'] }))
const error = ref('')
const busy = ref(false)
const skillKey = ref('')
const displayName = ref('')
const description = ref('')
const categoryId = ref<number | null>(null)
const teamId = ref<number | null>(null)
const categoryOptions = computed(() => categories.value.filter((item) => item.parentId === null).map((root) => ({
  label: root.name,
  value: root.id,
  children: categories.value.filter((item) => item.parentId === root.id).map((leaf) => ({ label: leaf.name, value: leaf.id, disabled: !leaf.selectable })),
})))
const teamOptions = computed(() => [
  { label: '请选择团队', value: null },
  ...teams.value.map((team) => ({ label: team.name, value: team.id })),
])
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined

function searchTeams(keyword = '') {
  if (teamSearchTimer) clearTimeout(teamSearchTimer)
  teamSearchTimer = setTimeout(async () => {
    teamLoading.value = true
    try {
      const page = await searchWikiTeams(keyword)
      const selectedTeam = teams.value.find((team) => team.id === teamId.value)
      teams.value = selectedTeam && !page.items.some((team) => team.id === selectedTeam.id)
        ? [selectedTeam, ...page.items]
        : page.items
    } catch {
      error.value = '团队加载失败，请稍后重试'
    } finally { teamLoading.value = false }
  }, 300)
}

function message(e: unknown) {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err.response?.data?.message || err.message || '操作失败'
}
async function load() {
  error.value = ''
  try {
    roles.value = await listExternalRoles()
    categories.value = await getSkillCategories()
    searchTeams()
    if (!roleId.value && roles.value.length) roleId.value = roles.value[0]!.id
    await loadResources()
  } catch (e) { error.value = message(e) }
}
async function loadResources() {
  if (!roleId.value) return
  try { resources.value = await listExternalResources(roleId.value, type.value || undefined, keyword.value || undefined, page.value) }
  catch (e) { error.value = message(e) }
}
function searchResources() { page.value = 0; void loadResources() }
function movePage(offset: number) { page.value += offset; void loadResources() }
async function selectResource(item: ExternalResource) {
  selected.value = item; versionId.value = item.currentVersionId
  preparation.value = null; entries.value = []; checked.value = []; preview.value = ''; teamId.value = null
  try { versions.value = await listExternalVersions(item.id); await selectVersion(item.currentVersionId) }
  catch (e) { error.value = message(e) }
}
async function selectVersion(id: number) {
  versionId.value = id; preparation.value = null; entries.value = []; checked.value = []; preview.value = ''
  try { imports.value = await listExternalImports(id) } catch (e) { error.value = message(e) }
}
async function download() {
  if (!versionId.value) return
  try {
    const blob = await downloadExternalZip(versionId.value)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url
    anchor.download = versions.value.find((v) => v.id === versionId.value)?.fileName || 'resource.zip'
    anchor.click(); URL.revokeObjectURL(url)
  } catch (e) { error.value = message(e) }
}
async function prepare() {
  if (!versionId.value) return
  busy.value = true; error.value = ''
  try {
    preparation.value = await prepareExternalSkill(versionId.value)
    skillKey.value = preparation.value.skillKey || ''
    displayName.value = selected.value?.name || ''
    description.value = selected.value?.description || selected.value?.name || ''
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
async function importSkill() {
  if (!versionId.value || !skillKey.value) return
  busy.value = true; error.value = ''
  try {
    preparation.value = await prepareExternalSkill(versionId.value, skillKey.value)
    if (preparation.value.activeDraftVersionId) throw new Error('该 Skill 已有草稿，需先处理现有草稿')
    if (preparation.value.exists && !confirm('同 Key 已存在。确认在该 Skill 下创建草稿？')) return
    const reimport = imports.value.some((row) => row.targetType === 'SKILL' && row.result === 'SUCCESS')
    if (reimport && !confirm('该原始版本已导入过。确认再次导入？不会覆盖已发布版本；已有草稿时会拒绝。')) return
    const result = await importExternalSkill(versionId.value, {
      skillKey: skillKey.value, displayName: displayName.value, description: description.value,
      categoryId: categoryId.value, teamId: teamId.value,
      confirmExisting: Boolean(preparation.value?.exists), reimport,
    })
    await router.push({ name: 'skill-draft', params: { skillKey: result.skillKey } })
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
async function openDocuments() {
  if (!versionId.value) return
  busy.value = true; error.value = ''
  try {
    entries.value = await listExternalDocuments(versionId.value)
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
async function showDocument(path: string) {
  if (!versionId.value) return
  previewPath.value = path
  try { preview.value = await getExternalDocument(versionId.value, path) }
  catch (e) { error.value = message(e) }
}
async function importDocuments() {
  if (!versionId.value || !checked.value.length) return
  if (!teamId.value) { error.value = '请先选择目标团队'; return }
  if (checked.value.length !== 1) { error.value = '请逐篇打开文档草稿；关联 Skill 可在 Wiki 页面选择'; return }
  busy.value = true; error.value = ''
  try {
    const path = checked.value[0]!
    const markdownContent = await getExternalDocument(versionId.value, path)
    const token = crypto.randomUUID()
    sessionStorage.setItem(`external-wiki-draft:${token}`, JSON.stringify({
      title: path.split('/').pop()!.replace(/\.md$/i, ''), markdownContent, teamId: teamId.value,
      teamName: teams.value.find((team) => team.id === teamId.value)?.name,
      source: { versionId: versionId.value, path },
    }))
    await router.push({ name: 'wiki', query: { externalDraft: token } })
  } catch (e) { error.value = message(e) } finally { busy.value = false }
}
watch([roleId, type], () => { selected.value = null; page.value = 0; void loadResources() })
onMounted(() => { void load() })
</script>

<template>
  <main class="external-page">
    <header><div><p class="eyebrow">SYSTEM MANAGEMENT</p><h1>外部资源接入</h1><p>原始 ZIP 归档后，由管理员按需导入 Skill 草稿或 Wiki。</p></div><button @click="load">刷新</button></header>
    <p v-if="error" class="alert">{{ error }}</p>
    <div class="layout">
      <aside class="panel"><h2>来源与角色</h2><button v-for="role in roles" :key="role.id" class="role" :class="{ active: roleId === role.id }" @click="roleId = role.id"><small>{{ role.sourceSystem }}</small><strong>{{ role.roleName }}</strong><small>{{ role.externalRoleId }}</small></button><p v-if="!roles.length">暂无外部资源</p></aside>
      <section class="panel"><h2>资源</h2><div class="filters"><input v-model="keyword" placeholder="搜索名称或外部 ID" @keyup.enter="searchResources"><select v-model="type"><option value="">全部类型</option><option value="SKILL">Skill</option><option value="DOCUMENT">文档 ZIP</option></select><button @click="searchResources">搜索</button></div><button v-for="item in resources" :key="item.id" class="resource" :class="{ active: selected?.id === item.id }" @click="selectResource(item)"><span class="badge">{{ item.resourceType }}</span><strong>{{ item.name }}</strong><small>版本 {{ item.externalVersion || '未标记' }} · {{ Math.ceil((item.sizeBytes || 0) / 1024) }} KB</small></button><p v-if="!resources.length">当前角色暂无资源</p><div class="filters"><button :disabled="page === 0" @click="movePage(-1)">上一页</button><span>第 {{ page + 1 }} 页</span><button :disabled="resources.length < 50" @click="movePage(1)">下一页</button></div></section>
      <section class="panel details"><template v-if="selected"><h2>{{ selected.name }}</h2><p>{{ selected.description }}</p><label>原始版本 <select v-model.number="versionId" @change="versionId && selectVersion(versionId)"><option v-for="v in versions" :key="v.id" :value="v.id">{{ v.externalVersion || '无版本号' }} · {{ v.receivedAt }}</option></select></label><button @click="download">下载原始 ZIP</button>
        <template v-if="selected.resourceType === 'SKILL'"><h3>推送到平台草稿</h3><button :disabled="busy" @click="prepare">解析并校验 ZIP</button><div v-if="preparation" class="form"><p>文件数 {{ preparation.fileCount }}；{{ preparation.exists ? '同 Key 已存在' : '尚无同 Key Skill' }}</p><p v-if="preparation.activeDraftVersionId" class="alert">该 Skill 已有草稿，需先处理冲突。</p><label>Skill Key <input v-model="skillKey" :disabled="Boolean(preparation.skillKey)"></label><label>名称 <input v-model="displayName"></label><label>说明 <textarea v-model="description"></textarea></label><label v-if="!preparation.exists">研发阶段 <t-cascader v-model="categoryId" :options="categoryOptions" clearable filterable placeholder="请选择具体阶段" /></label><label>归属团队 <t-select v-model="teamId" filterable clearable :loading="teamLoading" :options="[{ label: '平台 Skill', value: null }, ...teamOptions.filter((option) => option.value !== null)]" placeholder="平台 Skill 或搜索团队" @search="searchTeams" /></label><button :disabled="busy || Boolean(preparation.activeDraftVersionId)" @click="importSkill">确认导入草稿</button></div></template>
        <template v-else><h3>ZIP 内 Markdown</h3><button :disabled="busy" @click="openDocuments">查看文档</button><div v-if="entries.length"><p>选择一篇文档并打开团队 Wiki 草稿页；正文会自动填入，管理员在草稿页选择关联 Skill。</p><button @click="checked = checked.length === entries.length ? [] : entries.map((e) => e.path)">{{ checked.length === entries.length ? '取消全选' : '全选文档' }}</button><label v-for="entry in entries" :key="entry.path" class="entry"><input v-model="checked" type="checkbox" :value="entry.path"><button @click="showDocument(entry.path)">{{ entry.path }}</button></label><label>目标团队 <t-select v-model="teamId" filterable clearable :loading="teamLoading" :options="teamOptions" placeholder="搜索并选择团队" @search="searchTeams" /></label><button :disabled="busy || !teamId || checked.length !== 1" @click="importDocuments">在团队 Wiki 创建草稿</button><div v-if="previewPath"><h4>{{ previewPath }}</h4><details><summary>查看 Markdown 原文</summary><pre>{{ preview }}</pre></details><div class="markdown-body" v-html="safePreview"></div></div></div><p v-else>点击“查看文档”读取 ZIP 中的 Markdown 文件</p></template>
        <h3>导入记录</h3><p v-for="row in imports" :key="row.id">{{ row.createdAt }} · {{ row.targetType }} {{ row.entryPath || '' }} → {{ row.targetId }} · {{ row.result }}</p>
      </template><p v-else>选择资源查看版本、原始 ZIP 和导入操作。</p></section>
    </div>
  </main>
</template>

<style scoped>
.external-page{padding:28px;max-width:1600px;margin:auto;color:var(--text-primary,#233047)}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}h1{margin:3px 0;font-size:30px}h2{font-size:18px;margin:0 0 18px}h3{margin:28px 0 12px}.eyebrow{letter-spacing:.14em;color:#3668da;font-size:12px;font-weight:700}.layout{display:grid;grid-template-columns:minmax(190px,1fr) minmax(240px,1.2fr) minmax(360px,2fr);gap:16px}.panel{background:var(--surface,#fff);border:1px solid #dce5f3;border-radius:14px;padding:18px;min-height:360px}.role,.resource{display:flex;flex-direction:column;align-items:flex-start;text-align:left;width:100%;margin:8px 0;padding:12px;border:1px solid #e0e7f4;border-radius:10px;background:transparent;color:inherit;cursor:pointer;gap:4px}.active{border-color:#3b6be8;background:#eef3ff}small{color:#8797af}.badge{font-size:11px;color:#3266d9;font-weight:700}.filters{display:flex;gap:6px;margin-bottom:12px}.filters input{min-width:0;flex:1}input,select,textarea{padding:9px;border:1px solid #cbd6e8;border-radius:7px;background:transparent;color:inherit}button{padding:9px 12px;border:1px solid #b9c9e8;border-radius:8px;background:#f2f6ff;color:#2455c4;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}.form{display:grid;gap:12px;margin-top:14px}.form label,.details>label{display:grid;gap:6px}.entry{display:flex;align-items:center;gap:8px;margin:7px 0}.entry button{border:0;background:transparent;text-align:left;padding:3px}.alert{padding:10px;background:#fff1ed;color:#ab3324;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:250px;overflow:auto}.details{overflow-wrap:anywhere}@media(max-width:1000px){.layout{grid-template-columns:1fr}.panel{min-height:auto}}
</style>
