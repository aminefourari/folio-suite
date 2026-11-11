import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { SlideView, previewDeck } from '../deck.tsx'
import { createDoc, deleteDoc, listDocs } from '../docs'

export const Route = createFileRoute('/')({
  loader: () => listDocs(),
  component: function Home() {
    return (
      <FileHome app="stage" docs={Route.useLoaderData()}
        create={() => createDoc({ data: {} })}
        remove={(id) => deleteDoc({ data: id })}
        preview={(d) => {
          const { theme, slide } = previewDeck(d.preview)
          return <div className="slide-thumb"><SlideView slide={slide} theme={theme} placeholders={false} /></div>
        }} />
    )
  },
})
