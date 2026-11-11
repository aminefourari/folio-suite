import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, CalendarDays, Download, FilePlus, Highlighter,
  Image, IndentDecrease, IndentIncrease, Italic, Link as LinkIcon, List, ListOrdered, Minus, Plus, Printer, Redo2,
  RemoveFormatting, Strikethrough, Subscript, Superscript, Table, Underline, Undo2, Upload,
} from 'lucide-react'
import { DOC_FONTS } from '@folio/ui/apps.tsx'
import { useAutosave } from '@folio/ui/autosave.tsx'
import { EditorBar, ShareDialog, Tool, WideTool } from '@folio/ui/chrome.tsx'
import { Select } from '@folio/ui/Select.tsx'
import { download, escapeHtml, pickFile, sanitize } from '@folio/ui/util.ts'
import { createDoc, getDoc, saveDoc, shareDoc } from '../docs'

export const Route = createFileRoute('/doc/$id')({
  loader: ({ params }) => getDoc({ data: Number(params.id) }),
  component: function DocPage() {
    const doc = Route.useLoaderData()
    return <Editor key={doc.id} doc={doc} />
  },
})

const SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72']
const TOGGLES = ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
  'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']
const STYLES = [
  { value: 'p', label: 'Normal text', hint: '11' },
  { value: 'h1', label: 'Title', hint: '26', style: { fontSize: 20, fontWeight: 650 } },
  { value: 'h2', label: 'Heading', hint: '17', style: { fontSize: 16, fontWeight: 650 } },
  { value: 'h3', label: 'Subheading', hint: '13', style: { fontWeight: 650 } },
  { value: 'blockquote', label: 'Quote', hint: '“”', style: { fontStyle: 'italic' } },
  { value: 'pre', label: 'Code', hint: '{ }', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 13 } },
]
const FONT_OPTIONS = DOC_FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: `'${f}'` } }))
const SIZE_OPTIONS = SIZES.map((s) => ({ value: s, label: s }))

// ponytail: document.execCommand is deprecated but universally supported; swap for TipTap/Lexical if you need collaboration or a real document model.
const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value)

