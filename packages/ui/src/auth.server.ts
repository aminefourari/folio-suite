/// <reference path="./cloudflare.d.ts" />
// Server only. Better Auth on the shared D1 database. Import only from server routes and createServerFn handlers.
import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from 'better-auth/api'
import { oneTimeToken } from 'better-auth/plugins/one-time-token'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { ORIGINS } from './urls.ts'
import { hashPassword, verifyPassword } from './password.ts'

const bindings = env as unknown as { DB: D1Database; BETTER_AUTH_SECRET?: string }

function createAuth() {
  if (!bindings.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set (see .dev.vars.example)')
  return betterAuth({
    appName: 'Folio',
    database: bindings.DB as never, // Better Auth detects D1 and uses its Kysely D1 dialect
    secret: bindings.BETTER_AUTH_SECRET,
    trustedOrigins: ORIGINS,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    user: {
      deleteUser: {
        enabled: true,
        // Files aren't foreign-keyed to user, so remove them explicitly.
        beforeDelete: async (user) => {
          await bindings.DB.prepare('DELETE FROM documents WHERE owner = ?').bind(user.id).run()
        },
      },
    },
    // The cookie cache saves a D1 read per request. A deleted session keeps reading for up to 5 minutes on a
    // cached cookie, so writes recheck the row (requireUserId('fresh')) and /auth/signout clears every app's cookies.
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 300 } },
    rateLimit: {
      enabled: true,
      storage: 'database', // isolates don't share memory, so counters live in D1
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/change-password': { window: 60, max: 5 },
        '/delete-user': { window: 60, max: 5 },
      },
    },
    // Better Auth already rechecks the session row for password, sessions and account deletion, but
    // /update-user (the profile name) trusts the cookie cache, so a deleted session could still rename the user.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/update-user' && !(await getAuthoritativeSessionFromCtx(ctx))) throw new APIError('UNAUTHORIZED')
      }),
    },
    advanced: {
      cookiePrefix: 'folio',
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    // tanstackStartCookies must stay last.
    plugins: [oneTimeToken({ expiresIn: 1, storeToken: 'hashed' }), tanstackStartCookies()],
  })
}

let auth: ReturnType<typeof createAuth> | undefined
export const getAuth = () => (auth ??= createAuth())

export type Viewer = { id: string; name: string; email: string }

/** The signed-in user for the current request, or null. */
export async function currentViewer(headers: Headers = getRequestHeaders() as unknown as Headers, fresh = false): Promise<Viewer | null> {
  const s = await getAuth().api.getSession({ headers, query: { disableCookieCache: fresh } })
  return s ? { id: s.user.id, name: s.user.name, email: s.user.email } : null
}

/** Reads may trust the cookie cache; writes pass 'fresh' so a deleted session can't change anything. */
export async function requireUserId(check: 'cached' | 'fresh' = 'cached') {
  const v = await currentViewer(undefined, check === 'fresh')
  if (!v) throw new Error('Please sign in again')
  return v.id
}
