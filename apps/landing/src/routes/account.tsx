import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { KeyRound, LogOut, ShieldAlert, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { hubUrl } from '@folio/ui/apps.tsx'
import { authClient, must } from '@folio/ui/auth-client.ts'
import { SuiteNav } from '@folio/ui/nav.tsx'
import { useViewer } from '@folio/ui/viewer.tsx'
import { Field } from '../auth-shell.tsx'

export const Route = createFileRoute('/account')({
  beforeLoad: ({ context }) => {
    if (!context.viewer) throw redirect({ to: '/login', search: { to: hubUrl('account') } })
  },
  head: () => ({ meta: [{ title: 'Account · Folio' }] }),
  component: Account,
})

/** Runs a form action with busy/ok/error state. */
function useAction() {
  const [state, setState] = useState<{ busy: boolean; ok?: string; err?: string }>({ busy: false })
  const run = async (f: () => Promise<string | void>) => {
    setState({ busy: true })
    try { setState({ busy: false, ok: (await f()) || 'Saved' }) } catch (e) { setState({ busy: false, err: e instanceof Error ? e.message : 'Something went wrong' }) }
  }
  return [state, run] as const
}

function Panel({ icon, title, text, children, danger }: { icon: ReactNode; title: string; text: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`panel${danger ? ' danger' : ''}`}>
      <div className="panel-head">{icon}<div><h2>{title}</h2><p>{text}</p></div></div>
      {children}
    </section>
  )
}

const Msg = ({ s }: { s: { ok?: string; err?: string } }) =>
  s.err ? <p className="form-error" role="alert">{s.err}</p> : s.ok ? <p className="form-ok" role="status">{s.ok}</p> : null

function Account() {
  const viewer = useViewer()!
  const router = useRouter()
  const [profile, saveProfile] = useAction()
  const [password, savePassword] = useAction()
  const [sessions, endSessions] = useAction()
  const [del, deleteAccount] = useAction()

  return (
    <div className="home account">
      <SuiteNav />
      <header className="hero">
        <div>
          <h1>Account</h1>
          <p>Signed in as {viewer.email}</p>
        </div>
      </header>

      <div className="panels">
        <Panel icon={<UserRound size={20} />} title="Profile" text="Your name appears on files you share.">
          <form className="auth-form" onSubmit={(e) => {
            e.preventDefault()
            const name = String(new FormData(e.currentTarget).get('name')).trim()
            saveProfile(async () => { await must(authClient().updateUser({ name })); await router.invalidate(); return 'Profile updated' })
          }}>
            <Field label="Name" name="name" defaultValue={viewer.name} required maxLength={80} autoComplete="name" />
            <Field label="Email" value={viewer.email} readOnly disabled hint="Email changes aren’t available yet." />
            <Msg s={profile} />
            <button className="btn" disabled={profile.busy}>Save profile</button>
          </form>
        </Panel>

        <Panel icon={<KeyRound size={20} />} title="Password" text="Use at least 8 characters. A passphrase is easiest to remember.">
          <form className="auth-form" onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const f = new FormData(form)
            savePassword(async () => {
              if (f.get('newPassword') !== f.get('confirm')) throw new Error('The new passwords don’t match')
              await must(authClient().changePassword({
                currentPassword: String(f.get('currentPassword')),
                newPassword: String(f.get('newPassword')),
                revokeOtherSessions: f.get('revoke') === 'on',
              }))
              form.reset()
              return 'Password changed'
            })
          }}>
            <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
            <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
            <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            <label className="check"><input type="checkbox" name="revoke" defaultChecked /> Sign out on other devices</label>
            <Msg s={password} />
            <button className="btn" disabled={password.busy}>Change password</button>
          </form>
        </Panel>

        <Panel icon={<LogOut size={20} />} title="Sessions" text="Signed in somewhere you don’t recognise? End every session, including this one.">
          <Msg s={sessions} />
          <button className="btn soft" disabled={sessions.busy} onClick={() => endSessions(async () => {
            await must(authClient().revokeSessions())
            location.assign('/login')
          })}>Sign out everywhere</button>
        </Panel>

        <Panel danger icon={<ShieldAlert size={20} />} title="Delete account" text="Permanently deletes your account and every document, spreadsheet and presentation. This can’t be undone.">
          <form className="auth-form" onSubmit={(e) => {
            e.preventDefault()
            const pw = String(new FormData(e.currentTarget).get('password'))
            if (!confirm('Delete your account and all your files? This can’t be undone.')) return
            deleteAccount(async () => {
              await must(authClient().deleteUser({ password: pw }))
              location.assign('/')
            })
          }}>
            <Field label="Confirm with your password" name="password" type="password" autoComplete="current-password" required />
            <Msg s={del} />
            <button className="btn danger-btn" disabled={del.busy}>Delete my account</button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
