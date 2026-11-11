import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { PaperThumb, TEMPLATES, fillTemplate } from '../templates.tsx'
import { createDoc, deleteDoc, duplicateDoc, listDocs, renameDoc, shareDoc } from '../docs'

export const Route = createFileRoute('/')({
  loader: () => listDocs(),
  component: function Home() {
    return (
      <FileHome app="write" docs={Route.useLoaderData()} templates={TEMPLATES}
        create={(t) => createDoc({ data: t ? { ...t, content: fillTemplate(t.content) } : {} })}
        rename={(id, title) => renameDoc({ data: { id, title } })}
        duplicate={(id) => duplicateDoc({ data: id })}
        share={(id, on) => shareDoc({ data: { id, on } })}
        remove={(id) => deleteDoc({ data: id })}
        preview={(d) => <PaperThumb title={d.title} html={d.preview} />} />
    )
  },
})
