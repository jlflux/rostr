import { useEffect, useRef, useState } from 'react'
import { safeHref, serializeRich, toEditorHtml } from '../lib/RichText'

type Cmd = 'bold' | 'italic' | 'underline'

/**
 * A story editor with bold, italic, underline and links — and nothing else.
 *
 * Formatting is applied with the browser's own editing commands, so it behaves
 * like any word processor (including Ctrl/⌘+B, I and U). Every change is then
 * rebuilt through `serializeRich`, which is what gets saved: whatever the
 * browser or a paste put in the box, only paragraphs and those four kinds of
 * formatting survive.
 *
 * Pasting brings in text only. Pasted pages and Word documents carry fonts,
 * colors and layout that would fight the site's design, and formatting is two
 * clicks away anyway.
 */
export function RichEditor({ value, onChange, placeholder, invalid }: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  invalid?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const saved = useRef<Range | null>(null)
  const [active, setActive] = useState<Record<Cmd | 'link', boolean>>({ bold: false, italic: false, underline: false, link: false })
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')

  // Loaded once; from then on the box owns its content and reports changes up.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = toEditorHtml(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const report = () => { if (ref.current) onChange(serializeRich(ref.current)) }

  const inEditor = (n: Node | null) => !!n && !!ref.current && ref.current.contains(n)

  // Light up the buttons for the formatting under the cursor.
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection()
      if (!sel || !inEditor(sel.anchorNode)) return
      let n: Node | null = sel.anchorNode, link = false
      while (n && n !== ref.current) { if ((n as Element).tagName === 'A') link = true; n = n.parentNode }
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        link,
      })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const run = (cmd: Cmd) => {
    ref.current?.focus()
    document.execCommand(cmd)
    report()
  }

  // The link field takes focus, which loses the selection — so it is kept and put back.
  const openLink = () => {
    const sel = document.getSelection()
    saved.current = sel && sel.rangeCount && inEditor(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
    // Editing an existing link starts from its address.
    let n: Node | null = sel?.anchorNode ?? null, existing = ''
    while (n && n !== ref.current) { if ((n as Element).tagName === 'A') { existing = (n as Element).getAttribute('href') ?? ''; break } n = n.parentNode }
    setUrl(existing)
    setUrlError('')
    setLinking(true)
  }

  const restore = () => {
    ref.current?.focus()
    const sel = document.getSelection()
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current) }
    return sel
  }

  const applyLink = () => {
    const href = safeHref(url)
    if (!href) { setUrlError('Enter a web address, like homewoodathletics.com'); return }
    const sel = restore()
    if (!sel || sel.isCollapsed) {
      // Nothing selected: the address itself becomes the linked text.
      const a = document.createElement('a')
      a.href = href
      a.textContent = url.trim()
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null
      if (range && inEditor(range.startContainer)) { range.insertNode(a); range.setStartAfter(a); range.collapse(true) }
      else ref.current?.appendChild(a)
    } else {
      document.execCommand('createLink', false, href)
    }
    setLinking(false)
    report()
  }

  const removeLink = () => {
    restore()
    document.execCommand('unlink')
    setLinking(false)
    report()
  }

  return (
    <div className={`rte ${invalid ? 'invalid' : ''}`}>
      <div className="rte-bar" role="toolbar" aria-label="Formatting">
        {/* mousedown, not click: a click would take focus from the text first and lose the selection. */}
        <button type="button" className={active.bold ? 'on' : ''} title="Bold (Ctrl+B)" aria-label="Bold"
          onMouseDown={e => { e.preventDefault(); run('bold') }}><b>B</b></button>
        <button type="button" className={active.italic ? 'on' : ''} title="Italic (Ctrl+I)" aria-label="Italic"
          onMouseDown={e => { e.preventDefault(); run('italic') }}><i>I</i></button>
        <button type="button" className={active.underline ? 'on' : ''} title="Underline (Ctrl+U)" aria-label="Underline"
          onMouseDown={e => { e.preventDefault(); run('underline') }}><u>U</u></button>
        <span className="rte-sep" />
        <button type="button" className={active.link ? 'on' : ''} title="Link (Ctrl+K)" aria-label="Link"
          onMouseDown={e => { e.preventDefault(); openLink() }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          <span>Link</span>
        </button>
      </div>

      {linking && (
        <div className="rte-link">
          <input autoFocus value={url} placeholder="homewoodathletics.com/tickets"
            onChange={e => { setUrl(e.target.value); setUrlError('') }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') { e.preventDefault(); setLinking(false); restore() }
            }} />
          <button type="button" className="btn sm primary" onClick={applyLink}>{active.link ? 'Update link' : 'Add link'}</button>
          {active.link && <button type="button" className="btn sm" onClick={removeLink}>Remove link</button>}
          <button type="button" className="btn sm ghost" onClick={() => { setLinking(false); restore() }}>Cancel</button>
          {urlError && <span className="tiny" style={{ color: 'var(--danger)', flexBasis: '100%' }}>{urlError}</span>}
        </div>
      )}

      <div
        ref={ref}
        className="rte-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onInput={report}
        onPaste={e => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink() }
        }}
        onClick={e => {
          // Clicking a link while writing shouldn't navigate away from the post.
          if ((e.target as Element).closest('a')) e.preventDefault()
        }}
      />
    </div>
  )
}
