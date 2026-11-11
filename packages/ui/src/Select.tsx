import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type Option<T extends string> = { value: T; label: string; style?: CSSProperties; hint?: ReactNode }

/**
 * Non-native select (ARIA listbox). Mouse use never moves focus, so a contentEditable keeps its selection.
 * Keyboard: Enter/Space/↓ opens, ↑↓ Home End move, type to jump, Enter picks, Esc/Tab closes.
 */
export function Select<T extends string>({ label, value, options, onChange, width, icon, placeholder }: {
  label: string
  value: T | ''
  options: Option<T>[]
  onChange: (v: T) => void
  width?: number
  icon?: ReactNode
  placeholder?: string
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState<false | 'mouse' | 'keys'>(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<CSSProperties>({})
  const typed = useRef({ text: '', at: 0 })
  const current = options.find((o) => o.value === value)

  const show = (how: 'mouse' | 'keys') => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(how)
  }
  const close = (refocus = false) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const pick = (i: number) => {
    close(open === 'keys')
    onChange(options[i].value)
  }

  // Position under the trigger, flipping up and clamping to the viewport.
  useLayoutEffect(() => {
    if (!open || !trigger.current || !list.current) return
    const r = trigger.current.getBoundingClientRect()
    const h = list.current.offsetHeight
    const w = Math.max(r.width, list.current.offsetWidth)
    const below = r.bottom + 6 + h <= innerHeight - 8 || r.top < h + 14
    setPos({
      left: Math.max(8, Math.min(r.left, innerWidth - w - 8)),
      top: below ? r.bottom + 6 : r.top - h - 6,
      minWidth: r.width,
      maxHeight: below ? innerHeight - r.bottom - 14 : r.top - 14,
    })
    if (open === 'keys') list.current.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && open === 'mouse') close() }
    const off = (e: Event) => { if (!list.current?.contains(e.target as Node)) close() }
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

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    const moves: Record<string, number> = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last }
    if (e.key in moves) { e.preventDefault(); setActive(moves[e.key]); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); return }
    if (e.key === 'Escape') { e.preventDefault(); close(true); return }
    if (e.key === 'Tab') { close(); return }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button ref={trigger} type="button" className="select" style={{ width }} aria-label={label}
        aria-haspopup="listbox" aria-expanded={!!open} aria-controls={open ? id : undefined}
        onMouseDown={(e) => { e.preventDefault(); open ? close() : show('mouse') }}
        onKeyDown={(e) => {
          if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show('keys') }
        }}>
        {icon}
        <span className="select-value" style={{ fontFamily: current?.style?.fontFamily }}>{current?.label ?? placeholder ?? label}</span>
        <ChevronDown size={14} className="select-chevron" />
      </button>
      {open && createPortal(
        <ul ref={list} id={id} role="listbox" aria-label={label} tabIndex={-1} className="select-menu"
          style={{ ...pos, opacity: pos.top === undefined ? 0 : undefined }}
          aria-activedescendant={`${id}-${active}`} onKeyDown={onListKey}>
          {options.map((o, i) => (
            <li key={o.value} id={`${id}-${i}`} data-i={i} role="option" aria-selected={o.value === value}
              className={i === active ? 'active' : undefined} style={o.style}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
              <span>{o.label}</span>
              {o.hint && <span className="hint">{o.hint}</span>}
              {o.value === value && <Check size={14} className="tick" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}
