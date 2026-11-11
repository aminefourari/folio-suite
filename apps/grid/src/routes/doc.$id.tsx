import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Download, Eraser, FunctionSquare, Italic, Redo2, Sigma, Undo2, Upload,
} from 'lucide-react'
import { useAutosave } from '@folio/ui/autosave.tsx'
import { EditorBar, Tool } from '@folio/ui/chrome.tsx'
import { Select } from '@folio/ui/Select.tsx'
import { download, pickFile } from '@folio/ui/util.ts'
import { Err, FUNCTION_NAMES, colName, parseRef, ref } from '../formula.ts'
import {
  COLS, ROWS, display, evaluator, parse, parseCsv, serialize, toCsv,
  type Align, type Cell, type Cells, type Fmt,
} from '../sheet.ts'
import { createDoc, getDoc, saveDoc } from '../docs'

export const Route = createFileRoute('/doc/$id')({
  loader: ({ params }) => getDoc({ data: Number(params.id) }),
  component: function DocPage() {
    const doc = Route.useLoaderData()
    return <Sheet key={doc.id} doc={doc} />
  },
})

type Pos = [col: number, row: number]
const HEAD_H = 28, ROW_H = 28, ROWHEAD_W = 52, DEFAULT_W = 108
const FORMAT_OPTIONS: { value: Fmt; label: string; hint: string }[] = [
  { value: 'general', label: 'Automatic', hint: '1000.5' },
  { value: 'number', label: 'Number', hint: '1,000.50' },
  { value: 'integer', label: 'Whole number', hint: '1,001' },
  { value: 'currency', label: 'Currency', hint: '$1,000.50' },
  { value: 'percent', label: 'Percent', hint: '10.5%' },
]
const FN_OPTIONS = FUNCTION_NAMES.map((f) => ({ value: f, label: f }))
const clamp = ([c, r]: Pos): Pos => [Math.max(0, Math.min(COLS - 1, c)), Math.max(0, Math.min(ROWS - 1, r))]
const MIME = 'application/x-folio-grid'

