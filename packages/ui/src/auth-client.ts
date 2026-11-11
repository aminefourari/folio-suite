import { createAuthClient } from 'better-auth/react'

// Lazily created in the browser: each app talks to its own /api/auth on the same origin.
let client: ReturnType<typeof createAuthClient> | undefined
export const authClient = () => (client ??= createAuthClient({ baseURL: location.origin }))

/** Better Auth returns { data, error }; turn errors into exceptions with a readable message. */
export async function must<T>(p: Promise<{ data: T | null; error: { message?: string; status?: number } | null }>) {
  const { data, error } = await p
  if (error) {
    if (error.status === 429) throw new Error('Too many attempts. Wait a minute and try again.')
    throw new Error(error.message || 'Something went wrong')
  }
  return data as T
}
