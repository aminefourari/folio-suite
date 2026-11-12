import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import * as store from '@folio/ui/server.ts'
import { keepUnsynced, localStore, type DocStore } from '@folio/ui/local.ts'
import { useViewer } from '@folio/ui/viewer.tsx'

// Thin wrappers: TanStack's compiler needs createServerFn at the top level of app code.
const KIND = 'stage'

export const listDocs = createServerFn().handler(() => store.list(KIND))

export const getDoc = createServerFn()
  .validator(store.parseId)
  .handler(async ({ data }) => (await store.get(KIND, data)) ?? Promise.reject(notFound()))

export const createDoc = createServerFn({ method: 'POST' })
  .validator(store.parseNew)
  .handler(({ data }) => store.create(KIND, data))

export const saveDoc = createServerFn({ method: 'POST' })
  .validator(store.parseSave)
  .handler(({ data }) => store.save(KIND, data))

export const renameDoc = createServerFn({ method: 'POST' })
  .validator(store.parseRename)
  .handler(({ data }) => store.rename(KIND, data))

export const duplicateDoc = createServerFn({ method: 'POST' })
  .validator(store.parseId)
  .handler(({ data }) => store.duplicate(KIND, data))

export const deleteDoc = createServerFn({ method: 'POST' })
  .validator(store.parseId)
  .handler(({ data }) => store.remove(KIND, data))

export const shareDoc = createServerFn({ method: 'POST' })
  .validator(store.parseShare)
  .handler(({ data }) => store.setShare(KIND, data))

/** Public, no session: a file shared by link. */
export const getShared = createServerFn()
  .validator(store.parseShareId)
  .handler(async ({ data }) => (await store.getShared(KIND, data)) ?? Promise.reject(notFound()))

/** Files in the signed-in account. Edits made offline wait on this device until they reach it. */
export const cloud: DocStore = keepUnsynced(KIND, {
  local: false,
  list: () => listDocs(),
  get: (id) => getDoc({ data: id }),
  create: (d) => createDoc({ data: d }),
  save: (d) => saveDoc({ data: d }),
  rename: (id, title) => renameDoc({ data: { id, title } }),
  duplicate: (id) => duplicateDoc({ data: id }),
  remove: (id) => deleteDoc({ data: id }),
  share: (id, on) => shareDoc({ data: { id, on } }),
})

/** Signed in: the account. Guest: this browser (client only; routes using it set `ssr: false`). */
export const storeFor = (viewer: unknown) => (viewer ? cloud : localStore(KIND))
export const useDocs = () => storeFor(useViewer())
