<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { getSkills } from '../api/skills.api'
import { rebuildWikiVectors } from '../api/knowledge.api'
import { archiveWikiDocument, createWikiDocument, getWikiDocument, getWikiDocuments, getWikiRevisions, searchWikiTeams, restoreWikiRevision, submitWikiPlatformReview, publishWikiDirect, getWikiPublicationIndexStatus, getWikiDocumentIndexStatus, getWikiPublicationState, updateWikiDocument, previewWikiPlatformPromotion, suggestWikiCategory } from '../api/wiki.api'
import type { WikiCategorySuggestion } from '../api/wiki.api'
import MarkdownView from '../components/MarkdownView.vue'
import { previewWikiCategoryBatch, createWikiCategoryBatch } from '../api/wiki-category-batch.api'
import type { WikiCategoryPreview } from '../api/wiki-category-batch.api'
import type { SkillView, WikiDocument, WikiRevision, WikiTeam, WikiKnowledgeCategory } from '../types/skill'
import { wikiKnowledgeCategoryOptions, wikiKnowledgeCategoryLabel } from '../constants/wiki-knowledge-categories'

const route = useRoute()
const router = useRouter()
const isFdeArea = computed(() => route.name === 'wiki-fde')
const authStore = useAuthStore()
const teams = ref<WikiTeam[]>([])
const skills = ref<SkillView[]>([])
const documents = ref<WikiDocument[]>([])
const documentPage = ref(0)
const documentPageSize = 20
const documentTotal = ref(0)
const documentTotalPages = ref(0)
const selected = ref<WikiDocument | null>(null)
const selectedIsPlatformSnapshot = ref(false)
const publicationUpToDate = ref<boolean | null>(null)
const revisions = ref<WikiRevision[]>([])
const teamId = ref<number | undefined>(undefined)
const scopeSelection = ref<string>('ALL')
const keyword = ref('')
const knowledgeCategoryFilter = ref<WikiKnowledgeCategory | undefined>()
const knowledgeCategory = ref<WikiKnowledgeCategory | null>(null)
const suggestingCategory = ref(false)
const showSuggestionDialog = ref(false)
const categorySuggestion = ref<WikiCategorySuggestion | null>(null)
const categorySuggestionError = ref('')
let cachedSuggestion: { signature: string; value: WikiCategorySuggestion; at: number } | null = null
const knowledgeCategoryOptions = wikiKnowledgeCategoryOptions
const knowledgeCategoryLabel = wikiKnowledgeCategoryLabel
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const editing = ref(false)
const title = ref('')
const content = ref('')
const selectedSkillIds = ref<number[]>([])
const selectedTeamId = ref<number | null>(null)
const selectedTeamSelection = ref<number | 'PLATFORM' | null>(null)
const parentId = ref<number | null>(null)
const parentOptions = ref<Array<{ label: string; value: number }>>([])
const hiddenParentCategories = ref<Record<number, WikiKnowledgeCategory>>({})
const fileInput = ref<HTMLInputElement | null>(null)
const skillLoading = ref(false)
const showPromotionDialog = ref(false)
const promotionComment = ref('')
const promoting = ref(false)
const promotionPreview = ref<Awaited<ReturnType<typeof previewWikiPlatformPromotion>> | null>(null)
const batchPreview = ref<WikiCategoryPreview | null>(null)
const showBatchDialog = ref(false)
const includeConfirmedOther = ref(false)
const startingBatch = ref(false)
async function openBatchDialog() { try { batchPreview.value = await previewWikiCategoryBatch(); showBatchDialog.value = true } catch { errorMessage.value = '批量分类预检失败' } }
async function startBatch() { startingBatch.value = true; try { const result = await createWikiCategoryBatch(includeConfirmedOther.value); showBatchDialog.value = false; await router.push({ name: 'wiki-category-review', query: { batchId: String(result.batchId) } }) } catch { errorMessage.value = '批量分类启动失败，请检查是否有任务正在运行' } finally { startingBatch.value = false } }
const rebuildingVectors = ref(false)
const publicationNotice = ref('')
let publicationPoll: ReturnType<typeof setTimeout> | undefined
async function pollPublicationIndex(publicationId: number) {
  try {
    const result = await getWikiPublicationIndexStatus(publicationId)
    publicationNotice.value = result.indexStatus === 'READY' ? '已公开，知识库检索已同步。' : result.indexStatus === 'FAILED' ? '已公开，知识库索引失败，请联系管理员处理。' : '已公开；知识库检索同步中。'
    if (result.indexStatus === 'PENDING') publicationPoll = setTimeout(() => void pollPublicationIndex(publicationId), 5000)
  } catch { publicationNotice.value = '已公开；暂无法查询知识库索引状态。' }
}
async function pollDocumentIndex(documentId: number) {
  try {
    const result = await getWikiDocumentIndexStatus(documentId)
    publicationNotice.value = result.indexStatus === 'READY' ? '已公开，知识库检索已同步。' : result.indexStatus === 'FAILED' ? '已公开，知识库索引失败，请联系管理员处理。' : '已公开；知识库检索同步中。'
    if (result.indexStatus === 'PENDING') publicationPoll = setTimeout(() => void pollDocumentIndex(documentId), 5000)
  } catch { publicationNotice.value = '已公开；暂无法查询知识库索引状态。' }
}
onBeforeUnmount(() => { if (publicationPoll) clearTimeout(publicationPoll) })
const rebuildNotice = ref('')
const rebuildNoticeType = ref<'success' | 'warning' | 'error'>('success')
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined
let skillSearchTimer: ReturnType<typeof setTimeout> | undefined

