import { createFileRoute } from '@tanstack/react-router'
import { authHandoff } from '@folio/ui/auth-routes.ts'

export const Route = createFileRoute('/auth/handoff')({
  server: { handlers: { GET: authHandoff } },
})
