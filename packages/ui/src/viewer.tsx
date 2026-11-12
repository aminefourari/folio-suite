import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { Viewer } from './auth.server.ts'
import { primeViewer } from './session.ts'

export type { Viewer }
export { isPublicPath } from './urls.ts'
const Ctx = createContext<Viewer | null>(null)
export const useViewer = () => useContext(Ctx)

/** Provides the viewer from the root's `beforeLoad`, seeds `loadViewer`'s memo and drops `?sso` from the address bar. */
export function ViewerProvider({ value, children }: { value: Viewer | null; children: ReactNode }) {
  primeViewer(value)
  useEffect(() => {
    const u = new URL(location.href)
    if (!u.searchParams.has('sso')) return
    u.searchParams.delete('sso')
    history.replaceState(history.state, '', u)
  }, [])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const initials = (v: Pick<Viewer, 'name' | 'email'>) =>
  (v.name.trim() || v.email).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
