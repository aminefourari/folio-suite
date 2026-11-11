import { Err, createEvaluator, parseRef, type Val } from './formula.ts'

export type Align = 'left' | 'center' | 'right'
export type Fmt = 'general' | 'number' | 'integer' | 'currency' | 'percent'
export type Cell = { v: string; b?: boolean; i?: boolean; a?: Align; f?: Fmt }
export type Cells = Record<string, Cell>
export type Data = { cells: Cells; widths: Record<string, number> }

export const COLS = 26
export const ROWS = 100

const rowMajor = (a: string, b: string) => {
  const [ac, ar] = parseRef(a)!, [bc, br] = parseRef(b)!
  return ar - br || ac - bc
}

// Row-major key order keeps the top-left corner within the first few KB, which the files grid previews.
export const serialize = (d: Data) =>
  JSON.stringify({ cells: Object.fromEntries(Object.keys(d.cells).sort(rowMajor).map((k) => [k, d.cells[k]])), widths: d.widths })

export function parse(content: string): Data {
  try {
    const d = JSON.parse(content)
    return { cells: d.cells ?? {}, widths: d.widths ?? {} }
  } catch {
    return { cells: {}, widths: {} }
  }
}

/** Lenient parse of a truncated JSON prefix (list previews only get the first 4 KB). */
export function parsePreview(prefix: string): Cells {
  const cells: Cells = {}
  for (const m of prefix.matchAll(/"([A-Z]{1,3}\d+)":\{"v":"((?:[^"\\]|\\.)*)"/g)) {
    try { cells[m[1]] = { v: JSON.parse(`"${m[2]}"`) } } catch { /* cut mid-escape */ }
  }
  return cells
}

export const evaluator = (cells: Cells) => createEvaluator((r) => cells[r]?.v ?? '')

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(undefined, o)
const FORMATS: Record<Exclude<Fmt, 'general'>, Intl.NumberFormat> = {
  number: nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  integer: nf({ maximumFractionDigits: 0 }),
  currency: nf({ style: 'currency', currency: 'USD' }),
  percent: nf({ style: 'percent', maximumFractionDigits: 2 }),
}

export function display(v: Val, f: Fmt = 'general'): string {
  if (v === null) return ''
  if (v instanceof Err) return v.code
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return f === 'general' ? String(Number(v.toPrecision(12))) : FORMATS[f].format(v)
  return v
}

// CSV with RFC 4180 quoting.
export const toCsv = (rows: string[][]) =>
  rows.map((r) => r.map((s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)).join(',')).join('\r\n')

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === ',') { rows.at(-1)!.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      rows.at(-1)!.push(field); field = ''
      rows.push([])
    } else field += c
  }
  rows.at(-1)!.push(field)
  if (rows.length > 1 && rows.at(-1)!.join('') === '') rows.pop()
  return rows
}
