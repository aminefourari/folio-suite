// App URLs and redirect guards. Plain TS (no JSX) so node --test can import it.
export type Site = 'landing' | 'write' | 'grid' | 'stage'

const PORTS: Record<Site, number> = { landing: 3000, write: 3001, grid: 3002, stage: 3003 }
const WORKERS: Record<Site, string> = { landing: 'folio', write: 'folio-write', grid: 'folio-grid', stage: 'folio-stage' }
const WORKERS_DEV = 'aminethewiz18.workers.dev'
const DEV = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

// Each app is its own Worker on workers.dev; locally each runs on its own port.
export const urlFor = (id: Site) => (DEV ? `http://localhost:${PORTS[id]}/` : `https://${WORKERS[id]}.${WORKERS_DEV}/`)

// Every Folio origin. Used for Better Auth's trustedOrigins and to validate redirect targets.
export const ORIGINS = (Object.keys(PORTS) as Site[]).map((id) => new URL(urlFor(id)).origin)

/** URL on the landing app, which hosts sign-in and the account page. */
export const hubUrl = (path = '') => urlFor('landing') + path.replace(/^\//, '')

/** Where an app sends a signed-out visitor: the hub signs them in and hands a session back to `returnTo`. */
export const signInUrl = (returnTo: string) => hubUrl(`auth/handoff?to=${encodeURIComponent(returnTo)}`)

/** Absolute URL on a Folio origin, or null. Blocks open redirects. */
export function safeAppUrl(to: string | null | undefined): URL | null {
  if (!to) return null
  try {
    const u = new URL(to)
    return ORIGINS.includes(u.origin) ? u : null
  } catch {
    return null
  }
}

/** Paths that work without signing in. */
export const isPublicPath = (p: string) => /^\/(s|auth|api)\//.test(p)

/** Same-site path: must start with one slash (no scheme, no protocol-relative //host or /\\host). */
export const safePath = (p: string | null | undefined) => (p && /^\/(?![/\\])/.test(p) ? p : '/')
