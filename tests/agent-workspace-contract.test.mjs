import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('runtime event store preserves cursor and uses cookie-authenticated SSE', async () => {
  const source = await readFile(new URL('../src/stores/runtimeEvent.ts', import.meta.url), 'utf8')
  assert.match(source, /withCredentials: true/)
  assert.doesNotMatch(source, /access_token/)
  assert.match(source, /lastEventId/)
  assert.match(source, /agent\.message\.delta/)
})

test('workspace refreshes the authoritative run snapshot while agents are active', async () => {
  const store = await readFile(new URL('../src/stores/projectWorkspace.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  assert.match(store, /setInterval\(tick, 2000\)/)
  assert.match(store, /visibilitychange/)
  assert.match(store, /agent\.status\.changed/)
  assert.match(store, /agent\.protocol\.retry\.requested/)
  assert.match(store, /refreshQueued/)
  assert.match(store, /selectedJustFinished/)
  assert.match(store, /FOLLOWABLE\.includes\(previousSelected\.status\)/)
  assert.match(view, /startAutoRefresh/)
  assert.match(view, /stopAutoRefresh/)
})

test('intervention history stays bounded and scrolls independently', async () => {
  const panel = await readFile(new URL('../src/features/workbench/InterventionPanel.vue', import.meta.url), 'utf8')
  assert.match(panel, /data-testid="intervention-thread"/)
  assert.match(panel, /height: min\(70vh, 680px\)/)
  assert.match(panel, /overflow-y: auto/)
  assert.match(panel, /min-height: 0/)
})

test('retry targets the latest failed agent instead of the first node', async () => {
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/features/workbench/InterventionPanel.vue', import.meta.url), 'utf8')
  assert.match(view, /a\.status === 'FAILED'/)
  assert.match(view, /interventionTarget\.failed/)
  assert.match(panel, /!retryable/)
})

test('completed workflow keeps review cycle and intervention history read-only', async () => {
  const store = await readFile(new URL('../src/stores/projectWorkspace.ts', import.meta.url), 'utf8')
  const dag = await readFile(new URL('../src/features/workbench/WorkflowDagPanel.vue', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/features/workbench/InterventionPanel.vue', import.meta.url), 'utf8')
  assert.match(store, /stage.maxLoopCount \?\? 0/)
  assert.match(dag, /stage \? \{ current:/)
  assert.match(view, /:readonly="runReadonly"/)
  assert.match(panel, /v-if="!readonly" class="ops"/)
  assert.match(panel, /v-for="question in questions/)
})

test('final acceptance uses explicit decision contract', async () => {
  const source = await readFile(new URL('../src/api/workflow.api.ts', import.meta.url), 'utf8')
  assert.match(source, /'ACCEPT' \| 'REWORK'/)
  assert.match(source, /targetStageKey/)
  assert.doesNotMatch(source, /accepted = true/)
})

test('project list enters an existing run while setup remains available in read-only mode', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(projects, /getCurrentWorkflowRun/)
  assert.match(projects, /project-workspace/)
  assert.match(projects, /project-agent-setup/)
  assert.match(projects, /projectKey: project\.projectKey/)
  assert.match(setup, /getCurrentWorkflowRun/)
  assert.match(setup, /workflowStarted/)
  assert.match(setup, /Agent 配置只读/)
  assert.doesNotMatch(setup, /router\.replace/)
  assert.match(setup, /startWorkflowRun\(projectKey,/)
  assert.match(setup, /initialRequest/)
  assert.match(setup, /getProjectAgentContexts/)
  assert.match(setup, /saveProjectAgentContexts/)
  assert.match(setup, /contextTab/)
})

test('project agent setup searches and multi-selects published platform skills', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  const skills = await readFile(new URL('../src/api/skills.api.ts', import.meta.url), 'utf8')
  assert.match(setup, /getSkills\(/)
  assert.match(setup, /data-testid="project-agent-skill-picker"/)
  assert.match(setup, /LATEST_PUBLISHED/)
  assert.match(setup, /workflowProtocolPrompt/)
  assert.match(setup, /工作流执行协议 · 系统锁定/)
  // 打开技能区即按当前 Node 二级细分类预筛（角色精裁映射），搜索走全库
  assert.match(setup, /getSkillCategories/)
  assert.match(setup, /stageCategoryIds/)
  assert.match(setup, /NODE_ROLE_CATEGORY_KEYS/)
  assert.match(setup, /nodeCategoryIds/)
  assert.match(setup, /loadSkillPanelOptions/)
  // 已挂载卡片 + 结果列表的添加/移除交互（不再用多选下拉）
  assert.match(setup, /mounted-card/)
  assert.match(setup, /addSkill\(skill\)/)
  assert.match(setup, /removeSkill\(skill\.skillKey\)/)
  assert.match(skills, /export async function getSkills/)
})

test('project startup context only offers published platform-visible Wiki documents', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(setup, /page\.items\.filter\([\s\S]*platformVisible &&[\s\S]*active/)
})

test('started project only appends contexts and locks persisted selections', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/api/agent-library.api.ts', import.meta.url), 'utf8')
  assert.match(api, /contexts:append/)
  assert.match(api, /appendProjectAgentContexts/)
  assert.match(setup, /persistedContextKeys/)
  assert.match(setup, /追加上下文/)
  assert.match(setup, /contextLocked/)
  assert.match(setup, /workflowStarted[^\n]+appendProjectAgentContexts/)
})

test('project agent setup exposes validation result and keeps step 04 in document flow', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(setup, /data-testid="config-validation-result"/)
  assert.match(setup, /MessagePlugin\.success/)
  assert.match(setup, /MessagePlugin\.warning/)
  assert.doesNotMatch(setup, /\.footer\{position:sticky/)
})

test('successful configuration validation refreshes READY state for immediate workflow start', async () => {
  const store = await readFile(new URL('../src/stores/projectSetup.ts', import.meta.url), 'utf8')
  assert.match(store, /if \(validation\.value\.valid\) configuration\.value = await getProjectAgentConfiguration\(projectKey\)/)
})

test('project agent setup validates JSON objects before saving and hides model tuning from users', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(setup, /function parseJsonObject\(/)
  assert.match(setup, /outputSchemaJson = parseJsonObject/)
  assert.match(setup, /runtimeConfigJson = parseJsonObject/)
  // 本版不开放 model / temperature / runtime config 自定义（#3）
  assert.doesNotMatch(setup, /Runtime Config JSON<\/textarea>/)
  assert.doesNotMatch(setup, /v-model\.number="selectedDraft\.temperature"/)
})

test('multi-stage workspace uses backend display metadata and exposes parallel design switching', async () => {
  const types = await readFile(new URL('../src/types/workflow.ts', import.meta.url), 'utf8')
  const store = await readFile(new URL('../src/stores/projectWorkspace.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  assert.match(types, /displayName\?: string \| null/)
  assert.match(types, /approval\?: WorkflowStageApproval/)
  assert.match(store, /parallelDesignStages/)
  assert.match(store, /metadata\?\.parallelGroup/)
  assert.match(view, /并行设计阶段/)
  assert.match(view, /stage\.displayName \|\| stage\.name \|\| stage\.key/)
  assert.match(view, /acceptWorkflowStage/)
})

test('historical stages remain browsable while intervention is limited to selected active stage', async () => {
  const store = await readFile(new URL('../src/stores/projectWorkspace.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  const dag = await readFile(new URL('../src/features/workbench/WorkflowDagPanel.vue', import.meta.url), 'utf8')
  assert.match(store, /selectedStageInteractive/)
  assert.match(store, /ACTIVE\.includes\(String\(stage\.status\)\)/)
  assert.match(view, /stageReadonly/)
  assert.match(view, /selectedQuestions/)
  assert.match(view, /String\(question\.stageRunId\) === stageId/)
  assert.match(view, /:readonly="stageReadonly"/)
  assert.match(dag, /@click\.stop=.*emit\('select'/)
})

test('project agent setup groups nodes by backend stage display metadata', async () => {
  const types = await readFile(new URL('../src/types/agent-library.ts', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(types, /stageDisplayName\?: string/)
  assert.match(setup, /groupedNodes/)
  assert.match(setup, /node\.stageDisplayName \|\| node\.stageName \|\| node\.stageKey/)
  assert.match(setup, /nodeDisplayName \|\| n\.nodeName/)
})

test('profile view derives latest version from descending versions', async () => {
  const source = await readFile(new URL('../src/api/agent-config.api.ts', import.meta.url), 'utf8')
  assert.match(source, /const versions = profile\.versions\?\.map\(normalizeVersion\)/)
  assert.match(source, /: versions\?\.\[0\]/)
})

test('project creation validates optional Feishu publish root before submit', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/api/projects.api.ts', import.meta.url), 'utf8')
  assert.match(projects, /feishuWikiRootUrl/)
  assert.match(projects, /validateFeishuRoot/)
  assert.match(api, /feishu-publish-target:validate/)
  assert.match(api, /feishuWikiRootUrl/)
  assert.match(setup, /getFeishuPublishTarget/)
  assert.match(setup, /updateFeishuPublishTarget/)
  assert.match(setup, /feishu-publish-target/)
})

test('workspace exposes Feishu publication status, owner retry, and stageRunId deep-link selection', async () => {
  const types = await readFile(new URL('../src/types/workflow.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../src/features/workbench/CurrentStagePanel.vue', import.meta.url), 'utf8')
  const artifact = await readFile(new URL('../src/features/workbench/ArtifactPanel.vue', import.meta.url), 'utf8')
  assert.match(types, /FeishuPublicationStatus/)
  assert.match(view, /retryFeishuPublication/)
  assert.match(view, /route.query.stageRunId/)
  // 飞书发布状态已移至产物面板，仅在「预览」tab 与产物同区展示
  assert.match(artifact, /v-if="publication" class="publication-status"/)
  assert.match(artifact, /data-testid="feishu-publication-status"/)
  assert.match(artifact, /Owner 重试同步/)
  assert.doesNotMatch(panel, /feishu-publication-status/)
  // 并行设计切换条只在相关场景出现，不再常驻
  assert.match(view, /showParallelSwitcher/)
  assert.match(view, /v-if="showParallelSwitcher"/)
})

test('notifications use structured workflow target data for navigation', async () => {
  const types = await readFile(new URL('../src/types/notification.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/NotificationsView.vue', import.meta.url), 'utf8')
  assert.match(types, /targetData\?/)
  assert.match(view, /target.projectKey/)
  assert.match(view, /stageRunId: String\(target\.stageRunId\)/)
})
