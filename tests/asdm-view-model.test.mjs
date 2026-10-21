import test from 'node:test'
import assert from 'node:assert/strict'
import { asdmStatusLabel, groupCandidateFiles, isRetryableFile } from '../src/features/asdm/asdm-view-model.js'

test('ASDM candidate states are presented with user-facing labels', () => {
  assert.equal(asdmStatusLabel('DEBOUNCING'), '静默中')
  assert.equal(asdmStatusLabel('AUTH_PAUSED'), 'Token 失效')
  assert.equal(asdmStatusLabel('UNRECOGNIZED'), 'ASDM · UNRECOGNIZED')
})

test('candidate file grouping separates publishable, uncertain, external and excluded files', () => {
  const files = [
    { path: 'req.md', association: 'CONFIRMED' },
    { path: 'maybe.md', association: 'LIKELY' },
    { path: 'shared.xlsx', association: 'UNCERTAIN' },
    { path: 'repo/pr', association: 'EXTERNAL_REF' },
    { path: 'toolsets/template.md', association: 'EXCLUDED' },
    { path: 'large.bin', association: 'OVERSIZE' },
  ]
  const groups = groupCandidateFiles(files)
  assert.deepEqual(groups.confirmed.map(file => file.path), ['req.md'])
  assert.deepEqual(groups.likely.map(file => file.path), ['maybe.md'])
  assert.deepEqual(groups.uncertain.map(file => file.path), ['shared.xlsx', 'large.bin'])
  assert.deepEqual(groups.external.map(file => file.path), ['repo/pr'])
  assert.deepEqual(groups.excluded.map(file => file.path), ['toolsets/template.md'])
})

test('only failed or reconciliation-required package files are offered for retry', () => {
  assert.equal(isRetryableFile('FAILED'), true)
  assert.equal(isRetryableFile('RECONCILE_REQUIRED'), true)
  assert.equal(isRetryableFile('PUBLISHED'), false)
  assert.equal(isRetryableFile('UPLOADING'), false)
})