function Sheet({ doc }: { doc: { id: number; title: string; content: string } }) {
  const navigate = useNavigate()
  const initial = useMemo(() => parse(doc.content), [doc.content])
  const [title, setTitle] = useState(doc.title)
  const [cells, setCells] = useState<Cells>(initial.cells)
  const [widths, setWidths] = useState(initial.widths)
  const [past, setPast] = useState<Cells[]>([])
  const [future, setFuture] = useState<Cells[]>([])
  const [anchor, setAnchor] = useState<Pos>([0, 0])
  const [focus, setFocus] = useState<Pos>([0, 0])
  const [editing, setEditing] = useState<{ text: string; from: 'cell' | 'bar' } | null>(null)
  const [nameBox, setNameBox] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)

  const { status, error, touch } = useAutosave(() =>
    saveDoc({ data: { id: doc.id, title, content: serialize({ cells, widths }) } }))

  const get = useMemo(() => evaluator(cells), [cells])
  const w = (c: number) => widths[c] ?? DEFAULT_W
  const lefts = useMemo(() => {
    const out = [ROWHEAD_W]
    for (let c = 0; c < COLS; c++) out.push(out[c] + (widths[c] ?? DEFAULT_W))
    return out
  }, [widths])

  const [c0, c1] = [Math.min(anchor[0], focus[0]), Math.max(anchor[0], focus[0])]
  const [r0, r1] = [Math.min(anchor[1], focus[1]), Math.max(anchor[1], focus[1])]
  const single = c0 === c1 && r0 === r1
  const inRange = (c: number, r: number) => c >= c0 && c <= c1 && r >= r0 && r <= r1
  const rangeRefs = () => {
    const out: string[] = []
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(ref(c, r))
    return out
  }
  const anchorRef = ref(...anchor)
  const selLabel = single ? anchorRef : `${ref(c0, r0)}:${ref(c1, r1)}`

  // ── edits ──
  const apply = (next: Cells) => {
    setPast((p) => [...p.slice(-99), cells])
    setFuture([])
    setCells(next)
    touch()
  }
  const undo = () => {
    if (!past.length) return
    setFuture((f) => [cells, ...f])
    setCells(past.at(-1)!)
    setPast((p) => p.slice(0, -1))
    touch()
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, cells])
    setCells(future[0])
    setFuture((f) => f.slice(1))
    touch()
  }
  const put = (next: Cells, key: string, cell: Cell) => {
    if (!cell.v && !cell.b && !cell.i && !cell.a && !cell.f) delete next[key]
    else next[key] = cell
  }
  const setValue = (key: string, v: string) => {
    const next = { ...cells }
    put(next, key, { ...cells[key], v })
    apply(next)
  }
  const styleRange = (patch: (c: Cell) => Partial<Cell>) => {
    const next = { ...cells }
    for (const k of rangeRefs()) { const cur = cells[k] ?? { v: '' }; put(next, k, { ...cur, ...patch(cur) }) }
    apply(next)
  }
  const allRange = (pred: (c: Cell | undefined) => boolean) => rangeRefs().every((k) => pred(cells[k]))
  const toggle = (key: 'b' | 'i') => {
    const on = allRange((c) => !!c?.[key])
    styleRange(() => ({ [key]: !on || undefined }))
  }
  const clearRange = () => {
    const next = { ...cells }
    for (const k of rangeRefs()) if (next[k]) put(next, k, { ...next[k], v: '' })
    apply(next)
  }

  // ── selection & navigation ──
  const ensureVisible = ([c, r]: Pos) => {
    const el = wrap.current
    if (!el) return
    const left = lefts[c], right = lefts[c + 1], top = HEAD_H + r * ROW_H, bottom = top + ROW_H
    if (left - ROWHEAD_W < el.scrollLeft) el.scrollLeft = left - ROWHEAD_W
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
    if (top - HEAD_H < el.scrollTop) el.scrollTop = top - HEAD_H
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  }
  const select = (a: Pos, f: Pos = a) => {
    setAnchor(clamp(a))
    setFocus(clamp(f))
    ensureVisible(clamp(f))
  }
  const focusGrid = () => wrap.current?.focus({ preventScroll: true })

  const startEdit = (text?: string) => {
    setEditing({ text: text ?? cells[anchorRef]?.v ?? '', from: 'cell' })
  }
  // Read through a ref: Enter commits and refocuses the grid, whose blur would otherwise commit a second time.
  const editRef = useRef(editing)
  editRef.current = editing
  const commit = (move: Pos = [0, 1]) => {
    const ed = editRef.current
    if (!ed) return
    editRef.current = null
    if (ed.text !== (cells[anchorRef]?.v ?? '')) setValue(anchorRef, ed.text)
    setEditing(null)
    select([anchor[0] + move[0], anchor[1] + move[1]])
    focusGrid()
  }
  const cancel = () => {
    editRef.current = null
    setEditing(null)
    focusGrid()
  }

  useEffect(() => {
    if (editing?.from === 'cell') {
      const el = input.current!
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing?.from])

  useEffect(() => {
    focusGrid()
    const up = () => { dragging.current = false }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  const onGridKey = (e: React.KeyboardEvent) => {
    if (editing || e.nativeEvent.isComposing) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key
    const moves: Record<string, Pos> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
    if (mod && k.toLowerCase() === 'b') { e.preventDefault(); toggle('b'); return }
    if (mod && k.toLowerCase() === 'i') { e.preventDefault(); toggle('i'); return }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); select([0, 0], [COLS - 1, ROWS - 1]); return }
    if (k in moves) {
      e.preventDefault()
      const [dc, dr] = moves[k]
      const jump = mod ? 1000 : 1
      if (e.shiftKey) { const f = clamp([focus[0] + dc * jump, focus[1] + dr * jump]); setFocus(f); ensureVisible(f) }
      else select([anchor[0] + dc * jump, anchor[1] + dr * jump])
      return
    }
    if (k === 'Tab') { e.preventDefault(); select([anchor[0] + (e.shiftKey ? -1 : 1), anchor[1]]); return }
    if (k === 'Enter' || k === 'F2') { e.preventDefault(); startEdit(); return }
    if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); clearRange(); return }
    if (k === 'Escape') { select(anchor); return }
    if (k.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(k) }
  }

  const onEditKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') { e.preventDefault(); commit([0, e.shiftKey ? -1 : 1]) }
    else if (e.key === 'Tab') { e.preventDefault(); commit([e.shiftKey ? -1 : 1, 0]) }
    else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  // ── clipboard ──
  const matrix = <T,>(f: (key: string) => T) => {
    const rows: T[][] = []
    for (let r = r0; r <= r1; r++) { const row: T[] = []; for (let c = c0; c <= c1; c++) row.push(f(ref(c, r))); rows.push(row) }
    return rows
  }
  const onCopy = (e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', matrix((k) => display(get(k), cells[k]?.f)).map((r) => r.join('\t')).join('\n'))
    e.clipboardData.setData(MIME, JSON.stringify(matrix((k) => cells[k] ?? null)))
  }
  const onCut = (e: React.ClipboardEvent) => {
    if (editing) return
    onCopy(e)
    clearRange()
  }
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing) return
    e.preventDefault()
    let rows: (Cell | null)[][]
    try {
      rows = JSON.parse(e.clipboardData.getData(MIME))
    } catch {
      const text = e.clipboardData.getData('text/plain').replace(/\r?\n$/, '')
      rows = text.split(/\r?\n/).map((l) => l.split('\t').map((v) => ({ v })))
    }
    const next = { ...cells }
    rows.forEach((row, dr) => row.forEach((cell, dc) => {
      const [c, r] = [c0 + dc, r0 + dr]
      if (c < COLS && r < ROWS) put(next, ref(c, r), cell ?? { v: '' })
    }))
    apply(next)
    select([c0, r0], clamp([c0 + (rows[0]?.length ?? 1) - 1, r0 + rows.length - 1]))
  }

  // ── tools ──
  const autoSum = () => {
    const [c, r] = anchor
    const isNum = (cc: number, rr: number) => typeof get(ref(cc, rr)) === 'number'
    let top = r
    while (top > 0 && isNum(c, top - 1)) top--
    if (top < r) return setValue(anchorRef, `=SUM(${ref(c, top)}:${ref(c, r - 1)})`)
    let left = c
    while (left > 0 && isNum(left - 1, r)) left--
    if (left < c) return setValue(anchorRef, `=SUM(${ref(left, r)}:${ref(c - 1, r)})`)
    setEditing({ text: '=SUM(', from: 'cell' })
  }

  const usedSize = () => {
    let mc = 0, mr = 0
    for (const k of Object.keys(cells)) { const [c, r] = parseRef(k)!; mc = Math.max(mc, c + 1); mr = Math.max(mr, r + 1) }
    return [mc, mr]
  }
  const exportCsv = () => {
    const [mc, mr] = usedSize()
    const rows = Array.from({ length: mr }, (_, r) => Array.from({ length: mc }, (_, c) => {
      const v = get(ref(c, r))
      return v instanceof Err ? v.code : v === null ? '' : String(v)
    }))
    download(`${title || 'Untitled spreadsheet'}.csv`, 'text/csv', toCsv(rows))
  }
  const importCsv = () => pickFile('.csv,text/csv', async (f) => {
    const imported: Cells = {}
    parseCsv(await f.text()).slice(0, ROWS).forEach((row, r) => row.slice(0, COLS).forEach((v, c) => { if (v) imported[ref(c, r)] = { v } }))
    const id = await createDoc({ data: { title: f.name.replace(/\.\w+$/, ''), content: serialize({ cells: imported, widths: {} }) } })
    navigate({ to: '/doc/$id', params: { id: String(id) } })
  })

  const resizeCol = (c: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX, start = w(c)
    const move = (ev: PointerEvent) => setWidths((ws) => ({ ...ws, [c]: Math.max(40, Math.min(480, start + ev.clientX - startX)) }))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); touch() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ── status: quick totals for the selection ──
  const totals = useMemo(() => {
    if (single) return null
    const nums: number[] = []
    let filled = 0
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const v = get(ref(c, r))
      if (v !== null && v !== '') filled++
      if (typeof v === 'number') nums.push(v)
    }
    const sum = nums.reduce((a, b) => a + b, 0)
    return { sum, avg: nums.length ? sum / nums.length : null, count: filled }
  }, [get, single, r0, r1, c0, c1])

  const a = cells[anchorRef]
  const bar = editing ? editing.text : a?.v ?? ''
  const align = (x: Align) => styleRange(() => ({ a: x }))
  const alignOn = (x: Align) => allRange((c) => c?.a === x)

  return (
    <div className="app">
      <EditorBar app="grid" title={title} onTitle={(t) => { setTitle(t); touch() }} status={status} error={error}>
        <button className="btn ghost" onClick={importCsv}><Upload size={16} />Import CSV</button>
        <button className="btn accent" onClick={exportCsv}><Download size={16} /><span className="label">Download CSV</span></button>
      </EditorBar>

      <div className="toolbar">
        <div className="group first">
          <Tool label="Undo" kbd="⌘Z" onClick={undo}><Undo2 /></Tool>
          <Tool label="Redo" kbd="⇧⌘Z" onClick={redo}><Redo2 /></Tool>
        </div>
        <div className="group">
          <Tool label="Bold" kbd="⌘B" pressed={allRange((c) => !!c?.b)} onClick={() => toggle('b')}><Bold /></Tool>
          <Tool label="Italic" kbd="⌘I" pressed={allRange((c) => !!c?.i)} onClick={() => toggle('i')}><Italic /></Tool>
        </div>
        <div className="group">
          <Tool label="Align left" pressed={alignOn('left')} onClick={() => align('left')}><AlignLeft /></Tool>
          <Tool label="Align center" pressed={alignOn('center')} onClick={() => align('center')}><AlignCenter /></Tool>
          <Tool label="Align right" pressed={alignOn('right')} onClick={() => align('right')}><AlignRight /></Tool>
        </div>
        <div className="group">
          <Select label="Number format" value={a?.f ?? 'general'} options={FORMAT_OPTIONS} width={150}
            onChange={(f) => styleRange(() => ({ f: f === 'general' ? undefined : f }))} />
        </div>
        <div className="group">
          <Tool label="AutoSum" onClick={autoSum}><Sigma /></Tool>
          <Select label="Insert function" value="" placeholder="Function" options={FN_OPTIONS} width={138}
            icon={<FunctionSquare size={16} />} onChange={(f) => setEditing({ text: `=${f}(`, from: 'cell' })} />
          <Tool label="Clear cells" kbd="Delete" onClick={clearRange}><Eraser /></Tool>
        </div>
      </div>

      <div className="formula-bar">
        <input className="name-box" aria-label="Selected cell" value={nameBox ?? selLabel}
          onFocus={(e) => { setNameBox(selLabel); e.target.select() }}
          onChange={(e) => setNameBox(e.target.value.toUpperCase())}
          onBlur={() => setNameBox(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setNameBox(null); focusGrid() }
            if (e.key !== 'Enter') return
            const [p, q] = (nameBox ?? '').split(':').map((s) => parseRef(s.trim()))
            if (p) { select(p, q ?? p); setNameBox(null); focusGrid() }
          }} />
        <span className="fx" aria-hidden>fx</span>
        <input className="fx-input" aria-label={`Contents of ${anchorRef}`} value={bar} spellCheck={false}
          placeholder={single ? 'Type a value or a formula like =SUM(A1:A5)' : ''}
          onFocus={() => !editing && setEditing({ text: a?.v ?? '', from: 'bar' })}
          onChange={(e) => setEditing({ text: e.target.value, from: 'bar' })}
          onBlur={() => editing?.from === 'bar' && commit([0, 0])}
          onKeyDown={onEditKey} />
      </div>

      <div ref={wrap} className="sheet-wrap" tabIndex={0} role="grid" aria-label="Spreadsheet" aria-rowcount={ROWS} aria-colcount={COLS}
        onKeyDown={onGridKey} onCopy={onCopy} onCut={onCut} onPaste={onPaste}>
        <div className="sheet-inner" style={{ width: lefts[COLS], height: HEAD_H + ROWS * ROW_H }}>
          <table className="sheet">
            <colgroup>
              <col style={{ width: ROWHEAD_W }} />
              {Array.from({ length: COLS }, (_, c) => <col key={c} style={{ width: w(c) }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="corner" onPointerDown={(e) => { e.preventDefault(); select([0, 0], [COLS - 1, ROWS - 1]) }} />
                {Array.from({ length: COLS }, (_, c) => (
                  <th key={c} className={c >= c0 && c <= c1 ? 'hl' : undefined}
                    onPointerDown={(e) => { e.preventDefault(); e.shiftKey ? setFocus([c, ROWS - 1]) : select([c, 0], [c, ROWS - 1]) }}>
                    {colName(c)}
                    <span className="resize" onPointerDown={resizeCol(c)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }, (_, r) => (
                <tr key={r}>
                  <th className={r >= r0 && r <= r1 ? 'hl' : undefined}
                    onPointerDown={(e) => { e.preventDefault(); e.shiftKey ? setFocus([COLS - 1, r]) : select([0, r], [COLS - 1, r]) }}>{r + 1}</th>
                  {Array.from({ length: COLS }, (_, c) => {
                    const key = ref(c, r)
                    const cell = cells[key]
                    const v = cell ? get(key) : null
                    const cls = [
                      inRange(c, r) && !single ? 'in' : '',
                      v instanceof Err ? 'err' : typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : '',
                      cell?.b ? 'b' : '', cell?.i ? 'i' : '', cell?.a ? `a-${cell.a}` : '',
                    ].join(' ').trim()
                    return (
                      <td key={c} className={cls || undefined} title={v instanceof Err ? `${v.code} in ${cell?.v}` : undefined}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return
                          e.preventDefault()
                          focusGrid()
                          if (e.pointerType === 'touch' && single && anchor[0] === c && anchor[1] === r) return startEdit()
                          if (e.shiftKey) setFocus([c, r])
                          else { setAnchor([c, r]); setFocus([c, r]) }
                          dragging.current = true
                        }}
                        onPointerEnter={() => dragging.current && setFocus([c, r])}
                        onDoubleClick={() => startEdit()}>
                        {cell ? display(v, cell.f) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sel" aria-hidden style={{
            left: lefts[c0] - 1, top: HEAD_H + r0 * ROW_H - 1,
            width: lefts[c1 + 1] - lefts[c0] + 1, height: (r1 - r0 + 1) * ROW_H + 1,
          }} />
          {editing?.from === 'cell' && (
            <input ref={input} className="cell-input" aria-label={`Edit ${anchorRef}`} value={editing.text} spellCheck={false}
              style={{ left: lefts[anchor[0]], top: HEAD_H + anchor[1] * ROW_H, minWidth: w(anchor[0]), height: ROW_H }}
              onChange={(e) => setEditing({ text: e.target.value, from: 'cell' })}
              onKeyDown={onEditKey} onBlur={() => commit([0, 0])} />
          )}
        </div>
      </div>

      <footer className="statusbar">
        <span>{single ? anchorRef : `${selLabel} · ${(r1 - r0 + 1) * (c1 - c0 + 1)} cells`}</span>
        <div className="spacer" />
        {totals && (<>
          <span>Sum <b>{display(totals.sum)}</b></span>
          {totals.avg !== null && <span>Average <b>{display(Number(totals.avg.toPrecision(10)))}</b></span>}
          <span>Count <b>{totals.count}</b></span>
        </>)}
      </footer>
    </div>
  )
}
