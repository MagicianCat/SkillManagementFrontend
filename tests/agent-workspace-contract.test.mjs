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

test('project entry opens setup where the run is started after configuration', async () => {
  const projects = await readFile(new URL('../src/views/ProjectsView.vue', import.meta.url), 'utf8')
  const setup = await readFile(new URL('../src/views/ProjectAgentSetupView.vue', import.meta.url), 'utf8')
  assert.match(projects, /project-agent-setup/)
  assert.match(projects, /projectKey: project\.projectKey/)
  assert.match(setup, /startWorkflowRun\(projectKey,/)
  assert.match(setup, /initialRequest/)
  assert.match(setup, /contextSnapshotJson/)
})

test('profile view derives latest version from descending versions', async () => {
  const source = await readFile(new URL('../src/api/agent-config.api.ts', import.meta.url), 'utf8')
  assert.match(source, /const versions = profile\.versions\?\.map\(normalizeVersion\)/)
  assert.match(source, /: versions\?\.\[0\]/)
})
