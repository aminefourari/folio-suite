/// <reference path="./cloudflare.d.ts" />
// Server only. Better Auth on the shared D1 database. Import only from server routes and createServerFn handlers.
import { env } from 'cloudflare:workers'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
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
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
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
export async function currentViewer(headers: Headers = getRequestHeaders() as unknown as Headers): Promise<Viewer | null> {
  const s = await getAuth().api.getSession({ headers })
  return s ? { id: s.user.id, name: s.user.name, email: s.user.email } : null
}

export async function requireUserId() {
  const v = await currentViewer()
  if (!v) throw new Error('Please sign in again')
  return v.id
}
