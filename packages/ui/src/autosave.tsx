import { Check, CircleAlert, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

const DELAY = 600
const RETRY = 3000

/**
 * Debounced autosave. Call `touch()` after every edit. `persist` must read the latest state
 * (it is re-captured every render). Also saves on tab hide, on unmount, and via `save()` (Cmd/Ctrl+S).
 * Saves are queued so an older request can never land after a newer one.
 */
export function useAutosave(persist: () => Promise<unknown>) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState('')
  const [rev, setRev] = useState(0)
  const dirty = useRef(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const persistRef = useRef(persist)
  persistRef.current = persist

  const save = useCallback((): Promise<void> => {
    queue.current = queue.current.then(async () => {
      if (!dirty.current) return
      dirty.current = false
      setStatus('saving')
      try {
        await persistRef.current()
        setStatus(dirty.current ? 'dirty' : 'saved')
      } catch (e) {
        dirty.current = true
        const msg = e instanceof Error ? e.message : ''
        setError(msg)
        setStatus('error')
        // Validation errors won't fix themselves; only retry network/server hiccups.
        if (!/too large|no longer exists/i.test(msg)) setTimeout(save, RETRY)
      }
    })
    return queue.current
  }, [])

  const touch = useCallback(() => {
    dirty.current = true
    setStatus('dirty')
    setRev((r) => r + 1)
  }, [])

  useEffect(() => {
    if (!rev) return
    const t = setTimeout(save, DELAY)
    return () => clearTimeout(t)
  }, [rev, save])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && save()
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault() }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', warn)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('keydown', onKey)
      save() // leaving the editor in-app: flush pending edits
    }
  }, [save])

  return { status, error, touch, save }
}

const LABEL: Record<SaveStatus, string> = { saved: 'Saved', dirty: 'Edited', saving: 'Saving…', error: 'Couldn’t save' }

export function SaveBadge({ status, error, local }: { status: SaveStatus; error?: string; local?: boolean }) {
  return (
    <span className={`status ${status}`} role="status"
      title={status === 'error' ? error || 'Retrying…' : local ? 'Saved in this browser only' : undefined}>
      {status === 'saved' && <Check size={14} />}
      {status === 'dirty' && <span className="dot" />}
      {status === 'saving' && <LoaderCircle size={14} className="spin" />}
      {status === 'error' && <CircleAlert size={14} />}
      {status === 'saved' && local ? 'Saved in browser' : LABEL[status]}
    </span>
  )
}
