import { createFileRoute } from '@tanstack/react-router'
import { authCallback } from '@folio/ui/auth-routes.ts'

export const Route = createFileRoute('/auth/callback')({
  server: { handlers: { GET: authCallback } },
})
