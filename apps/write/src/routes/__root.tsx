import { Outlet, createRootRoute, redirect } from '@tanstack/react-router'
import { signInUrl, urlFor } from '@folio/ui/apps.tsx'
import { RootShell, rootHead } from '@folio/ui/root.tsx'
import { getViewer } from '@folio/ui/session.ts'
import ui from '@folio/ui/styles.css?url'
import { ViewerProvider, isPublicPath } from '@folio/ui/viewer.tsx'
import css from '../app.css?url'

export const Route = createRootRoute({
  // Everything except share links and auth endpoints needs a signed-in user; the hub signs them in.
  beforeLoad: async ({ location }) => {
    if (isPublicPath(location.pathname)) return { viewer: null }
    const viewer = await getViewer()
    if (!viewer) throw redirect({ href: signInUrl(urlFor('write') + location.href.replace(/^\//, '')) })
    return { viewer }
  },
  head: () => rootHead('write', [ui, css]),
  shellComponent: RootShell,
  component: function Root() {
    return <ViewerProvider value={Route.useRouteContext().viewer}><Outlet /></ViewerProvider>
  },
})
