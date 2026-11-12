import { useRouterState } from '@tanstack/react-router'
import { LogOut, Settings } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { APPS, Mark, SUITE, hubUrl, signInUrl, urlFor, type AppId } from './apps.tsx'
import { Menu, type MenuItem } from './Menu.tsx'
import { initials, useViewer, type Viewer } from './viewer.tsx'

/** Link to an app. Signed in, it carries `?sso=1` so the app signs the visitor in if it has no session yet. */
export const appLink = (id: AppId, viewer: Viewer | null) => urlFor(id) + (viewer ? '?sso=1' : '')

/** Signs this browser out of every app: a redirect chain through each app's /auth/signout, ending at the hub's /login. */
export const signOutEverywhere = () => location.assign(urlFor('write') + 'auth/signout')

/** Avatar button with the user, app switcher, account settings and sign out. */
export function AccountMenu({ current }: { current?: AppId }) {
  const v = useViewer()
  if (!v) return <a className="btn ghost" href={current ? `${signInUrl(urlFor(current))}` : hubUrl('login')}>Sign in</a>
  const items: MenuItem[] = [
    { header: <><strong>{v.name || 'Your account'}</strong><span>{v.email}</span></> },
    { separator: true },
    ...APPS.map((a): MenuItem => ({ label: a.name, icon: <a.icon size={16} style={{ color: a.color }} />, href: appLink(a.id, v), hint: a.id === current ? 'Open' : undefined })),
    { separator: true },
    { label: 'Account settings', icon: <Settings size={16} />, href: hubUrl('account') },
    { label: 'Sign out', icon: <LogOut size={16} />, onSelect: signOutEverywhere },
  ]
  return <Menu label="Account" triggerClassName="avatar-btn" trigger={<span className="avatar">{initials(v)}</span>} items={items} />
}

/** Suite switcher: Folio home plus each app, current one highlighted. */
export function SuiteNav({ current }: { current?: AppId }) {
  const viewer = useViewer()
  // Another app takes a moment to paint: mark its tab and show the progress bar until then.
  const [going, setGoing] = useState<AppId | null>(null)
  useEffect(() => {
    const reset = () => { setGoing(null); delete document.documentElement.dataset.leaving }
    addEventListener('pageshow', reset) // back/forward cache restores the page as it was left
    return () => removeEventListener('pageshow', reset)
  }, [])
  const leave = (id: AppId) => (e: MouseEvent) => {
    if (id === current || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    setGoing(id)
    document.documentElement.dataset.leaving = ''
  }
  return (
    <nav className="suite-nav" aria-label="Folio apps">
      <a href={urlFor('landing')} className="suite-home" aria-label="Folio home">
        <Mark color={SUITE.color} icon={SUITE.icon} size={28} /> <span>Folio</span>
      </a>
      <div className="suite-apps">
        {APPS.map((a) => (
          <a key={a.id} href={appLink(a.id, viewer)} aria-current={a.id === (going ?? current) ? 'page' : undefined} onClick={leave(a.id)}
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


/** Thin bar at the top of the window: in-app navigations that take over 150 ms, and leaving for another app. */
export function NavProgress() {
  const pending = useRouterState({ select: (s) => s.status === 'pending' })
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!pending) return setShow(false)
    const t = setTimeout(() => setShow(true), 150)
    return () => clearTimeout(t)
  }, [pending])
  return <div className="nav-progress" data-on={show || undefined} aria-hidden />
}
