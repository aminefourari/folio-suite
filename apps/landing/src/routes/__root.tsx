import { createRootRoute } from '@tanstack/react-router'
import { RootShell, rootHead } from '@folio/ui/root.tsx'
import ui from '@folio/ui/styles.css?url'
import css from '../app.css?url'

export const Route = createRootRoute({
  head: () => rootHead('landing', [ui, css]),
  shellComponent: RootShell,
})
