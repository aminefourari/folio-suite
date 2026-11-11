import { Outlet, createRootRoute } from '@tanstack/react-router'
import { RootShell, rootHead } from '@folio/ui/root.tsx'
import { getViewer } from '@folio/ui/session.ts'
import ui from '@folio/ui/styles.css?url'
import { ViewerProvider, isPublicPath } from '@folio/ui/viewer.tsx'
import css from '../app.css?url'

export const Route = createRootRoute({
  // Signed in: files live in the account. Guest (viewer null): files live in this browser.
  beforeLoad: async ({ location }) => ({ viewer: isPublicPath(location.pathname) ? null : await getViewer() }),
  head: () => rootHead('write', [ui, css]),
  shellComponent: RootShell,
  component: function Root() {
    return <ViewerProvider value={Route.useRouteContext().viewer}><Outlet /></ViewerProvider>
  },
})
