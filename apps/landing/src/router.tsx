import { createRouter } from '@tanstack/react-router'
import { ErrorView, NotFound } from '@folio/ui/status-pages.tsx'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true, defaultPreload: 'intent', defaultNotFoundComponent: NotFound, defaultErrorComponent: ErrorView })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
