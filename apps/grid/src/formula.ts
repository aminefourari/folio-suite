// Small spreadsheet formula engine: recursive descent, no eval.
// Supports + - * / ^ & %, comparisons, cell refs (A1, $B$2), ranges inside functions, strings, TRUE/FALSE,
// and SUM AVERAGE MIN MAX COUNT COUNTA ROUND ABS SQRT IF AND OR NOT CONCAT LEN UPPER LOWER.

export type ErrCode = '#DIV/0!' | '#VALUE!' | '#NAME?' | '#REF!' | '#CYCLE!' | '#ERROR!' | '#NUM!'
export class Err {
  readonly code: ErrCode
  constructor(code: ErrCode) { this.code = code }
  toString() { return this.code }
}
export type Val = number | string | boolean | null | Err
type Arg = Val | Val[]

export const colName = (i: number) => {
  let s = ''
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}
export const colIndex = (name: string) => [...name.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
export const ref = (col: number, row: number) => `${colName(col)}${row + 1}`
export function parseRef(r: string): [col: number, row: number] | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d{1,7})$/i.exec(r)
  return m && Number(m[2]) > 0 ? [colIndex(m[1]), Number(m[2]) - 1] : null
}

const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?%?$/i

/** Interpret a raw cell entry that is not a formula. */
export function literal(raw: string): Val {
  const s = raw.trim()
  if (s === '') return null
  if (NUMBER.test(s)) return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s)
  if (/^(true|false)$/i.test(s)) return s.toUpperCase() === 'TRUE'
  return raw
}

const isErr = (v: unknown): v is Err => v instanceof Err

function toNum(v: Val): number | Err {
  if (isErr(v)) return v
  if (v === null) return 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number') return v
  return NUMBER.test(v.trim()) ? (literal(v) as number) : new Err('#VALUE!')
}
const toStr = (v: Val) => (v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v))
const toBool = (v: Val): boolean | Err => {
  if (isErr(v)) return v
  if (typeof v === 'string') return /^true$/i.test(v) ? true : /^false$/i.test(v) ? false : new Err('#VALUE!')
  return Boolean(v)
}
const firstErr = (vs: Val[]) => vs.find(isErr)
const flat = (args: Arg[]) => args.flatMap((a) => (Array.isArray(a) ? a : [a]))
// Range contents: only real numbers count. Direct arguments are coerced.
const nums = (args: Arg[]): number[] | Err => {
  const out: number[] = []
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a) { if (isErr(v)) return v; if (typeof v === 'number') out.push(v) }
    } else {
      const n = toNum(a)
      if (isErr(n)) return n
      out.push(n)
    }
  }
  return out
}
const num = (f: (n: number[]) => number) => (args: Arg[]) => {
  const n = nums(args)
  return isErr(n) ? n : f(n)
}

const FUNCS: Record<string, (args: Arg[]) => Val> = {
  SUM: num((n) => n.reduce((a, b) => a + b, 0)),
  AVERAGE: (args) => { const n = nums(args); return isErr(n) ? n : n.length ? n.reduce((a, b) => a + b, 0) / n.length : new Err('#DIV/0!') },
  MIN: num((n) => (n.length ? Math.min(...n) : 0)),
  MAX: num((n) => (n.length ? Math.max(...n) : 0)),
  COUNT: (args) => flat(args).filter((v) => typeof v === 'number').length,
  COUNTA: (args) => flat(args).filter((v) => v !== null && v !== '').length,
  ROUND: (args) => {
    const [x, d = 0] = args.map((a) => (Array.isArray(a) ? new Err('#VALUE!') : toNum(a)))
    if (isErr(x)) return x
    if (isErr(d)) return d
    const f = 10 ** Math.trunc(d)
    return Math.round((x + Math.sign(x) * Number.EPSILON) * f) / f
  },
  ABS: num((n) => Math.abs(n[0] ?? 0)),
  SQRT: (args) => { const n = nums(args); return isErr(n) ? n : (n[0] ?? 0) < 0 ? new Err('#NUM!') : Math.sqrt(n[0] ?? 0) },
  IF: ([c, a = true, b = false]) => {
    if (Array.isArray(c) || Array.isArray(a) || Array.isArray(b)) return new Err('#VALUE!')
    const t = toBool(c)
    return isErr(t) ? t : t ? a : b
  },
  AND: (args) => { const vs = flat(args).map(toBool); return firstErr(vs as Val[]) ?? vs.every(Boolean) },
  OR: (args) => { const vs = flat(args).map(toBool); return firstErr(vs as Val[]) ?? vs.some(Boolean) },
  NOT: ([a]) => { if (Array.isArray(a)) return new Err('#VALUE!'); const t = toBool(a ?? null); return isErr(t) ? t : !t },
  CONCAT: (args) => firstErr(flat(args)) ?? flat(args).map(toStr).join(''),
  LEN: ([a]) => (Array.isArray(a) ? new Err('#VALUE!') : isErr(a) ? a : toStr(a ?? null).length),
  UPPER: ([a]) => (Array.isArray(a) ? new Err('#VALUE!') : isErr(a) ? a : toStr(a ?? null).toUpperCase()),
  LOWER: ([a]) => (Array.isArray(a) ? new Err('#VALUE!') : isErr(a) ? a : toStr(a ?? null).toLowerCase()),
}
export const FUNCTION_NAMES = Object.keys(FUNCS)

const TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:e[-+]?\d+)?|\.\d+(?:e[-+]?\d+)?)|("(?:[^"]|"")*")|(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)(?![A-Z0-9_(])|([A-Z_][A-Z0-9_.]*)|(<=|>=|<>|[-+*/^&=<>(),%]))/iy