const teamOptions = computed(() => teams.value.map((team) => ({ label: team.name, value: team.id })))
const canDirectPublish = computed(() => Boolean(authStore.user?.permissions.includes('wiki:publish:direct') || authStore.user?.permissions.includes('admin:identity')))
const scopeOptions = computed(() => [
  { label: '全部可见范围', value: 'ALL' },
  ...(canDirectPublish.value ? [{ label: '全平台', value: 'PLATFORM' }] : []),
  ...teams.value.map((team) => ({ label: team.name, value: `TEAM:${team.id}` })),
])
const createTeamOptions = computed(() => [
  ...(canDirectPublish.value ? [{ label: '全平台（创建即公开）', value: 'PLATFORM' as const }] : []),
  ...teamOptions.value,
])
function changeScope() {
  teamId.value = scopeSelection.value.startsWith('TEAM:') ? Number(scopeSelection.value.slice(5)) : undefined
  if (route.query.audience) void router.replace({ query: { ...route.query, audience: undefined } })
  applyDocumentFilters()
}
function changeCreateTeam() {
  selectedTeamId.value = selectedTeamSelection.value === 'PLATFORM' ? null : selectedTeamSelection.value
  parentId.value = null; selectedSkillIds.value = []; void loadParents()
}
const orderedDocuments = computed(() => {
  const byParent = new Map<number | null, WikiDocument[]>()
  const ids = new Set(documents.value.map((document) => document.id))
  for (const document of documents.value) {
    const parent = document.parentId && ids.has(document.parentId) ? document.parentId : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), document])
  }
  const result: Array<{ document: WikiDocument; depth: number; hiddenParent: boolean }> = []
  const visited = new Set<number>()
  const walk = (parent: number | null, depth: number) => {
    for (const document of byParent.get(parent) ?? []) {
      if (visited.has(document.id)) continue
      visited.add(document.id); result.push({ document, depth, hiddenParent: Boolean(document.parentId && !ids.has(document.parentId)) }); walk(document.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
})
const isSuperAdmin = computed(() => Boolean(authStore.user?.permissions.includes('admin:identity') && authStore.user?.roles.includes('ADMIN')))
const skillOptions = computed(() => {
  const options = skills.value.filter((skill) => skill.status === 'ACTIVE' &&
    (selectedTeamSelection.value === 'PLATFORM'
      ? skill.scopeType === 'PLATFORM' && Boolean(skill.latestPublishedVersion)
      : skill.scopeType === 'PLATFORM' || (selectedTeamId.value !== null && skill.scopeType === 'TEAM' && skill.teamId === selectedTeamId.value)))
    .map((skill) => ({ label: `${skill.displayName}（${skill.skillKey}）`, value: skill.id }))
  for (const skill of selected.value?.skills ?? []) {
    if (!options.some((option) => option.value === skill.id)) options.push({ label: `${skill.displayName}（${skill.skillKey}）`, value: skill.id })
  }
  return options
})
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
async function loadParents(keyword = '') {
  if (!selectedTeamId.value && selectedTeamSelection.value !== 'PLATFORM') { parentOptions.value = []; return }
  try {
    const page = await getWikiDocuments({ teamId: selectedTeamId.value ?? undefined, scope: selectedTeamSelection.value === 'PLATFORM' ? 'PLATFORM' : undefined, knowledgeCategory: isFdeArea.value && !selected.value ? 'FDE_WIKI' : undefined, keyword: keyword || undefined, size: 50 })
    parentOptions.value = page.items.filter((item) => item.id !== selected.value?.id && (selectedTeamSelection.value !== 'PLATFORM' || item.teamId === null)).map((item) => ({ label: item.title, value: item.id }))
    if (parentId.value && !parentOptions.value.some((option) => option.value === parentId.value)) {
      const current = await getWikiDocument(parentId.value)
      parentOptions.value.unshift({ label: current.title, value: current.id })
    }
  } catch { errorMessage.value = '父 Wiki 加载失败，请重试' }
}

async function loadDocuments(preferRoute = false) {
  loading.value = true; errorMessage.value = ''
  try {
    const page = await getWikiDocuments({ teamId: teamId.value, scope: scopeSelection.value === 'PLATFORM' ? 'PLATFORM' : undefined, knowledgeCategory: isFdeArea.value ? 'FDE_WIKI' : knowledgeCategoryFilter.value, keyword: keyword.value.trim() || undefined, page: documentPage.value, size: documentPageSize })
    documents.value = page.items
    hiddenParentCategories.value = {}
    if (isFdeArea.value) {
      const ids = new Set(page.items.map((item) => item.id))
      const hiddenIds = [...new Set(page.items.map((item) => item.parentId).filter((id): id is number => typeof id === 'number' && !ids.has(id)))]
      const parents = await Promise.allSettled(hiddenIds.map((id) => getWikiDocument(id)))
      for (let i = 0; i < hiddenIds.length; i++) {
        const parent = parents[i]
        if (parent?.status === 'fulfilled') hiddenParentCategories.value[hiddenIds[i]!] = parent.value.knowledgeCategory
      }
    }
    documentTotal.value = page.totalElements
    documentTotalPages.value = page.totalPages
    if (documentPage.value > 0 && page.items.length === 0 && page.totalPages > 0) {
      documentPage.value = page.totalPages - 1
      await loadDocuments()
      return
    }
    const requested = Number(route.query.documentId)
    const currentSelectedId = selected.value?.id
    const nextId = preferRoute && requested > 0 && Number.isSafeInteger(requested) && (!isFdeArea.value || documents.value.some((item) => item.id === requested))
      ? requested
      : currentSelectedId && documents.value.some((item) => item.id === currentSelectedId)
        ? currentSelectedId
        : documents.value[0]?.id
    if (nextId) {
      await selectDocument(nextId)
    } else {
      selected.value = null
      selectedIsPlatformSnapshot.value = false
      publicationUpToDate.value = null
      title.value = ''
      content.value = ''
      revisions.value = []
      if (route.query.documentId) await router.replace({ query: { ...route.query, documentId: undefined } })
    }
  } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? 'Wiki 加载失败') : 'Wiki 加载失败' }
  finally { loading.value = false }
}
function applyDocumentFilters() { documentPage.value = 0; void loadDocuments() }
function changeDocumentPage(value: number) { documentPage.value = value - 1; void loadDocuments() }
async function selectDocument(id: number) {
  try {
    const platformAudience = scopeSelection.value === 'PLATFORM' || route.query.audience === 'PLATFORM' && Number(route.query.documentId) === id
    const document = await getWikiDocument(id, platformAudience ? 'PLATFORM' : undefined)
    if (isFdeArea.value && document.knowledgeCategory !== 'FDE_WIKI') { await loadDocuments(); return }
    selected.value = document
    selectedIsPlatformSnapshot.value = platformAudience
    publicationUpToDate.value = null
    title.value = selected.value.title
    parentId.value = selected.value.parentId ?? null
    content.value = selected.value.markdownContent
    knowledgeCategory.value = selected.value.knowledgeCategory
    revisions.value = await getWikiRevisions(id)
    if (!platformAudience && document.canEdit && document.teamId !== null) {
      try {
        const state = await getWikiPublicationState(id)
        if (selected.value?.id === id && !selectedIsPlatformSnapshot.value) publicationUpToDate.value = state.upToDate
      } catch {
        if (selected.value?.id === id && !selectedIsPlatformSnapshot.value) publicationUpToDate.value = false
      }
    }
    if (route.query.download === '1' && Number(route.query.documentId) === id) {
      downloadMarkdown(selected.value)
      await router.replace({ query: { ...route.query, documentId: String(id), audience: platformAudience ? 'PLATFORM' : undefined, download: undefined } })
    } else if (Number(route.query.documentId) !== id) {
      await router.replace({ query: { ...route.query, documentId: String(id), download: undefined } })
    }
  }
  catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '文档加载失败') : '文档加载失败' }
}
function downloadMarkdown(wikiDocument: WikiDocument) {
  const blob = new Blob([wikiDocument.markdownContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${wikiDocument.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_') || `wiki-${wikiDocument.id}`}.md`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function beginCreate() { selected.value = null; editing.value = true; title.value = ''; content.value = ''; knowledgeCategory.value = isFdeArea.value ? 'FDE_WIKI' : null; selectedSkillIds.value = []; selectedTeamSelection.value = scopeSelection.value === 'PLATFORM' && canDirectPublish.value ? 'PLATFORM' : teamId.value ?? teams.value[0]?.id ?? null; selectedTeamId.value = selectedTeamSelection.value === 'PLATFORM' ? null : selectedTeamSelection.value; parentId.value = null; showSuggestionDialog.value = false; categorySuggestion.value = null; categorySuggestionError.value = ''; cachedSuggestion = null; void loadParents() }
async function beginEdit() {
  if (!selected.value) return
  const id = selected.value.id
  if (selectedIsPlatformSnapshot.value) {
    try {
      const work = await getWikiDocument(id)
      if (!work.canEdit) { errorMessage.value = '没有此文档的编辑权限'; return }
      scopeSelection.value = 'ALL'
      teamId.value = undefined
      await router.replace({ query: { ...route.query, documentId: String(id), audience: undefined } })
      await loadDocuments(true)
      selected.value = work
      selectedIsPlatformSnapshot.value = false
    } catch (error: unknown) {
      errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '工作版本加载失败') : '工作版本加载失败'
      return
    }
  }
  if (!selected.value || selected.value.id !== id) return
  editing.value = true; title.value = selected.value.title; content.value = selected.value.markdownContent; knowledgeCategory.value = selected.value.knowledgeCategory; selectedSkillIds.value = selected.value.skills.map((item) => item.id); selectedTeamId.value = selected.value.teamId; selectedTeamSelection.value = selected.value.teamId ?? 'PLATFORM'; parentId.value = selected.value.parentId ?? null; void loadParents()
}
function onFileChange(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (!file.name.toLowerCase().endsWith('.md')) { errorMessage.value = '仅支持 .md 文件'; return } const reader = new globalThis.FileReader(); reader.onload = () => { content.value = String(reader.result ?? ''); if (!title.value) title.value = file.name.replace(/\.md$/i, '') }; reader.readAsText(file); (event.target as HTMLInputElement).value = '' }
function suggestionInput() { return { title: title.value.trim(), markdownContent: content.value, teamId: selectedTeamId.value, skillIds: [...selectedSkillIds.value], parentId: parentId.value } }
function suggestionSignature() { return JSON.stringify(suggestionInput()) }
async function requestCategorySuggestion() {
  if (suggestingCategory.value) return
  const input = suggestionInput()
  const signature = suggestionSignature()
  categorySuggestionError.value = ''
  if (cachedSuggestion?.signature === signature && Date.now() - cachedSuggestion.at < 5 * 60_000) {
    categorySuggestion.value = cachedSuggestion.value
    showSuggestionDialog.value = true
    return
  }
  suggestingCategory.value = true
  try {
    const result = await suggestWikiCategory(input)
    if (signature !== suggestionSignature() || selected.value || !editing.value) return
    cachedSuggestion = { signature, value: result, at: Date.now() }
    categorySuggestion.value = result
    showSuggestionDialog.value = true
  } catch (error: unknown) {
    if (signature !== suggestionSignature() || selected.value || !editing.value) return
    categorySuggestion.value = null
    categorySuggestionError.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? 'AI 推荐暂不可用') : 'AI 推荐暂不可用'
    showSuggestionDialog.value = true
  } finally { suggestingCategory.value = false }
}
function useSuggestedCategory() { if (!categorySuggestion.value) return; knowledgeCategory.value = categorySuggestion.value.recommendedCategory; showSuggestionDialog.value = false; void save() }
async function save() {
  if (selected.value && !selected.value.canEdit) { errorMessage.value = '当前文档不可编辑'; return }
  if (!title.value.trim() || !content.value.trim()) { errorMessage.value = '标题和 Markdown 正文不能为空'; return }
  if (!selected.value && selectedTeamId.value === null && (selectedTeamSelection.value !== 'PLATFORM' || !canDirectPublish.value)) { errorMessage.value = '请先选择所属团队'; return }
  if (!selected.value && knowledgeCategory.value === null) { await requestCategorySuggestion(); return }
  if (!selected.value && selectedTeamSelection.value === 'PLATFORM' && !window.confirm('此 Wiki 创建后立即向全平台公开，无需审核。确认发布？')) return
  saving.value = true; errorMessage.value = ''
  try {
    const target = selected.value
    const result = target ? await updateWikiDocument(target.id, { title: title.value.trim(), markdownContent: content.value, versionNo: target.versionNo, skillIds: selectedSkillIds.value, parentId: parentId.value, parentSpecified: true, knowledgeCategory: knowledgeCategory.value ?? undefined }) : await createWikiDocument({ title: title.value.trim(), teamId: selectedTeamId.value, skillIds: selectedSkillIds.value, markdownContent: content.value, parentId: parentId.value, knowledgeCategory: knowledgeCategory.value ?? undefined })
    if (!target && selectedTeamSelection.value === 'PLATFORM') {
      publicationNotice.value = '已公开；知识库检索同步中。'; scopeSelection.value = 'PLATFORM'; teamId.value = undefined
      if (publicationPoll) clearTimeout(publicationPoll)
      publicationPoll = setTimeout(() => void pollDocumentIndex(result.id), 1500)
    }
    editing.value = false
    if (isFdeArea.value && result.knowledgeCategory !== 'FDE_WIKI') {
      await router.push({ name: 'wiki', query: { documentId: String(result.id) } })
    } else {
      await selectDocument(result.id); await loadDocuments()
    }
  } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '保存失败') : '保存失败' }
  finally { saving.value = false }
}
async function restore(revision: WikiRevision) { if (!selected.value || !window.confirm(`恢复到修订 ${revision.revisionNo}？`)) return; saving.value = true; try { await restoreWikiRevision(selected.value.id, revision.id, selected.value.versionNo); await selectDocument(selected.value.id) } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '恢复失败') : '恢复失败' } finally { saving.value = false } }
async function archiveSelected() { if (!selected.value || !window.confirm('下架此 Wiki 及全部子 Wiki？180 天后将永久删除。')) return; saving.value = true; try { await archiveWikiDocument(selected.value.id); selected.value = null; await router.replace({ query: { ...route.query, documentId: undefined } }); await loadDocuments() } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '下架失败') : '下架失败' } finally { saving.value = false } }
async function openPromotionDialog() { if (!selected.value) return; promotionComment.value = ''; promotionPreview.value = null; try { promotionPreview.value = await previewWikiPlatformPromotion(selected.value.id); showPromotionDialog.value = true } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '推广预检失败') : '推广预检失败' } }
async function submitPromotion() {
  if (!selected.value || !promotionComment.value.trim()) return
  promoting.value = true; errorMessage.value = ''
  try { await submitWikiPlatformReview(selected.value.id, { versionNo: selected.value.versionNo, comment: promotionComment.value.trim() }); showPromotionDialog.value = false; await selectDocument(selected.value.id); await loadDocuments() }
  catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '提交平台审核失败') : '提交平台审核失败' }
  finally { promoting.value = false }
}
async function submitDirectPublication() {
  if (!selected.value || !promotionPreview.value || !promotionComment.value.trim() || !canDirectPublish.value) return
  promoting.value = true; errorMessage.value = ''
  try {
    const publication = await publishWikiDirect(selected.value.id, { versionNo: selected.value.versionNo, treeFingerprint: promotionPreview.value.treeFingerprint, comment: promotionComment.value.trim() })
    showPromotionDialog.value = false
    publicationNotice.value = '已公开；知识库检索同步中。'
    if (publicationPoll) clearTimeout(publicationPoll)
    publicationPoll = setTimeout(() => void pollPublicationIndex(publication.publicationId), 1500)
    await selectDocument(selected.value.id); await loadDocuments()
  } catch (error: unknown) { errorMessage.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '直接发布失败，请重新预览') : '直接发布失败，请重新预览' }
  finally { promoting.value = false }
}
async function rebuildVectors() {
  if (!isSuperAdmin.value || rebuildingVectors.value) return
  rebuildingVectors.value = true
  rebuildNotice.value = ''
  try {
    const result = await rebuildWikiVectors()
    rebuildNoticeType.value = result.status === 'ACCEPTED' ? 'success' : 'warning'
    rebuildNotice.value = result.message
  } catch (error: unknown) {
    rebuildNoticeType.value = 'error'
    rebuildNotice.value = axios.isAxiosError(error) ? String(error.response?.data?.message ?? '向量重建任务提交失败') : '向量重建任务提交失败'
  } finally {
    rebuildingVectors.value = false
  }
}
onMounted(async () => { await searchTeams(); await loadSkills(); await loadDocuments(true) })
watch(() => route.name, (name, previous) => {
  if ((name !== 'wiki' && name !== 'wiki-fde') || name === previous) return
  editing.value = false
  selected.value = null
  documentPage.value = 0
  knowledgeCategoryFilter.value = undefined
  void loadDocuments(true)
})
watch(() => [route.query.documentId, route.query.audience], () => { const id = Number(route.query.documentId); if (id && (!isFdeArea.value || documents.value.some((item) => item.id === id))) void selectDocument(id) })
watch([title, content, selectedTeamId, parentId, selectedSkillIds], () => {
  if (showSuggestionDialog.value && cachedSuggestion?.signature !== suggestionSignature()) {
    showSuggestionDialog.value = false
    categorySuggestion.value = null
  }
})
</script>

