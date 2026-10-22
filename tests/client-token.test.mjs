import test from 'node:test'
import assert from 'node:assert/strict'
import { clientToken } from '../src/utils/clientToken.ts'

test('document draft token works when browser has no randomUUID', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues(bytes) { bytes.fill(0x2a); return bytes } },
    })
    assert.equal(clientToken(), '2a'.repeat(16))
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
    assert.match(clientToken(), /^[0-9a-z]+-[0-9a-z]+$/)
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original)
    else delete globalThis.crypto
  }
})
