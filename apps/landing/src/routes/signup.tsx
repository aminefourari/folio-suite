import { Link, createFileRoute } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, must } from '@folio/ui/auth-client.ts'
import { useViewer } from '@folio/ui/viewer.tsx'
import { AuthShell, Field, afterAuth, toSearch } from '../auth-shell.tsx'

export const Route = createFileRoute('/signup')({
  validateSearch: toSearch,
  head: () => ({ meta: [{ title: 'Create account · Folio' }] }),
  component: Signup,
})

function Signup() {
  const { to } = Route.useSearch()
  const viewer = useViewer()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pw, setPw] = useState('')

  useEffect(() => { if (viewer) location.replace(afterAuth(to)) }, [viewer, to])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setErr('')
    try {
      await must(authClient().signUp.email({ name: String(f.get('name')).trim(), email: String(f.get('email')), password: pw }))
      location.assign(afterAuth(to))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create your account')
      setBusy(false)
    }
  }

  const strength = [pw.length >= 8, pw.length >= 12, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /\d|[^A-Za-z]/.test(pw)].filter(Boolean).length
  return (
    <AuthShell title="Create your account" subtitle="One account for Folio Write, Grid and Stage. Free, no card needed."
      footer={<>Already have an account? <Link to="/login" search={{ to }}>Sign in</Link></>}>
      <form onSubmit={submit} className="auth-form">
        <Field label="Name" name="name" autoComplete="name" required maxLength={80} autoFocus />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
          value={pw} onChange={(e) => setPw(e.target.value)}
          hint={<span className="strength" data-level={pw ? strength : 0}><i /><i /><i /><i />
            {pw.length < 8 ? 'At least 8 characters' : ['Weak', 'Weak', 'Okay', 'Good', 'Strong'][strength]}</span>} />
        {err && <p className="form-error" role="alert">{err}</p>}
        <button className="btn accent wide-btn" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}Create account</button>
      </form>
    </AuthShell>
  )
}
