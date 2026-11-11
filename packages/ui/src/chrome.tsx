import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { APPS, Mark, SUITE, appById, urlFor, type AppId } from './apps.tsx'
import { SaveBadge, type SaveStatus } from './autosave.tsx'
import type { DocSummary } from './server.ts'
import { ago, greeting } from './util.ts'

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
    </nav>
  )
}

/** Files grid used by every app's home route. */
export function FileHome({ app: id, docs, create, remove, preview }: {
  app: AppId
  docs: DocSummary[]
  create: () => Promise<number>
  remove: (id: number) => Promise<unknown>
  preview: (d: DocSummary) => ReactNode
}) {
  const app = appById(id)
  const navigate = useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onCreate = async () => {
    setBusy(true)
    setErr('')
    try {
      navigate({ to: '/doc/$id', params: { id: String(await create()) } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create a file')
      setBusy(false)
    }
  }
  const onRemove = async (d: DocSummary) => {
    if (!confirm(`Delete “${d.title || `Untitled ${app.noun}`}”? This can’t be undone.`)) return
    await remove(d.id)
    router.invalidate()
  }

  return (
    <div className="home" style={{ '--app': app.color } as CSSProperties}>
      <SuiteNav current={id} />
      <header className="hero">
        <Mark color={app.color} icon={app.icon} size={52} />
        <div>
          <h1 suppressHydrationWarning>{greeting()}</h1>
          <p>Your {app.noun}s in {app.name}. They’re saved to this browser’s private space.</p>
        </div>
        <div className="spacer" />
        <button className="btn accent" onClick={onCreate} disabled={busy}><Plus size={16} />New {app.noun}</button>
      </header>
      {err && <p className="banner" role="alert">{err}</p>}

      <section className="grid" aria-label={`Your ${app.noun}s`}>
        <button className="card new" onClick={onCreate} disabled={busy} style={{ '--i': 0 } as CSSProperties}>
          <span className="plus"><Plus size={22} /></span>
          <span>Blank {app.noun}</span>
        </button>
        {docs.map((d, i) => {
          const title = d.title || `Untitled ${app.noun}`
          return (
            <article key={d.id} className="card doc" style={{ '--i': Math.min(i + 1, 12) } as CSSProperties}>
              <Link to="/doc/$id" params={{ id: String(d.id) }} className="cover" aria-label={`Open ${title}`} />
              <div className="thumb">{preview(d)}</div>
              <div className="meta">
                <app.icon size={16} className="icon" />
                <div className="name">
                  <strong title={title}>{title}</strong>
                  <time suppressHydrationWarning>Edited {ago(d.updated_at)}</time>
                </div>
                <button className="icon-btn danger" aria-label={`Delete ${title}`} onClick={() => onRemove(d)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          )
        })}
      </section>
      {docs.length === 0 && <p className="empty">No {app.noun}s yet. Start with a blank one.</p>}
    </div>
  )
}

/** Editor top bar: back to files, editable title, save status, actions. */
export function EditorBar({ app: id, title, onTitle, status, error, children }: {
  app: AppId
  title: string
  onTitle: (t: string) => void
  status: SaveStatus
  error?: string
  children?: ReactNode
}) {
  const app = appById(id)
  return (
    <header className="topbar" style={{ '--app': app.color } as CSSProperties}>
      <Link to="/" className="back" aria-label={`All ${app.noun}s`} title={`All ${app.noun}s`}><ChevronLeft size={18} /></Link>
      <a href={urlFor('landing')} className="topbar-mark" aria-label="Folio home" title="Folio home">
        <Mark color={app.color} icon={app.icon} size={30} />
      </a>
      <input className="title" aria-label={`${app.noun} title`} placeholder={`Untitled ${app.noun}`} value={title}
        maxLength={200} onChange={(e) => onTitle(e.target.value)} />
      <SaveBadge status={status} error={error} />
      <div className="spacer" />
      {children}
    </header>
  )
}

const keepEditorFocus = (e: React.MouseEvent) => e.preventDefault()

/** Toolbar icon button. Never takes focus on click, so the editor keeps its selection. */
export function Tool({ label, kbd, pressed, disabled, onClick, children }: {
  label: string; kbd?: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button type="button" className="tool" title={kbd ? `${label} (${kbd})` : label} aria-label={label}
      aria-pressed={pressed} disabled={disabled} onMouseDown={keepEditorFocus} onClick={onClick}>{children}</button>
  )
}

/** Toolbar button with a visible label. */
export function WideTool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="tool wide" onMouseDown={keepEditorFocus} onClick={onClick}>{children}<span>{label}</span></button>
  )
}
