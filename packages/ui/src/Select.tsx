import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPopover, type OpenMode } from './popover.ts'

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
  const [open, setOpen] = useState<OpenMode>(false)
  const [active, setActive] = useState(0)
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
  const { trigger, popover: list, style } = useAnchoredPopover<HTMLUListElement>(open, () => close())
  const pick = (i: number) => {
    close(open === 'keys')
    onChange(options[i].value)
  }

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
          style={style}
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
