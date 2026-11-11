import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import * as store from '@folio/ui/server.ts'

const KIND = 'write'

export const listDocs = createServerFn().handler(() => store.list(KIND))

export const getDoc = createServerFn()
  .validator(store.parseId)
  .handler(async ({ data }) => {
    const doc = await store.get(KIND, data)
    if (!doc) throw notFound()
    return doc
  })

export const createDoc = createServerFn({ method: 'POST' })
  .validator(store.parseNew)
  .handler(({ data }) => store.create(KIND, data))

export const saveDoc = createServerFn({ method: 'POST' })
  .validator(store.parseSave)
  .handler(({ data }) => store.save(KIND, data))

export const deleteDoc = createServerFn({ method: 'POST' })
  .validator(store.parseId)
  .handler(({ data }) => store.remove(KIND, data))
