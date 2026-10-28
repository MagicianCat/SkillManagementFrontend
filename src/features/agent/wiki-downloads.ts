import MarkdownIt from 'markdown-it'

export interface AgentWikiDocument {
  id: number
  title: string
  sourceUrl: string
}

const parser = new MarkdownIt({ html: false, linkify: true })

export function platformWikiDocumentId(href: string): number | null {
  try {
    const url = new URL(href, 'http://agent.local')
    if (url.pathname !== '/wiki') return null
    const raw = url.searchParams.get('documentId')
    if (!raw || !/^[1-9]\d*$/.test(raw)) return null
    const id = Number(raw)
    return Number.isSafeInteger(id) ? id : null
  } catch { return null }
}

export function isPlatformWikiDownload(href: string): number | null {
  try {
    const url = new URL(href, 'http://agent.local')
    return url.searchParams.get('download') === '1' ? platformWikiDocumentId(href) : null
  } catch { return null }
}

export function citedWikiDocuments(markdown: string): AgentWikiDocument[] {
  const found = new Map<number, AgentWikiDocument>()
  for (const block of parser.parse(markdown, {})) {
    const parts = block.children ?? []
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part?.type !== 'link_open') continue
      const href = String(part.attrGet('href') ?? '')
      const id = platformWikiDocumentId(href)
      if (id === null) continue
      const previous = parts[i - 1]?.content ?? ''
      const titleBefore = previous.match(/[《「]([^》」]+)[》」]\s*$/)?.[1]
      const label = parts[i + 1]?.content?.trim() ?? ''
      const title = titleBefore || (!/^(原文|下载|下载 Markdown|查看原文)$/i.test(label) ? label : '') || `Wiki 文档 #${id}`
      const existing = found.get(id)
      if (!existing) found.set(id, { id, title, sourceUrl: href })
      else if (existing.title.startsWith('Wiki 文档 #') && !title.startsWith('Wiki 文档 #')) existing.title = title
      if (existing && isPlatformWikiDownload(existing.sourceUrl) !== null && isPlatformWikiDownload(href) === null) existing.sourceUrl = href
    }
  }
  return [...found.values()]
}