class ParseError extends Error {}

/**
 * Returns a function that evaluates any cell by reference, memoised, with cycle detection.
 * `raw(ref)` gives the cell's raw text ('' when empty).
 */
export function createEvaluator(raw: (ref: string) => string) {
  const memo = new Map<string, Val>()
  const visiting = new Set<string>()

  function cell(r: string): Val {
    const key = r.replace(/\$/g, '').toUpperCase()
    if (memo.has(key)) return memo.get(key)!
    if (visiting.has(key)) return new Err('#CYCLE!')
    const text = raw(key)
    if (!text.startsWith('=')) return literal(text)
    visiting.add(key)
    const v = formula(text.slice(1))
    visiting.delete(key)
    // A cell that is part of a cycle reports the cycle rather than caching a half-computed value.
    memo.set(key, v)
    return v
  }

  function range(a: string, b: string): Val[] {
    const p = parseRef(a), q = parseRef(b)
    if (!p || !q) return [new Err('#REF!')]
    const out: Val[] = []
    for (let row = Math.min(p[1], q[1]); row <= Math.max(p[1], q[1]); row++)
      for (let col = Math.min(p[0], q[0]); col <= Math.max(p[0], q[0]); col++) out.push(cell(ref(col, row)))
    return out
  }

  function formula(src: string): Val {
    const tokens: string[][] = []
    TOKEN.lastIndex = 0
    while (TOKEN.lastIndex < src.length) {
      if (/^\s*$/.test(src.slice(TOKEN.lastIndex))) break
      const m = TOKEN.exec(src)
      if (!m) return new Err('#ERROR!')
      tokens.push(m.slice(1, 6).map((x) => x ?? ''))
    }
    let i = 0
    const peek = () => tokens[i]?.[4] ?? ''
    const eat = (op: string) => { if (peek() === op) { i++; return true } return false }
    const expect = (op: string) => { if (!eat(op)) throw new ParseError() }

    // Each level returns Arg so ranges can flow into function calls.
    const scalar = (a: Arg): Val => (Array.isArray(a) ? (a.length === 1 ? a[0] : new Err('#VALUE!')) : a)
    const arith = (a: Val, b: Val, f: (x: number, y: number) => Val): Val => {
      const x = toNum(a), y = toNum(b)
      return isErr(x) ? x : isErr(y) ? y : f(x, y)
    }

    function compare(): Arg {
      let left = concat()
      for (let op = peek(); ['=', '<>', '<', '>', '<=', '>='].includes(op); op = peek()) {
        i++
        const a = scalar(left), b = scalar(concat())
        if (isErr(a)) return a
        if (isErr(b)) return b
        const [x, y] = typeof a === 'string' || typeof b === 'string'
          ? [toStr(a).toLowerCase(), toStr(b).toLowerCase()]
          : [toNum(a) as number, toNum(b) as number]
        left = op === '=' ? x === y : op === '<>' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y
      }
      return left
    }
    function concat(): Arg {
      let left = additive()
      while (eat('&')) {
        const a = scalar(left), b = scalar(additive())
        left = isErr(a) ? a : isErr(b) ? b : toStr(a) + toStr(b)
      }
      return left
    }
    function additive(): Arg {
      let left = term()
      for (let op = peek(); op === '+' || op === '-'; op = peek()) {
        i++
        left = arith(scalar(left), scalar(term()), (x, y) => (op === '+' ? x + y : x - y))
      }
      return left
    }
    function term(): Arg {
      let left = power()
      for (let op = peek(); op === '*' || op === '/'; op = peek()) {
        i++
        left = arith(scalar(left), scalar(power()), (x, y) => (op === '*' ? x * y : y === 0 ? new Err('#DIV/0!') : x / y))
      }
      return left
    }
    function power(): Arg {
      let left = unary()
      while (eat('^')) left = arith(scalar(left), scalar(unary()), (x, y) => { const r = x ** y; return Number.isFinite(r) ? r : new Err('#NUM!') })
      return left
    }
    function unary(): Arg {
      if (eat('-')) return arith(0, scalar(unary()), (_, y) => -y)
      if (eat('+')) return unary()
      let v = primary()
      while (eat('%')) v = arith(scalar(v), 100, (x, y) => x / y)
      return v
    }
    function primary(): Arg {
      const t = tokens[i++]
      if (!t) throw new ParseError()
      const [n, str, r, name, op] = t
      if (n) return parseFloat(n)
      if (str) return str.slice(1, -1).replace(/""/g, '"')
      if (r) {
        const [a, b] = r.split(':')
        return b ? range(a, b) : parseRef(a) ? cell(a) : new Err('#REF!')
      }
      if (name) {
        const upper = name.toUpperCase()
        if (!eat('(')) {
          if (upper === 'TRUE' || upper === 'FALSE') return upper === 'TRUE'
          return new Err('#NAME?')
        }
        const args: Arg[] = []
        if (!eat(')')) {
          do args.push(compare())
          while (eat(','))
          expect(')')
        }
        const f = FUNCS[upper]
        return f ? f(args) : new Err('#NAME?')
      }
      if (op === '(') {
        const v = compare()
        expect(')')
        return v
      }
      throw new ParseError()
    }

    try {
      const v = scalar(compare())
      if (i < tokens.length) return new Err('#ERROR!')
      return typeof v === 'number' && !Number.isFinite(v) ? new Err('#NUM!') : v
    } catch (e) {
      if (e instanceof ParseError) return new Err('#ERROR!')
      throw e
    }
  }

  return cell
}
