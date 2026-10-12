import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('project creation is independent from Feishu publication target configuration', async () => {
  const projects = await read('src/views/ProjectsView.vue')
  const api = await read('src/api/projects.api.ts')

  assert.doesNotMatch(projects, /feishu-wiki-root-url/)
  assert.doesNotMatch(projects, /feishuWikiRootUrl/)

  const createProject = api.slice(
    api.indexOf('export async function createProject'),
    api.indexOf('export async function validateFeishuPublishTarget'),
  )
  assert.doesNotMatch(createProject, /feishuWikiRootUrl/)
})

test('Agent setup saves the Feishu publication target through the single validating endpoint', async () => {
  const setup = await read('src/views/ProjectAgentSetupView.vue')

  assert.match(setup, /飞书发布目录/)
  assert.match(setup, /updateFeishuPublishTarget\(projectKey, url\)/)
  assert.doesNotMatch(setup, /await validateFeishuPublishTarget\(url\)/)
})
