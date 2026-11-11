import { HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { GOOGLE_FONTS_HREF, appById, favicon, type AppId } from './apps.tsx'

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
      { rel: 'stylesheet', href: GOOGLE_FONTS_HREF },
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
        {children}
        <Scripts />
      </body>
    </html>
  )
}
