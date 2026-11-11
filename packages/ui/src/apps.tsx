import { Layers, PenLine, Presentation, Sheet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AppId = 'write' | 'grid' | 'stage'
export type App = {
  id: AppId
  name: string
  short: string
  noun: string
  tagline: string
  color: string
  icon: LucideIcon
  port: number
}

export const SUITE = { name: 'Folio', color: '#18181b', icon: Layers, port: 3000, worker: 'folio' }

export const APPS: App[] = [
  { id: 'write', name: 'Folio Write', short: 'Write', noun: 'document', color: '#6d5dfc', icon: PenLine, port: 3001,
    tagline: 'Documents with a calm page, real formatting and autosave.' },
  { id: 'grid', name: 'Folio Grid', short: 'Grid', noun: 'spreadsheet', color: '#0d9488', icon: Sheet, port: 3002,
    tagline: 'Spreadsheets with formulas, ranges and quick totals.' },
  { id: 'stage', name: 'Folio Stage', short: 'Stage', noun: 'presentation', color: '#e5484d', icon: Presentation, port: 3003,
    tagline: 'Slides with themes, speaker notes and a full-screen presenter.' },
]

export const appById = (id: AppId) => APPS.find((a) => a.id === id)!

// Each app is its own Worker on workers.dev; locally each runs on its own port.
const WORKERS_DEV = 'aminethewiz18.workers.dev'
export const urlFor = (id: AppId | 'landing') => {
  const port = id === 'landing' ? SUITE.port : appById(id).port
  const worker = id === 'landing' ? SUITE.worker : `folio-${id}`
  return import.meta.env.DEV ? `http://localhost:${port}/` : `https://${worker}.${WORKERS_DEV}/`
}

// Document fonts, all served by Google Fonts.
export const DOC_FONTS = ['Inter', 'Instrument Sans', 'Lora', 'Merriweather', 'Source Serif 4', 'Fraunces', 'Space Grotesk', 'JetBrains Mono']

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  ['Instrument+Sans:wght@400..700', 'Inter:ital,wght@0,400..700;1,400..700', 'Lora:ital,wght@0,400..700;1,400..700',
    'Merriweather:ital,wght@0,400;0,700;1,400', 'Source+Serif+4:ital,wght@0,400..700;1,400..700',
    'Fraunces:ital,wght@0,400..800;1,400..800', 'Space+Grotesk:wght@400..700', 'JetBrains+Mono:ital,wght@0,400..700;1,400']
    .map((f) => `family=${f}`).join('&') + '&display=swap'

export function Mark({ color, icon: Icon, size = 40 }: { color: string; icon: LucideIcon; size?: number }) {
  return (
    <span className="mark" style={{ background: color, width: size, height: size, borderRadius: size * 0.3 }} aria-hidden>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  )
}

// Favicon: rounded square in the app colour with a simple glyph.
const GLYPHS: Record<AppId | 'landing', string> = {
  landing: '<path d="M18 22h28M18 32h28M18 42h18" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
  write: '<path d="M20 44l4-12 18-18 8 8-18 18z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>',
  grid: '<path d="M16 16h32v32H16zM16 27h32M16 38h32M27 16v32" fill="none" stroke="#fff" stroke-width="4"/>',
  stage: '<path d="M14 18h36v22H14zM32 40v8M24 48h16" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/>',
}
export const favicon = (id: AppId | 'landing') =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${id === 'landing' ? SUITE.color : appById(id).color}"/>${GLYPHS[id]}</svg>`)
