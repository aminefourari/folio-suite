import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { escapeHtml, plainText, sanitize } from '@folio/ui/util.ts'

export type Layout = 'title' | 'content' | 'section' | 'two'
export type Slide = { id: string; layout: Layout; title: string; body: string; body2: string; notes: string }
export type ThemeId = keyof typeof THEMES
export type Deck = { theme: ThemeId; slides: Slide[] }

export const THEMES = {
  paper: { name: 'Paper', bg: '#fbfaf7', ink: '#1c1917', muted: '#78716c', accent: '#e5484d', title: 'Fraunces', body: 'Inter' },
  midnight: { name: 'Midnight', bg: 'radial-gradient(120% 120% at 0% 0%, #23285a 0%, #0d0f1e 60%)', ink: '#eef0ff', muted: '#a3a9d6', accent: '#8b9cff', title: 'Space Grotesk', body: 'Inter' },
  ocean: { name: 'Ocean', bg: 'linear-gradient(135deg, #0891b2 0%, #1d4ed8 100%)', ink: '#ffffff', muted: '#cfe8ff', accent: '#fde68a', title: 'Instrument Sans', body: 'Instrument Sans' },
  forest: { name: 'Forest', bg: '#10251e', ink: '#e8f3ec', muted: '#9cc2ad', accent: '#7ee2b8', title: 'Lora', body: 'Inter' },
  sunset: { name: 'Sunset', bg: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)', ink: '#ffffff', muted: '#ffe4e6', accent: '#1c1917', title: 'Fraunces', body: 'Instrument Sans' },
  mono: { name: 'Mono', bg: '#ffffff', ink: '#111111', muted: '#6b6b6b', accent: '#111111', title: 'Inter', body: 'Inter' },
} as const

export const LAYOUTS: { value: Layout; label: string }[] = [
  { value: 'title', label: 'Title slide' },
  { value: 'content', label: 'Title and content' },
  { value: 'section', label: 'Section header' },
  { value: 'two', label: 'Two columns' },
]

export const newSlide = (layout: Layout = 'content'): Slide =>
  ({ id: crypto.randomUUID().slice(0, 8), layout, title: '', body: '', body2: '', notes: '' })

export function parseDeck(content: string): Deck {
  try {
    const d = JSON.parse(content) as Partial<Deck>
    const slides = Array.isArray(d.slides) && d.slides.length ? d.slides.map((s) => ({ ...newSlide(), ...s })) : [newSlide('title')]
    return { theme: d.theme && d.theme in THEMES ? d.theme : 'paper', slides }
  } catch {
    return { theme: 'paper', slides: [newSlide('title')] }
  }
}

/** Lenient parse of a truncated JSON prefix (list previews only get the first 4 KB). */
export function previewDeck(prefix: string): { theme: ThemeId; slide: Slide } {
  const pick = (key: string) => {
    const m = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`).exec(prefix)
    try { return m ? (JSON.parse(`"${m[1]}"`) as string) : '' } catch { return '' }
  }
  const theme = pick('theme')
  return {
    theme: theme in THEMES ? (theme as ThemeId) : 'paper',
    // Rendered on the server, so the body is reduced to escaped plain text instead of sanitized HTML.
    slide: { ...newSlide(), layout: (pick('layout') as Layout) || 'title', title: pick('title'), body: escapeHtml(plainText(pick('body'), 160)) },
  }
}

/** Browser only (uses DOMParser). */
export const sanitizeDeck = (d: Deck): Deck =>
  ({ ...d, slides: d.slides.map((s) => ({ ...s, body: sanitize(s.body), body2: sanitize(s.body2) })) })

export const themeStyle = (id: ThemeId) => {
  const t = THEMES[id]
  return {
    '--s-bg': t.bg, '--s-ink': t.ink, '--s-muted': t.muted, '--s-accent': t.accent,
    '--s-title': `'${t.title}'`, '--s-body': `'${t.body}'`,
  } as CSSProperties
}

/** Uncontrolled contentEditable: DOM is only written when the slide changes, so typing never loses the caret. */
function Editable({ html, onChange, className, placeholder, plain, slideId }: {
  html: string; onChange: (html: string) => void; className: string; placeholder: string; plain?: boolean; slideId: string
}) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (el.current && el.current.innerHTML !== html) el.current.innerHTML = html
  }, [slideId])
  return (
    <div ref={el} className={className} data-placeholder={placeholder} role="textbox" aria-label={placeholder}
      aria-multiline={!plain} contentEditable={plain ? 'plaintext-only' : true} suppressContentEditableWarning
      spellCheck
      onKeyDown={(e) => { if (plain && e.key === 'Enter') e.preventDefault() }}
      onInput={(e) => {
        const node = e.currentTarget
        if (!node.textContent?.trim() && !node.querySelector('img,li')) node.innerHTML = ''
        onChange(plain ? node.textContent ?? '' : node.innerHTML)
      }} />
  )
}

const Static = ({ html, className, placeholder, plain }: { html: string; className: string; placeholder: string; plain?: boolean }) =>
  plain
    ? <div className={className} data-placeholder={placeholder}>{html}</div>
    : <div className={className} data-placeholder={placeholder} dangerouslySetInnerHTML={{ __html: html }} />

/** One slide. Text sizes use container-query units, so the same markup works as a thumbnail or full screen. */
export function SlideView({ slide, theme, edit, onChange, placeholders = true }: {
  slide: Slide
  theme: ThemeId
  edit?: boolean
  onChange?: (patch: Partial<Slide>) => void
  placeholders?: boolean
}) {
  const field = (key: 'title' | 'body' | 'body2', className: string, placeholder: string, plain = false) => {
    const ph = placeholders ? placeholder : ''
    return edit && onChange
      ? <Editable slideId={slide.id} html={slide[key]} onChange={(v) => onChange({ [key]: v })} className={className} placeholder={ph} plain={plain} />
      : <Static html={slide[key]} className={className} placeholder={ph} plain={plain} />
  }
  return (
    <div className={`slide l-${slide.layout}`} style={themeStyle(theme)}>
      <div className="slide-inner">
        {slide.layout === 'title' && (<>
          {field('title', 's-title', 'Click to add a title', true)}
          {field('body', 's-sub', 'Add a subtitle')}
        </>)}
        {slide.layout === 'section' && (<>
          <span className="s-bar" />
          {field('title', 's-title', 'Section title', true)}
          {field('body', 's-sub', 'A line about this section')}
        </>)}
        {slide.layout === 'content' && (<>
          {field('title', 's-title', 'Slide title', true)}
          {field('body', 's-body', 'Add your points. Use the list button for bullets.')}
        </>)}
        {slide.layout === 'two' && (<>
          {field('title', 's-title', 'Slide title', true)}
          <div className="s-cols">
            {field('body', 's-body', 'Left column')}
            {field('body2', 's-body', 'Right column')}
          </div>
        </>)}
      </div>
    </div>
  )
}
