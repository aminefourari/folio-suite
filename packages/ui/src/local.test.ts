import assert from 'node:assert/strict'
import { test } from 'node:test'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
} as Storage
const { keepUnsynced, localStore, moveToAccount } = await import('./local.ts')

test('guest files: create, save, list newest first, duplicate, remove', async () => {
  const s = localStore('t1')
  const a = await s.create({ title: 'A', content: 'one' })
  const b = await s.duplicate(a)
  await s.save({ id: a, title: 'A2', content: 'two' })
  assert.equal((await s.get(a)).content, 'two')
  assert.deepEqual((await s.list()).map((d) => d.title).sort(), ['A (copy)', 'A2'])
  await s.remove(b)
  assert.equal((await s.list()).length, 1)
  await assert.rejects(s.get(b))
})

test('moveToAccount moves every file once and keeps the rest on failure', async () => {
  const s = localStore('t2')
  const ids = [await s.create({ title: 'x' }), await s.create({ title: 'y' }), await s.create({ title: 'z' })]
  let n = 100
  const made: string[] = []
  const flaky = { create: async ({ title }: { title?: string }) => { if (made.length === 2) throw new Error('offline'); made.push(title!); return ++n } }
  await assert.rejects(moveToAccount('t2', flaky as never))
  assert.equal((await s.list()).length, 1) // the unsaved one stays in the browser
  const ok = { create: async ({ title }: { title?: string }) => { made.push(title!); return ++n } }
  const moved = await moveToAccount('t2', ok as never)
  assert.equal(moved.size, 1)
  assert.deepEqual(made.sort(), ['x', 'y', 'z'])
  assert.equal((await s.list()).length, 0)
  assert.ok(ids.every((id) => typeof id === 'number'))
})

test('keepUnsynced keeps offline account edits on the device and sends them once back online', async () => {
  const server = new Map([[1, { id: 1, title: 'Doc', content: 'old', updated_at: '', share_id: null }]])
  let online = false
  const fake = {
    local: false,
    list: async () => [...server.values()].map(({ content, ...d }) => ({ ...d, preview: content })),
    get: async (id: number) => ({ ...server.get(id)! }),
    save: async (d: { id: number; title: string; content: string }) => {
      if (!online) throw new TypeError('Failed to fetch')
      if (!server.has(d.id)) throw new Error('This file no longer exists')
      server.set(d.id, { ...server.get(d.id)!, ...d })
    },
    remove: async (id: number) => void server.delete(id),
  }
  const s = keepUnsynced('t3', fake as never)
  await assert.rejects(s.save({ id: 1, title: 'Doc', content: 'offline edit' }))
  assert.equal((await s.get(1)).content, 'offline edit', 'a reopened file shows the unsent edit, not the server copy')
  assert.equal(server.get(1)!.content, 'old')

  online = true
  await s.list() // the next screen that loads sends it
  assert.equal(server.get(1)!.content, 'offline edit')
  assert.equal(mem.get('folio:t3:unsynced'), '{}')

  online = false
  await assert.rejects(s.save({ id: 1, title: 'Doc', content: 'again' }))
  server.delete(1) // deleted on another device
  online = true
  await s.list()
  assert.equal(mem.get('folio:t3:unsynced'), '{}', 'an edit to a deleted file is dropped, not retried forever')
})
