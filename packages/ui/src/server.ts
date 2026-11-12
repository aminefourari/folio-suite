/// <reference path="./cloudflare.d.ts" />
// Server only: D1 document storage shared by every Folio app, scoped to the signed-in user.
// Import this only from inside createServerFn handlers so it never reaches the client bundle.
import { env } from 'cloudflare:workers'
import type { AppId } from './apps.tsx'
import { requireUserId } from './auth.server.ts'

export type DocRow = { id: number; title: string; content: string; updated_at: string; share_id: string | null }
export type DocSummary = Omit<DocRow, 'content'> & { preview: string }
export type SharedDoc = { title: string; content: string; updated_at: string; owner_name: string }

const MAX_CONTENT = 1_500_000 // D1 rows top out at 2 MB
const MAX_DOCS = 200 // per user per app
const db = () => (env as unknown as { DB: D1Database }).DB

export const parseId = (d: unknown) => {
  const n = Number(d)
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid document id')
  return n
}

export const parseNew = (d: unknown) => {
  const { title = '', content = '' } = (d ?? {}) as { title?: unknown; content?: unknown }
  if (typeof title !== 'string' || typeof content !== 'string') throw new Error('Invalid document')
  if (content.length > MAX_CONTENT) throw new Error('Too large to save: remove some images or content')
  return { title: title.slice(0, 200), content }
}

export const parseSave = (d: unknown) => ({ id: parseId((d as { id?: unknown })?.id), ...parseNew(d) })

export const parseRename = (d: unknown) => {
  const { id, title } = (d ?? {}) as { id?: unknown; title?: unknown }
  if (typeof title !== 'string') throw new Error('Invalid title')
  return { id: parseId(id), title: title.trim().slice(0, 200) }
}

export const parseShare = (d: unknown) => {
  const { id, on } = (d ?? {}) as { id?: unknown; on?: unknown }
  return { id: parseId(id), on: on === true }
}

export const parseShareId = (d: unknown) => {
  if (typeof d !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(d)) throw new Error('Invalid link')
  return d
}

export async function list(kind: AppId): Promise<DocSummary[]> {
  const { results } = await db()
    .prepare('SELECT id, title, updated_at, share_id, substr(content, 1, 4000) AS preview FROM documents WHERE owner = ? AND kind = ? ORDER BY updated_at DESC')
    .bind(await requireUserId(), kind).all<DocSummary>()
  return results
}

export async function get(kind: AppId, id: number) {
  return db().prepare('SELECT id, title, content, updated_at, share_id FROM documents WHERE id = ? AND owner = ? AND kind = ?')
    .bind(id, await requireUserId(), kind).first<DocRow>()
}

export async function create(kind: AppId, { title, content }: { title: string; content: string }) {
  const who = await requireUserId('fresh')
  const count = await db().prepare('SELECT count(*) AS n FROM documents WHERE owner = ? AND kind = ?').bind(who, kind).first<number>('n')
  if ((count ?? 0) >= MAX_DOCS) throw new Error(`You can keep up to ${MAX_DOCS} files here. Delete some to make room.`)
  return (await db().prepare('INSERT INTO documents (owner, kind, title, content) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(who, kind, title, content).first<number>('id'))!
}

export async function save(kind: AppId, { id, title, content }: { id: number; title: string; content: string }) {
  const { meta } = await db()
    .prepare("UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ? AND owner = ? AND kind = ?")
    .bind(title, content, id, await requireUserId('fresh'), kind).run()
  if (!meta.changes) throw new Error('This file no longer exists')
}

export async function rename(kind: AppId, { id, title }: { id: number; title: string }) {
  await db().prepare("UPDATE documents SET title = ?, updated_at = datetime('now') WHERE id = ? AND owner = ? AND kind = ?")
    .bind(title, id, await requireUserId('fresh'), kind).run()
}

export async function duplicate(kind: AppId, id: number) {
  const doc = await get(kind, id)
  if (!doc) throw new Error('This file no longer exists')
  return create(kind, { title: `${doc.title || 'Untitled'} (copy)`.slice(0, 200), content: doc.content })
}

export async function remove(kind: AppId, id: number) {
  await db().prepare('DELETE FROM documents WHERE id = ? AND owner = ? AND kind = ?').bind(id, await requireUserId('fresh'), kind).run()
}

// 128 random bits, URL-safe base64 (22 chars).
const newShareId = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Turn the public read-only link on or off. Returns the share id, or null when off. */
export async function setShare(kind: AppId, { id, on }: { id: number; on: boolean }) {
  const shareId = on ? newShareId() : null
  // Keep an existing link stable when it is already on.
  const row = await db()
    .prepare('UPDATE documents SET share_id = CASE WHEN ? THEN coalesce(share_id, ?) ELSE NULL END WHERE id = ? AND owner = ? AND kind = ? RETURNING share_id')
    .bind(on ? 1 : 0, shareId, id, await requireUserId('fresh'), kind).first<{ share_id: string | null }>()
  if (!row) throw new Error('This file no longer exists')
  return row.share_id
}

/** Public: a shared file by its link id. No session needed. */
export async function getShared(kind: AppId, shareId: string) {
  return db()
    .prepare('SELECT d.title, d.content, d.updated_at, coalesce(u.name, \'\') AS owner_name FROM documents d LEFT JOIN "user" u ON u.id = d.owner WHERE d.share_id = ? AND d.kind = ?')
    .bind(shareId, kind).first<SharedDoc>()
}
