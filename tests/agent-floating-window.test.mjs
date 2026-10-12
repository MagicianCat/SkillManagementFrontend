import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('floating assistant stays within viewport on scaled and short screens', async () => {
  const source = await readFile(new URL('../src/features/agent/AgentFloatingWindow.vue', import.meta.url), 'utf8')
  assert.match(source, /width: min\(390px, max\(320px, 34vw\), calc\(100vw - 24px\)\)/)
  assert.match(source, /height: min\(520px, 68vh, calc\(100vh - 24px\)\)/)
  assert.match(source, /@supports \(height: 100dvh\)/)
  assert.match(source, /max-height: min\(520px, 68dvh, calc\(100dvh - 24px\)\)/)
  assert.match(source, /@media \(max-width: 640px\)/)
  assert.match(source, /safe-area-inset-bottom/)
})
