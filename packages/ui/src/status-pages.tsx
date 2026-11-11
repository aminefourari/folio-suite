import { FileQuestion, TriangleAlert } from 'lucide-react'
import { hubUrl } from './urls.ts'

/** Router-level 404 page. */
export function NotFound() {
  return (
    <main className="status-page">
      <FileQuestion size={40} />
      <h1>Nothing here</h1>
      <p>This file doesn’t exist, was deleted, or isn’t shared with you. If someone sent you a link, they may have turned sharing off.</p>
      <div className="row"><a className="btn" href="/">Go to your files</a><a className="btn ghost" href={hubUrl()}>Folio home</a></div>
    </main>
  )
}

/** Router-level error page. */
export function ErrorView({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <main className="status-page" role="alert">
      <TriangleAlert size={40} />
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : 'An unexpected error happened.'} Your last saved changes are safe.</p>
      <div className="row"><button className="btn" onClick={() => { reset(); location.reload() }}>Try again</button><a className="btn ghost" href="/">Go to your files</a></div>
    </main>
  )
}
