import { createServerFn } from '@tanstack/react-start'
import { currentViewer } from './auth.server.ts'

export type { Viewer } from './auth.server.ts'

/** The signed-in user (or null). Safe to call from route loaders on server and client. */
export const getViewer = createServerFn().handler(() => currentViewer())
