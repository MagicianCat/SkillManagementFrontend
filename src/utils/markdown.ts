import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false, breaks: true, linkify: true })

// Open linkified / markdown links in a new tab and prevent reverse tabnabbing.
const defaultRender =
  parser.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
parser.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]?.attrSet('target', '_blank')
  tokens[idx]?.attrSet('rel', 'noopener noreferrer')
  return defaultRender(tokens, idx, options, env, self)
}

export function renderMarkdown(value: string | null) {
  return DOMPurify.sanitize(parser.render(value || ''), {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
  })
}
