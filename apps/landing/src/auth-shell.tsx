import { APPS, Mark, SUITE, safeAppUrl, urlFor } from '@folio/ui/apps.tsx'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/** After signing in or up: continue to the app that asked (via the SSO hand-off), else the landing page. */
export const afterAuth = (to?: string) => (safeAppUrl(to) ? `/auth/handoff?to=${encodeURIComponent(to!)}` : '/')

export const toSearch = (s: Record<string, unknown>) => ({ to: typeof s.to === 'string' ? s.to : undefined })

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="auth-page">
      <a href="/" className="auth-brand"><Mark color={SUITE.color} icon={SUITE.icon} size={36} /> Folio</a>
      <section className="auth-card">
        <h1>{title}</h1>
        <p className="auth-sub">{subtitle}</p>
        {children}
      </section>
      <p className="auth-footer">{footer}</p>
    </main>
  )
}

export function Field({ label, hint, ...input }: { label: string; hint?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} />
      {hint && <small>{hint}</small>}
    </label>
  )
}

export type Busy = '' | 'sending' | 'opening'

/** Submit state that resets when the back/forward cache restores the page mid-redirect. */
export function useBusy() {
  const [busy, setBusy] = useState<Busy>('')
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setBusy('') }
    addEventListener('pageshow', reset)
    return () => removeEventListener('pageshow', reset)
  }, [])
  return [busy, setBusy] as const
}

/** Submit button that says what is happening: the request, then the app the browser is opening. */
export function AuthSubmit({ busy, to, label, sending }: { busy: Busy; to?: string; label: string; sending: string }) {
  const target = safeAppUrl(to)
  const app = target && APPS.find((a) => new URL(urlFor(a.id)).origin === target.origin)
  return (
    <button className="btn accent wide-btn" disabled={!!busy} aria-live="polite">
      {busy && <LoaderCircle size={16} className="spin" />}
      {busy === 'sending' ? sending : busy === 'opening' ? `Opening ${app ? app.name : 'Folio'}…` : label}
    </button>
  )
}
