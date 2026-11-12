import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient, must } from '@folio/ui/auth-client.ts'
import { AuthShell, AuthSubmit, Field, afterAuth, toSearch, useBusy } from '../auth-shell.tsx'

export const Route = createFileRoute('/signup')({
  validateSearch: toSearch,
  // Already signed in: continue straight away, from the server, before the form renders.
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: afterAuth(search.to), reloadDocument: true })
  },
  head: () => ({ meta: [{ title: 'Create account · Folio' }] }),
  component: Signup,
})

function Signup() {
  const { to } = Route.useSearch()
  const [busy, setBusy] = useBusy()
  const [err, setErr] = useState('')
  const [pw, setPw] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy('sending')
    setErr('')
    try {
      await must(authClient().signUp.email({ name: String(f.get('name')).trim(), email: String(f.get('email')), password: pw }))
      setBusy('opening')
      location.assign(afterAuth(to))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create your account')
      setBusy('')
    }
  }

  const strength = [pw.length >= 8, pw.length >= 12, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /\d|[^A-Za-z]/.test(pw)].filter(Boolean).length
  return (
    <AuthShell title="Create your account" subtitle="One account for Folio Write, Grid and Stage. Free, no card needed."
      footer={<>Already have an account? <Link to="/login" search={{ to }}>Sign in</Link></>}>
      <form method="post" onSubmit={submit} className="auth-form">
        <Field label="Name" name="name" autoComplete="name" required maxLength={80} autoFocus />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
          value={pw} onChange={(e) => setPw(e.target.value)}
          hint={<span className="strength" data-level={pw ? strength : 0}><i /><i /><i /><i />
            {pw.length < 8 ? 'At least 8 characters' : ['Weak', 'Weak', 'Okay', 'Good', 'Strong'][strength]}</span>} />
        {err && <p className="form-error" role="alert">{err}</p>}
        <AuthSubmit busy={busy} to={to} label="Create account" sending="Creating account…" />
      </form>
    </AuthShell>
  )
}
