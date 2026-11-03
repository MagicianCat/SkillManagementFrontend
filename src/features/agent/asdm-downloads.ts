import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false, linkify: true })

export interface AgentAsdmTool { assetId: number; title: string }

export function citedAsdmTools(markdown: string): AgentAsdmTool[] {
  const found = new Map<number, AgentAsdmTool>()
  for (const block of parser.parse(markdown, {})) {
    const parts = block.children ?? []
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part?.type !== 'link_open') continue
      try {
        const url = new URL(String(part.attrGet('href') ?? ''), 'http://agent.local')
        const match = /^\/asdm-tools\/download\/([1-9]\d*)\/?$/.exec(url.pathname)
        if (!match) continue
        const assetId = Number(match[1])
        if (!Number.isSafeInteger(assetId)) continue
        const title = parts[i + 1]?.content?.trim() || 'ASDM 工具包'
        found.set(assetId, { assetId, title })
      } catch { /* Ignore malformed links. */ }
    }
  }
  return [...found.values()]
}
