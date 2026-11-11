import { createFileRoute } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { SharedBar } from '@folio/ui/chrome.tsx'
import { download } from '@folio/ui/util.ts'
import { Err, colName, parseRef, ref } from '../../formula.ts'
import { display, evaluator, parse, toCsv } from '../../sheet.ts'
import { getShared } from '../../docs'

export const Route = createFileRoute('/s/$shareId')({
  loader: ({ params }) => getShared({ data: params.shareId }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title || 'Shared spreadsheet'} · Folio Grid` }, { name: 'robots', content: 'noindex' }] }),
  component: SharedSheet,
})

function SharedSheet() {
  const doc = Route.useLoaderData()
  const { cells, widths } = useMemo(() => parse(doc.content), [doc.content])
  const get = useMemo(() => evaluator(cells), [cells])
  // Used range, with a little breathing room.
  let cols = 6, rows = 12
  for (const k of Object.keys(cells)) { const [c, r] = parseRef(k)!; cols = Math.max(cols, c + 2); rows = Math.max(rows, r + 3) }
  cols = Math.min(cols, 26)

  const exportCsv = () => {
    const out = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
      const v = get(ref(c, r))
      return v instanceof Err ? v.code : v === null ? '' : String(v)
    }))
    download(`${doc.title || 'Shared spreadsheet'}.csv`, 'text/csv', toCsv(out))
  }

  return (
    <div className="app shared">
      <SharedBar app="grid" title={doc.title} owner={doc.owner_name} updated={doc.updated_at}>
        <button className="btn ghost" onClick={exportCsv}><Download size={16} /><span className="label">Download CSV</span></button>
      </SharedBar>
      <div className="sheet-wrap readonly">
        <table className="sheet" style={{ width: 52 + Array.from({ length: cols }, (_, c) => widths[c] ?? 108).reduce((a, b) => a + b, 0) }}>
          <colgroup><col style={{ width: 52 }} />{Array.from({ length: cols }, (_, c) => <col key={c} style={{ width: widths[c] ?? 108 }} />)}</colgroup>
          <thead><tr><th className="corner" />{Array.from({ length: cols }, (_, c) => <th key={c}>{colName(c)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const cell = cells[ref(c, r)]
                  const v = cell ? get(ref(c, r)) : null
                  const cls = [v instanceof Err ? 'err' : typeof v === 'number' ? 'num' : '', cell?.b ? 'b' : '', cell?.i ? 'i' : '', cell?.a ? `a-${cell.a}` : ''].join(' ').trim()
                  return <td key={c} className={cls || undefined}>{cell ? display(v, cell.f) : null}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
