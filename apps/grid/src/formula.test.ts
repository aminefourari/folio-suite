import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colIndex, colName, createEvaluator } from './formula.ts'

const sheet = (cells: Record<string, string>) => createEvaluator((r) => cells[r] ?? '')
const show = (cells: Record<string, string>, r = 'A1') => String(sheet(cells)(r))

test('column names round-trip', () => {
  for (const [i, n] of [[0, 'A'], [25, 'Z'], [26, 'AA'], [701, 'ZZ'], [702, 'AAA']] as const) {
    assert.equal(colName(i), n)
    assert.equal(colIndex(n), i)
  }
})

test('literals', () => {
  assert.equal(sheet({ A1: '42' })('A1'), 42)
  assert.equal(sheet({ A1: '15%' })('A1'), 0.15)
  assert.equal(sheet({ A1: 'hello' })('A1'), 'hello')
  assert.equal(sheet({})('A1'), null)
})

test('arithmetic and precedence', () => {
  assert.equal(sheet({ A1: '=1+2*3' })('A1'), 7)
  assert.equal(sheet({ A1: '=(1+2)*3' })('A1'), 9)
  assert.equal(sheet({ A1: '=2^3^2' })('A1'), 64) // left-associative, like spreadsheets
  assert.equal(sheet({ A1: '=-2^2' })('A1'), 4) // unary minus binds first
  assert.equal(sheet({ A1: '=50%*10' })('A1'), 5)
  assert.equal(sheet({ A1: '=10/4' })('A1'), 2.5)
})

test('references, ranges and functions', () => {
  const s = sheet({ A1: '1', A2: '2', A3: '3', B1: 'x', B2: '=SUM(A1:A3)', B3: '=AVERAGE(A1:A3)*$A$2', C1: '=sum(a1:b1)' })
  assert.equal(s('B2'), 6)
  assert.equal(s('B3'), 4)
  assert.equal(s('C1'), 1) // text in a range is skipped
  assert.equal(sheet({ A1: '=MAX(1, 9, 3) - MIN(4, 2)' })('A1'), 7)
  assert.equal(sheet({ A1: '=COUNT(B1:B3)', B1: '1', B2: 'a', B3: '2' })('A1'), 2)
  assert.equal(sheet({ A1: '=ROUND(2.345, 2)' })('A1'), 2.35)
  assert.equal(sheet({ A1: '=IF(B1>10, "big", "small")', B1: '12' })('A1'), 'big')
  assert.equal(sheet({ A1: '="a" & 1 + 1 & "b"' })('A1'), 'a2b')
  assert.equal(sheet({ A1: '=AND(TRUE, 1>0, NOT(FALSE))' })('A1'), true)
})

test('errors', () => {
  assert.equal(show({ A1: '=1/0' }), '#DIV/0!')
  assert.equal(show({ A1: '=IF(B1=0, 0, 1/B1)' }), '0') // untaken error branch doesn't leak
  assert.equal(show({ A1: '=NOPE(1)' }), '#NAME?')
  assert.equal(show({ A1: '=1+' }), '#ERROR!')
  assert.equal(show({ A1: '=1+"x"' }), '#VALUE!')
  assert.equal(show({ A1: '=B1', B1: '=A1' }), '#CYCLE!')
  assert.equal(show({ A1: '=A1+1' }), '#CYCLE!')
  assert.equal(show({ A1: '=B1+1', B1: '=1/0' }), '#DIV/0!') // errors propagate
  assert.equal(show({ A1: '=SUM(B1:B2)', B1: '1', B2: '=1/0' }), '#DIV/0!')
})

test('CSV round-trip with quotes, commas and newlines', async () => {
  const { parseCsv, toCsv, parsePreview, serialize } = await import('./sheet.ts')
  const rows = [['name', 'note'], ['Ada', 'said "hi", then left'], ['Bo', 'line1\nline2']]
  assert.deepEqual(parseCsv(toCsv(rows)), rows)
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']])
  // previews survive a truncated JSON prefix
  const json = serialize({ cells: { B2: { v: 'x' }, A1: { v: '=1+1' } }, widths: {} })
  assert.deepEqual(Object.keys(parsePreview(json.slice(0, json.indexOf('B2') + 10))), ['A1'])
})
