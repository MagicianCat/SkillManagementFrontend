<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listAgentLibrary, listTeamPresets, getProjectAgentNode, saveProjectAgentNodeDraft, getProjectAgentContexts, saveProjectAgentContexts, appendProjectAgentContexts, reviseProjectAgentConfiguration, resolveProjectFeishuWiki } from '../api/agent-library.api'
import { getCurrentWorkflowRun, startWorkflowRun } from '../api/workflow.api'
import { getWikiDocuments } from '../api/wiki.api'
import { searchDocumentAgentFeishu } from '../api/document-agent.api'
import { getSkills, getSkillCategories } from '../api/skills.api'
import { MessagePlugin } from 'tdesign-vue-next'
import { Button as TButton, Tag as TTag, Select as TSelect, Input as TInput, InputNumber as TInputNumber, Textarea as TTextarea, RadioGroup as TRadioGroup, RadioButton as TRadioButton, Collapse as TCollapse, CollapsePanel as TCollapsePanel, Pagination as TPagination, DialogPlugin } from 'tdesign-vue-next'
import { LockOnIcon, InfoCircleFilledIcon, EditIcon, ChevronRightIcon, AddIcon, CloudUploadIcon, SearchIcon, CodeIcon, FileIcon, SecuredIcon } from 'tdesign-icons-vue-next'
import type { SkillCategory, SkillView } from '../types/skill'
import type { AgentLibraryProfile, AgentTeamBinding, AgentTeamPreset, ProjectAgentContext, ProjectAgentContexts, ProjectAgentNodeDraft } from '../types/agent-library'
import { useProjectSetupStore } from '../stores/projectSetup'
import { getFeishuPublishTarget, updateFeishuPublishTarget, validateFeishuPublishTarget, type FeishuPublishTarget } from '../api/projects.api'

const route = useRoute(); const router = useRouter(); const setup = useProjectSetupStore(); const projectKey = String(route.params.projectKey)
const profiles = ref<AgentLibraryProfile[]>([]); const presets = ref<AgentTeamPreset[]>([]); const source = ref<'SYSTEM_PRESET'|'PROJECT_COPY'|'CUSTOM'>('SYSTEM_PRESET'); const selectedPreset = ref<string|number|null>(null); const sourceProjectKey = ref(''); const selectedDraft = ref<ProjectAgentNodeDraft|null>(null); const contexts = ref<ProjectAgentContexts>({ platformWiki: [], feishu: [] }); const initialRequest = ref(''); const wikiQuery = ref(''); const feishuQuery = ref(''); const contextTab = ref<'PLATFORM_WIKI'|'FEISHU'>('PLATFORM_WIKI'); const message = ref(''); const busy = ref(false); const saving = ref(false); const validating = ref(false); const resolvingEntry = ref(true); const feishuResolving = ref(false); const skillQuery = ref(''); const skillResults = ref<SkillView[]>([]); const skillSearching = ref(false)
const workflowStarted = ref(false)
const currentRunId = ref<string|number|null>(null)
const persistedContextKeys = ref(new Set<string>())
/** 阶段折叠面板 value：展开的 stageKey 数组，默认只展开第一个（需求）阶段。（#2） */
const activeStages = ref<string[]>([])
/** Skill 二级细分类（skill.category.parentId != null 为二级），用于按当前阶段预筛。 */
const skillCategories = ref<SkillCategory[]>([])
const selectedNode = computed(() => setup.configuration?.nodes.find(n => `${n.stageKey}/${n.nodeKey}` === setup.selectedNodeKey)); const ready = computed(() => setup.configuration?.status === 'READY'); const draftMode = computed(() => setup.configuration?.status === 'DRAFT' && !workflowStarted.value)
const feishuTarget = ref<FeishuPublishTarget | null>(null); const feishuTargetUrl = ref(''); const feishuTargetBusy = ref(false); const feishuTargetMessage = ref('')
const presetDescription = computed(() => presets.value.find(p => p.versionId === selectedPreset.value)?.description || '')
const groupedNodes = computed(() => {
  const groups = new Map<string, { key: string; label: string; nodes: AgentTeamBinding[] }>()
  for (const node of setup.configuration?.nodes ?? []) {
    const key = String(node.stageKey)
    const existing = groups.get(key)
    if (existing) existing.nodes.push(node)
    else groups.set(key, { key, label: node.stageDisplayName || node.stageName || node.stageKey, nodes: [node] })
  }
  return [...groups.values()]
})
async function loadNode() { if (!selectedNode.value) return; try { selectedDraft.value = await getProjectAgentNode(projectKey, selectedNode.value.stageKey, selectedNode.value.nodeKey) } catch (e) { message.value = e instanceof Error ? e.message : 'Agent 草稿加载失败' } }
function removeSkill(skillKey: string) { if (!selectedDraft.value) return; selectedDraft.value.skills = (selectedDraft.value.skills ?? []).filter(skill => skill.skillKey !== skillKey).map((skill, index) => ({ ...skill, versionPolicy: 'LATEST_PUBLISHED', fixedSkillVersionId: undefined, required: true, sortOrder: index })) }
function selectedSkill(skillKey: string) { return selectedDraft.value?.skills?.some(skill => skill.skillKey === skillKey) ?? false }
async function searchSkills() { skillSearching.value = true; skillSearched.value = true; try { const page = await getSkills({ keyword: skillQuery.value.trim() || undefined, status: 'ACTIVE', page: 0, size: 20, sort: 'skillKey,asc' }); skillResults.value = page.items.filter(skill => Boolean(skill.latestPublishedVersion) && (!skill.scopeType || skill.scopeType === 'PLATFORM')); skillCategoryFilter.value = null; cacheSkillMeta(skillResults.value) } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : 'Skill 搜索失败') } finally { skillSearching.value = false } }
/** Skill 选择器：打开面板即展示当前阶段二级细分类的 Skill（参照团队 Wiki「可见范围」筛选框），输入即全局搜索。 */
const skillPanelOpened = ref(false)
/** 当前 Node 所属阶段命中的二级细分类（SkillCategory.stage === 当前 stageKey）。 */
const stageCategoryIds = computed(() => { const stageKey = String(selectedNode.value?.stageKey ?? '').toUpperCase(); if (!stageKey) return new Set<number>(); return new Set(skillCategories.value.filter(c => String(c.stage).toUpperCase() === stageKey).map(c => c.id)) })
/** Node 角色 → 该角色关心的二级细分类 key（对齐 V37 taxonomy）。
 *  阶段提供粗筛，角色映射在阶段内再精裁：写作者偏内容生产，评审者偏验证与质量。 */
