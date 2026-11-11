import { createFileRoute } from '@tanstack/react-router'
import { authApi } from '@folio/ui/auth-routes.ts'

export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: { GET: authApi, POST: authApi } },
})
