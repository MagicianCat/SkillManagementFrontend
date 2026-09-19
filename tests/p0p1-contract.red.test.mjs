import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('P0 route and profile access use stable code and visible permission sections', async () => {
  const router = await read('src/router/index.ts')
  const detail = await read('src/views/AgentConfigDetailView.vue')
  assert.match(router, /agent-config\/:code/)
  assert.match(detail, /data-testid="agent-profile-skills"/)
  assert.match(detail, /data-testid="agent-profile-tools"/)
})

test('P0 workspace starts a run with initialRequest and workflow snapshot', async () => {
  const workspace = await read('src/views/ProjectWorkspaceView.vue')
  const workflow = await read('src/api/workflow.api.ts')
  assert.match(workspace, /initialRequest/)
  assert.match(workflow, /initialRequest/)
  assert.match(workflow, /contextSnapshotJson/)
})

test('P0 intervention contract includes info and retry controls', async () => {
  const chat = await read('src/features/intervention/AgentInterventionChat.vue')
  assert.match(chat, /PROVIDE_INFO/)
  for (const action of ['ASK', 'CORRECT', 'PAUSE', 'RESUME', 'CANCEL', 'RETRY']) assert.match(chat, new RegExp(action))
  assert.match(chat, /target/)
})

test('P1 workspace renders requirement team, revision, issues and human gate', async () => {
  const workspace = await read('src/views/ProjectWorkspaceView.vue')
  const acceptance = await read('src/features/workbench/AcceptancePanel.vue')
  const artifact = await read('src/features/workbench/ArtifactPanel.vue')
  for (const marker of ['Clarifier', 'Writer', 'Reviewer', 'Revision', 'review issues', 'HUMAN_REQUIRED']) assert.match(workspace, new RegExp(marker, 'i'))
  assert.match(acceptance, /data-testid="final-acceptance"/)
  assert.match(artifact, /data-testid="document-revision"/)
})

test('P1 has a browser acceptance test with stable user journey selectors', async () => {
  const e2e = await read('e2e/requirement-workflow.spec.ts')
  assert.match(e2e, /initial-request/)
  assert.match(e2e, /agent-team/)
  assert.match(e2e, /document-revision/)
  assert.match(e2e, /final-acceptance/)
})

test('Agent Version save uses full skill bindings, never legacy skillIds', async () => {
  const api = await read('src/api/agent-config.api.ts')
  const request = api.slice(api.indexOf('export function buildAgentProfileVersionRequest'), api.indexOf('export async function saveAgentProfileVersion'))
  assert.match(request, /skillId: skill\.skillId/)
  assert.match(request, /versionPolicy: skill\.versionPolicy/)
  assert.match(request, /fixedSkillVersionId: skill\.fixedSkillVersionId/)
  assert.match(request, /required: skill\.required/)
  assert.match(request, /sortOrder: skill\.sortOrder/)
  assert.match(request, /outputSchemaJson: stringifyJson\(version\.outputSchemaJson\)/)
  assert.match(request, /runtimeConfigJson: stringifyJson\(version\.runtimeConfigJson\)/)
  assert.doesNotMatch(request, /skillIds/)
})

test('Agent detail preserves skill ids and gates editing to owned user agents', async () => {
  const detail = await read('src/views/AgentConfigDetailView.vue')
  assert.match(detail, /skillId: skill\.id/)
  assert.match(detail, /skillId: option\.skillId/)
  assert.match(detail, /sourceType === 'SYSTEM'/)
  assert.match(detail, /ownerUserId/)
})

test('Agent draft save updates DRAFT in place and creates a new version from published', async () => {
  const api = await read('src/api/agent-config.api.ts')
  const detail = await read('src/views/AgentConfigDetailView.vue')
  assert.match(api, /http\.put<AgentProfileVersion>\(`\$\{profilesPath\}\/\$\{encodedCode\}\/versions\/\$\{version\.versionNo\}`/)
  assert.match(api, /version\.status === 'DRAFT'/)
  assert.match(api, /http\.post<AgentProfileVersion>\(`\$\{profilesPath\}\/\$\{encodedCode\}\/versions`/)
  assert.match(detail, /createsNewVersion\.value = version\.status !== 'DRAFT'/)
  assert.match(detail, /createNewVersion: createsNewVersion\.value/)
  assert.match(detail, /name: 'agent-config-detail'/)
})
