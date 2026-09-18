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

test('final acceptance uses explicit decision contract', async () => {
  const source = await readFile(new URL('../src/api/workflow.api.ts', import.meta.url), 'utf8')
  assert.match(source, /'ACCEPT' \| 'REWORK'/)
  assert.match(source, /targetStageKey/)
  assert.doesNotMatch(source, /accepted = true/)
})

test('project entry opens workspace where the run is started with an initial request', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const workspace = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  assert.match(projects, /name: 'project-workspace'/)
  assert.match(projects, /projectId: project\.projectKey/)
  assert.match(workspace, /startWorkflowRun\(projectKey\.value,/)
  assert.match(workspace, /data-testid="initial-request"/)
  assert.match(workspace, /data-testid="start-workflow"/)
})

test('one run per project: workspace auto-resumes the project current run when no runId in URL', async () => {
  const workspace = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/api/workflow.api.ts', import.meta.url), 'utf8')
  assert.match(api, /projects\/.*\/workflow-runs\/current/)
  assert.match(workspace, /getCurrentWorkflowRun\(projectKey\.value\)/)
})

test('profile view derives latest version from descending versions', async () => {
  const source = await readFile(new URL('../src/api/agent-config.api.ts', import.meta.url), 'utf8')
  assert.match(source, /const versions = profile\.versions\?\.map\(normalizeVersion\)/)
  assert.match(source, /: versions\?\.\[0\]/)
})
