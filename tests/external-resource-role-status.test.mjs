import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('../src/api/external-resources.api.ts', import.meta.url), 'utf8')
const view = readFileSync(new URL('../src/views/ExternalResourcesView.vue', import.meta.url), 'utf8')

test('external resource admin role list displays ACTIVE and INACTIVE status', () => {
  assert.match(api, /status:\s*'ACTIVE'\s*\|\s*'INACTIVE'/)
  assert.match(view, /role\.status === 'ACTIVE' \? '启用 · ACTIVE' : '停用 · INACTIVE'/)
  assert.match(view, /role-status--active/)
  assert.match(view, /role-status--inactive/)
})
