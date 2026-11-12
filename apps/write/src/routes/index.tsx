import { createFileRoute } from '@tanstack/react-router'
import { FileHome, FileHomeSkeleton } from '@folio/ui/chrome.tsx'
import { PaperThumb, TEMPLATES, fillTemplate } from '../templates.tsx'
import { cloud, storeFor } from '../docs'

export const Route = createFileRoute('/')({
  ssr: false, // guests' files live in localStorage
  pendingComponent: () => <FileHomeSkeleton app="write" />, // also the server HTML
  loader: ({ context }) => storeFor(context.viewer).list(),
  component: function Home() {
    return (
      <FileHome app="write" docs={Route.useLoaderData()} cloud={cloud} templates={TEMPLATES} fill={fillTemplate}
        preview={(d) => <PaperThumb title={d.title} html={d.preview} />} />
    )
  },
})