<template>
  <div class="wiki-page">
    <header class="wiki-heading"><div><p class="eyebrow">TEAM KNOWLEDGE</p><h1>{{ isFdeArea ? 'FDE 专区' : '团队 Wiki' }}</h1><p>{{ isFdeArea ? '集中查看与沉淀 FDE 团队知识，文档仍遵循所在团队的访问与发布规则。' : '沉淀 Skill 使用说明，让团队经验可以被持续复用。' }}</p></div><div class="wiki-heading__actions"><t-button v-if="isSuperAdmin && !isFdeArea" variant="outline" @click="openBatchDialog">批量 AI 分类</t-button><t-button v-if="isSuperAdmin" variant="outline" :loading="rebuildingVectors" :disabled="rebuildingVectors" @click="rebuildVectors">一键重建向量</t-button><t-button theme="primary" @click="beginCreate">新建 Markdown 文档</t-button></div></header>
    <div v-if="errorMessage" class="wiki-alert">{{ errorMessage }}</div>
    <div v-if="rebuildNotice" class="wiki-rebuild-notice" :class="`wiki-rebuild-notice--${rebuildNoticeType}`" role="status" aria-live="polite">{{ rebuildNotice }}</div>
    <div v-if="publicationNotice" class="wiki-rebuild-notice wiki-rebuild-notice--success" role="status">{{ publicationNotice }}</div>
    <div class="wiki-toolbar"><t-select v-model="scopeSelection" filterable :options="scopeOptions" placeholder="全部可见范围" @search="searchTeams" @change="changeScope" /><t-select v-if="!isFdeArea" v-model="knowledgeCategoryFilter" clearable placeholder="全部知识分类" :options="knowledgeCategoryOptions" @change="applyDocumentFilters" /><t-input v-model="keyword" placeholder="搜索文档标题" clearable @enter="applyDocumentFilters" /><t-button variant="outline" @click="applyDocumentFilters">搜索</t-button></div>
    <div class="wiki-layout">
      <aside class="wiki-list"><div class="wiki-list__head"><strong>文档目录</strong><span>共 {{ documentTotal }} 篇</span></div><div v-if="loading" class="wiki-empty">加载中…</div><button v-for="item in orderedDocuments" :key="item.document.id" class="wiki-list-item" :class="{ active: selected?.id === item.document.id }" :style="{ paddingLeft: `${10 + item.depth * 16}px` }" @click="selectDocument(item.document.id)"><strong>{{ item.depth ? '↳ ' : '' }}{{ item.document.title }}</strong><small>{{ knowledgeCategoryLabel(item.document.knowledgeCategory) }} · 修订 {{ item.document.revisionNo }}</small><small v-if="isFdeArea && item.hiddenParent && hiddenParentCategories[item.document.parentId!] && hiddenParentCategories[item.document.parentId!] !== 'FDE_WIKI'">原属其他分类父 Wiki</small></button><div v-if="!loading && !documents.length" class="wiki-empty">暂无可见文档</div><div v-if="documentTotalPages > 1" class="wiki-pagination"><t-button size="small" variant="outline" :disabled="loading || documentPage === 0" @click="changeDocumentPage(documentPage)">上一页</t-button><span>第 {{ documentPage + 1 }} / {{ documentTotalPages }} 页</span><t-button size="small" variant="outline" :disabled="loading || documentPage + 1 >= documentTotalPages" @click="changeDocumentPage(documentPage + 2)">下一页</t-button></div></aside>
      <main class="wiki-reader">
        <template v-if="editing"><div class="editor-heading"><div><t-input v-model="title" placeholder="文档标题" /></div><div class="editor-actions"><t-button variant="outline" @click="editing = false">取消</t-button><t-button theme="primary" :loading="saving || suggestingCategory" @click="save">保存</t-button></div></div><div class="editor-fields"><label v-if="!selected" class="wiki-field"><span>所属团队</span><t-select v-model="selectedTeamSelection" filterable :options="createTeamOptions" placeholder="所属团队" @search="searchTeams" @change="changeCreateTeam" /></label><label class="wiki-field"><span>知识分类</span><t-select v-model="knowledgeCategory" :options="knowledgeCategoryOptions" placeholder="未选择，保存时获取 AI 推荐" /><small v-if="isFdeArea && knowledgeCategory !== 'FDE_WIKI'" class="wiki-category-warning">保存后文档将离开 FDE 专区，可在全部 Wiki 中找到。</small></label><label class="wiki-field"><span>关联 Skill（选填）</span><t-select v-model="selectedSkillIds" multiple filterable :loading="skillLoading" :options="skillOptions" placeholder="可不选择，保存为独立 Wiki" @search="searchSkills" /></label><label class="wiki-field"><span>父 Wiki（可选）</span><t-select v-model="parentId" clearable filterable :options="parentOptions" placeholder="选择父 Wiki" @search="loadParents" /></label></div><div class="upload-row"><t-button variant="outline" @click="fileInput?.click()">导入 .md 文件</t-button><input ref="fileInput" type="file" accept=".md,text/markdown" hidden @change="onFileChange" /><span>仅支持 UTF-8 Markdown，正文最大 1 MiB</span></div><t-textarea v-model="content" :autosize="{ minRows: 22, maxRows: 40 }" placeholder="输入 Markdown 内容" /></template>
        <template v-else-if="selected"><div class="reader-heading"><div><h2>{{ selected.title }}</h2><p>{{ knowledgeCategoryLabel(selected.knowledgeCategory) }} · 修订 {{ selected.revisionNo }} · {{ selectedIsPlatformSnapshot ? '平台批准版本' : selected.platformVisible ? '全公司可见' : '团队内部可见' }}<span v-if="selected.pendingPlatformReviewId" class="pending-review-badge">平台审核中</span></p></div><div class="reader-actions"><t-button variant="outline" @click="downloadMarkdown(selected)">下载 Markdown</t-button><t-button v-if="selected.canEdit && selected.teamId !== null && !selectedIsPlatformSnapshot && !selected.pendingPlatformReviewId && publicationUpToDate === false" theme="primary" variant="outline" @click="openPromotionDialog">{{ canDirectPublish ? '直接推送全平台' : '推送到全平台' }}</t-button><t-button v-if="selected.canEdit" theme="primary" variant="outline" @click="beginEdit">编辑文档</t-button><t-button v-if="selected.canArchive" theme="danger" variant="outline" :loading="saving" @click="archiveSelected">下架文档</t-button></div></div><div v-if="selected.skills.length" class="reader-links"><RouterLink v-for="skill in selected.skills" :key="skill.id" :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }">{{ skill.displayName }}</RouterLink></div><p v-else-if="selected.teamId" class="independent-document">独立团队知识文档</p><MarkdownView :content="selected.markdownContent" class="markdown-content" /><section v-if="selected.canEdit && !selectedIsPlatformSnapshot" class="revision-panel"><div class="revision-heading"><strong>修订历史</strong><span>{{ revisions.length }} 个修订</span></div><div v-for="revision in revisions" :key="revision.id" class="revision-row"><span>修订 {{ revision.revisionNo }} · {{ revision.createdByName }}</span><time>{{ new Date(revision.createdAt).toLocaleString() }}</time><t-button v-if="revision.revisionNo !== selected.revisionNo" size="small" variant="text" @click="restore(revision)">恢复</t-button></div></section></template>
        <div v-else class="wiki-empty wiki-empty--large">选择左侧文档开始阅读</div>
      </main>
    </div>
    <div v-if="showPromotionDialog" class="promotion-mask"><div class="promotion-dialog" role="dialog" aria-modal="true"><h2>推送到全平台</h2><p>本次将{{ canDirectPublish ? '直接公开' : '提交审核' }} {{ promotionPreview?.wikiCount }} 篇 Wiki 和 {{ promotionPreview?.skillCount }} 个关联 Skill，其中 {{ promotionPreview?.teamSkillsToPromote }} 个团队 Skill 会连带公开。所有分类的子 Wiki 都会一起发布。</p><div v-if="promotionPreview?.wikiItems.length" class="promotion-linked-skills"><span>完整子树：</span><strong v-for="item in promotionPreview.wikiItems" :key="item.documentId">{{ item.title }}（{{ knowledgeCategoryLabel(item.knowledgeCategory as WikiKnowledgeCategory) }}）</strong></div><div v-if="promotionPreview?.skillItems.length" class="promotion-linked-skills"><span>关联 Skill：</span><strong v-for="skill in promotionPreview.skillItems" :key="skill.skillId">{{ skill.displayName }}</strong></div><textarea v-model="promotionComment" rows="5" placeholder="请填写推送理由（必填）"></textarea><div class="promotion-actions"><t-button variant="outline" :disabled="promoting" @click="showPromotionDialog = false">取消</t-button><t-button v-if="canDirectPublish" theme="primary" :loading="promoting" :disabled="!promotionComment.trim()" @click="submitDirectPublication">确认直接发布</t-button><t-button v-else theme="primary" :loading="promoting" :disabled="!promotionComment.trim()" @click="submitPromotion">提交审核</t-button></div></div></div>
    <div v-if="showBatchDialog" class="promotion-mask"><div class="promotion-dialog" role="dialog" aria-modal="true" aria-label="批量 AI 分类预检"><h2>批量 AI 分类</h2><p>待处理“其他”：{{ batchPreview?.pendingCount }} 篇；已确认“其他”：{{ batchPreview?.confirmedOtherCount }} 篇</p><p>预计最大模型调用：{{ includeConfirmedOther ? (batchPreview?.pendingCount ?? 0) + (batchPreview?.confirmedOtherCount ?? 0) : batchPreview?.estimatedMaxCalls }} 次</p><p v-if="batchPreview?.activeBatchId">当前运行批次：{{ batchPreview.activeBatchId }}</p><label><input v-model="includeConfirmedOther" type="checkbox"> 重新评估已确认“其他”</label><p>扫描不会修改 Wiki 分类；建议需在审核工作台人工确认。</p><div class="promotion-actions"><t-button variant="outline" @click="showBatchDialog = false">取消</t-button><t-button theme="primary" :loading="startingBatch" :disabled="!!batchPreview?.activeBatchId" @click="startBatch">开始扫描</t-button></div></div></div>
    <div v-if="showSuggestionDialog" class="promotion-mask"><div class="promotion-dialog" role="dialog" aria-modal="true" aria-label="知识分类建议"><h2>确认知识分类</h2><template v-if="categorySuggestion"><p>{{ categorySuggestion.model === 'rule:asdm' ? '规则推荐' : 'AI 推荐' }}：<strong>{{ knowledgeCategoryLabel(categorySuggestion.recommendedCategory) }}</strong><span v-if="categorySuggestion.confidence !== null">（模型概率 {{ Math.round(categorySuggestion.confidence * 100) }}%）</span></p><p v-if="categorySuggestion.model === 'rule:asdm'">ASDM 属于工具，按分类规则推荐为“Skill 与工具”。</p><p v-if="categorySuggestion.lowContext">文档内容较少，请重点核对分类。</p><p>模型概率仅供参考，最终分类由你确认。</p></template><p v-else>{{ categorySuggestionError || 'AI 推荐暂不可用，请自行选择分类。' }}</p><div class="promotion-actions"><t-button variant="outline" @click="showSuggestionDialog = false">自行选择</t-button><t-button v-if="categorySuggestion" theme="primary" @click="useSuggestedCategory">采用推荐</t-button></div></div></div>
  </div>
