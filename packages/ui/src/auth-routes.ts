// Server only: request handlers used by each app's server routes.
import { getAuth } from './auth.server.ts'
import { hubUrl, safeAppUrl, safePath } from './urls.ts'

type Ctx = { request: Request }
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const go = (location: string, extra?: Headers) => {
  const res = new Response(null, { status: 302, headers: { Location: location, ...NO_STORE } })
  extra?.getSetCookie().forEach((c) => res.headers.append('Set-Cookie', c))
  return res
}

/** /api/auth/* : Better Auth's own endpoints (sign-in, sign-up, sign-out, change password…). */
export const authApi = ({ request }: Ctx) => getAuth().handler(request)

/**
 * App side of single sign-on: /auth/callback?token=…&next=/path
 * Consumes the one-time token from the hub, which sets this app's session cookie, then continues to `next`.
 */
export async function authCallback({ request }: Ctx) {
  const url = new URL(request.url)
  const next = safePath(url.searchParams.get('next'))
  try {
    const { headers } = await getAuth().api.verifyOneTimeToken({
      body: { token: url.searchParams.get('token') ?? '' },
      headers: request.headers,
      returnHeaders: true,
    })
    return go(next, headers)
  } catch {
    // Expired or reused token: start over at the hub.
    return go(hubUrl(`login?to=${encodeURIComponent(url.origin + next)}`))
  }
}

/**
 * Hub side of single sign-on: /auth/handoff?to=<Folio URL>
 * Signed in: mint a one-minute, single-use token and send the browser to the target app's callback.
 * Signed out: go to /login first, which comes back here afterwards.
 */
export async function authHandoff({ request }: Ctx) {
  const url = new URL(request.url)
  const to = safeAppUrl(url.searchParams.get('to'))
  if (!to) return go('/')
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return go(`/login?to=${encodeURIComponent(to.href)}`)
  if (to.origin === url.origin) return go(to.pathname + to.search)
  const { token } = await auth.api.generateOneTimeToken({ headers: request.headers })
  const target = new URL('/auth/callback', to.origin)
  target.searchParams.set('token', token)
  target.searchParams.set('next', to.pathname + to.search)
  return go(target.href)
}
