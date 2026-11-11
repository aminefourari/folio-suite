import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { MiniSheet, TEMPLATES } from '../templates.tsx'
import { createDoc, deleteDoc, duplicateDoc, listDocs, renameDoc, shareDoc } from '../docs'

export const Route = createFileRoute('/')({
  loader: () => listDocs(),
  component: function Home() {
    return (
      <FileHome app="grid" docs={Route.useLoaderData()} templates={TEMPLATES}
        create={(t) => createDoc({ data: t ?? {} })}
        rename={(id, title) => renameDoc({ data: { id, title } })}
        duplicate={(id) => duplicateDoc({ data: id })}
        share={(id, on) => shareDoc({ data: { id, on } })}
        remove={(id) => deleteDoc({ data: id })}
        preview={(d) => <MiniSheet prefix={d.preview} />} />
    )
  },
})
