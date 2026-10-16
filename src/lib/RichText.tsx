/**
 * Formatted news stories: bold, italic, underline and links, nothing else.
 *
 * A story is stored as a tiny subset of HTML — <p>, <br>, <strong>, <em>, <u>
 * and <a href> — and these rules hold everywhere it is read or written:
 *
 *  - Saving: the editor's content is rebuilt from scratch through
 *    `serializeRich`, which keeps only those six things. Whatever arrived by
 *    paste or by a browser's own editing quirks is reduced to them.
 *  - Showing: `RichBody` builds React elements for the allowed tags itself.
 *    Stored text is never handed to the page as HTML, so even a story that
 *    somehow contained <script> or an onerror= has nothing that can run.
 *  - Links: only http(s), mailto and tel. Anything else keeps its text and
 *    loses the link.
 *
 * Stories written before formatting existed are plain text, and keep reading
 * exactly as before: a blank line starts a paragraph.
 *
 * Shared by the app and the public site, so both agree on what a story is.
 */
import React from 'react'

/** A formatted story always opens with a paragraph tag; plain text never does. */
export function isRichBody(body: string): boolean {
  return /^\s*<p[\s>]/i.test(body)
}

/**
 * A link as it may be stored: http(s), mailto or tel only. A bare
 * "homewoodathletics.com" gets its https; anything else is refused.
 */
export function safeHref(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`
  return null
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;')

type Mark = 'strong' | 'em' | 'u'

/** Which of the three marks an element stands for, however the browser spelled it. */
function marksOf(el: Element): Mark[] {
  const tag = el.tagName.toLowerCase()
  const out: Mark[] = []
  if (tag === 'b' || tag === 'strong') out.push('strong')
  if (tag === 'i' || tag === 'em') out.push('em')
  if (tag === 'u' || tag === 'ins') out.push('u')
  // Browsers sometimes record formatting as inline styles instead of tags.
  const style = (el as HTMLElement).style
  if (style) {
    const w = style.fontWeight
    if (w === 'bold' || w === 'bolder' || Number(w) >= 600) out.push('strong')
    if (style.fontStyle === 'italic') out.push('em')
    if ((style.textDecoration || style.textDecorationLine || '').includes('underline')) out.push('u')
  }
  return [...new Set(out)]
}

const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'section', 'article', 'header', 'footer', 'pre', 'table', 'tbody', 'thead', 'tr', 'td', 'th'])

/** Inline content of a node, as allowed HTML. */
function inlineHtml(node: Node, inLink = false): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '<br>'
  if (tag === 'script' || tag === 'style' || tag === 'template') return ''
  let inner = [...el.childNodes].map(c => inlineHtml(c, inLink || tag === 'a')).join('')
  if (tag === 'a' && !inLink) {
    const href = safeHref(el.getAttribute('href'))
    if (href && inner.replace(/<br>/g, '').trim()) inner = `<a href="${escapeAttr(href)}">${inner}</a>`
  }
  for (const m of marksOf(el)) if (inner.trim()) inner = `<${m}>${inner}</${m}>`
  return inner
}

/**
 * Turn whatever is in an editor (or any HTML) into a stored story: paragraphs
 * of allowed inline content. Empty paragraphs are dropped, and an empty story
 * comes back as "" so a blank post is still recognized as blank.
 */
export function serializeRich(root: Node): string {
  const paras: string[] = []
  let current = ''
  const flush = () => {
    const html = current.replace(/^(<br>)+|(<br>)+$/g, '')
    if (html.replace(/<[^>]+>/g, '').trim()) paras.push(`<p>${html}</p>`)
    current = ''
  }
  const walk = (n: Node) => {
    if (n.nodeType === Node.ELEMENT_NODE && BLOCKS.has((n as Element).tagName.toLowerCase())) {
      flush()
      // A block holding other blocks (pasted layouts) is walked through, not kept.
      const hasBlocks = [...n.childNodes].some(c => c.nodeType === Node.ELEMENT_NODE && BLOCKS.has((c as Element).tagName.toLowerCase()))
      if (hasBlocks) [...n.childNodes].forEach(walk)
      else { current = inlineHtml(n).replace(/^<(strong|em|u)><\/\1>$/, ''); flush() }
      return
    }
    current += inlineHtml(n)
  }
  ;[...root.childNodes].forEach(walk)
  flush()
  return paras.join('')
}

/** Parse stored HTML in a detached document, where nothing in it can run. */
function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
}

/** What to load into the editor: a stored story, cleaned, or plain text turned into paragraphs. */
export function toEditorHtml(body: string): string {
  if (!body.trim()) return ''
  if (isRichBody(body)) return serializeRich(parse(body))
  return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${p.split('\n').map(escapeText).join('<br>')}</p>`).join('')
}

/** The story as plain words — for teasers, search, and checking it isn't blank. */
export function toPlainText(body: string): string {
  if (!isRichBody(body)) return body
  const root = parse(body)
  return [...root.querySelectorAll('p')].map(p => p.textContent ?? '').join('\n\n')
}

// ---------- showing a story ----------

function renderInline(node: Node, key: string, inLink = false): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return <br key={key} />
  const kids = [...el.childNodes].map((c, i) => renderInline(c, `${key}.${i}`, inLink || tag === 'a'))
  switch (tag) {
    case 'strong': return <strong key={key}>{kids}</strong>
    case 'em': return <em key={key}>{kids}</em>
    case 'u': return <u key={key}>{kids}</u>
    case 'a': {
      const href = inLink ? null : safeHref(el.getAttribute('href'))
      return href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{kids}</a>
        : <React.Fragment key={key}>{kids}</React.Fragment>
    }
    // Anything not on the list contributes its text and nothing else.
    default: return <React.Fragment key={key}>{kids}</React.Fragment>
  }
}

/** A story as paragraphs, formatted or plain. */
export function RichBody({ body }: { body: string }) {
  if (!isRichBody(body)) {
    return <>{body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map((p, i) => (
      <p key={i}>{p.split('\n').map((line, j) => <React.Fragment key={j}>{j > 0 && <br />}{line}</React.Fragment>)}</p>
    ))}</>
  }
  const root = parse(body)
  // Paragraphs only at the top: stray inline content is gathered into one.
  const blocks = [...root.childNodes].filter(b => b.nodeType !== Node.TEXT_NODE || (b.textContent ?? '').trim())
  return <>{blocks.map((b, i) => {
    const kids = b.nodeType === Node.ELEMENT_NODE && (b as Element).tagName.toLowerCase() === 'p'
      ? [...b.childNodes].map((c, j) => renderInline(c, `${i}.${j}`))
      : [renderInline(b, `${i}`)]
    return <p key={i}>{kids}</p>
  })}</>
}
