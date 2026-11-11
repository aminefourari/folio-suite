import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, ChevronLeft, ChevronRight, Copy, FileDown, Italic,
  LayoutTemplate, List, ListOrdered, Palette, Play, Plus, Trash2, Underline, X,
} from 'lucide-react'
import { useAutosave } from '@folio/ui/autosave.tsx'
import { EditorBar, Tool } from '@folio/ui/chrome.tsx'
import { Select } from '@folio/ui/Select.tsx'
import { LAYOUTS, SlideView, THEMES, newSlide, parseDeck, sanitizeDeck, type Deck, type Layout, type Slide, type ThemeId } from '../deck.tsx'
import { getDoc, saveDoc } from '../docs'

export const Route = createFileRoute('/doc/$id')({
  loader: ({ params }) => getDoc({ data: Number(params.id) }),
  component: function DocPage() {
    const doc = Route.useLoaderData()
    // Parse and sanitize in the browser (needs DOMParser); the server renders a placeholder.
    const [deck, setDeck] = useState<Deck | null>(null)
    useEffect(() => setDeck(sanitizeDeck(parseDeck(doc.content))), [doc.id])
    return deck
      ? <Stage key={doc.id} doc={doc} initial={deck} />
      : <div className="app"><div className="stage-loading" aria-busy="true" /></div>
  },
})

const THEME_OPTIONS = (Object.keys(THEMES) as ThemeId[]).map((id) => ({
  value: id, label: THEMES[id].name,
  hint: <span className="swatch" style={{ background: THEMES[id].bg, borderColor: THEMES[id].accent }} />,
}))
const keepFocus = (e: React.MouseEvent) => e.preventDefault()
const exec = (cmd: string) => document.execCommand(cmd, false)
const TEXT_CMDS = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight']