const NODE_ROLE_CATEGORY_KEYS: Record<string, string[]> = {
  clarifier: ['requirement.discovery', 'requirement.analysis', 'requirement.research'],
  analyst: ['requirement.analysis', 'requirement.research', 'requirement.market'],
  writer: ['requirement.analysis', 'requirement.planning'],
  reviewer: ['requirement.analysis'],
}
function nodeRoleKey(nodeKey: string) { const key = nodeKey.toLowerCase(); if (key.includes('clarifier') || key.includes('analyst')) return 'analyst'; if (key.includes('review')) return 'reviewer'; if (key.includes('writ') || key.includes('author')) return 'writer'; return key }
/** 当前 Node 的二级细分类 id：阶段命中后按角色精裁，角色未配置时回退整阶段。 */
const nodeCategoryIds = computed(() => {
  const stageIds = stageCategoryIds.value
  if (!stageIds.size) return stageIds
  const role = nodeRoleKey(String(selectedNode.value?.nodeKey ?? ''))
  const roleKeys = NODE_ROLE_CATEGORY_KEYS[role]
  if (!roleKeys?.length) return stageIds
  const roleIds = new Set(skillCategories.value.filter(c => roleKeys.includes(c.key)).map(c => c.id))
  const intersected = new Set([...stageIds].filter(id => roleIds.has(id)))
  return intersected.size ? intersected : stageIds
})
/** 已挂载 Skill 的元信息（描述/版本/分类），缓存所有加载过的结果，缺失时骨架兜底。 */
const skillMetaCache = ref(new Map<string, SkillView>())
function skillMeta(skillKey: string) { return skillMetaCache.value.get(skillKey) ?? skillResults.value.find(s => s.skillKey === skillKey) ?? null }
function cacheSkillMeta(list: SkillView[]) { const next = new Map(skillMetaCache.value); for (const s of list) next.set(s.skillKey, s); skillMetaCache.value = next }
/** 类别筛选 chips：当前结果池里按二级分类聚合计数。 */
const skillCategoryFilter = ref<number | null>(null)
const stageCategoryChips = computed(() => { const counts = new Map<number, { id: number; name: string; count: number }>(); for (const s of skillResults.value) { const id = s.categoryId ?? s.category?.id; const name = s.category?.name; if (id == null || !name) continue; const entry = counts.get(id) ?? { id, name, count: 0 }; entry.count++; counts.set(id, entry) } return [...counts.values()] })
const visibleSkillResults = computed(() => { if (skillCategoryFilter.value == null) return skillResults.value; return skillResults.value.filter(s => (s.categoryId ?? s.category?.id) === skillCategoryFilter.value) })
/** 结果列表分页：每页最多 5 条，筛选/换词/切 Node 时回到第 1 页。 */
const SKILL_PAGE_SIZE = 5
const skillPage = ref(1)
const pagedSkillResults = computed(() => { const start = (skillPage.value - 1) * SKILL_PAGE_SIZE; return visibleSkillResults.value.slice(start, start + SKILL_PAGE_SIZE) })
watch([skillCategoryFilter, skillResults], () => { skillPage.value = 1 })
/** 结果卡片左侧图标：按分类 key 取图标。 */
function iconOf(skillKey: string) { const cat = skillMeta(skillKey)?.category?.key ?? ''; if (cat.includes('backend') || cat.includes('frontend') || cat.includes('testing')) return CodeIcon; if (cat.includes('security')) return SecuredIcon; return FileIcon }
function categoryChips(skillKey: string) { const cat = skillMeta(skillKey)?.category; return cat ? [`category: ${cat.key}`] : [] }
const skillSearched = ref(false)
function addSkill(skill: SkillView) { if (!selectedDraft.value || selectedSkill(skill.skillKey)) return; const skills = selectedDraft.value.skills ?? []; if (skills.length >= 10) return; selectedDraft.value.skills = [...skills, { skillId: skill.id, skillKey: skill.skillKey, name: skill.displayName, versionPolicy: 'LATEST_PUBLISHED', required: true, sortOrder: skills.length }] }
function clearSkills() { if (selectedDraft.value) selectedDraft.value.skills = [] }
/** 打开技能区即加载当前 Node 二级细分类的平台 Skill（阶段预筛）；输入关键字搜索全库。 */
async function loadSkillPanelOptions() {
  if (skillSearching.value) return
  skillSearching.value = true
  try {
    const published = (skill: SkillView) => Boolean(skill.latestPublishedVersion) && (!skill.scopeType || skill.scopeType === 'PLATFORM')
    const ids = [...nodeCategoryIds.value]
    let merged: SkillView[] = []
    if (ids.length) {
      const groups = await Promise.all(ids.map(categoryId => getSkills({ categoryId, status: 'ACTIVE', page: 0, size: 50, sort: 'skillKey,asc' })))
      const dedup = new Map<string, SkillView>()
      for (const skill of groups.flatMap(g => g.items).filter(published)) dedup.set(skill.skillKey, skill)
      merged = [...dedup.values()]
    }
    if (!merged.length) {
      const stage = String(selectedNode.value?.stageKey ?? '').toUpperCase()
      const page = await getSkills({ developmentStage: stage || undefined, status: 'ACTIVE', page: 0, size: 50, sort: 'skillKey,asc' })
      merged = page.items.filter(published)
    }
    skillResults.value = merged
    cacheSkillMeta(merged)
  } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : 'Skill 加载失败') } finally { skillSearching.value = false }
}
watch(() => setup.selectedNodeKey, () => { skillResults.value = []; skillCategoryFilter.value = null; void loadSkillPanelOptions() })
const wikiResults = ref<ProjectAgentContext[]>([]); const feishuResults = ref<ProjectAgentContext[]>([])
function contextKey(item: ProjectAgentContext) { return `${item.kind}:${String(item.id)}:${String(item.docType || item.documentType || '').toUpperCase()}` }
function contextLocked(item: ProjectAgentContext) { return workflowStarted.value && persistedContextKeys.value.has(contextKey(item)) }
function rememberPersisted(value: ProjectAgentContexts) { persistedContextKeys.value = new Set([...value.platformWiki, ...value.feishu].map(contextKey)) }
const pendingContexts = computed<ProjectAgentContexts>(() => ({ platformWiki: contexts.value.platformWiki.filter(item => !persistedContextKeys.value.has(contextKey(item))), feishu: contexts.value.feishu.filter(item => !persistedContextKeys.value.has(contextKey(item))) }))
const pendingContextCount = computed(() => pendingContexts.value.platformWiki.length + pendingContexts.value.feishu.length)
async function loadAll() { await Promise.allSettled([setup.load(projectKey), setup.loadReusable(projectKey), listAgentLibrary().then(v => profiles.value = v), listTeamPresets().then(v => { presets.value = v; selectedPreset.value = v.find(x => x.isDefault)?.versionId ?? v[0]?.versionId ?? null }), getProjectAgentContexts(projectKey).then(v => { contexts.value = v; rememberPersisted(v) }), getFeishuPublishTarget(projectKey).then(v => { feishuTarget.value = v; feishuTargetUrl.value = v.url || '' }), getSkillCategories().then(v => skillCategories.value = (v ?? []).filter(c => c.parentId != null && c.selectable !== false)).catch(() => {}), getCurrentWorkflowRun(projectKey).then(run => { workflowStarted.value = true; currentRunId.value = run?.id ?? null }).catch(() => { workflowStarted.value = false })]); if (!activeStages.value.length) activeStages.value = groupedNodes.value.slice(0, 1).map(group => group.key); const firstNode = setup.configuration?.nodes?.[0]; if (firstNode) { setup.selectedNodeKey = `${firstNode.stageKey}/${firstNode.nodeKey}`; await loadNode() } }
async function resolveEntry() { try { await loadAll() } catch (error) { message.value = (error as any)?.response?.data?.message || '项目配置加载失败，请稍后重试' } finally { resolvingEntry.value = false } }
onMounted(resolveEntry)
function goWorkspace() { router.push({ name: 'project-workspace', params: { projectId: projectKey, ...(currentRunId.value ? { runId: String(currentRunId.value) } : {}) } }) }
function confirmApplySource(action: () => Promise<void>, label: string) { if (workflowStarted.value) return; const dialog = DialogPlugin.confirm({ header: '确认应用配置来源？', body: `${label} 将覆盖当前所有 Node 的草稿配置，且不可恢复。`, confirmBtn: '确认应用', cancelBtn: '取消', theme: 'warning', onConfirm: async () => { dialog.destroy(); busy.value = true; try { setup.clearValidation(); await action(); setup.selectedNodeKey = setup.configuration?.nodes[0] ? `${setup.configuration.nodes[0].stageKey}/${setup.configuration.nodes[0].nodeKey}` : ''; await loadNode() } catch (e) { message.value = e instanceof Error ? e.message : '配置来源应用失败' } finally { busy.value = false } }, onClose: () => dialog.destroy() }) }
function applySource() { if (source.value === 'SYSTEM_PRESET' && selectedPreset.value != null) confirmApplySource(() => setup.usePreset(projectKey, selectedPreset.value!), '应用系统方案'); else if (source.value === 'PROJECT_COPY' && sourceProjectKey.value) confirmApplySource(() => setup.copyFrom(projectKey, sourceProjectKey.value), '复制历史项目配置') }
function parseJsonObject(value: unknown, label: string) { try { const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : (value ?? {}); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label}必须是 JSON 对象`); return JSON.stringify(parsed) } catch (e) { throw new Error(`${label}格式无效：${e instanceof Error ? e.message : '请填写合法 JSON'}`) } }
async function saveNode() { if (!selectedNode.value || !selectedDraft.value) return; saving.value = true; try { const skills = (selectedDraft.value.skills ?? []).map((skill, index) => ({ ...skill, versionPolicy: 'LATEST_PUBLISHED' as const, fixedSkillVersionId: undefined, required: true, sortOrder: index })); selectedDraft.value.skills = skills; const outputSchemaJson = parseJsonObject(selectedDraft.value.outputSchemaJson, 'Output Schema'); const runtimeConfigJson = parseJsonObject(selectedDraft.value.runtimeConfigJson, 'Runtime Config'); await saveProjectAgentNodeDraft(projectKey, selectedNode.value.stageKey, selectedNode.value.nodeKey, { systemPrompt: selectedDraft.value.systemPrompt, modelCode: selectedDraft.value.modelCode, temperature: selectedDraft.value.temperature, maxIterationPerRun: selectedDraft.value.maxIterationPerRun, timeoutSeconds: selectedDraft.value.timeoutSeconds, outputSchemaJson, runtimeConfigJson, skills }); setup.clearValidation(); MessagePlugin.success('当前 Node 草稿已保存') } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : '草稿保存失败') } finally { saving.value = false } }
async function saveContexts() { try { contexts.value = workflowStarted.value ? await appendProjectAgentContexts(projectKey, pendingContexts.value) : await saveProjectAgentContexts(projectKey, contexts.value); rememberPersisted(contexts.value); setup.clearValidation(); MessagePlugin.success(workflowStarted.value ? '上下文已追加并对当前工作流生效' : '启动上下文已保存') } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : '上下文保存失败') } }
async function revise() { try { setup.configuration = await reviseProjectAgentConfiguration(projectKey); setup.clearValidation(); MessagePlugin.success('已创建可编辑配置修订') } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : '创建修订失败') } }
async function validate() { if (validating.value) return; validating.value = true; try { const result = await setup.validate(projectKey); if (result.valid) MessagePlugin.success('配置校验通过'); else MessagePlugin.warning(`配置校验未通过：${result.issues.length} 个问题`); } catch (e) { MessagePlugin.error(e instanceof Error ? e.message : '配置校验失败') } finally { validating.value = false } }
async function confirm() { try { await setup.confirm(projectKey) } catch (e) { message.value = e instanceof Error ? e.message : '配置确认失败' } }
async function start() { if (!initialRequest.value.trim() || !ready.value) return; try { const run = await startWorkflowRun(projectKey, { initialRequest: initialRequest.value.trim() }); await router.push({ name: 'project-workspace', params: { projectId: projectKey, runId: String(run.id) } }) } catch (e) { message.value = e instanceof Error ? e.message : 'Workflow 启动失败' } }
function remove(kind: 'platformWiki'|'feishu', item: ProjectAgentContext) { if (contextLocked(item)) return; contexts.value[kind] = contexts.value[kind].filter(x => contextKey(x) !== contextKey(item)) }
function apiErrorMessage(error: any, fallback: string) { return error?.response?.data?.message || error?.response?.data?.code || (error instanceof Error ? error.message : fallback) }
async function searchContext() { if (feishuResolving.value) return; try { if (contextTab.value === 'PLATFORM_WIKI') { const page = await getWikiDocuments({ keyword: wikiQuery.value.trim() || undefined, page: 0, size: 10 }); wikiResults.value = page.items.filter(x => x.platformVisible && x.active).map(x => ({ kind: 'PLATFORM_WIKI', id: x.id, title: x.title, revisionNo: x.revisionNo })) } else { const query = feishuQuery.value.trim(); const documentUrl = /^https:\/\/[A-Za-z0-9.-]+\.feishu\.cn\/(?:wiki|docx|docs)\/[A-Za-z0-9_-]+(?:[?#].*)?$/i.test(query); if (documentUrl) { feishuResolving.value = true; const resolved = await resolveProjectFeishuWiki(projectKey, query); if (resolved.readable === false) throw new Error(resolved.message || '暂不支持该类型文件'); const item = { kind: 'FEISHU' as const, id: resolved.nodeToken || resolved.docId, title: resolved.title || resolved.nodeToken || resolved.docId, docType: resolved.docType, url: resolved.sourceUrl || query, readable: true }; feishuResults.value = [item, ...feishuResults.value.filter(x => String(x.id) !== String(item.id))]; addContext(item); MessagePlugin.success('飞书文档解析成功，已加入启动上下文'); return } const raw = await searchDocumentAgentFeishu(query); const data = Array.isArray(raw) ? raw : (raw as any).result ?? raw; const items = (data as any).files ?? (data as any).items ?? (data as any).docs ?? []; feishuResults.value = items.filter((x: any) => x.readable !== false).map((x: any) => ({ kind: 'FEISHU', id: x.docId, title: x.title || x.docId, docType: x.docType, url: x.open_url })) } } catch (e) { const text = apiErrorMessage(e, '上下文搜索失败'); message.value = text; MessagePlugin.error(text) } finally { feishuResolving.value = false } }
function addContext(item: ProjectAgentContext) { const key = item.kind === 'PLATFORM_WIKI' ? 'platformWiki' : 'feishu'; const index = contexts.value[key].findIndex(x => contextKey(x) === contextKey(item)); if (index >= 0) { if (!contextLocked(contexts.value[key][index])) contexts.value[key] = contexts.value[key].map((value, current) => current === index ? item : value); return } if (contexts.value[key].length >= 10) return; contexts.value[key] = [...contexts.value[key], item] }
async function saveFeishuTarget() { const url = feishuTargetUrl.value.trim(); if (!url || feishuTargetBusy.value) return; feishuTargetBusy.value = true; feishuTargetMessage.value = ''; try { await validateFeishuPublishTarget(url); feishuTarget.value = await updateFeishuPublishTarget(projectKey, url); feishuTargetUrl.value = feishuTarget.value.url || url; feishuTargetMessage.value = '飞书发布目录已校验并保存' } catch (e) { feishuTargetMessage.value = apiErrorMessage(e, '飞书发布目录校验失败') } finally { feishuTargetBusy.value = false } }
</script>
<template>
  <main v-if="resolvingEntry" class="setup-workbench"><section class="panel muted">正在检查项目工作流…</section></main>
  <main v-else class="setup-workbench">
    <header class="hero">
      <div class="hero-title">
        <TTag theme="primary" variant="light" class="eyebrow">PROJECT AGENT SETUP</TTag>
        <span class="hero-id">ID: {{ projectKey }}</span>
        <h1>项目 Agent 配置</h1>
        <p class="muted">先复制为项目私有草稿，再按 Node 调整 Prompt、Skill 与启动资料。</p>
      </div>
      <div class="status-stack">
        <span v-if="workflowStarted" class="locked-chip"><LockOnIcon /><b>LOCKED</b><i>|</i>工作流已启动 · Agent 配置只读</span>
        <TButton v-if="workflowStarted" theme="primary" variant="outline" @click="goWorkspace">返回 Agent 工作流<template #suffix><ChevronRightIcon /></template></TButton>
        <TButton v-if="!draftMode && !workflowStarted" variant="outline" @click="revise">创建配置修订</TButton>
      </div>
    </header>
    <p v-if="message || setup.error" class="notice">{{ message || setup.error }}</p>

    <section class="source panel">
      <div class="section-head"><div><span class="step">01</span><h2>配置来源</h2><p class="muted">来源应用后，每个 Node 都是当前项目独立副本。</p></div><TTag v-if="workflowStarted" theme="success" variant="light">方案模板运行中</TTag></div>
      <div class="source-row">
        <TRadioGroup v-model="source" variant="default-filled" :disabled="workflowStarted">
          <TRadioButton value="SYSTEM_PRESET">系统推荐</TRadioButton>
          <TRadioButton value="PROJECT_COPY">历史项目</TRadioButton>
          <TRadioButton value="CUSTOM">自定义</TRadioButton>
        </TRadioGroup>
        <template v-if="source==='SYSTEM_PRESET'">
          <TSelect v-model="selectedPreset" :disabled="workflowStarted" class="source-select" placeholder="选择系统方案" :keys="{ label: 'name', value: 'versionId' }" :options="presets.map(p => ({ ...p, name: `${p.name} v${p.versionNo}` }))" />
          <TButton theme="primary" variant="outline" :disabled="workflowStarted || selectedPreset == null" :loading="busy" @click="applySource"><template #icon><EditIcon /></template>应用方案</TButton>
          <p v-if="presetDescription" class="source-hint"><InfoCircleFilledIcon />{{ presetDescription }}</p>
        </template>
        <template v-else-if="source==='PROJECT_COPY'">
          <TSelect v-model="sourceProjectKey" :disabled="workflowStarted" class="source-select" placeholder="选择历史项目" :options="setup.reusableProjects.map(p => ({ label: `${p.name} · ${p.status}`, value: p.projectKey }))" />
          <TButton theme="primary" variant="outline" :disabled="workflowStarted || !sourceProjectKey" :loading="busy" @click="applySource"><template #icon><EditIcon /></template>复制为草稿</TButton>
        </template>
        <p v-else class="muted">选择下方 Node 后编辑项目私有 Agent。</p>
      </div>
    </section>

    <section class="editor panel">
      <div class="section-head"><div><span class="step">02</span><h2>Agent 团队</h2></div><TTag theme="primary" variant="light">{{ setup.configuration?.nodes.length || 0 }} Nodes</TTag></div>
      <div class="editor-grid">
        <TCollapse v-model="activeStages" expand-mutex="false" class="node-collapse">
          <TCollapsePanel v-for="group in groupedNodes" :key="group.key" :value="group.key">
            <template #header><span class="stage-header">{{ group.label }}<b class="stage-count">{{ group.nodes.length }}</b></span></template>
            <div class="stage-nodes">
              <button v-for="n in group.nodes" :key="`${n.stageKey}/${n.nodeKey}`" type="button" class="node-item" :class="{selected:setup.selectedNodeKey===`${n.stageKey}/${n.nodeKey}`}" @click="setup.selectedNodeKey=`${n.stageKey}/${n.nodeKey}`; loadNode()"><strong>{{ n.nodeDisplayName || n.nodeName || n.nodeKey }}</strong><small>{{ n.nodeKey }} · {{ n.agentProfileCode }}</small></button>
            </div>
          </TCollapsePanel>
        </TCollapse>
        <article v-if="selectedDraft" class="inspector">
          <div class="section-head"><div><h3>{{ selectedDraft.nodeName || selectedDraft.nodeKey }}</h3><p class="muted">项目私有 Draft · 来源版本 {{ selectedDraft.sourceAgentProfileVersionId || '—' }}</p></div><TButton :disabled="saving || !draftMode" :loading="saving" @click="saveNode">{{ saving ? '保存中…' : '保存此 Agent' }}</TButton></div>
          <details class="locked-protocol"><summary>工作流执行协议 · 系统锁定<TTag size="small" theme="success" variant="light">标准契约已生效</TTag></summary><pre>{{ selectedDraft.workflowProtocolPrompt || '该 Workflow Node 暂无协议文本' }}</pre><p class="hint">此协议负责 JSON 返回、resultCode、artifact、review 和人员介入闭环，运行时不可被角色指令覆盖。</p></details>
          <label class="field-label">Agent 角色与补充指令<span class="char-count">{{ (selectedDraft.systemPrompt || '').length }} 字符</span></label>
          <TTextarea v-model="selectedDraft.systemPrompt" :autosize="{ minRows: 7, maxRows: 14 }" :disabled="!draftMode" placeholder="描述该 Agent 的角色、目标与约束" />
          <div class="form-grid">
            <label class="field-label">Max Iteration<TInputNumber v-model="selectedDraft.maxIterationPerRun" :min="1" :disabled="!draftMode" suffix="轮次" theme="normal" align="left" /></label>
            <label class="field-label">Timeout（秒）<TInputNumber v-model="selectedDraft.timeoutSeconds" :min="0" :disabled="!draftMode" suffix="sec" theme="normal" align="left" /></label>
          </div>
          <p class="hint"><InfoCircleFilledIcon class="hint-icon" />Model 与采样参数由平台统一调度，暂不开放自定义。</p>
          <details open class="skills-details"><summary>Skills 配置与挂载<span class="hint-inline">为当前 Agent 注入专项能力，支持多轮调试搜索并跨类别组合挂载。</span><span class="skill-head-meta"><TTag size="small" theme="primary" variant="light">已挂载 {{ (selectedDraft.skills || []).length }} / 上限 10</TTag><button type="button" class="link-btn" :disabled="!draftMode || !(selectedDraft.skills || []).length" @click="clearSkills">清空全部</button></span></summary>
            <div class="skill-picker" data-testid="project-agent-skill-picker">
              <div v-if="(selectedDraft.skills || []).length" class="mounted-list">
                <article v-for="skill in selectedDraft.skills || []" :key="skill.skillKey" class="mounted-card">
                  <div class="mounted-icon"><component :is="iconOf(skill.skillKey)" /></div>
                  <div class="mounted-body">
                    <header><strong>{{ skill.name || skill.skillKey }}</strong><TTag v-if="skillMeta(skill.skillKey)?.category?.name" size="small" theme="success" variant="light">{{ skillMeta(skill.skillKey).category.name }}</TTag><span v-if="skillMeta(skill.skillKey)?.latestPublishedVersion" class="ver mono">v{{ skillMeta(skill.skillKey).latestPublishedVersion }}</span></header>
                    <p>{{ skillMeta(skill.skillKey)?.description || skill.skillKey }}</p>
                    <div class="tool-chips"><span v-for="cat in categoryChips(skill.skillKey)" :key="cat" class="tool-chip mono">{{ cat }}</span></div>
                  </div>
                  <div class="mounted-actions"><RouterLink class="link-btn" :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }" target="_blank">查看契约</RouterLink><button type="button" class="link-btn danger" :disabled="!draftMode" @click="removeSkill(skill.skillKey)">× 移除</button></div>
                </article>
              </div>
              <div class="skill-searchbar"><TInput v-model="skillQuery" :disabled="!draftMode" placeholder="搜索能力库（技能名 / 关键词）" clearable @enter="searchSkills"><template #prefixIcon><SearchIcon /></template></TInput><TButton theme="primary" :disabled="!draftMode || skillSearching" :loading="skillSearching" @click="searchSkills">搜索能力库</TButton></div>
              <div v-if="stageCategoryChips.length" class="category-chips"><span class="chips-label">热门类别：</span><button type="button" class="cat-chip" :class="{ on: skillCategoryFilter === null }" @click="skillCategoryFilter = null">全部（{{ skillResults.length }}）</button><button v-for="chip in stageCategoryChips" :key="chip.id" type="button" class="cat-chip" :class="{ on: skillCategoryFilter === chip.id }" @click="skillCategoryFilter = chip.id">{{ chip.name }}（{{ chip.count }}）</button></div>
              <div v-if="pagedSkillResults.length" class="result-list">
                <article v-for="skill in pagedSkillResults" :key="skill.skillKey" class="result-card">
                  <div class="mounted-icon"><component :is="iconOf(skill.skillKey)" /></div>
                  <div class="mounted-body">
                    <header><strong>{{ skill.displayName }}</strong><TTag v-if="skill.category?.name" size="small" theme="primary" variant="light">{{ skill.category.name }}</TTag><span v-if="skill.latestPublishedVersion" class="ver mono">v{{ skill.latestPublishedVersion }}</span></header>
                    <p>{{ skill.description || skill.skillKey }}</p>
                  </div>
                  <TButton v-if="!selectedSkill(skill.skillKey)" size="small" variant="outline" :disabled="!draftMode || (selectedDraft.skills || []).length >= 10" @click="addSkill(skill)">+ 添加</TButton>
                  <TButton v-else size="small" variant="outline" disabled>✓ 已添加</TButton>
                </article>
              </div>
              <p v-else-if="skillSearched && !skillSearching" class="empty compact">未找到匹配的平台 Skill</p>
              <div v-if="visibleSkillResults.length" class="result-footer">
                <span class="result-count muted">已检索到 {{ visibleSkillResults.length }} 项匹配能力</span>
                <TPagination v-model:current="skillPage" :page-size="5" :total="visibleSkillResults.length" size="small" :page-size-options="[]" :show-page-size="false" :show-jumper="false" />
              </div>
            </div>
          </details>
        </article>
        <p v-else class="empty">选择一个 Node 开始编辑</p>
      </div>
    </section>

    <section class="feishu-target panel" data-testid="feishu-publish-target">
      <div class="section-head"><div><span class="step">03</span><h2>飞书发布目录</h2><p class="muted">用于阶段产物发布；已锁定且配置后只读，未配置时可追加。</p></div><TTag :theme="feishuTarget?.configured ? 'success' : 'default'" variant="light">{{ feishuTarget?.configured ? '已配置' : '未配置' }}</TTag></div>
      <div class="inline">
        <TInput v-model="feishuTargetUrl" placeholder="粘贴飞书 Wiki 根目录 URL" :disabled="Boolean(feishuTarget?.configured && feishuTarget?.editable === false) || feishuTargetBusy" class="feishu-input"><template #prefixIcon><CloudUploadIcon /></template></TInput>
        <TButton variant="outline" :disabled="feishuTargetBusy || !feishuTargetUrl.trim()" :loading="feishuTargetBusy" @click="saveFeishuTarget">{{ feishuTargetBusy ? '校验中…' : feishuTarget?.configured ? '重新校验 / 授权' : '校验并保存' }}</TButton>
      </div>
      <p v-if="feishuTargetMessage" class="hint">{{ feishuTargetMessage }}</p>
    </section>

    <section class="context panel">
      <div class="section-head"><div><span class="step">04</span><h2>启动上下文</h2><p class="muted">{{ workflowStarted ? '可继续追加并立即供当前工作流使用；已保存的上下文不可移除。' : '整个 Run 共享；平台 Wiki 启动时固定版本，飞书固定文档身份。' }}</p></div><TButton :disabled="workflowStarted ? pendingContextCount === 0 : !draftMode" @click="saveContexts"><template #icon><AddIcon /></template>{{ workflowStarted ? `追加上下文${pendingContextCount ? `（${pendingContextCount}）` : ''}` : '保存上下文' }}</TButton></div>
      <TRadioGroup v-model="contextTab" variant="default-filled" class="context-tabs">
        <TRadioButton value="PLATFORM_WIKI">平台 Wiki <b>{{ contexts.platformWiki.length }}/10</b></TRadioButton>
        <TRadioButton value="FEISHU">飞书 <b>{{ contexts.feishu.length }}/10</b></TRadioButton>
      </TRadioGroup>
      <div class="context-search">
        <TInput v-if="contextTab==='PLATFORM_WIKI'" v-model="wikiQuery" placeholder="搜索平台 Wiki" clearable @enter="searchContext" />
        <TInput v-else v-model="feishuQuery" placeholder="粘贴飞书 Wiki/原生文档链接，或搜索文档" clearable @enter="searchContext" />
        <TButton :disabled="feishuResolving" :loading="feishuResolving" @click="searchContext">{{ feishuResolving ? '解析中…' : contextTab==='FEISHU' && /^https:\/\//i.test(feishuQuery.trim()) ? '解析并添加' : '搜索' }}</TButton>
      </div>
      <p v-if="contextTab==='FEISHU'" class="hint">支持 Wiki 与原生 DOC/DOCX；附件文件暂不支持。</p>
      <div v-if="(contextTab==='PLATFORM_WIKI'?wikiResults:feishuResults).length" class="results"><button v-for="item in contextTab==='PLATFORM_WIKI'?wikiResults:feishuResults" :key="`${item.kind}-${item.id}`" type="button" @click="addContext(item)"><span>{{ item.title }}</span><small>{{ item.revisionNo ? `v${item.revisionNo}` : item.docType }}</small></button></div>
      <div class="selected"><span v-for="item in contexts[contextTab==='PLATFORM_WIKI'?'platformWiki':'feishu']" :key="contextKey(item)" class="tag" :class="{ locked: contextLocked(item) }">{{ item.title }} <small v-if="contextLocked(item)">已锁定</small><button v-else type="button" @click="remove(contextTab==='PLATFORM_WIKI'?'platformWiki':'feishu',item)">×</button></span><p v-if="!contexts[contextTab==='PLATFORM_WIKI'?'platformWiki':'feishu'].length" class="muted">尚未选择资料</p></div>
    </section>

    <section class="footer panel">
      <div><span class="step">05</span><h2>{{ workflowStarted ? '配置已锁定' : '校验并启动' }}</h2><p class="muted">{{ workflowStarted ? '工作流已经启动，Agent 配置不可修改；可在上方继续追加上下文。' : '确认后项目 Agent 草稿冻结；启动时生成上下文快照。' }}</p></div>
      <template v-if="!workflowStarted">
        <div class="actions"><TButton variant="outline" :disabled="validating" :loading="validating" @click="validate">{{ validating ? '校验中…' : '校验配置' }}</TButton><TButton v-if="setup.configuration?.status==='READY'" theme="primary" :disabled="!initialRequest.trim()" @click="start">启动 Workflow</TButton><TButton v-else theme="primary" @click="confirm">确认配置</TButton></div>
        <div v-if="setup.validation" class="validation-result" :class="{valid: setup.validation.valid, invalid: !setup.validation.valid}" data-testid="config-validation-result"><strong>{{ setup.validation.valid ? '配置校验通过' : '配置校验未通过' }}</strong><div class="checks"><span v-for="check in setup.validation.checks || []" :key="check.label" :class="{passed: check.passed}">{{ check.passed ? '✓' : '!' }} {{ check.label }}</span></div><ul v-if="setup.validation.issues.length"><li v-for="issue in setup.validation.issues" :key="issue">{{ issue }}</li></ul><p v-else class="muted">所有配置检查均已通过。</p></div>
        <TTextarea v-if="setup.configuration?.status==='READY'" v-model="initialRequest" data-testid="initial-request" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="输入本次研发需求" class="initial-request" />
      </template>
      <div v-else class="workspace-return"><TButton theme="primary" variant="outline" size="large" @click="goWorkspace">返回 Agent 工作流<template #suffix><ChevronRightIcon /></template></TButton></div>
    </section>
  </main>
</template>
<style scoped>
/* ===== 布局骨架 ===== */
.setup-workbench{position:relative;max-width:1240px;margin:auto;padding-bottom:70px}
/* 页面级环境光晕：顶部一点青色辉光，压住灰扑扑的平板感 */
.setup-workbench::before{content:"";position:fixed;inset:0 0 auto;height:420px;pointer-events:none;z-index:0;background:radial-gradient(640px 300px at 18% 0%,var(--ambient-1),transparent 70%),radial-gradient(560px 260px at 85% 0%,var(--ambient-2),transparent 70%)}
.setup-workbench>*{position:relative;z-index:1}
.hero,.section-head,.inline,.actions,.context-search{display:flex;align-items:center;justify-content:space-between;gap:14px}
.hero{align-items:flex-end;padding-top:6px}
.hero-title h1{margin:8px 0 6px;font-size:28px;font-weight:700;letter-spacing:.01em;color:var(--text-1)}
.hero-title p{margin:0}
.eyebrow{font-family:var(--font-mono);letter-spacing:.14em;font-weight:600}
.hero-id{margin-left:10px;color:var(--text-3);font-size:13px}
.step{display:block;color:var(--accent-400);font-size:11px;letter-spacing:.14em;font-family:var(--font-mono)}
.muted{color:var(--text-2)}.hint{display:flex;align-items:center;gap:5px;margin:0;color:var(--text-3);font-size:12px}.hint-icon{flex:none;color:var(--info)}
.status-stack{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.locked-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border:1px solid var(--border-2);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-2);font-size:13px}
.locked-chip b{letter-spacing:.08em;font-size:12px}
.locked-chip i{opacity:.4;font-style:normal}
/* ===== 玻璃面板：边框 + 顶部内高光 ===== */
.panel{position:relative;margin:16px 0;padding:22px;border:1px solid var(--border-1);border-radius:var(--radius-lg);background:var(--surface-1);box-shadow:var(--shadow-sm),var(--inner-highlight);transition:border-color var(--duration-base) var(--ease-out),box-shadow var(--duration-base) var(--ease-out)}
.panel:hover{border-color:var(--border-2);box-shadow:var(--shadow-md),var(--inner-highlight)}
h2,h3{margin:4px 0}
/* ===== 01 配置来源 ===== */
.source-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
.source-select{min-width:280px}
.source-hint{display:inline-flex;align-items:center;gap:6px;margin:0;color:var(--text-2);font-size:12px}
.source-hint svg{color:var(--info)}
/* ===== 02 Agent 团队：TDesign Collapse 折叠侧栏 ===== */
.editor-grid{display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start}
.node-collapse{border:0;background:transparent}
.node-collapse :deep(.t-collapse-panel){margin-bottom:10px;border:1px solid var(--border-1);border-radius:var(--radius-md);background:var(--surface-2);overflow:hidden}
.node-collapse :deep(.t-collapse-panel__header){padding:10px 12px}
.node-collapse :deep(.t-collapse-panel__body){background:transparent;border-top:1px solid var(--border-1)}
.node-collapse :deep(.t-collapse-panel__content){padding:10px}
.stage-header{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text-1)}
.stage-count{padding:1px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent-300);font-size:11px;font-family:var(--font-mono)}
.stage-nodes{display:grid;gap:8px}
.node-item{display:grid;gap:5px;text-align:left;padding:10px 12px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:var(--surface-1);color:var(--text-1);cursor:pointer;transition:border-color var(--duration-fast),box-shadow var(--duration-fast),transform var(--duration-fast)}
.node-item:hover:not(.selected){transform:translateX(2px);border-color:var(--border-3)}
.node-item.selected{border-color:var(--accent-500);background:var(--accent-softer);box-shadow:inset 3px 0 var(--accent-500),0 0 18px var(--accent-glow)}
.node-item small{color:var(--text-2)}
/* ===== Node 详情 ===== */
.inspector{display:grid;gap:14px}
.field-label{display:grid;gap:6px;color:var(--text-1);font-weight:600;font-size:13px}
.char-count{justify-self:end;color:var(--text-3);font-size:11px;font-weight:400}
.locked-protocol{border:1px solid rgb(148 163 184 / 35%);border-radius:var(--radius-md);padding:10px 12px;background:var(--bg-2)}
.locked-protocol summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;color:var(--text-2);font-weight:650;list-style:none}
.locked-protocol summary::before{content:"▸";color:var(--text-3);transition:transform var(--duration-fast)}
.locked-protocol[open] summary::before{transform:rotate(90deg)}
.locked-protocol pre{white-space:pre-wrap;max-height:260px;overflow:auto;margin:12px 0;padding:12px;border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-2);font:12px/1.6 var(--font-mono)}
.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.skills-details>summary{display:flex;align-items:baseline;gap:10px;cursor:pointer;font-weight:650;color:var(--text-1);list-style:none}
.skills-details>summary::before{content:"▸";color:var(--text-3)}
.skills-details[open]>summary::before{transform:rotate(90deg)}
.hint-inline{color:var(--text-3);font-size:12px;font-weight:400}
.skill-picker{display:grid;gap:12px;padding-top:10px}
.skill-searchbar{display:flex;gap:10px}
.skill-searchbar .t-input{flex:1}
/* 已挂载卡片 */
.mounted-list{display:grid;gap:10px}
.mounted-card,.result-card{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border:1px solid var(--border-1);border-radius:var(--radius-md);background:var(--surface-2);transition:border-color var(--duration-fast),box-shadow var(--duration-fast)}
.mounted-card:hover,.result-card:hover{border-color:var(--border-2);box-shadow:var(--shadow-sm)}
.mounted-icon{flex:none;width:36px;height:36px;display:grid;place-items:center;border-radius:var(--radius-sm);background:var(--accent-softer);color:var(--accent-400);font-size:18px}
.mounted-body{flex:1;min-width:0;display:grid;gap:5px}
.mounted-body header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mounted-body strong{color:var(--text-1);font-size:14px}
.mounted-body p{margin:0;color:var(--text-2);font-size:12px;line-height:1.6}
.ver{color:var(--text-3);font-size:11px}
.tool-chips{display:flex;flex-wrap:wrap;gap:6px}
.tool-chip{padding:2px 8px;border:1px solid var(--border-2);border-radius:var(--radius-sm);background:var(--surface-1);color:var(--text-2);font-size:11px}
.mounted-actions{display:flex;gap:12px;align-items:center;flex:none}
.link-btn{border:0;background:transparent;color:var(--accent-300);font-size:12px;cursor:pointer;padding:0;text-decoration:none}
.link-btn:hover{color:var(--accent-200);text-decoration:underline}
.link-btn.danger{color:var(--text-3)}
.link-btn.danger:hover{color:var(--error)}
.link-btn:disabled{opacity:.4;cursor:not-allowed;text-decoration:none}
/* 类别筛选 chips */
.category-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chips-label{color:var(--text-3);font-size:12px}
.cat-chip{padding:4px 12px;border:1px solid var(--border-1);border-radius:999px;background:var(--surface-2);color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color var(--duration-fast),background var(--duration-fast)}
.cat-chip:hover{border-color:var(--border-accent)}
.cat-chip.on{border-color:var(--accent-500);background:var(--accent-soft);color:var(--accent-300)}
/* 结果列表 */
.result-list{display:grid;gap:10px}
.result-card .t-button{flex:none;align-self:center}
.result-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.result-count{margin:0;font-size:12px}
.result-footer :deep(.t-pagination){margin:0}
.result-footer :deep(.t-pagination__number){border-color:var(--border-1);background:var(--surface-2);color:var(--text-2)}
.result-footer :deep(.t-pagination__number.t-is-current){border-color:var(--accent-500);background:var(--accent-softer);color:var(--accent-300)}
.skill-head-meta{display:inline-flex;align-items:center;gap:12px;margin-left:auto}
/* ===== 04 启动上下文 ===== */
.context-tabs{margin:14px 0}
.context-tabs b{font-family:var(--font-mono);font-weight:600}
.context-search{justify-content:flex-start}
.context-search .t-input{flex:1}
.selected,.results{display:flex;flex-wrap:wrap;gap:7px;min-height:44px;align-items:center;margin-top:10px}
.results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.results button{display:flex;justify-content:space-between;text-align:left;padding:10px 12px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-1);cursor:pointer}
.results button:hover{border-color:var(--border-accent)}
.results small{color:var(--text-2)}
.tag{display:inline-flex;gap:6px;align-items:center;padding:7px 12px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border-1)}
.tag button{border:0;padding:0;background:transparent;color:var(--text-3);cursor:pointer}
/* ===== 03 飞书发布目录 ===== */
.feishu-input{flex:1}
/* ===== 05 底部 ===== */
.validation-result{display:grid;gap:10px;margin-top:16px;padding:14px 16px;border:1px solid var(--border-1);border-radius:var(--radius-md)}
.validation-result.valid{border-color:rgb(34 197 94 / 45%);background:rgb(34 197 94 / 8%)}
.validation-result.invalid{border-color:rgb(248 113 113 / 45%);background:rgb(248 113 113 / 8%)}
.checks{display:flex;flex-wrap:wrap;gap:8px}
.checks span{padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--error)}
.checks span.passed{color:var(--success)}
.validation-result ul{margin:0;padding-left:20px;color:var(--error)}
.initial-request{margin-top:14px}
.workspace-return{margin-top:16px;display:flex;justify-content:flex-end}
.notice{padding:10px 14px;border:1px solid var(--border-accent);border-radius:var(--radius-sm);background:var(--accent-softer);color:var(--accent-300)}
.empty{padding:40px;color:var(--text-2)}
@media(max-width:760px){.hero,.section-head{display:block}.editor-grid{grid-template-columns:1fr}.form-grid,.results,.skill-results{grid-template-columns:1fr}.status-stack{margin-top:12px}.source-select{min-width:0;width:100%}}
</style>
