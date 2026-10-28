import test from 'node:test'
import assert from 'node:assert/strict'
import { citedWikiDocuments, isPlatformWikiDownload } from '../src/features/agent/wiki-downloads.ts'

test('extracts distinct platform Wiki citations for batch selection', () => {
  const markdown = '来源：《需求规范》[原文](http://127.0.0.1:5173/wiki?documentId=12) · [下载 Markdown](http://127.0.0.1:5173/wiki?documentId=12&download=1)\n\n来源：《测试计划》[原文](/wiki?documentId=34) · [下载 Markdown](/wiki?documentId=34&download=1)'
  assert.deepEqual(citedWikiDocuments(markdown), [
    { id: 12, title: '需求规范', sourceUrl: 'http://127.0.0.1:5173/wiki?documentId=12' },
    { id: 34, title: '测试计划', sourceUrl: '/wiki?documentId=34' },
  ])
})

test('intercepts only valid platform Wiki download links', () => {
  assert.equal(isPlatformWikiDownload('/wiki?documentId=12&download=1'), 12)
  assert.equal(isPlatformWikiDownload('/wiki?documentId=12'), null)
  assert.equal(isPlatformWikiDownload('https://www.feishu.cn/wiki/abc?download=1'), null)
  assert.equal(isPlatformWikiDownload('/wiki?documentId=not-a-number&download=1'), null)
})