function Stage({ doc, initial }: { doc: { id: number; title: string }; initial: Deck }) {
  const [title, setTitle] = useState(doc.title)
  const [deck, setDeck] = useState(initial)
  const [cur, setCur] = useState(0)
  const [presenting, setPresenting] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const rail = useRef<HTMLDivElement>(null)

  const { status, error, touch } = useAutosave(() =>
    saveDoc({ data: { id: doc.id, title, content: JSON.stringify(deck) } }))

  const slide = deck.slides[cur] ?? deck.slides[0]
  const update = (next: Deck) => { setDeck(next); touch() }
  const patch = (p: Partial<Slide>) =>
    update({ ...deck, slides: deck.slides.map((s, i) => (i === cur ? { ...s, ...p } : s)) })
  const go = (i: number) => setCur(Math.max(0, Math.min(deck.slides.length - 1, i)))
  useEffect(() => {
    rail.current?.querySelector(`[data-i="${cur}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cur])
  const insertAt = (i: number, s: Slide) => {
    const slides = [...deck.slides]
    slides.splice(i, 0, s)
    update({ ...deck, slides })
    setCur(i)
  }
  const addSlide = (layout: Layout = 'content') => insertAt(cur + 1, newSlide(layout))
  const duplicate = () => insertAt(cur + 1, { ...slide, id: newSlide().id })
  const remove = () => {
    if (deck.slides.length === 1) return update({ ...deck, slides: [newSlide('title')] })
    update({ ...deck, slides: deck.slides.filter((_, i) => i !== cur) })
    setCur(Math.min(cur, deck.slides.length - 2))
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= deck.slides.length || from === to) return
    const slides = [...deck.slides]
    const [s] = slides.splice(from, 1)
    slides.splice(to, 0, s)
    update({ ...deck, slides })
    setCur(to)
  }

  // Reflect bold/italic/list state for the focused text box.
  useEffect(() => {
    const refresh = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el?.isContentEditable) return setActive({})
      setActive(Object.fromEntries(TEXT_CMDS.map((c) => [c, document.queryCommandState(c)])))
    }
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  }, [])

  const run = (cmd: string) => {
    const el = document.activeElement as HTMLElement | null
    if (!el?.isContentEditable || el.getAttribute('contenteditable') === 'plaintext-only') return
    exec(cmd)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const onRailKey = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      e.altKey ? move(cur, cur + d) : go(cur + d)
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove() }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate() }
    else if (e.key === 'Enter') { e.preventDefault(); addSlide() }
  }


  return (
    <div className="app">
      <EditorBar app="stage" title={title} onTitle={(t) => { setTitle(t); touch() }} status={status} error={error}>
        <button className="btn ghost" onClick={() => window.print()}><FileDown size={16} />Export PDF</button>
        <button className="btn accent" onClick={() => setPresenting(true)}><Play size={16} /><span className="label">Present</span></button>
      </EditorBar>

      <div className="toolbar">
        <div className="group first">
          <button className="tool wide" onMouseDown={keepFocus} onClick={() => addSlide()}><Plus />New slide</button>
          <Select label="Slide layout" value={slide.layout} options={LAYOUTS} width={176} icon={<LayoutTemplate size={16} />}
            onChange={(layout) => patch({ layout })} />
          <Select label="Theme" value={deck.theme} options={THEME_OPTIONS} width={130} icon={<Palette size={16} />}
            onChange={(theme) => update({ ...deck, theme })} />
        </div>
        <div className="group">
          <Tool label="Bold (⌘B)" pressed={active['bold']} onClick={() => run('bold')}><Bold /></Tool>
          <Tool label="Italic (⌘I)" pressed={active['italic']} onClick={() => run('italic')}><Italic /></Tool>
          <Tool label="Underline (⌘U)" pressed={active['underline']} onClick={() => run('underline')}><Underline /></Tool>
        </div>
        <div className="group">
          <Tool label="Bulleted list" pressed={active['insertUnorderedList']} onClick={() => run('insertUnorderedList')}><List /></Tool>
          <Tool label="Numbered list" pressed={active['insertOrderedList']} onClick={() => run('insertOrderedList')}><ListOrdered /></Tool>
        </div>
        <div className="group">
          <Tool label="Align left" pressed={active['justifyLeft']} onClick={() => run('justifyLeft')}><AlignLeft /></Tool>
          <Tool label="Center" pressed={active['justifyCenter']} onClick={() => run('justifyCenter')}><AlignCenter /></Tool>
          <Tool label="Align right" pressed={active['justifyRight']} onClick={() => run('justifyRight')}><AlignRight /></Tool>
        </div>
        <div className="group">
          <Tool label="Move slide up (⌥↑)" onClick={() => move(cur, cur - 1)} disabled={cur === 0}><ArrowUp /></Tool>
          <Tool label="Move slide down (⌥↓)" onClick={() => move(cur, cur + 1)} disabled={cur === deck.slides.length - 1}><ArrowDown /></Tool>
          <Tool label="Duplicate slide (⌘D)" onClick={duplicate}><Copy /></Tool>
          <Tool label="Delete slide" onClick={remove}><Trash2 /></Tool>
        </div>
      </div>

      <div className="stage-body">
        <div ref={rail} className="rail" role="listbox" aria-label="Slides" tabIndex={0} onKeyDown={onRailKey}
          aria-activedescendant={`slide-${cur}`}>
          {deck.slides.map((s, i) => (
            <div key={s.id} id={`slide-${i}`} data-i={i} role="option" aria-selected={i === cur} aria-label={`Slide ${i + 1}`}
              className={['thumb-row', i === cur ? 'current' : '', dropAt === i && dragFrom !== null ? 'drop' : '', dragFrom === i ? 'dragging' : ''].join(' ')}
              draggable onClick={() => setCur(i)}
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); setDropAt(i) }}
              onDragEnd={() => { setDragFrom(null); setDropAt(null) }}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDropAt(null) }}>
              <span className="num">{i + 1}</span>
              <div className="thumb-slide"><SlideView slide={s} theme={deck.theme} placeholders={false} /></div>
            </div>
          ))}
          <button className="add-slide" onClick={() => insertAt(deck.slides.length, newSlide())}><Plus size={16} /><span>Add slide</span></button>
        </div>

        <main className="stage-main">
          <div className="stage-frame">
            <SlideView key={slide.id} slide={slide} theme={deck.theme} edit onChange={patch} />
          </div>
          <label className="notes">
            <span>Speaker notes</span>
            <textarea value={slide.notes} placeholder="What do you want to say on this slide?"
              onChange={(e) => patch({ notes: e.target.value })} />
          </label>
        </main>
      </div>

      <footer className="statusbar">
        <span>Slide {cur + 1} of {deck.slides.length}</span>
        <span>{THEMES[deck.theme].name} theme</span>
        <div className="spacer" />
        <span className="hide-sm">Drag slides to reorder · ⌥↑↓ to move · ⌘D to duplicate</span>
      </footer>

      {presenting && <Presenter deck={deck} start={cur} onExit={(i) => { setPresenting(false); go(i) }} />}

      <div className="print-deck" aria-hidden>
        {deck.slides.map((s) => <div key={s.id} className="print-page"><SlideView slide={s} theme={deck.theme} placeholders={false} /></div>)}
      </div>
    </div>
  )
}

function Presenter({ deck, start, onExit }: { deck: Deck; start: number; onExit: (i: number) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(start)
  const iRef = useRef(i)
  iRef.current = i
  const last = deck.slides.length - 1
  const next = () => setI((n) => Math.min(last, n + 1))
  const prev = () => setI((n) => Math.max(0, n - 1))

  useEffect(() => {
    const el = root.current!
    el.focus()
    el.requestFullscreen?.().catch(() => {})
    const onFs = () => { if (!document.fullscreenElement) onExit(iRef.current) }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next() }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev() }
    else if (e.key === 'Home') setI(0)
    else if (e.key === 'End') setI(last)
    else if (e.key === 'Escape') onExit(i)
  }

  return (
    <div ref={root} className="presenter" tabIndex={-1} role="dialog" aria-label="Presentation" onKeyDown={onKey}>
      <div className="presenter-slide" onClick={next}>
        <SlideView key={deck.slides[i].id} slide={deck.slides[i]} theme={deck.theme} placeholders={false} />
      </div>
      <div className="presenter-hud">
        <button onClick={prev} disabled={i === 0} aria-label="Previous slide"><ChevronLeft size={18} /></button>
        <span>{i + 1} / {deck.slides.length}</span>
        <button onClick={next} disabled={i === last} aria-label="Next slide"><ChevronRight size={18} /></button>
        <button onClick={() => onExit(i)} aria-label="Exit presentation"><X size={18} /></button>
      </div>
      <div className="presenter-progress" style={{ width: `${((i + 1) / deck.slides.length) * 100}%` }} />
    </div>
  )
}