function Editor({ doc }: { doc: { id: number; title: string; content: string; share_id: string | null } }) {
  const page = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [tab, setTab] = useState('Home')
  const [title, setTitle] = useState(doc.title)
  const [shareId, setShareId] = useState(doc.share_id)
  const [sharing, setSharing] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [block, setBlock] = useState('p')
  const [font, setFont] = useState('Inter')
  const [size, setSize] = useState('11')
  const [stats, setStats] = useState({ words: 0, chars: 0 })
  const [zoom, setZoom] = useState(100)
  const html = useRef(doc.content)

  const { status, error, touch } = useAutosave(() =>
    saveDoc({ data: { id: doc.id, title, content: html.current } }))

  const changed = () => {
    html.current = page.current!.innerHTML
    touch()
  }

  const refresh = () => {
    const sel = document.getSelection()
    if (!page.current || !sel?.anchorNode || !page.current.contains(sel.anchorNode)) return
    setActive(Object.fromEntries(TOGGLES.map((c) => [c, document.queryCommandState(c)])))
    setBlock(document.queryCommandValue('formatBlock').toLowerCase() || 'p')
    const el = sel.anchorNode.nodeType === 1 ? (sel.anchorNode as Element) : sel.anchorNode.parentElement!
    const cs = getComputedStyle(el)
    setFont(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim())
    setSize(String(Math.round(parseFloat(cs.fontSize) * 0.75)))
  }

  const count = () => {
    const text = page.current?.innerText ?? ''
    setStats({ words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.replace(/\n/g, '').length })
  }

  useEffect(() => {
    page.current!.innerHTML = sanitize(doc.content)
    exec('styleWithCSS', 'true')
    exec('defaultParagraphSeparator', 'p')
    count()
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  }, [])

  const run = (cmd: string, value?: string) => {
    page.current!.focus()
    exec(cmd, value)
    changed()
    refresh()
    count()
  }

  // execCommand only knows sizes 1–7; apply size 7 as a marker, then swap it for a real pt size.
  const setFontSize = (pt: string) => {
    page.current!.focus()
    exec('styleWithCSS', 'false')
    exec('fontSize', '7')
    exec('styleWithCSS', 'true')
    page.current!.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span')
      span.style.fontSize = `${pt}pt`
      span.append(...Array.from(f.childNodes))
      f.replaceWith(span)
    })
    setSize(pt)
    changed()
  }

  const openNew = async (title?: string, content?: string) =>
    navigate({ to: '/doc/$id', params: { id: String(await createDoc({ data: { title, content } })) } })

  // Imported files become a new document.
  const fileImport = () => pickFile('.html,.htm,.txt,.md', async (f) => {
    const text = await f.text()
    openNew(f.name.replace(/\.\w+$/, ''), /\.html?$/i.test(f.name)
      ? sanitize(text)
      : text.split('\n').map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`).join(''))
  })

  // Word processors open HTML saved with a .doc extension.
  const downloadDoc = () => download(`${title || 'Untitled document'}.doc`, 'application/msword',
    `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${page.current!.innerHTML}</body></html>`)

  const insertImage = () => pickFile('image/*', (f) => {
    if (f.size > 800_000) return alert('Please pick an image under 800 KB so the document can still be saved.')
    const r = new FileReader()
    r.onload = () => run('insertImage', r.result as string)
    r.readAsDataURL(f)
  })

  const insertTable = () => {
    const rows = Number(prompt('Rows', '3')), cols = Number(prompt('Columns', '3'))
    if (!(rows > 0 && cols > 0 && rows <= 50 && cols <= 12)) return
    const tr = `<tr>${'<td><br></td>'.repeat(cols)}</tr>`
    run('insertHTML', `<table>${tr.repeat(rows)}</table><p><br></p>`)
  }

  const insertLink = () => {
    const url = prompt('Link URL', 'https://')
    if (url && /^(https?:|mailto:)/i.test(url)) run('createLink', url)
  }


  return (
    <div className="app">
      <EditorBar app="write" title={title} onTitle={(t) => { setTitle(t); touch() }} status={status} error={error}
        onShare={() => setSharing(true)} shared={!!shareId}>
        <button className="btn ghost" onClick={() => window.print()}><Printer size={16} />Print</button>
        <button className="btn accent" onClick={downloadDoc}><Download size={16} /><span className="label">Download</span></button>
      </EditorBar>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Toolbar">
          {['Home', 'Insert', 'File'].map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {tab === 'Home' && (<>
          <div className="group">
            <Tool label="Undo" kbd="⌘Z" pressed={active['undo']} onClick={() => run('undo')}><Undo2 /></Tool>
            <Tool label="Redo" kbd="⇧⌘Z" pressed={active['redo']} onClick={() => run('redo')}><Redo2 /></Tool>
          </div>
          <div className="group">
            <Select label="Text style" value={STYLES.some((s) => s.value === block) ? block : 'p'} options={STYLES} width={130}
              onChange={(v) => run('formatBlock', v)} />
            <Select label="Font" value={DOC_FONTS.includes(font) ? font : ''} placeholder={font} options={FONT_OPTIONS} width={140}
              onChange={(v) => { run('fontName', v); setFont(v) }} />
            <Select label="Font size" value={SIZES.includes(size) ? size : ''} placeholder={size} options={SIZE_OPTIONS} width={64}
              onChange={setFontSize} />
          </div>
          <div className="group">
            <Tool label="Bold" kbd="⌘B" pressed={active['bold']} onClick={() => run('bold')}><Bold /></Tool>
            <Tool label="Italic" kbd="⌘I" pressed={active['italic']} onClick={() => run('italic')}><Italic /></Tool>
            <Tool label="Underline" kbd="⌘U" pressed={active['underline']} onClick={() => run('underline')}><Underline /></Tool>
            <Tool label="Strikethrough" pressed={active['strikeThrough']} onClick={() => run('strikeThrough')}><Strikethrough /></Tool>
            <Tool label="Subscript" pressed={active['subscript']} onClick={() => run('subscript')}><Subscript /></Tool>
            <Tool label="Superscript" pressed={active['superscript']} onClick={() => run('superscript')}><Superscript /></Tool>
            <label className="tool color" title="Text colour">
              <Baseline /><input type="color" aria-label="Text colour" defaultValue="#d93025"
                onChange={(e) => run('foreColor', e.target.value)} />
            </label>
            <label className="tool color" title="Highlight">
              <Highlighter /><input type="color" aria-label="Highlight colour" defaultValue="#fde047"
                onChange={(e) => run('hiliteColor', e.target.value)} />
            </label>
            <Tool label="Clear formatting" pressed={active['removeFormat']} onClick={() => run('removeFormat')}><RemoveFormatting /></Tool>
          </div>
          <div className="group">
            <Tool label="Bulleted list" pressed={active['insertUnorderedList']} onClick={() => run('insertUnorderedList')}><List /></Tool>
            <Tool label="Numbered list" pressed={active['insertOrderedList']} onClick={() => run('insertOrderedList')}><ListOrdered /></Tool>
            <Tool label="Decrease indent" kbd="⇧Tab" pressed={active['outdent']} onClick={() => run('outdent')}><IndentDecrease /></Tool>
            <Tool label="Increase indent" kbd="Tab" pressed={active['indent']} onClick={() => run('indent')}><IndentIncrease /></Tool>
          </div>
          <div className="group">
            <Tool label="Align left" pressed={active['justifyLeft']} onClick={() => run('justifyLeft')}><AlignLeft /></Tool>
            <Tool label="Center" pressed={active['justifyCenter']} onClick={() => run('justifyCenter')}><AlignCenter /></Tool>
            <Tool label="Align right" pressed={active['justifyRight']} onClick={() => run('justifyRight')}><AlignRight /></Tool>
            <Tool label="Justify" pressed={active['justifyFull']} onClick={() => run('justifyFull')}><AlignJustify /></Tool>
          </div>
        </>)}

        {tab === 'Insert' && (
          <div className="group">
            <WideTool label="Table" onClick={insertTable}><Table /></WideTool>
            <WideTool label="Picture" onClick={insertImage}><Image /></WideTool>
            <WideTool label="Link" onClick={insertLink}><LinkIcon /></WideTool>
            <WideTool label="Divider" onClick={() => run('insertHorizontalRule')}><Minus /></WideTool>
            <WideTool label="Date" onClick={() => run('insertHTML', `${new Date().toLocaleDateString()}&nbsp;`)}><CalendarDays /></WideTool>
          </div>
        )}

        {tab === 'File' && (
          <div className="group">
            <WideTool label="New" onClick={() => openNew()}><FilePlus /></WideTool>
            <WideTool label="Import" onClick={fileImport}><Upload /></WideTool>
            <WideTool label="Download .doc" onClick={downloadDoc}><Download /></WideTool>
            <WideTool label="Print / PDF" onClick={() => window.print()}><Printer /></WideTool>
          </div>
        )}
      </div>

      <main className="canvas" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); page.current!.focus() } }}>
        <div ref={page} className="page" contentEditable suppressContentEditableWarning spellCheck
          role="textbox" aria-multiline aria-label="Document body" style={{ zoom: zoom / 100 }}
          onInput={() => { changed(); count() }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') { e.preventDefault(); run(e.shiftKey ? 'outdent' : 'indent') }
          }} />
      </main>

      <footer className="statusbar">
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.chars.toLocaleString()} characters</span>
        <div className="spacer" />
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out"><Minus size={14} /></button>
          <input type="range" min={50} max={200} step={10} value={zoom} aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))} />
          <button onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Zoom in"><Plus size={14} /></button>
          <span className="pct">{zoom}%</span>
        </div>
      </footer>
      <ShareDialog app="write" open={sharing} onClose={() => setSharing(false)} title={title} shareId={shareId}
        onToggle={async (on) => { const id = await shareDoc({ data: { id: doc.id, on } }); setShareId(id); return id }} />
    </div>
  )
}
