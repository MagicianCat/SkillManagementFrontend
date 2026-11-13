<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '../utils/markdown'
import { getSkillCategories } from '../api/skills.api'
import { getWikiDocuments, searchWikiTeams } from '../api/wiki.api'
import type { SkillCategory, WikiTeam } from '../types/skill'
import {
  downloadExternalZip, getExternalDocument,
  getExternalImportJob, importExternalSkill, listExternalDocuments, listExternalImports, listExternalResources,
  listExternalRoles, listExternalVersions, prepareExternalSkill, startBulkSkillImport, startBulkWikiImport, getAsdmToolStatus, importAsdmTool, refreshAsdmToolLink, listAsdmCommands,
  type DocumentEntry, type ExternalImport, type ExternalResource,
  type ExternalRole, type ExternalVersion, type SkillPreparation, type ExternalImportJob, type AsdmToolStatus, type AsdmToolImportResult, type AsdmCommand,
} from '../api/external-resources.api'

const router = useRouter()
const route = useRoute()
const roles = ref<ExternalRole[]>([])
const resources = ref<ExternalResource[]>([])
const versions = ref<ExternalVersion[]>([])
const imports = ref<ExternalImport[]>([])
const asdmStatus = ref<AsdmToolStatus | null>(null)
const asdmResult = ref<AsdmToolImportResult | null>(null)
const asdmCommands = ref<AsdmCommand[]>([])
const asdmCommandsLoaded = ref(false)
const asdmSyncOnly = computed(() => Boolean(
  asdmStatus.value?.imported && asdmStatus.value?.wikiActive
  && ['OUTDATED', 'PENDING'].includes(asdmStatus.value?.commandMappingStatus ?? ''),
))
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
const bulkWikiTeamId = ref<number | null>(null)
const bulkParentWikiId = ref<number | null>(null)
const bulkParentOptions = ref<Array<{ label: string; value: number }>>([])
let bulkParentSearchTimer: ReturnType<typeof setTimeout> | undefined
let bulkParentSearchId = 0
const linkRoleSkills = ref(true)
const bulkBusy = ref(false)
const skillChoices = ref<ExternalResource[]>([])
const selectedSkillIds = ref<number[]>([])
const skillChoicesLoading = ref(false)
let skillChoiceLoadId = 0
const wikiChoices = ref<ExternalResource[]>([])
const selectedWikiZipIds = ref<number[]>([])
const wikiEntries = ref<Record<number, DocumentEntry[]>>({})
const selectedWikiPaths = ref<Record<number, string[]>>({})
const wikiChoicesLoading = ref(false)
const wikiZipLoading = ref<number[]>([])
let wikiChoiceLoadId = 0
const selectedWikiDocumentCount = computed(() => selectedWikiZipIds.value.reduce((total, id) => total + (selectedWikiPaths.value[id]?.length || 0), 0))
const bulkJob = ref<ExternalImportJob | null>(null)
const bulkRunning = computed(() => bulkJob.value?.job.roleId === roleId.value && ['PENDING', 'RUNNING'].includes(bulkJob.value.job.status))
let bulkJobTimer: ReturnType<typeof setTimeout> | undefined
let activeBulkJobId = 0
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

