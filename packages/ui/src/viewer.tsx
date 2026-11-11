import { createContext, useContext } from 'react'
import type { Viewer } from './auth.server.ts'

export type { Viewer }
const Ctx = createContext<Viewer | null>(null)
export const ViewerProvider = Ctx.Provider
export const useViewer = () => useContext(Ctx)

/** Paths that work without signing in. */
export const isPublicPath = (p: string) => /^\/(s|auth|api)\//.test(p)

export const initials = (v: Pick<Viewer, 'name' | 'email'>) =>
  (v.name.trim() || v.email).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
