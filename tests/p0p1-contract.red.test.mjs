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

test('P0 project start requires initialRequest and workflow snapshot', async () => {
  const projects = await read('src/views/ProjectsView.vue')
  const workflow = await read('src/api/workflow.api.ts')
  assert.match(projects, /initialRequest/)
  assert.match(workflow, /initialRequest/)
  assert.match(workflow, /workflowCode/)
  assert.match(workflow, /workflowVersion/)
})

test('P0 intervention contract includes info and retry controls', async () => {
  const chat = await read('src/features/intervention/AgentInterventionChat.vue')
  assert.match(chat, /PROVIDE_INFO/)
  for (const action of ['ASK', 'CORRECT', 'PAUSE', 'RESUME', 'CANCEL', 'RETRY']) assert.match(chat, new RegExp(action))
  assert.match(chat, /target/)
})

test('P1 workspace renders requirement team, revision, issues and human gate', async () => {
  const workspace = await read('src/views/ProjectWorkspaceView.vue')
  for (const marker of ['Clarifier', 'Writer', 'Reviewer', 'Revision', 'review issues', 'HUMAN_REQUIRED', 'data-testid="final-acceptance"']) assert.match(workspace, new RegExp(marker, 'i'))
})

test('P1 has a browser acceptance test with stable user journey selectors', async () => {
  const e2e = await read('e2e/requirement-workflow.spec.ts')
  assert.match(e2e, /initial-request/)
  assert.match(e2e, /agent-team/)
  assert.match(e2e, /document-revision/)
  assert.match(e2e, /final-acceptance/)
})
