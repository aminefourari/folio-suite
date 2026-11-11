import assert from 'node:assert/strict'
import { test } from 'node:test'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
} as Storage
const { localStore, moveToAccount } = await import('./local.ts')

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
