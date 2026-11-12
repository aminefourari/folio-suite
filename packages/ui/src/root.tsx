import { HeadContent, Scripts } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { GOOGLE_FONTS_HREF, ORIGINS, appById, favicon, urlFor, type AppId } from './apps.tsx'
import { NavProgress } from './nav.tsx'

/** The UI font, self-hosted (OFL) so the first paint doesn't wait on a third-party stylesheet. */
const UI_FONT = '/fonts/instrument-sans-latin.woff2'

export function rootHead(id: AppId | 'landing', stylesheets: string[]) {
  const name = id === 'landing' ? 'Folio' : appById(id).name
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: name },
      { name: 'description', content: 'Folio: a small, calm suite for documents, spreadsheets and presentations.' },
      { name: 'theme-color', content: '#f4f4f5', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#151517', media: '(prefers-color-scheme: dark)' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' as const },
      // The other Folio apps, so switching to one skips the connection setup.
      ...ORIGINS.filter((o) => o !== new URL(urlFor(id)).origin).map((href) => ({ rel: 'preconnect', href })),
      { rel: 'preload', href: UI_FONT, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const },
      ...stylesheets.map((href) => ({ rel: 'stylesheet', href })),
      { rel: 'icon', href: favicon(id) },
    ],
  }
}

export function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <NavProgress />
        <DocFonts />
        {children}
        <Scripts />
      </body>
    </html>
  )
}

/** Document fonts (Google Fonts), added after the first paint so the stylesheet never blocks it. */
function DocFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`)) return
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: GOOGLE_FONTS_HREF })
    document.head.append(link)
  }, [])
  return null
}
