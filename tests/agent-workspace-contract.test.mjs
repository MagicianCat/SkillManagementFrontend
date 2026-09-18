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

test('project entry creates a workflow run before opening workspace', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const workspace = await readFile(new URL('../src/views/ProjectWorkspaceView.vue', import.meta.url), 'utf8')
  assert.match(projects, /startWorkflowRun\(selected\.value!\.projectKey,/)
  assert.match(projects, /runId:String\(workflowRun\.id\)/)
  assert.match(workspace, /route\.params\.runId \|\| ''/)
  assert.doesNotMatch(workspace, /route\.params\.runId \|\| route\.params\.projectId/)
})

test('profile view derives latest version from descending versions', async () => {
  const source = await readFile(new URL('../src/api/agent-config.api.ts', import.meta.url), 'utf8')
  assert.match(source, /const versions = profile\.versions\?\.map\(normalizeVersion\)/)
  assert.match(source, /: versions\?\.\[0\]/)
})
