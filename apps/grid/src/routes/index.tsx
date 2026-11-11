import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { colName, ref } from '../formula.ts'
import { display, evaluator, parsePreview } from '../sheet.ts'
import { createDoc, deleteDoc, listDocs } from '../docs'

export const Route = createFileRoute('/')({
  loader: () => listDocs(),
  component: function Home() {
    return (
      <FileHome app="grid" docs={Route.useLoaderData()}
        create={() => createDoc({ data: {} })}
        remove={(id) => deleteDoc({ data: id })}
        preview={(d) => <MiniSheet prefix={d.preview} />} />
    )
  },
})

function MiniSheet({ prefix }: { prefix: string }) {
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
              return <td key={c} className={typeof v === 'number' ? 'num' : undefined}>{display(v)}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
