/// <reference path="./cloudflare.d.ts" />
// Server only: D1 (Cloudflare's SQLite) storage shared by every Folio app.
// Import this only from inside createServerFn handlers so it never reaches the client bundle.
import { env } from 'cloudflare:workers'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import type { AppId } from './apps.tsx'

export type DocRow = { id: number; title: string; content: string; updated_at: string }
export type DocSummary = Omit<DocRow, 'content'> & { preview: string }

const MAX_CONTENT = 1_500_000 // D1 rows top out at 2 MB
const MAX_DOCS = 200 // per visitor per app; keeps a public demo from being used as free storage
const COOKIE = 'folio_owner'

const db = () => (env as unknown as { DB: D1Database }).DB

// Schema is created lazily, once per isolate.
let ready: Promise<unknown> | undefined
const schema = () =>
  (ready ??= db().batch([
    db().prepare(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      owner TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    db().prepare('CREATE INDEX IF NOT EXISTS documents_owner ON documents (owner, kind, updated_at DESC)'),
  ]).catch((e) => { ready = undefined; throw e }))

// ponytail: anonymous per-browser ownership; real accounts (Cloudflare Access, OAuth) if people need cross-device sync.
function owner() {
  let id = getCookie(COOKIE)
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) id = crypto.randomUUID()
  setCookie(COOKIE, id, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 400 })
  return id
}

export const parseId = (d: unknown) => {
  const n = Number(d)
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid document id')
  return n
}

export const parseNew = (d: unknown) => {
  const { title = '', content = '' } = (d ?? {}) as { title?: unknown; content?: unknown }
  if (typeof title !== 'string' || typeof content !== 'string') throw new Error('Invalid document')
  return { title: title.slice(0, 200), content: checkSize(content) }
}

export const parseSave = (d: unknown) => ({ id: parseId((d as { id?: unknown })?.id), ...parseNew(d) })

function checkSize(content: string) {
  if (content.length > MAX_CONTENT) throw new Error('Too large to save: remove some images or content')
  return content
}

export async function list(kind: AppId): Promise<DocSummary[]> {
  await schema()
  const { results } = await db()
    .prepare('SELECT id, title, updated_at, substr(content, 1, 4000) AS preview FROM documents WHERE owner = ? AND kind = ? ORDER BY updated_at DESC')
    .bind(owner(), kind).all<DocSummary>()
  return results
}

export async function get(kind: AppId, id: number) {
  await schema()
  return db().prepare('SELECT id, title, content, updated_at FROM documents WHERE id = ? AND owner = ? AND kind = ?')
    .bind(id, owner(), kind).first<DocRow>()
}

export async function create(kind: AppId, { title, content }: { title: string; content: string }) {
  await schema()
  const who = owner()
  const count = await db().prepare('SELECT count(*) AS n FROM documents WHERE owner = ? AND kind = ?').bind(who, kind).first<number>('n')
  if ((count ?? 0) >= MAX_DOCS) throw new Error(`You can keep up to ${MAX_DOCS} files here. Delete some to make room.`)
  const row = await db().prepare('INSERT INTO documents (owner, kind, title, content) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(who, kind, title, content).first<number>('id')
  return row!
}

export async function save(kind: AppId, { id, title, content }: { id: number; title: string; content: string }) {
  await schema()
  const { meta } = await db()
    .prepare("UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ? AND owner = ? AND kind = ?")
    .bind(title, content, id, owner(), kind).run()
  if (!meta.changes) throw new Error('This file no longer exists')
}

export async function remove(kind: AppId, id: number) {
  await schema()
  await db().prepare('DELETE FROM documents WHERE id = ? AND owner = ? AND kind = ?').bind(id, owner(), kind).run()
}
