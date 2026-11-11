import { Outlet, createRootRoute } from '@tanstack/react-router'
import { RootShell, rootHead } from '@folio/ui/root.tsx'
import { getViewer } from '@folio/ui/session.ts'
import ui from '@folio/ui/styles.css?url'
import { ViewerProvider } from '@folio/ui/viewer.tsx'
import css from '../app.css?url'

export const Route = createRootRoute({
  beforeLoad: async () => ({ viewer: await getViewer() }),
  head: () => rootHead('landing', [ui, css]),
  shellComponent: RootShell,
  component: function Root() {
    return <ViewerProvider value={Route.useRouteContext().viewer}><Outlet /></ViewerProvider>
  },
})
