import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { plainText } from '@folio/ui/util.ts'
import { createDoc, deleteDoc, listDocs } from '../docs'

export const Route = createFileRoute('/')({
  loader: () => listDocs(),
  component: function Home() {
    return (
      <FileHome app="write" docs={Route.useLoaderData()}
        create={() => createDoc({ data: {} })}
        remove={(id) => deleteDoc({ data: id })}
        preview={(d) => (
          <div className="paper-thumb">
            {d.title && <b>{d.title}</b>}
            <p>{plainText(d.preview) || <span className="muted">Empty document</span>}</p>
          </div>
        )} />
    )
  },
})
