import { Link, createFileRoute } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, must } from '@folio/ui/auth-client.ts'
import { useViewer } from '@folio/ui/viewer.tsx'
import { AuthShell, Field, afterAuth, toSearch } from '../auth-shell.tsx'

export const Route = createFileRoute('/login')({
  validateSearch: toSearch,
  head: () => ({ meta: [{ title: 'Sign in · Folio' }] }),
  component: Login,
})

function Login() {
  const { to } = Route.useSearch()
  const viewer = useViewer()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Already signed in: continue straight away.
  useEffect(() => { if (viewer) location.replace(afterAuth(to)) }, [viewer, to])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setErr('')
    try {
      await must(authClient().signIn.email({ email: String(f.get('email')), password: String(f.get('password')) }))
      location.assign(afterAuth(to))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not sign in')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to open your documents, spreadsheets and presentations."
      footer={<>New to Folio? <Link to="/signup" search={{ to }}>Create an account</Link></>}>
      <form method="post" onSubmit={submit} className="auth-form">
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        {err && <p className="form-error" role="alert">{err}</p>}
        <button className="btn accent wide-btn" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}Sign in</button>
      </form>
    </AuthShell>
  )
}
