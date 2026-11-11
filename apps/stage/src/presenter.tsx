import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SlideView, type Deck } from './deck.tsx'

/** Full-screen slideshow. → Space Enter PageDown next, ← PageUp Backspace back, Home/End, Esc exits. */
export function Presenter({ deck, start, onExit }: { deck: Deck; start: number; onExit: (i: number) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(start)
  const iRef = useRef(i)
  iRef.current = i
  const last = deck.slides.length - 1
  const next = () => setI((n) => Math.min(last, n + 1))
  const prev = () => setI((n) => Math.max(0, n - 1))

  useEffect(() => {
    const el = root.current!
    el.focus()
    el.requestFullscreen?.().catch(() => {})
    const onFs = () => { if (!document.fullscreenElement) onExit(iRef.current) }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next() }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev() }
    else if (e.key === 'Home') setI(0)
    else if (e.key === 'End') setI(last)
    else if (e.key === 'Escape') onExit(i)
  }

  return (
    <div ref={root} className="presenter" tabIndex={-1} role="dialog" aria-label="Presentation" onKeyDown={onKey}>
      <div className="presenter-slide" onClick={next}>
        <SlideView key={deck.slides[i].id} slide={deck.slides[i]} theme={deck.theme} placeholders={false} />
      </div>
      <div className="presenter-hud">
        <button onClick={prev} disabled={i === 0} aria-label="Previous slide"><ChevronLeft size={18} /></button>
        <span>{i + 1} / {deck.slides.length}</span>
        <button onClick={next} disabled={i === last} aria-label="Next slide"><ChevronRight size={18} /></button>
        <button onClick={() => onExit(i)} aria-label="Exit presentation"><X size={18} /></button>
      </div>
      <div className="presenter-progress" style={{ width: `${((i + 1) / deck.slides.length) * 100}%` }} />
    </div>
  )
}
