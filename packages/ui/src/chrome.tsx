import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import {
  Check, ChevronLeft, CloudUpload, Copy, CopyPlus, ExternalLink, FileSearch, HardDrive, Link2, MoreHorizontal, PencilLine, Plus, Search,
  Share2, Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Mark, appById, hubUrl, signInUrl, urlFor, type AppId } from './apps.tsx'
import { localStore, moveToAccount, type DocStore } from './local.ts'
import { AccountMenu, SuiteNav } from './nav.tsx'
import { SaveBadge, type SaveStatus } from './autosave.tsx'
import { Menu } from './Menu.tsx'
import { Select } from './Select.tsx'
import type { DocSummary } from './server.ts'
import { ago, greeting } from './util.ts'

export { AccountMenu, SuiteNav }
import { useViewer } from './viewer.tsx'

/** Share dialog (native <dialog>: focus trap, Esc to close). */
export function ShareDialog({ app, open, onClose, title, shareId, onToggle }: {
  app: AppId
  open: boolean
  onClose: () => void
  title: string
  shareId: string | null
  onToggle: (on: boolean) => Promise<string | null>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState<boolean | null>(null) // optimistic switch state
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const link = shareId ? `${urlFor(app)}s/${shareId}` : ''

  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const toggle = async (on: boolean) => {
    setPending(on)
    setErr('')
    try { await onToggle(on) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not update sharing') }
    setPending(null)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="share-title" style={{ '--app': appById(app).color } as CSSProperties}>
      <div className="dialog-body">
        <h2 id="share-title"><Share2 size={18} /> Share “{title || `Untitled ${appById(app).noun}`}”</h2>
        <label className="switch-row">
          <span>
            <strong>Anyone with the link can view</strong>
            <small>Viewers can read it but can’t edit. Turn this off to disable the link.</small>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={pending ?? !!shareId} disabled={pending !== null}
            onChange={(e) => toggle(e.target.checked)} />
        </label>
        {shareId && (
          <div className="link-row">
            <Link2 size={16} />
            <input readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <button className="btn soft" onClick={copy}>{copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy</>}</button>
          </div>
        )}
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="dialog-actions">
          {shareId && <a className="btn ghost" href={link} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open view</a>}
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </dialog>
  )
}

export type Template = { name: string; blurb: string; title: string; content: string; preview: ReactNode }

type Sort = 'recent' | 'name' | 'oldest'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Last edited' },
  { value: 'name', label: 'Name' },
  { value: 'oldest', label: 'Oldest first' },
]

/** Files grid used by every app's home route. */
/** Where a guest goes to save online. Back on this app, `?save` moves this browser's files into the account
 * (and opens file `open` when given). */
export const saveOnlineUrl = (app: AppId, open?: number) => signInUrl(`${urlFor(app)}?save=${open ?? ''}`)

/** Files grid used by every app's home route. Signed in: the account's files. Guest: this browser's files. */
export function FileHome({ app: id, docs, templates, cloud, fill = (c) => c, preview }: {
  app: AppId
  docs: DocSummary[]
  templates: Template[]
  cloud: DocStore
  /** Fills template placeholders at creation time. */
  fill?: (content: string) => string
  preview: (d: DocSummary) => ReactNode
}) {
  const app = appById(id)
  const viewer = useViewer()
  const store = viewer ? cloud : localStore(id)
  const navigate = useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [onDevice, setOnDevice] = useState(0) // signed in, but files still in this browser
  const moving = useRef(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [renaming, setRenaming] = useState<number | null>(null)
  const [sharing, setSharing] = useState<number | null>(null)

  const attempt = async (f: () => Promise<unknown>) => {
    setErr('')
    try { await f() } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong') }
  }
  const open = (docId: number) => navigate({ to: '/doc/$id', params: { id: String(docId) } })
  const onCreate = (t?: Template) => attempt(async () => {
    setBusy(true)
    try { await open(await store.create(t ? { title: t.title, content: fill(t.content) } : {})) } finally { setBusy(false) }
  })
  const moveHere = (openId?: number) => attempt(async () => {
    if (moving.current) return
    moving.current = true
    setBusy(true)
    try {
      const moved = await moveToAccount(id, cloud)
      const target = openId && moved.get(openId)
      if (target) return void await navigate({ to: '/doc/$id', params: { id: String(target) }, replace: true })
      await router.invalidate()
      setNotice(`Saved ${moved.size} ${app.noun}${moved.size === 1 ? '' : 's'} from this browser to your account.`)
    } finally {
      moving.current = false
      setBusy(false)
      setOnDevice((await localStore(id).list()).length)
    }
  })

  // Signed in with files left in this browser: offer to move them, or move them straight away after "Save online".
  useEffect(() => {
    if (!viewer) return
    const save = new URLSearchParams(location.search).get('save')
    if (save !== null) history.replaceState(history.state, '', location.pathname)
    localStore(id).list().then((l) => {
      setOnDevice(l.length)
      if (l.length && save !== null) moveHere(Number(save) || undefined)
    })
  }, [])
  const onRemove = (d: DocSummary) => attempt(async () => {
    if (!confirm(`Delete “${d.title || `Untitled ${app.noun}`}”? This can’t be undone.`)) return
    await store.remove(d.id)
    await router.invalidate()
  })
  const onRename = (d: DocSummary, title: string) => attempt(async () => {
    setRenaming(null)
    if (title.trim() === d.title) return
    await store.rename(d.id, title)
    await router.invalidate()
  })
  const onDuplicate = (d: DocSummary) => attempt(async () => {
    await store.duplicate(d.id)
    await router.invalidate()
  })

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle ? docs.filter((d) => (d.title || `untitled ${app.noun}`).toLowerCase().includes(needle)) : [...docs]
    if (sort === 'name') list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
    if (sort === 'oldest') list.reverse()
    return list
  }, [docs, q, sort, app.noun])

  const first = viewer?.name.trim().split(/\s+/)[0]
  const sharingDoc = docs.find((d) => d.id === sharing)

  return (
    <div className="home" style={{ '--app': app.color } as CSSProperties}>
      <SuiteNav current={id} />
      <header className="hero">
        <Mark color={app.color} icon={app.icon} size={52} />
        <div>
          <h1 suppressHydrationWarning>{greeting()}{first ? `, ${first}` : ''}</h1>
          {viewer ? <p>Your {app.noun}s in {app.name}.</p> : (
            <p>No account needed. Files you make here are saved in this browser.</p>
          )}
        </div>
        <div className="spacer" />
        <button className="btn accent" onClick={() => onCreate()} disabled={busy}><Plus size={16} />New {app.noun}</button>
      </header>
      {err && <p className="banner" role="alert">{err}</p>}
      {!viewer && (
        <div className="callout">
          <HardDrive size={20} />
          <p><strong>Saved in this browser only.</strong> Create a free account to keep your {app.noun}s safe, share them, and open them on any device.</p>
          <a className="btn accent" href={saveOnlineUrl(id)}><CloudUpload size={16} />Save online</a>
        </div>
      )}
      {viewer && onDevice > 0 && (
        <div className="callout">
          <HardDrive size={20} />
          <p><strong>{onDevice} {app.noun}{onDevice === 1 ? ' is' : 's are'} still only in this browser.</strong> Move {onDevice === 1 ? 'it' : 'them'} to your account to open {onDevice === 1 ? 'it' : 'them'} anywhere.</p>
          <button className="btn accent" onClick={() => moveHere()} disabled={busy}><CloudUpload size={16} />Move to my account</button>
        </div>
      )}
      {notice && <p className="callout ok" role="status"><Check size={18} />{notice}</p>}

      <section className="templates" aria-label="Start from a template">
        <h2>Start from a template</h2>
        <div className="template-row">
          <button className="template blank" onClick={() => onCreate()} disabled={busy}>
            <span className="template-thumb"><span className="plus"><Plus size={22} /></span></span>
            <strong>Blank {app.noun}</strong>
            <small>Start from scratch</small>
          </button>
          {templates.map((t) => (
            <button key={t.name} className="template" onClick={() => onCreate(t)} disabled={busy}>
              <span className="template-thumb">{t.preview}</span>
              <strong>{t.name}</strong>
              <small>{t.blurb}</small>
            </button>
          ))}
        </div>
      </section>

      <section aria-label={`Your ${app.noun}s`}>
        <div className="files-bar">
          <h2>Your {app.noun}s <span className="count">{docs.length}</span></h2>
          <div className="spacer" />
          {docs.length > 0 && (<>
            <label className="search">
              <Search size={16} />
              <input type="search" placeholder={`Search ${app.noun}s`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${app.noun}s`} />
            </label>
            <Select label="Sort by" value={sort} options={SORTS} width={140} onChange={setSort} />
          </>)}
        </div>

        <div className="grid">
          {shown.map((d, i) => {
            const title = d.title || `Untitled ${app.noun}`
            return (
              <article key={d.id} className="card doc" style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                <Link to="/doc/$id" params={{ id: String(d.id) }} className="cover" aria-label={`Open ${title}`} />
                <div className="thumb">
                  {preview(d)}
                  {d.share_id && <span className="shared-pill"><Link2 size={12} />Shared</span>}
                </div>
                <div className="meta">
                  <app.icon size={16} className="icon" />
                  <div className="name">
                    {renaming === d.id ? (
                      <input className="rename" autoFocus defaultValue={d.title} aria-label="New name" maxLength={200}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => onRename(d, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setRenaming(null)
                        }} />
                    ) : <strong title={title}>{title}</strong>}
                    <time suppressHydrationWarning>Edited {ago(d.updated_at)}</time>
                  </div>
                  <span className="card-menu">
                    <Menu label={`Actions for ${title}`} trigger={<MoreHorizontal size={18} />} items={[
                      { label: 'Open', icon: <FileSearch size={16} />, onSelect: () => open(d.id) },
                      { label: 'Rename', icon: <PencilLine size={16} />, onSelect: () => setRenaming(d.id) },
                      { label: 'Duplicate', icon: <CopyPlus size={16} />, onSelect: () => onDuplicate(d) },
                      viewer
                        ? { label: d.share_id ? 'Sharing settings' : 'Share link…', icon: <Share2 size={16} />, onSelect: () => setSharing(d.id) }
                        : { label: 'Share link…', icon: <Share2 size={16} />, href: saveOnlineUrl(id, d.id) },
                      { separator: true },
                      { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onRemove(d) },
                    ]} />
                  </span>
                </div>
              </article>
            )
          })}
        </div>
        {docs.length === 0 && <p className="empty">No {app.noun}s yet. Start with a blank one or a template above.</p>}
        {docs.length > 0 && shown.length === 0 && <p className="empty">Nothing matches “{q}”.</p>}
      </section>

      <ShareDialog app={id} open={sharingDoc !== undefined} onClose={() => setSharing(null)} title={sharingDoc?.title ?? ''}
        shareId={sharingDoc?.share_id ?? null}
        onToggle={async (on) => {
          const s = await store.share(sharing!, on)
          await router.invalidate()
          return s
        }} />
    </div>
  )
}

/** Editor top bar: back to files, editable title, save status, share, actions, account. */
export function EditorBar({ app: id, docId, title, onTitle, status, error, onShare, shared, children }: {
  app: AppId
  docId: number
  title: string
  onTitle: (t: string) => void
  status: SaveStatus
  error?: string
  onShare?: () => void
  shared?: boolean
  children?: ReactNode
}) {
  const app = appById(id)
  const viewer = useViewer()
  return (
    <header className="topbar" style={{ '--app': app.color } as CSSProperties}>
      <Link to="/" className="back" aria-label={`All ${app.noun}s`} title={`All ${app.noun}s`}><ChevronLeft size={18} /></Link>
      <a href={urlFor('landing')} className="topbar-mark" aria-label="Folio home" title="Folio home">
        <Mark color={app.color} icon={app.icon} size={30} />
      </a>
      <input className="title" aria-label={`${app.noun} title`} placeholder={`Untitled ${app.noun}`} value={title}
        maxLength={200} onChange={(e) => onTitle(e.target.value)} />
      <SaveBadge status={status} error={error} local={!viewer} />
      <div className="spacer" />
      {!viewer && (
        <a className="btn soft" href={saveOnlineUrl(id, docId)} title="Create a free account to keep this file and open it anywhere">
          <CloudUpload size={16} /><span className="label">Save online</span>
        </a>
      )}
      {viewer && onShare && (
        <button className={`btn ghost share-btn${shared ? ' on' : ''}`} onClick={onShare} aria-label={shared ? 'Sharing settings' : 'Share'}>
          {shared ? <Link2 size={16} /> : <Share2 size={16} />}<span className="label">{shared ? 'Shared' : 'Share'}</span>
        </button>
      )}
      {children}
      {viewer && <AccountMenu current={id} />}
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

/** Header for public read-only share pages. */
export function SharedBar({ app: id, title, owner, updated, children }: {
  app: AppId; title: string; owner: string; updated: string; children?: ReactNode
}) {
  const app = appById(id)
  return (
    <header className="topbar shared-bar" style={{ '--app': app.color } as CSSProperties}>
      <a href={urlFor(id)} className="topbar-mark" aria-label={app.name}><Mark color={app.color} icon={app.icon} size={32} /></a>
      <div className="shared-title">
        <strong>{title || `Untitled ${app.noun}`}</strong>
        <span suppressHydrationWarning>{owner ? `Shared by ${owner}` : 'Shared'} · read only · edited {ago(updated)}</span>
      </div>
      <div className="spacer" />
      {children}
      <a className="btn accent" href={hubUrl('signup')}>Make your own<span className="label"> with Folio</span></a>
    </header>
  )
}
