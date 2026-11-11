import { createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SharedBar } from '@folio/ui/chrome.tsx'
import { SlideView, parseDeck, sanitizeDeck, type Deck } from '../../deck.tsx'
import { Presenter } from '../../presenter.tsx'
import { getShared } from '../../docs'

export const Route = createFileRoute('/s/$shareId')({
  loader: ({ params }) => getShared({ data: params.shareId }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title || 'Shared presentation'} · Folio Stage` }, { name: 'robots', content: 'noindex' }] }),
  component: SharedDeck,
})

function SharedDeck() {
  const doc = Route.useLoaderData()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [i, setI] = useState(0)
  const [presenting, setPresenting] = useState(false)
  // Parsed and sanitized in the browser (needs DOMParser).
  useEffect(() => setDeck(sanitizeDeck(parseDeck(doc.content))), [doc.content])

  useEffect(() => {
    if (!deck || presenting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setI((n) => Math.min(deck.slides.length - 1, n + 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck, presenting])

  return (
    <div className="app shared">
      <SharedBar app="stage" title={doc.title} owner={doc.owner_name} updated={doc.updated_at}>
        <button className="btn ghost" onClick={() => setPresenting(true)} disabled={!deck}><Play size={16} /><span className="label">Present</span></button>
      </SharedBar>
      {deck ? (
        <main className="shared-stage">
          <div className="stage-frame"><SlideView slide={deck.slides[i]} theme={deck.theme} placeholders={false} /></div>
          <div className="shared-nav">
            <button className="icon-btn" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Previous slide"><ChevronLeft size={18} /></button>
            <span>{i + 1} / {deck.slides.length}</span>
            <button className="icon-btn" onClick={() => setI(i + 1)} disabled={i === deck.slides.length - 1} aria-label="Next slide"><ChevronRight size={18} /></button>
          </div>
          <div className="shared-strip">
            {deck.slides.map((s, n) => (
              <button key={s.id} className={`thumb-slide${n === i ? ' current' : ''}`} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} aria-current={n === i}>
                <SlideView slide={s} theme={deck.theme} placeholders={false} />
              </button>
            ))}
          </div>
        </main>
      ) : <div className="stage-loading" aria-busy="true" />}
      {presenting && deck && <Presenter deck={deck} start={i} onExit={(n) => { setPresenting(false); setI(n) }} />}
    </div>
  )
}