</template>

<style scoped>
.wiki-page{width:100%;max-width:var(--page-max-width);margin:0 auto;color:var(--text-1)}.wiki-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.wiki-heading h1{margin:0;font-size:var(--font-page-title)}.wiki-heading p:not(.eyebrow){margin:0;color:var(--text-2);font-size:13px}.wiki-alert{margin:18px 0;padding:10px 13px;border:1px solid color-mix(in srgb, var(--error) 30%, transparent);border-radius:var(--radius-sm);color:var(--error);background:var(--error-soft);font-size:var(--font-body)}.wiki-toolbar{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.wiki-toolbar :deep(.t-select__wrap){width:220px;min-width:0}.wiki-toolbar :deep(.t-input__wrap){flex:1 1 240px;min-width:0;max-width:420px}.wiki-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px;min-height:570px}.wiki-list,.wiki-reader{border:1px solid var(--border-1);border-radius:12px;background:var(--surface-1);backdrop-filter:blur(12px)}.wiki-list{padding:12px}.wiki-list__head,.revision-heading,.reader-heading,.editor-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}.wiki-list__head{padding:8px 8px 14px;border-bottom:1px solid var(--border-1)}.wiki-list__head span,.revision-heading span{color:var(--text-3);font-size:12px}.wiki-list-item{display:grid;width:100%;gap:5px;margin-top:6px;padding:12px 10px;border:0;border-radius:8px;color:var(--text-2);background:transparent;text-align:left;cursor:pointer}.wiki-list-item:hover,.wiki-list-item.active{color:var(--accent-400);background:var(--accent-softer)}.wiki-list-item small{color:var(--text-3)}.wiki-empty{padding:30px 10px;color:var(--text-3);font-size:13px;text-align:center}.wiki-empty--large{padding-top:220px}.wiki-reader{padding:var(--card-padding)}.reader-heading h2{margin:5px 0;font-size:20px}.reader-heading p{margin:5px 0;color:var(--text-3);font-size:12px}.reader-actions{display:flex;gap:8px;flex-wrap:wrap}.pending-review-badge{display:inline-flex;align-items:center;margin-left:8px;padding:1px 7px;border:1px solid color-mix(in srgb, var(--warning) 30%, transparent);border-radius:var(--radius-full);color:var(--warning);background:var(--warning-soft);font-size:var(--font-meta);line-height:1.6}.reader-links{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.reader-links a{padding:5px 9px;border-radius:5px;color:var(--accent-400);background:var(--accent-softer);font-size:12px;text-decoration:none}.independent-document{margin:18px 0 10px;color:var(--text-3);font-size:12px}.markdown-content{min-height:280px;margin:0;padding:20px;border-radius:8px;color:var(--text-1);background:var(--surface-2);overflow:auto}.revision-panel{margin-top:24px;padding-top:18px;border-top:1px solid var(--border-1)}.revision-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-1);color:var(--text-2);font-size:12px}.revision-row time{margin-right:auto;color:var(--text-3)}.editor-heading{margin-bottom:16px}.editor-heading :deep(.t-input__wrap){width:420px}.editor-actions{display:flex;gap:8px}.editor-fields{display:flex;gap:10px;margin-bottom:14px;align-items:flex-end;flex-wrap:wrap}.wiki-field{display:grid;gap:5px;color:var(--text-2);font-size:12px}.editor-fields :deep(.t-select__wrap){min-width:200px}.upload-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;color:var(--text-3);font-size:12px}.promotion-mask{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:var(--mask-bg);backdrop-filter:blur(4px)}.promotion-dialog{width:min(100%,520px);padding:var(--card-padding);border:1px solid var(--border-1);border-radius:var(--card-radius);background:var(--surface-overlay-solid);box-shadow:var(--shadow-xl)}.promotion-dialog h2{margin:0 0 8px}.promotion-dialog p{margin:0 0 16px;color:var(--text-2);font-size:13px;line-height:1.6}.promotion-dialog textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--border-1);border-radius:8px;resize:vertical}.promotion-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}@media(max-width:800px){.wiki-page{width:100%}.wiki-layout{grid-template-columns:1fr}.wiki-toolbar{flex-wrap:wrap}.wiki-toolbar :deep(.t-input__wrap),.wiki-toolbar :deep(.t-select__wrap){width:100%}.editor-heading :deep(.t-input__wrap){width:100%}.editor-heading{align-items:stretch;flex-direction:column}.editor-fields{flex-direction:column}}
.wiki-heading__actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}
.wiki-rebuild-notice{margin:18px 0;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.5}
.wiki-rebuild-notice--success{color:var(--success);background:var(--success-soft)}
.wiki-rebuild-notice--warning{color:var(--warning);background:var(--warning-soft)}
.wiki-rebuild-notice--error{color:var(--error);background:var(--error-soft)}
.wiki-pagination{display:flex;align-items:center;justify-content:space-between;gap:4px;min-width:0;margin-top:14px;padding:0 2px}.wiki-pagination span{white-space:nowrap;font-size:12px;color:var(--text-3)}.wiki-pagination :deep(.t-button){min-width:0;flex-shrink:1}
@media(max-width:800px){.wiki-heading{flex-wrap:wrap}.wiki-heading__actions{justify-content:flex-start}}

.external-import-choice{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px;margin:12px 0;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-1)}
.external-import-choice strong,.external-import-choice p{width:100%;margin:0}
.external-import-choice label{display:flex;align-items:center;gap:6px;cursor:pointer}
.external-import-target select{min-width:220px;padding:7px;border:1px solid var(--border-1);border-radius:6px;background:var(--surface-1);color:inherit}
</style>
