import { createFileRoute } from '@tanstack/react-router'
import { authSignOut } from '@folio/ui/auth-routes.ts'

// Sign-out chain: write → grid → stage → landing → /login (see authSignOut).
export const Route = createFileRoute('/auth/signout')({
  server: { handlers: { GET: authSignOut('/login') } },
})
