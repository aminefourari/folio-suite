import { Mark, SUITE, safeAppUrl } from '@folio/ui/apps.tsx'
import type { ReactNode } from 'react'

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
