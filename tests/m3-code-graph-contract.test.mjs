import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const api = await readFile(new URL('../src/api/code-graph.api.ts', import.meta.url), 'utf8').catch(() => '')
const workflow = await readFile(new URL('../src/api/workflow.api.ts', import.meta.url), 'utf8')
const router = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
const view = await readFile(new URL('../src/views/CodeGraphView.vue', import.meta.url), 'utf8').catch(() => '')

test('M3 code graph API exposes prepare, status, retry and activate contracts', () => {
  assert.match(api, /workflow-runs:prepare/)
  assert.match(api, /code-graph/)
  assert.match(api, /:retry/)
  assert.match(workflow, /:activate/)
})

test('M3 has a dedicated code graph route and view', () => {
  assert.match(router, /projects\/:projectKey\/code-graph/)
  assert.match(router, /CodeGraphView/)
  assert.match(view, /正式开始工作流/)
  assert.match(view, /PREPARING_CODE_GRAPH|READY_TO_START|CODE_GRAPH_PREPARATION_FAILED/)
})

test('configured workflow starts with graph preparation and navigates to graph page', () => {
  assert.match(setup, /prepareWorkflowRun/)
  assert.match(setup, /project-code-graph|project-code-graph/)
  assert.doesNotMatch(setup, /startWorkflowRun\(projectKey\.value/)
})
