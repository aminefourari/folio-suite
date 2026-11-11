import type { Template } from '@folio/ui/chrome.tsx'
import { colName, ref } from './formula.ts'
import { display, evaluator, parsePreview, serialize, type Cell, type Cells, type Fmt } from './sheet.ts'

/** First rows/columns of a sheet, rendered from a (possibly truncated) JSON prefix. */
export function MiniSheet({ prefix }: { prefix: string }) {
  const cells = parsePreview(prefix)
  const get = evaluator(cells)
  return (
    <table className="mini-sheet" aria-hidden>
      <thead><tr><th />{[0, 1, 2, 3].map((c) => <th key={c}>{colName(c)}</th>)}</tr></thead>
      <tbody>
        {[0, 1, 2, 3, 4, 5, 6].map((r) => (
          <tr key={r}>
            <th>{r + 1}</th>
            {[0, 1, 2, 3].map((c) => {
              const v = get(ref(c, r))
              return <td key={c} className={typeof v === 'number' ? 'num' : undefined}>{display(v, cells[ref(c, r)]?.f)}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Build cells from rows; `fmt` maps column index to a number format, row 0 is bold.
function sheet(rows: string[][], fmt: Record<number, Fmt> = {}, boldRows: number[] = [0]): Cells {
  const cells: Cells = {}
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return
    const cell: Cell = { v }
    if (boldRows.includes(r)) cell.b = true
    if (fmt[c] && r > 0) cell.f = fmt[c]
    cells[ref(c, r)] = cell
  }))
  return cells
}

const t = (name: string, blurb: string, title: string, cells: Cells, widths: Record<string, number> = {}): Template => {
  const content = serialize({ cells, widths })
  return { name, blurb, title, content, preview: <MiniSheet prefix={content} /> }
}

const budget = sheet([
  ['Category', 'Budget', 'Actual', 'Left'],
  ['Rent', '1200', '1200', '=B2-C2'],
  ['Groceries', '400', '362.5', '=B3-C3'],
  ['Transport', '120', '96', '=B4-C4'],
  ['Utilities', '150', '171.2', '=B5-C5'],
  ['Going out', '200', '140', '=B6-C6'],
  ['Total', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)'],
], { 1: 'currency', 2: 'currency', 3: 'currency' }, [0, 6])

const invoice = sheet([
  ['Item', 'Qty', 'Price', 'Amount'],
  ['Design work (hours)', '12', '85', '=B2*C2'],
  ['Development (hours)', '20', '95', '=B3*C3'],
  ['Hosting (months)', '3', '25', '=B4*C4'],
  ['', '', 'Subtotal', '=SUM(D2:D4)'],
  ['', '', 'Tax 20%', '=ROUND(D5*0.2, 2)'],
  ['', '', 'Total', '=D5+D6'],
], { 2: 'currency', 3: 'currency' }, [0, 6])

const sales = sheet([
  ['Quarter', 'Revenue', 'Growth', 'Target met'],
  ['Q1', '18400', '', '=IF(B2>=17500, "Yes", "No")'],
  ['Q2', '21250', '=(B3-B2)/B2', '=IF(B3>=20000, "Yes", "No")'],
  ['Q3', '19800', '=(B4-B3)/B3', '=IF(B4>=22000, "Yes", "No")'],
  ['Q4', '26900', '=(B5-B4)/B4', '=IF(B5>=24000, "Yes", "No")'],
  ['Year', '=SUM(B2:B5)', '=(B5-B2)/B2', ''],
], { 1: 'currency', 2: 'percent' }, [0, 5])

export const TEMPLATES: Template[] = [
  t('Monthly budget', 'Planned vs. actual spending', 'Monthly budget', budget),
  t('Invoice', 'Line items, tax and total', 'Invoice', invoice, { 0: 180 }),
  t('Sales tracker', 'Quarterly revenue and growth', 'Sales tracker', sales),
]
