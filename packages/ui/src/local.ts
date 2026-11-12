// Guest storage: files kept in this browser's localStorage until the visitor creates an account.
// Each app is its own origin, so each app has its own list. Browser only.
import { notFound } from '@tanstack/react-router'
import type { DocRow, DocSummary } from './server.ts'

type NewDoc = { title?: string; content?: string }

/** What an editor or file list needs, whether files live in the account (D1) or in this browser. */
export type DocStore = {
  local: boolean
  list(): Promise<DocSummary[]>
  get(id: number): Promise<DocRow>
  create(d: NewDoc): Promise<number>
  save(d: { id: number; title: string; content: string }): Promise<unknown>
  rename(id: number, title: string): Promise<unknown>
  duplicate(id: number): Promise<number>
  remove(id: number): Promise<unknown>
  share(id: number, on: boolean): Promise<string | null>
}

const MAX_DOCS = 200
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19) // same format as SQLite datetime('now')

export function localStore(kind: string): DocStore {
  const key = `folio:${kind}:docs`
  const read = (): DocRow[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  }
  const write = (docs: DocRow[]) => {
    try { localStorage.setItem(key, JSON.stringify(docs)) } catch {
      throw new Error('This browser is out of storage space. Create a free account to save online.')
    }
  }
  const find = (id: number) => {
    const doc = read().find((d) => d.id === id)
    if (!doc) throw new Error('This file no longer exists')
    return doc
  }
  const update = (id: number, patch: Partial<DocRow>) => {
    const docs = read()
    const i = docs.findIndex((d) => d.id === id)
    if (i < 0) throw new Error('This file no longer exists')
    docs[i] = { ...docs[i], ...patch, updated_at: now() }
    write(docs)
  }
  const create = async ({ title = '', content = '' }: NewDoc) => {
    const docs = read()
    if (docs.length >= MAX_DOCS) throw new Error(`You can keep up to ${MAX_DOCS} files here. Delete some to make room.`)
    const id = Math.max(0, ...docs.map((d) => d.id)) + 1
    write([...docs, { id, title: title.slice(0, 200), content, updated_at: now(), share_id: null }])
    return id
  }
  return {
    local: true,
    list: async () => read()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ content, ...d }) => ({ ...d, preview: content.slice(0, 4000) })),
    get: async (id) => read().find((d) => d.id === id) ?? Promise.reject(notFound()),
    create,
    save: async ({ id, title, content }) => update(id, { title: title.slice(0, 200), content }),
    rename: async (id, title) => update(id, { title: title.trim().slice(0, 200) }),
    duplicate: async (id) => {
      const d = find(id)
      return create({ title: `${d.title || 'Untitled'} (copy)`, content: d.content })
    },
    remove: async (id) => write(read().filter((d) => d.id !== id)),
    share: () => Promise.reject(new Error('Create a free account to share files')),
  }
}

/**
 * Moves this browser's files into the signed-in account, one at a time (each is removed locally only after it
 * saved, so a failure halfway never duplicates). Returns a map from local id to the new account id.
 */
export async function moveToAccount(kind: string, cloud: DocStore) {
  const local = localStore(kind)
  const moved = new Map<number, number>()
  for (const { id } of await local.list()) {
    const doc = await local.get(id)
    moved.set(id, await cloud.create({ title: doc.title, content: doc.content }))
    await local.remove(id)
  }
  return moved
}

type Unsynced = Record<string, { title: string; content: string }>
// Errors a retry can't fix: drop the copy instead of retrying it forever.
const PERMANENT = /too large|no longer exists|invalid/i

/**
 * Wraps the account store so an edit that can't reach the server (offline) is kept on this device and never lost.
 * `save` writes the edit here before sending it and clears it once the server has it. `get` and `list` first resend
 * whatever is still waiting, then `get` shows any edit still unsent instead of the server's older copy.
 */
export function keepUnsynced(kind: string, cloud: DocStore): DocStore {
  const key = `folio:${kind}:unsynced`
  const read = (): Unsynced => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
  }
  const write = (m: Unsynced) => {
    try { localStorage.setItem(key, JSON.stringify(m)) } catch { /* full: the save itself still goes to the server */ }
  }
  const forget = (id: number, sent?: { title: string; content: string }) => {
    const m = read()
    const kept = m[id]
    // Keep a newer edit made while this one was in flight.
    if (kept && (!sent || (kept.title === sent.title && kept.content === sent.content))) { delete m[id]; write(m) }
  }
  const send = async (d: { id: number; title: string; content: string }) => {
    try {
      const r = await cloud.save(d)
      forget(d.id, d)
      return r
    } catch (e) {
      if (PERMANENT.test(e instanceof Error ? e.message : '')) forget(d.id, d)
      else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('You’re offline. Your changes are kept on this device and save when you’re back online.')
      }
      throw e
    }
  }
  const resend = async (only?: number) => {
    for (const [id, d] of Object.entries(read())) {
      if (only === undefined || Number(id) === only) await send({ id: Number(id), ...d }).catch(() => {})
    }
  }
  return {
    ...cloud,
    list: async () => { await resend(); return cloud.list() },
    get: async (id) => {
      await resend(id)
      const doc = await cloud.get(id)
      const kept = read()[id]
      return kept ? { ...doc, ...kept } : doc
    },
    save: async (d) => {
      write({ ...read(), [d.id]: { title: d.title, content: d.content } })
      return send(d)
    },
    rename: async (id, title) => {
      const r = await cloud.rename(id, title)
      const m = read()
      if (m[id]) { m[id].title = title.trim().slice(0, 200); write(m) }
      return r
    },
    remove: async (id) => { const r = await cloud.remove(id); forget(id); return r },
  }
}
