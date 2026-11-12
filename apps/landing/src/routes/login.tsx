import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient, must } from '@folio/ui/auth-client.ts'
import { AuthShell, AuthSubmit, Field, afterAuth, toSearch, useBusy } from '../auth-shell.tsx'

export const Route = createFileRoute('/login')({
  validateSearch: toSearch,
  // Already signed in: continue straight away, from the server, before the form renders.
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: afterAuth(search.to), reloadDocument: true })
  },
  head: () => ({ meta: [{ title: 'Sign in · Folio' }] }),
  component: Login,
})

function Login() {
  const { to } = Route.useSearch()
  const [busy, setBusy] = useBusy()
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy('sending')
    setErr('')
    try {
      await must(authClient().signIn.email({ email: String(f.get('email')), password: String(f.get('password')) }))
      setBusy('opening')
      location.assign(afterAuth(to))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not sign in')
      setBusy('')
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to open your documents, spreadsheets and presentations."
      footer={<>New to Folio? <Link to="/signup" search={{ to }}>Create an account</Link></>}>
      <form method="post" onSubmit={submit} className="auth-form">
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        {err && <p className="form-error" role="alert">{err}</p>}
        <AuthSubmit busy={busy} to={to} label="Sign in" sending="Signing in…" />
      </form>
    </AuthShell>
  )
}
