import { createFileRoute } from '@tanstack/react-router'
import { authSignOut } from '@folio/ui/auth-routes.ts'
import { urlFor } from '@folio/ui/urls.ts'

// Sign-out chain: write → grid → stage → landing → /login (see authSignOut).
export const Route = createFileRoute('/auth/signout')({
  server: { handlers: { GET: authSignOut(urlFor('grid') + 'auth/signout') } },
})
