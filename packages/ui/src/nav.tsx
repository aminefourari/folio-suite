import { LogOut, Settings } from 'lucide-react'
import type { CSSProperties } from 'react'
import { APPS, Mark, SUITE, hubUrl, urlFor, type AppId } from './apps.tsx'
import { authClient } from './auth-client.ts'
import { Menu, type MenuItem } from './Menu.tsx'
import { initials, useViewer } from './viewer.tsx'

export async function signOutEverywhere() {
  try { await authClient().signOut() } finally { location.assign(hubUrl('login')) }
}

/** Avatar button with the user, app switcher, account settings and sign out. */
export function AccountMenu({ current }: { current?: AppId }) {
  const v = useViewer()
  if (!v) return null
  const items: MenuItem[] = [
    { header: <><strong>{v.name || 'Your account'}</strong><span>{v.email}</span></> },
    { separator: true },
    ...APPS.map((a): MenuItem => ({ label: a.name, icon: <a.icon size={16} style={{ color: a.color }} />, href: urlFor(a.id), hint: a.id === current ? 'Open' : undefined })),
    { separator: true },
    { label: 'Account settings', icon: <Settings size={16} />, href: hubUrl('account') },
    { label: 'Sign out', icon: <LogOut size={16} />, onSelect: signOutEverywhere },
  ]
  return <Menu label="Account" triggerClassName="avatar-btn" trigger={<span className="avatar">{initials(v)}</span>} items={items} />
}

/** Suite switcher: Folio home plus each app, current one highlighted. */
export function SuiteNav({ current }: { current?: AppId }) {
  return (
    <nav className="suite-nav" aria-label="Folio apps">
      <a href={urlFor('landing')} className="suite-home" aria-label="Folio home">
        <Mark color={SUITE.color} icon={SUITE.icon} size={28} /> <span>Folio</span>
      </a>
      <div className="suite-apps">
        {APPS.map((a) => (
          <a key={a.id} href={urlFor(a.id)} aria-current={a.id === current ? 'page' : undefined}
            style={{ '--app': a.color } as CSSProperties}>
            <a.icon size={15} /> {a.short}
          </a>
        ))}
      </div>
      <div className="spacer" />
      <AccountMenu current={current} />
    </nav>
  )
}

