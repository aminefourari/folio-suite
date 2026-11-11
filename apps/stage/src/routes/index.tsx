import { createFileRoute } from '@tanstack/react-router'
import { FileHome } from '@folio/ui/chrome.tsx'
import { SlideThumb, TEMPLATES } from '../templates.tsx'
import { cloud, storeFor } from '../docs'

export const Route = createFileRoute('/')({
  ssr: false, // guests' files live in localStorage
  loader: ({ context }) => storeFor(context.viewer).list(),
  component: function Home() {
    return (
      <FileHome app="stage" docs={Route.useLoaderData()} cloud={cloud} templates={TEMPLATES}
        preview={(d) => <SlideThumb prefix={d.preview} />} />
    )
  },
})
