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

test('project entry resolves an existing run before opening setup', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(projects, /getCurrentWorkflowRun/)
  assert.match(projects, /project-workspace/)
  assert.match(projects, /project-agent-setup/)
  assert.match(projects, /projectKey: project\.projectKey/)
  assert.match(setup, /getCurrentWorkflowRun/)
  assert.match(setup, /router\.replace/)
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
  assert.match(setup, /selected-skills/)
  assert.match(setup, /workflowProtocolPrompt/)
  assert.match(setup, /工作流执行协议 · 系统锁定/)
  assert.match(skills, /export async function getSkills/)
})

test('project agent setup exposes validation result and keeps step 04 in document flow', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(setup, /data-testid="config-validation-result"/)
  assert.match(setup, /MessagePlugin\.success/)
  assert.match(setup, /MessagePlugin\.warning/)
  assert.doesNotMatch(setup, /\.footer\{position:sticky/)
})

test('project agent setup validates JSON objects before saving and displays runtime checks', async () => {
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(setup, /function parseJsonObject\(/)
  assert.match(setup, /Runtime Config/)
  assert.match(setup, /outputSchemaJson = parseJsonObject/)
  assert.match(setup, /runtimeConfigJson = parseJsonObject/)
})

test('profile view derives latest version from descending versions', async () => {
  const source = await readFile(new URL('../src/api/agent-config.api.ts', import.meta.url), 'utf8')
  assert.match(source, /const versions = profile\.versions\?\.map\(normalizeVersion\)/)
  assert.match(source, /: versions\?\.\[0\]/)
})
