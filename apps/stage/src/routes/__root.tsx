import { Outlet, createRootRoute } from '@tanstack/react-router'
import { RootShell, rootHead } from '@folio/ui/root.tsx'
import { appContext } from '@folio/ui/session.ts'
import ui from '@folio/ui/styles.css?url'
import { ViewerProvider } from '@folio/ui/viewer.tsx'
import css from '../app.css?url'

export const Route = createRootRoute({
  // Signed in: files live in the account. Guest (viewer null): files live in this browser.
  beforeLoad: ({ location }) => appContext('stage', location),
  head: () => rootHead('stage', [ui, css]),
  shellComponent: RootShell,
  component: function Root() {
    return <ViewerProvider value={Route.useRouteContext().viewer}><Outlet /></ViewerProvider>
  },
})
