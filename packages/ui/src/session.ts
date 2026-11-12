import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { currentViewer, type Viewer } from './auth.server.ts'
import { isPublicPath, safePath, signInUrl, urlFor, type Site } from './urls.ts'

export type { Viewer } from './auth.server.ts'

/** The signed-in user (or null). Safe to call from route loaders on server and client. */
export const getViewer = createServerFn().handler(() => currentViewer())

// Browser only: the viewer for the lifetime of this page. Signing in or out, and deleting the account,
// are full page loads; the name change on the account page calls forgetViewer().
let memo: Promise<Viewer | null> | undefined
let primed = false

/** getViewer() on the server; in the browser, at most once per page (forgotten if the call fails, e.g. offline). */
export function loadViewer(): Promise<Viewer | null> {
  if (typeof window === 'undefined') return getViewer()
  return (memo ??= getViewer().catch((e) => {
    memo = undefined
    throw e
  }))
}

/** Seeds the memo with the viewer the server rendered with, once per page, so the first navigation makes no call. */
export function primeViewer(v: Viewer | null) {
  if (primed || typeof window === 'undefined' || isPublicPath(location.pathname)) return
  primed = true
  memo ??= Promise.resolve(v)
}

export const forgetViewer = () => { memo = undefined }

/** Root `beforeLoad` of the three apps. `?sso=1` (added to links from another Folio app while signed in) sends a
 * visitor with no session here through the hub's hand-off, back to this URL without `sso`, so it cannot loop. */
export async function appContext(app: Site, location: ParsedLocation) {
  if (isPublicPath(location.pathname)) return { viewer: null }
  const viewer = await loadViewer()
  const search = new URLSearchParams(location.searchStr)
  if (!viewer && search.has('sso')) {
    search.delete('sso')
    const qs = search.toString()
    // Built from this app's own origin; the path goes through safePath so it can't become //other-host.
    const back = urlFor(app) + safePath(location.pathname).slice(1) + (qs ? `?${qs}` : '')
    throw redirect({ href: signInUrl(back), reloadDocument: true })
  }
  return { viewer }
}