function bulkStatusText(status: string) { return ({ PENDING: '排队中', RUNNING: '导入中', SUCCEEDED: '已完成', FAILED: '失败', PARTIAL: '部分完成', CANCELLED: '已取消' } as Record<string, string>)[status] ?? status }
function mappingStatusText(status: string | null | undefined) {
  return ({ NOT_PROVIDED: '未提供工具集分类', PENDING: '待同步', SYNCED: '已同步', OUTDATED: '待同步（元数据已变化）', FAILED: '同步失败' } as Record<string, string>)[status ?? ''] ?? status ?? ''
}
function message(e: unknown) {
  const err = e as { response?: { data?: { message?: string } }; message?: string }
  return err.response?.data?.message || err.message || '操作失败'
}
async function load() {
  error.value = ''
  try {
    const previousRoleId = roleId.value
    roles.value = await listExternalRoles()
    categories.value = await getSkillCategories()
    searchTeams()
    if (!roleId.value && roles.value.length) roleId.value = roles.value[0]!.id
    await loadResources()
    if (previousRoleId === roleId.value) await Promise.all([loadSkillChoices(), loadWikiChoices()])
  } catch (e) { error.value = message(e) }
}
async function loadResources() {
  if (!roleId.value) return
  try { resources.value = await listExternalResources(roleId.value, type.value || undefined, keyword.value || undefined, page.value) }
  catch (e) { error.value = message(e) }
}
async function loadSkillChoices() {
  const requestId = ++skillChoiceLoadId
  const currentRoleId = roleId.value
  skillChoices.value = []
  selectedSkillIds.value = []
  if (!currentRoleId) return
  skillChoicesLoading.value = true
  try {
    const all: ExternalResource[] = []
    for (let pageIndex = 0; ; pageIndex++) {
      const batch = await listExternalResources(currentRoleId, 'SKILL', undefined, pageIndex, 100)
      if (requestId !== skillChoiceLoadId) return
      all.push(...batch.filter((item) => item.currentVersionId))
      if (batch.length < 100) break
    }
    skillChoices.value = all
    selectedSkillIds.value = all.map((item) => item.id)
  } catch (e) { if (requestId === skillChoiceLoadId) error.value = message(e) }
  finally { if (requestId === skillChoiceLoadId) skillChoicesLoading.value = false }
}
async function loadWikiChoices() {
  const requestId = ++wikiChoiceLoadId
  const currentRoleId = roleId.value
  wikiChoices.value = []
  selectedWikiZipIds.value = []
  wikiEntries.value = {}
  selectedWikiPaths.value = {}
  wikiZipLoading.value = []
  if (!currentRoleId) return
  wikiChoicesLoading.value = true
  try {
    const all: ExternalResource[] = []
    for (let pageIndex = 0; ; pageIndex++) {
      const batch = await listExternalResources(currentRoleId, 'DOCUMENT', undefined, pageIndex, 100)
      if (requestId !== wikiChoiceLoadId) return
      all.push(...batch.filter((item) => item.currentVersionId))
      if (batch.length < 100) break
    }
    wikiChoices.value = all
  } catch (e) { if (requestId === wikiChoiceLoadId) error.value = message(e) }
  finally { if (requestId === wikiChoiceLoadId) wikiChoicesLoading.value = false }
}
async function toggleWikiZip(item: ExternalResource) {
  if (selectedWikiZipIds.value.includes(item.id)) {
    selectedWikiZipIds.value = selectedWikiZipIds.value.filter((id) => id !== item.id)
    delete selectedWikiPaths.value[item.id]
    return
  }
  selectedWikiZipIds.value.push(item.id)
  if (wikiEntries.value[item.id]) {
    selectedWikiPaths.value[item.id] = wikiEntries.value[item.id]!.map((entry) => entry.path)
    return
  }
  const requestId = wikiChoiceLoadId
  wikiZipLoading.value.push(item.id)
  try {
    const documents = await listExternalDocuments(item.currentVersionId)
    if (requestId !== wikiChoiceLoadId || !selectedWikiZipIds.value.includes(item.id)) return
    wikiEntries.value[item.id] = documents
    selectedWikiPaths.value[item.id] = documents.map((entry) => entry.path)
  } catch (e) {
    if (requestId === wikiChoiceLoadId) {
      selectedWikiZipIds.value = selectedWikiZipIds.value.filter((id) => id !== item.id)
      error.value = message(e)
    }
  } finally { wikiZipLoading.value = wikiZipLoading.value.filter((id) => id !== item.id) }
}
function searchResources() { page.value = 0; void loadResources() }
function movePage(offset: number) { page.value += offset; void loadResources() }
function syncVersionCategory(id: number) {
  const subStageKey = versions.value.find((version) => version.id === id)?.subStageKey
  categoryId.value = categories.value.find((category) => category.key === subStageKey && category.selectable)?.id ?? null
}
async function selectResource(item: ExternalResource) {
  selected.value = item; versionId.value = item.currentVersionId
  asdmStatus.value = null; asdmResult.value = null
  asdmCommands.value = []; asdmCommandsLoaded.value = false
  preparation.value = null; entries.value = []; preview.value = ''; teamId.value = null; categoryId.value = null
  try { versions.value = await listExternalVersions(item.id); await selectVersion(item.currentVersionId) }
  catch (e) { error.value = message(e) }
}
async function selectVersion(id: number) {
  versionId.value = id; preparation.value = null; entries.value = []; preview.value = ''
  asdmCommands.value = []; asdmCommandsLoaded.value = false
  syncVersionCategory(id)
  try {
    imports.value = await listExternalImports(id)
    asdmStatus.value = selected.value?.resourceType === 'ASDM-TOOL' ? await getAsdmToolStatus(id) : null
    asdmResult.value = null
  } catch (e) { error.value = message(e) }
}
async function importAsdm() {
  if (!versionId.value || busy.value) return
  const prior = asdmStatus.value
  const updating = Boolean(prior?.wikiDocumentId && prior.wikiActive && !prior.imported)
  if (updating && !confirm('更新平台 Wiki 将替换现有正文并生成新的工具下载链接，确认继续？')) return
  busy.value = true; error.value = ''
  try {
    asdmResult.value = await importAsdmTool(versionId.value, { confirmUpdate: updating, expectedWikiVersionNo: updating ? prior?.wikiVersionNo ?? null : null })
    asdmStatus.value = await getAsdmToolStatus(versionId.value)
    imports.value = await listExternalImports(versionId.value)
    if (asdmCommandsLoaded.value) await loadAsdmCommands()
  } catch (e) { error.value = message(e) }
  finally { busy.value = false }
}
async function refreshAsdmLink() {
  if (!versionId.value || busy.value || !confirm('重新生成 Wiki 中的工具包下载链接？')) return
  busy.value = true; error.value = ''
  try {
    asdmResult.value = await refreshAsdmToolLink(versionId.value)
    asdmStatus.value = await getAsdmToolStatus(versionId.value)
  } catch (e) { error.value = message(e) }
  finally { busy.value = false }
}
async function loadAsdmCommands() {
  if (!versionId.value) return
  busy.value = true; error.value = ''
  try {
    asdmCommands.value = await listAsdmCommands(versionId.value)
    asdmCommandsLoaded.value = true
  } catch (e) { error.value = message(e) }
  finally { busy.value = false }
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
    if (preparation.value.exists && !confirm('同 Key 已存在。确认用此次 ZIP 和元数据更新该 Skill 的当前草稿？')) return
    const reimport = imports.value.some((row) => row.targetType === 'SKILL' && row.result === 'SUCCESS')
    if (reimport && !confirm('该原始版本已导入过。确认再次导入并更新当前草稿？不会覆盖已发布版本。')) return
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
function loadBulkParents(keyword = '') {
  if (bulkParentSearchTimer) clearTimeout(bulkParentSearchTimer)
  const searchId = ++bulkParentSearchId
  const query = keyword.trim()
  bulkParentOptions.value = []
  if (!query) return
  bulkParentSearchTimer = setTimeout(async () => {
    try {
      const page = await getWikiDocuments({ teamId: bulkWikiTeamId.value ?? undefined, keyword: query, size: 100 })
      if (searchId !== bulkParentSearchId) return
      bulkParentOptions.value = page.items.filter((item) => bulkWikiTeamId.value === null ? item.platformVisible : item.teamId === bulkWikiTeamId.value).map((item) => ({ label: item.title, value: item.id }))
    } catch (e) { if (searchId === bulkParentSearchId) error.value = message(e) }
  }, 300)
}
async function refreshBulkJob(id: number) {
  if (bulkJobTimer) clearTimeout(bulkJobTimer)
  activeBulkJobId = id
  try {
    bulkJob.value = await getExternalImportJob(id)
    if (bulkJob.value.job.status === 'PENDING' || bulkJob.value.job.status === 'RUNNING') {
      bulkJobTimer = setTimeout(() => { void refreshBulkJob(id) }, 3000)
    }
  } catch (e) { error.value = message(e) }
}
async function startBulk(kind: 'SKILL' | 'DOCUMENT') {
  if (!roleId.value) return
  if (kind === 'SKILL' && selectedSkillIds.value.length === 0) { error.value = '请至少选择一个 Skill'; return }
  
  if (kind === 'DOCUMENT' && (wikiZipLoading.value.length > 0 || selectedWikiDocumentCount.value === 0)) { error.value = '请先在 ZIP 中选择要导入的文档'; return }
  bulkBusy.value = true; error.value = ''
  try {
    const result = kind === 'SKILL'
      ? await startBulkSkillImport(roleId.value, selectedSkillIds.value)
      : await startBulkWikiImport(roleId.value, {
        teamId: bulkWikiTeamId.value, parentWikiId: bulkParentWikiId.value, linkRoleSkills: linkRoleSkills.value,
        selections: selectedWikiZipIds.value.filter((id) => (selectedWikiPaths.value[id]?.length || 0) > 0)
          .map((id) => ({ resourceId: id, paths: selectedWikiPaths.value[id]! })),
      })
    if (bulkJobTimer) clearTimeout(bulkJobTimer)
    activeBulkJobId = result.jobId
    await router.replace({ query: { ...route.query, jobId: String(result.jobId) } })
    await refreshBulkJob(result.jobId)
  } catch (e) { error.value = message(e) }
  finally { bulkBusy.value = false }
}
watch(bulkWikiTeamId, () => { bulkParentWikiId.value = null; loadBulkParents() })
onUnmounted(() => { if (bulkJobTimer) clearTimeout(bulkJobTimer); if (bulkParentSearchTimer) clearTimeout(bulkParentSearchTimer) })
watch([roleId, type], () => { selected.value = null; page.value = 0; void loadResources() })
watch(roleId, () => { void loadSkillChoices(); void loadWikiChoices() })
onMounted(() => { void load(); const id = Number(route.query.jobId); if (Number.isSafeInteger(id) && id > 0) void refreshBulkJob(id) })
watch(() => route.query.jobId, (value) => { const id = Number(value); if (Number.isSafeInteger(id) && id > 0 && activeBulkJobId !== id) void refreshBulkJob(id) })
</script>

<template>
  <main class="external-page">
    <header><div><p class="eyebrow">SYSTEM MANAGEMENT</p><h1>外部资源接入</h1><p>按角色批量导入 Skill 与 Wiki，完成后进入审核中心。</p></div><button @click="load">刷新</button></header>
    <p v-if="error" class="alert">{{ error }}</p>
    <div class="layout">
      <aside class="panel"><h2>来源与角色</h2><button v-for="role in roles" :key="role.id" class="role" :class="{ active: roleId === role.id }" @click="roleId = role.id"><small>{{ role.sourceSystem }}</small><span class="role-heading"><strong>{{ role.roleName }}</strong><span class="role-status" :class="role.status === 'ACTIVE' ? 'role-status--active' : 'role-status--inactive'">{{ role.status === 'ACTIVE' ? '启用 · ACTIVE' : '停用 · INACTIVE' }}</span></span><small>{{ role.externalRoleId }}</small></button><p v-if="!roles.length">暂无外部资源</p><div v-if="roleId" class="bulk-controls"><h3>按角色批量导入</h3><div class="skill-selection"><div class="skill-selection-heading"><strong>选择要导入的 Skill（{{ selectedSkillIds.length }}/{{ skillChoices.length }}）</strong><div><button :disabled="skillChoicesLoading" @click="selectedSkillIds = skillChoices.map((item) => item.id)">全选</button><button :disabled="skillChoicesLoading" @click="selectedSkillIds = []">清空</button></div></div><p v-if="skillChoicesLoading">正在加载当前角色的 Skill…</p><p v-else-if="!skillChoices.length">当前角色没有可导入的 Skill</p><div v-else class="skill-selection-list"><label v-for="item in skillChoices" :key="item.id" class="bulk-checkbox"><input v-model="selectedSkillIds" type="checkbox" :value="item.id"><span>{{ item.name }}</span></label></div></div><button class="btn-primary" :disabled="bulkBusy || bulkRunning || skillChoicesLoading || !selectedSkillIds.length" @click="startBulk('SKILL')">导入选中的 {{ selectedSkillIds.length }} 个 Skill 并提交审核</button><div class="wiki-selection"><strong>选择文档 ZIP（{{ selectedWikiZipIds.length }}/{{ wikiChoices.length }}）</strong><p v-if="wikiChoicesLoading">正在加载当前角色的文档 ZIP…</p><p v-else-if="!wikiChoices.length">当前角色没有可导入的文档 ZIP</p><div v-else class="wiki-selection-list"><div v-for="item in wikiChoices" :key="item.id" class="wiki-zip"><label class="bulk-checkbox"><input type="checkbox" :checked="selectedWikiZipIds.includes(item.id)" @change="toggleWikiZip(item)"><span>{{ item.name }}</span></label><p v-if="wikiZipLoading.includes(item.id)">正在读取 ZIP 内文档…</p><div v-else-if="selectedWikiZipIds.includes(item.id)" class="wiki-document-list"><p v-if="!wikiEntries[item.id]?.length">ZIP 中没有 Markdown 文档</p><template v-else><div class="skill-selection-heading"><small>选中 {{ selectedWikiPaths[item.id]?.length || 0 }}/{{ wikiEntries[item.id]?.length }} 篇</small><div><button @click="selectedWikiPaths[item.id] = wikiEntries[item.id]!.map((entry) => entry.path)">全选</button><button @click="selectedWikiPaths[item.id] = []">清空</button></div></div><label v-for="entry in wikiEntries[item.id]" :key="entry.path" class="bulk-checkbox"><input v-model="selectedWikiPaths[item.id]" type="checkbox" :value="entry.path"><span>{{ entry.path }}</span></label></template></div></div></div><small>共选中 {{ selectedWikiDocumentCount }} 篇文档</small></div><label>Wiki 发布范围 <t-select v-model="bulkWikiTeamId" filterable clearable :loading="teamLoading" :options="[{ label: '平台级 Wiki', value: null }, ...teamOptions.filter((option) => option.value !== null)]" placeholder="平台级 Wiki 或选择团队" @search="searchTeams" /></label><label>父 Wiki（可选） <t-select v-model="bulkParentWikiId" filterable clearable :options="bulkParentOptions" placeholder="输入父 Wiki 名称搜索；不选则放在根目录" @search="loadBulkParents" /></label><label class="bulk-checkbox"><input v-model="linkRoleSkills" type="checkbox">关联当前角色已推送的全部 Skill</label><button class="btn-primary" :disabled="bulkBusy || bulkRunning || wikiChoicesLoading || wikiZipLoading.length > 0 || !selectedWikiDocumentCount" @click="startBulk('DOCUMENT')">导入选中的 {{ selectedWikiDocumentCount }} 篇 Wiki 并提交审核</button><p v-if="bulkJob">任务 {{ bulkJob.job.id }}：{{ bulkStatusText(bulkJob.job.status) }}，成功 {{ bulkJob.job.successCount }}，失败 {{ bulkJob.job.failureCount }}</p><p v-for="(item, index) in bulkJob?.items.filter((row) => row.status === 'FAILED')" :key="index" class="alert">{{ item.entryPath || `资源 ${item.resourceId}` }}：{{ item.errorCode }} {{ item.errorMessage }}</p></div></aside>
      <section class="panel"><h2>资源</h2><div class="filters"><input v-model="keyword" placeholder="搜索名称或外部 ID" @keyup.enter="searchResources"><select v-model="type"><option value="">全部类型</option><option value="SKILL">Skill</option><option value="DOCUMENT">文档 ZIP</option><option value="ASDM-TOOL">ASDM 工具</option></select><button @click="searchResources">搜索</button></div><button v-for="item in resources" :key="item.id" class="resource" :class="{ active: selected?.id === item.id }" @click="selectResource(item)"><span class="badge">{{ item.resourceType }}</span><strong>{{ item.name }}</strong><small>版本 {{ item.externalVersion || '未标记' }} · {{ Math.ceil((item.sizeBytes || 0) / 1024) }} KB</small></button><p v-if="!resources.length">当前角色暂无资源</p><div class="filters"><button :disabled="page === 0" @click="movePage(-1)">上一页</button><span>第 {{ page + 1 }} 页</span><button :disabled="resources.length < 50" @click="movePage(1)">下一页</button></div></section>
      <section class="panel details"><template v-if="selected"><h2>{{ selected.name }}</h2><p>{{ selected.description }}</p><label>原始版本 <select v-model.number="versionId" @change="versionId && selectVersion(versionId)"><option v-for="v in versions" :key="v.id" :value="v.id">{{ v.externalVersion || '无版本号' }} · {{ v.receivedAt }}</option></select></label><button @click="download">下载原始 ZIP</button>
        <template v-if="selected.resourceType === 'SKILL'"><h3>推送到平台草稿</h3><button :disabled="busy" @click="prepare">解析并校验 ZIP</button><div v-if="preparation" class="form"><p>文件数 {{ preparation.fileCount }}；{{ preparation.exists ? '同 Key 已存在' : '尚无同 Key Skill' }}</p><p v-if="preparation.activeDraftVersionId" class="alert">该 Skill 已有草稿；导入将更新此草稿的 ZIP 和元数据。</p><label>Skill Key <input v-model="skillKey" :disabled="Boolean(preparation.skillKey)"></label><label>名称 <input v-model="displayName"></label><label>说明 <textarea v-model="description"></textarea></label><label>研发阶段 <t-cascader v-model="categoryId" :options="categoryOptions" clearable filterable placeholder="请选择具体阶段" /></label><label>归属团队 <t-select v-model="teamId" filterable clearable :loading="teamLoading" :options="[{ label: '平台 Skill', value: null }, ...teamOptions.filter((option) => option.value !== null)]" placeholder="平台 Skill 或搜索团队" @search="searchTeams" /></label><button class="btn-primary" :disabled="busy" @click="importSkill">确认导入草稿</button></div></template>
        <template v-else-if="selected.resourceType === 'ASDM-TOOL'"><h3>ASDM 工具包</h3><p>来源：{{ selected.sourceSystem }} · 资源 ID：{{ selected.externalResourceId }}</p><p>原始文件：{{ versions.find((item) => item.id === versionId)?.fileName || '未知' }}</p><p v-if="asdmStatus?.imported && asdmStatus.wikiActive">已导入平台 Wiki #{{ asdmStatus.wikiDocumentId }} · {{ asdmStatus.toolFilename }}</p><p v-else-if="asdmStatus?.imported">原 Wiki #{{ asdmStatus.wikiDocumentId }} 已归档，可重新导入为新文档</p><p v-else-if="asdmStatus?.wikiDocumentId">此资源已有平台 Wiki #{{ asdmStatus.wikiDocumentId }}；当前版本尚未导入</p><p v-if="asdmStatus">工具集分类 {{ asdmStatus.commandMappingCount }} 条 · {{ mappingStatusText(asdmStatus.commandMappingStatus) }}</p><button class="btn-primary" :disabled="busy || !versionId || (asdmStatus?.imported && asdmStatus.wikiActive && !asdmSyncOnly)" @click="importAsdm">{{ asdmSyncOnly ? '同步工具集分类' : asdmStatus?.wikiDocumentId && asdmStatus.wikiActive && !asdmStatus.imported ? '更新平台 Wiki' : '导入为新平台 Wiki' }}</button><div v-if="asdmResult || (asdmStatus?.imported && asdmStatus.wikiActive)" class="form"><RouterLink v-if="asdmStatus?.wikiActive && asdmStatus.wikiDocumentId" :to="{ name: 'wiki', query: { documentId: asdmStatus.wikiDocumentId } }">查看平台 Wiki</RouterLink><RouterLink v-if="asdmStatus?.wikiActive && asdmStatus.assetId" :to="{ name: 'asdm-tool-download', params: { assetId: asdmStatus.assetId } }">下载 ASDM 工具包</RouterLink><button v-if="asdmStatus?.imported && asdmStatus.wikiActive" :disabled="busy" @click="refreshAsdmLink">重建下载链接</button></div><button v-if="asdmStatus?.imported" :disabled="busy" @click="loadAsdmCommands">{{ asdmCommandsLoaded ? '刷新工具集分类' : '查看工具集分类' }}</button><div v-if="asdmCommandsLoaded" class="command-list"><p v-if="!asdmCommands.length">该工具包当前没有工具集分类映射。</p><p v-for="item in asdmCommands" :key="item.id">工具集 {{ item.toolName }} → {{ item.firstCategoryCode }} · {{ item.developmentStage }} · {{ item.status === 'ACTIVE' ? '生效' : '已替代' }}</p></div></template><template v-else><h3>ZIP 内 Markdown</h3><button :disabled="busy" @click="openDocuments">查看文档</button><div v-if="entries.length"><p>导入请使用左侧“按角色批量导入”。</p><div v-for="entry in entries" :key="entry.path" class="entry"><button @click="showDocument(entry.path)">{{ entry.path }}</button></div><div v-if="previewPath"><h4>{{ previewPath }}</h4><details><summary>查看 Markdown 原文</summary><pre>{{ preview }}</pre></details><div class="markdown-body" v-html="safePreview"></div></div></div><p v-else>点击“查看文档”读取 ZIP 中的 Markdown 文件</p></template>
        <h3>导入记录</h3><p v-for="row in imports" :key="row.id">{{ row.createdAt }} · {{ row.targetType }} {{ row.entryPath || '' }} → {{ row.targetId }} · {{ row.result }}</p>
      </template><p v-else>选择资源查看版本、原始 ZIP 和导入操作。</p></section>
    </div>
  </main>
</template>

<style scoped>
.external-page{width:100%;max-width:var(--page-max-width);margin:0 auto;color:var(--text-1)}header{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-5)}h1{margin:0;font-size:var(--font-page-title)}h2{font-size:var(--font-section-title);margin:0 0 16px}h3{margin:var(--space-6) 0 var(--space-3)}.eyebrow{letter-spacing:.14em;color:var(--accent-400);font-size:12px;font-weight:700}.layout{display:grid;grid-template-columns:minmax(190px,1fr) minmax(240px,1.2fr) minmax(360px,2fr);gap:16px}.panel{background:var(--surface-1);border:1px solid var(--border-1);border-radius:var(--card-radius);padding:var(--card-padding);min-height:360px}.role,.resource{display:flex;flex-direction:column;align-items:flex-start;text-align:left;width:100%;margin:8px 0;padding:12px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:transparent;color:inherit;cursor:pointer;gap:4px}.role-heading{display:flex;align-items:center;justify-content:space-between;width:100%;gap:8px}.role-heading strong{min-width:0;overflow-wrap:anywhere}.role-status{flex:none;padding:2px 8px;border-radius:var(--radius-full);font-size:var(--font-meta);font-weight:600}.role-status--active{color:var(--success);background:var(--success-soft)}.role-status--inactive{color:var(--error);background:var(--error-soft)}.active{border-color:var(--border-accent);background:var(--accent-soft)}small{color:var(--text-3)}.badge{font-size:var(--font-meta);color:var(--accent-400);font-weight:700}.filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.filters input{min-width:0;flex:1 1 100%}input,select,textarea{box-sizing:border-box;min-height:var(--control-height);padding:8px 10px;border:1px solid var(--border-2);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-1);font:inherit;font-size:var(--font-body)}button{min-height:var(--control-height);padding:0 12px;border:1px solid var(--border-2);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-2);cursor:pointer;font:inherit;font-size:var(--font-meta);font-weight:600;transition:border-color var(--duration-fast) var(--ease-out),background var(--duration-fast) var(--ease-out),color var(--duration-fast) var(--ease-out)}button:hover:not(:disabled){border-color:var(--border-accent);color:var(--accent-300);background:var(--surface-3)}button:disabled{opacity:.5;cursor:not-allowed}.bulk-controls{display:grid;gap:10px;margin-top:20px;border-top:1px solid var(--border-1);padding-top:14px}.bulk-controls label{display:grid;gap:6px}.bulk-controls .bulk-checkbox{display:flex;align-items:center;font-size:13px}.form{display:grid;gap:12px;margin-top:14px}.form label,.details>label{display:grid;gap:6px}.entry{display:flex;align-items:center;gap:8px;margin:7px 0}.entry button{border:0;background:transparent;text-align:left;padding:3px}.alert{padding:10px 12px;background:var(--error-soft);color:var(--error);border-radius:var(--radius-sm);font-size:var(--font-meta)}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:250px;overflow:auto}.details{overflow-wrap:anywhere}@media(max-width:1000px){.layout{grid-template-columns:1fr}.panel{min-height:auto}}
.skill-selection{border:1px solid var(--border-1);border-radius:var(--radius-sm);padding:10px}.skill-selection-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}.skill-selection-heading div{display:flex;gap:4px}.skill-selection-heading button{padding:4px 6px}.skill-selection-list{max-height:260px;overflow:auto;margin-top:8px}.skill-selection-list label{padding:5px 0;overflow-wrap:anywhere}.skill-selection-list input{flex:none}
.wiki-selection{border:1px solid var(--border-1);border-radius:var(--radius-sm);padding:10px;font-size:var(--font-body)}.wiki-selection-list{max-height:320px;overflow:auto;margin-top:8px}.wiki-zip{padding:8px 0;border-top:1px solid var(--border-1)}.wiki-zip label{overflow-wrap:anywhere}.wiki-document-list{padding:6px 0 4px 18px}.wiki-document-list label{padding:4px 0}.wiki-document-list input{flex:none}
.command-list{max-height:260px;overflow:auto;font-size:var(--font-meta)}.command-list p{margin:6px 0;overflow-wrap:anywhere}
</style>
