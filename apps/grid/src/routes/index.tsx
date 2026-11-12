import { createFileRoute } from '@tanstack/react-router'
import { FileHome, FileHomeSkeleton } from '@folio/ui/chrome.tsx'
import { MiniSheet, TEMPLATES } from '../templates.tsx'
import { cloud, storeFor } from '../docs'

export const Route = createFileRoute('/')({
  ssr: false, // guests' files live in localStorage
  pendingComponent: () => <FileHomeSkeleton app="grid" />, // also the server HTML
  loader: ({ context }) => storeFor(context.viewer).list(),
  component: function Home() {
    return (
      <FileHome app="grid" docs={Route.useLoaderData()} cloud={cloud} templates={TEMPLATES}
        preview={(d) => <MiniSheet prefix={d.preview} />} />
    )
  },
})
