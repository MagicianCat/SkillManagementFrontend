import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('document agent flow keeps DSH and artifact navigation separate', async () => {
  const router = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  const view = await readFile(new URL('../src/views/DocumentAgentView.vue', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/api/document-agent.api.ts', import.meta.url), 'utf8')
  assert.match(router, /name: 'document-agent'/)
  assert.match(router, /name: 'project-document'/)
  assert.match(view, /router-link[^>]+project-document/)
  assert.doesNotMatch(view, /name: ['"]agent['"]/)
  assert.match(api, /Accept: 'text\/event-stream'/)
  assert.match(view, /平台 Wiki 上下文/)
  assert.match(view, /saveWiki/)
  assert.match(api, /wiki-contexts/)
  assert.doesNotMatch(api, /wikiDocuments.*sendDocumentAgentTurn/)
})
