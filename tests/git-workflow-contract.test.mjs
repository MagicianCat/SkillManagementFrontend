import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('project setup resolves repositories and locks saved entries after workflow start', async () => {
  const setup = await read('src/views/ProjectAgentSetupView.vue')
  const api = await read('src/api/git.api.ts')
  assert.match(setup, /识别仓库/)
  assert.match(setup, /BACKEND_CODING/)
  assert.match(setup, /FRONTEND_CODING/)
  assert.match(setup, /workflowStarted[\s\S]*appendProjectGitRepository/)
  assert.match(api, /git-repositories:resolve/)
  assert.match(api, /git-repositories:append/)
})

test('git stages render repository watch and require explicit human completion', async () => {
  const workspace = await read('src/views/ProjectWorkspaceView.vue')
  const panel = await read('src/features/workbench/GitWatchPanel.vue')
  assert.match(workspace, /executionMode === 'GIT_WATCH'/)
  assert.match(panel, /立即检查/)
  assert.match(panel, /当前未检测到相对 baseline 的新提交/)
  assert.match(panel, /completeExternalWorkflowStage/)
})

test('repository SSE events refresh the Git status without browser Git polling', async () => {
  const runtime = await read('src/stores/runtimeEvent.ts')
  const workspace = await read('src/views/ProjectWorkspaceView.vue')
  assert.match(runtime, /repository\.commit\.detected/)
  assert.match(runtime, /repository\.poll\.failed/)
  assert.match(workspace, /event-sequence="runtime\.events\.length"/)
})
