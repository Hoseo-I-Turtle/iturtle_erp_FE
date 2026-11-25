// 테마 색을 따르는 드롭다운 (브라우저 기본 <select> 목록 대신).
// - 누르면(또는 Enter · Space · ↓) 목록이 열린다. ↑↓ · Home · End 로 옮기고 Enter · Space 로 고른다. Esc · Tab 으로 닫힌다.
// - 글자를 치면 그 글자로 시작하는 항목으로 간다 (type-ahead). searchable 이면 맨 위에 찾기 칸이 있다.
// - 목록은 body 에 붙여(portal) 창 · 카드 밖으로 잘리지 않게 하고, 마우스 효과 캔버스(z-index 60)보다 위에 띄운다.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search } from 'lucide-react'
import s from './Dropdown.module.css'

export type DropdownOption<T> = {
  value: T
  label: string
  /** 이름 앞에 놓을 것 (아바타 등) */
  leading?: ReactNode
  /** 이름 옆의 흐린 글자 (역할 · 팀 등) */
  meta?: string
}

type DropdownProps<T> = {
  value: T
  options: DropdownOption<T>[]
  onChange: (v: T) => void
  /** 읽어 주는 이름 */
  label: string
  /** 버튼 안에 그릴 것. 없으면 고른 항목의 이름 */
  trigger?: (selected: DropdownOption<T> | undefined, open: boolean) => ReactNode
  triggerClassName?: string
  triggerStyle?: CSSProperties
  disabled?: boolean
  /** 찾기 칸: true · false, 'auto' 면 항목이 7개보다 많을 때 */
  searchable?: boolean | 'auto'
  /** 목록 최소 너비(px). 없으면 버튼 너비 */
  menuWidth?: number
}

const GAP = 6
const MAX_H = 320

export function Dropdown<T>({ value, options, onChange, label, trigger, triggerClassName, triggerStyle, disabled, searchable = false, menuWidth }: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const withSearch = searchable === 'auto' ? options.length > 7 : searchable
  const selectedIndex = options.findIndex((o) => Object.is(o.value, value))
  const selected = options[selectedIndex]

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.meta ?? '').toLowerCase().includes(q)) : options
  }, [options, query])

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, menuWidth ?? 0)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    // 아래 자리가 모자라고 위가 더 넓으면 위로 연다
    if (below < Math.min(MAX_H, 200) && above > below) setPos({ left, bottom: window.innerHeight - r.top + GAP, width, maxH: Math.min(MAX_H, above) })
    else setPos({ left, top: r.bottom + GAP, width, maxH: Math.min(MAX_H, below) })
  }

  const openMenu = (at?: number) => {
    if (disabled) return
    setQuery('')
    setActive(at ?? Math.max(0, selectedIndex))
    place()
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }
  const pick = (o: DropdownOption<T> | undefined) => {
    if (!o) return
    onChange(o.value)
    close()
  }

  // 열리면 목록(또는 찾기 칸)으로 초점을 옮긴다
  useLayoutEffect(() => {
    if (!open) return
    if (withSearch) search.current?.focus()
    else list.current?.focus()
  }, [open, withSearch])

  // 바깥을 누르거나 스크롤 · 크기가 바뀌면
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) close(false)
    }
    const move = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return
      place()
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('scroll', move, true)
    window.addEventListener('resize', move)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('scroll', move, true)
      window.removeEventListener('resize', move)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 고른 칸이 보이게 스크롤
  useEffect(() => {
    if (!open) return
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const typeAhead = (ch: string) => {
    const now = performance.now()
    const t = typed.current
    t.text = now - t.at > 600 ? ch : t.text + ch
    t.at = now
    const q = t.text.toLowerCase()
    const n = shown.length
    // 같은 글자를 거듭 치면 다음 항목으로
    const start = t.text.length === 1 ? active + 1 : active
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n
      if (shown[i].label.toLowerCase().startsWith(q)) return i
    }
    return -1
  }

  const onListKey = (e: KeyboardEvent) => {
    const n = shown.length
    if (e.key === 'ArrowDown') setActive((a) => Math.min(n - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(n - 1)
    else if (e.key === 'Enter' || (e.key === ' ' && !withSearch)) pick(shown[active])
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') {
      close(false)
      return
    } else if (!withSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = typeAhead(e.key)
      if (i >= 0) setActive(i)
    } else return
    e.preventDefault()
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu()
    } else if (!open && e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 닫힌 채로 글자를 치면 그 항목을 바로 고른다 (기본 select 처럼)
      const i = typeAhead(e.key)
      if (i >= 0 && shown[i]) onChange(shown[i].value)
    }
  }

  const optId = (i: number) => `${id}-o${i}`

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={triggerClassName}
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
      >
        {trigger ? trigger(selected, open) : selected?.label}
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={menu} className={s.menu} style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxH }}>
            {withSearch && (
              <div className={s.search}>
                <Search size={15} aria-hidden />
                <input
                  ref={search}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onListKey}
                  aria-label={`${label} 찾기`}
                  aria-controls={`${id}-list`}
                  aria-activedescendant={shown[active] ? optId(active) : undefined}
                />
              </div>
            )}
            <ul
              ref={list}
              id={`${id}-list`}
              className={s.list}
              role="listbox"
              aria-label={label}
              tabIndex={-1}
              aria-activedescendant={shown[active] ? optId(active) : undefined}
              onKeyDown={onListKey}
            >
              {shown.map((o, i) => {
                const on = Object.is(o.value, value)
                return (
                  <li
                    key={i}
                    id={optId(i)}
                    data-i={i}
                    role="option"
                    aria-selected={on}
                    className={`${s.option} ${i === active ? s.active : ''} ${on ? s.selected : ''}`}
                    onPointerMove={() => i !== active && setActive(i)}
                    onClick={() => pick(o)}
                  >
                    {o.leading}
                    <span className={s.label}>{o.label}</span>
                    {o.meta && <span className={s.meta}>{o.meta}</span>}
                    <Check size={15} className={s.check} aria-hidden />
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
