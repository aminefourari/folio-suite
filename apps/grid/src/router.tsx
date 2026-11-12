import { createRouter } from '@tanstack/react-router'
import { ErrorView, NotFound } from '@folio/ui/status-pages.tsx'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree, scrollRestoration: true, defaultPreload: 'intent', defaultNotFoundComponent: NotFound, defaultErrorComponent: ErrorView,
    // Skeletons after 150 ms, gone as soon as the data is there (the default keeps them up for at least 500 ms).
    defaultPendingMs: 150, defaultPendingMinMs: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
