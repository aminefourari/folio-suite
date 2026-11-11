import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export type OpenMode = false | 'mouse' | 'keys'

/**
 * Positions a fixed popover under (or above) its trigger, clamped to the viewport, and closes it on outside
 * pointer, Escape (mouse-opened), resize or page scroll. Keyboard-opened popovers get focus.
 */
export function useAnchoredPopover<P extends HTMLElement>(open: OpenMode, close: () => void, align: 'start' | 'end' = 'start') {
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<P>(null)
  const [pos, setPos] = useState<CSSProperties>({})
  const closeRef = useRef(close)
  closeRef.current = close

  useLayoutEffect(() => {
    if (!open || !trigger.current || !popover.current) return
    const r = trigger.current.getBoundingClientRect()
    const h = popover.current.offsetHeight
    const w = Math.max(r.width, popover.current.offsetWidth)
    const below = r.bottom + 6 + h <= innerHeight - 8 || r.top < h + 14
    const left = align === 'end' ? r.right - w : r.left
    setPos({
      left: Math.max(8, Math.min(left, innerWidth - w - 8)),
      top: below ? r.bottom + 6 : r.top - h - 6,
      minWidth: align === 'start' ? r.width : undefined,
      maxHeight: below ? innerHeight - r.bottom - 14 : r.top - 14,
    })
    if (open === 'keys') popover.current.focus()
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!popover.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) closeRef.current()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && open === 'mouse') closeRef.current() }
    const off = (e: Event) => { if (!popover.current?.contains(e.target as Node)) closeRef.current() }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', off)
    window.addEventListener('scroll', off, true)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', off)
      window.removeEventListener('scroll', off, true)
    }
  }, [open])

  // Hidden with opacity (not visibility) while measuring, so keyboard focus still lands.
  const style: CSSProperties = { ...pos, opacity: pos.top === undefined ? 0 : undefined }
  return { trigger, popover, style }
}
