import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false, breaks: true, linkify: true })

export function renderAgentMarkdown(value: string) {
  return DOMPurify.sanitize(parser.render(value || ''), {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
  })
}
