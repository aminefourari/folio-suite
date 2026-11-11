import { createFileRoute } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SharedBar } from '@folio/ui/chrome.tsx'
import { sanitize } from '@folio/ui/util.ts'
import { getShared } from '../../docs'

export const Route = createFileRoute('/s/$shareId')({
  loader: ({ params }) => getShared({ data: params.shareId }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title || 'Shared document'} · Folio Write` }, { name: 'robots', content: 'noindex' }] }),
  component: function SharedDoc() {
    const doc = Route.useLoaderData()
    const page = useRef<HTMLDivElement>(null)
    // Sanitized in the browser (needs DOMParser), same as the editor.
    useEffect(() => { page.current!.innerHTML = sanitize(doc.content) }, [doc.content])
    return (
      <div className="app shared">
        <SharedBar app="write" title={doc.title} owner={doc.owner_name} updated={doc.updated_at}>
          <button className="btn ghost" onClick={() => window.print()}><Printer size={16} /><span className="label">Print</span></button>
        </SharedBar>
        <main className="canvas"><article ref={page} className="page" aria-label={doc.title || 'Shared document'} /></main>
      </div>
    )
  },
})
