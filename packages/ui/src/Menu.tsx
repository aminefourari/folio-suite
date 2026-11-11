import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPopover, type OpenMode } from './popover.ts'

export type MenuItem =
  | { label: string; icon?: ReactNode; onSelect?: () => void; href?: string; danger?: boolean; hint?: string }
  | { separator: true }
  | { header: ReactNode }

const actionable = (i: MenuItem): i is Extract<MenuItem, { label: string }> => 'label' in i

/** Action menu (ARIA menu). ↑↓ Home End move, Enter/Space activate, Esc closes and returns focus. */
export function Menu({ label, trigger: triggerContent, triggerClassName = 'icon-btn', items, align = 'end' }: {
  label: string
  trigger: ReactNode
  triggerClassName?: string
  items: MenuItem[]
  align?: 'start' | 'end'
}) {
  const id = useId()
  const [open, setOpen] = useState<OpenMode>(false)
  const [active, setActive] = useState(-1)
  const actions = items.map((it, i) => (actionable(it) ? i : -1)).filter((i) => i >= 0)
  const close = (refocus = false) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const { trigger, popover, style } = useAnchoredPopover<HTMLDivElement>(open, () => close(), align)

  const show = (how: 'mouse' | 'keys') => {
    setActive(how === 'keys' ? actions[0] ?? -1 : -1)
    setOpen(how)
  }
  const run = (i: number) => {
    const it = items[i]
    if (!actionable(it)) return
    close(open === 'keys')
    if (it.href) location.assign(it.href)
    else it.onSelect?.()
  }

  useEffect(() => {
    if (open && active >= 0) (popover.current?.querySelector(`[data-i="${active}"]`) as HTMLElement | null)?.focus()
  }, [active, open])

  const onKey = (e: React.KeyboardEvent) => {
    const pos = actions.indexOf(active)
    const to: Record<string, number | undefined> = {
      ArrowDown: actions[Math.min(actions.length - 1, pos + 1)], ArrowUp: actions[Math.max(0, pos - 1)],
      Home: actions[0], End: actions.at(-1),
    }
    if (e.key in to) { e.preventDefault(); setActive(to[e.key] ?? -1) }
    else if (e.key === 'Escape') { e.preventDefault(); close(true) }
    else if (e.key === 'Tab') close()
  }

  return (
    <>
      <button ref={trigger} type="button" className={triggerClassName} aria-label={label} title={label}
        aria-haspopup="menu" aria-expanded={!!open} aria-controls={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); open ? close() : show(e.detail === 0 ? 'keys' : 'mouse') }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); show('keys') } }}>
        {triggerContent}
      </button>
      {open && createPortal(
        <div ref={popover} id={id} role="menu" aria-label={label} tabIndex={-1} className="menu" style={style} onKeyDown={onKey}>
          {items.map((it, i) =>
            'separator' in it ? <hr key={i} role="separator" /> :
            'header' in it ? <div key={i} className="menu-header">{it.header}</div> : (
              <button key={i} type="button" role="menuitem" data-i={i} tabIndex={active === i ? 0 : -1}
                className={`menu-item${it.danger ? ' danger' : ''}`}
                onMouseEnter={() => setActive(i)} onClick={() => run(i)}>
                {it.icon}<span>{it.label}</span>{it.hint && <span className="hint">{it.hint}</span>}
              </button>
            ))}
        </div>,
        document.body,
      )}
    </>
  )
}
