import { useRef, useState, type KeyboardEvent } from 'react'
import { usePeople, type Person } from '../../api/people'
import s from './MentionMenu.module.css'

type Field = HTMLTextAreaElement | HTMLInputElement
type Query = { start: number; text: string }

/** 커서 앞의 "@검색어" (이름 · 아이디, 앞이 글자면 이메일로 본다) */
const AT_QUERY = /(^|[^A-Za-z0-9._@-])@([A-Za-z0-9가-힣._-]{0,30})$/

/**
 * 쓰는 칸의 사람 언급 자동완성 (ERP-34). @ 를 치면 이름 · 아이디로 찾아 고르고, 고르면 @아이디를 넣는다.
 * 칸에 ref · onChange(detect) · onClick(detect) · onKeyDown 을 걸고, 칸을 감싼 position: relative 상자 안에 popup 을 둔다.
 */
export function useAtMention<T extends Field>(value: string, onChange: (v: string) => void, placement: 'below' | 'above' | 'inside' = 'below') {
  const ref = useRef<T>(null)
  const people = usePeople()
  const [query, setQuery] = useState<Query | null>(null)
  const [active, setActive] = useState(0)

  const detect = () => {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart ?? el.value.length
    const m = AT_QUERY.exec(el.value.slice(0, pos))
    const next = m ? { start: pos - m[2].length - 1, text: m[2] } : null
    if (next?.text !== query?.text || next?.start !== query?.start) setActive(0)
    setQuery(next)
  }

  const q = query?.text.toLowerCase() ?? ''
  const matches = query ? people.filter((p) => !q || p.loginId.startsWith(q) || p.name.includes(query.text)).slice(0, 6) : []

  const pick = (p: Person) => {
    const el = ref.current
    if (!el || !query) return
    const end = el.selectionStart ?? value.length
    const inserted = `@${p.loginId} `
    onChange(value.slice(0, query.start) + inserted + value.slice(end))
    setQuery(null)
    const caret = query.start + inserted.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  /** 목록이 열려 있을 때 ↑↓ · Enter · Tab · Esc 를 가져간다. 가져갔으면 true (칸의 Enter 보내기를 막는다) */
  const onKeyDown = (e: KeyboardEvent<T>) => {
    if (matches.length === 0 || e.nativeEvent.isComposing) return false
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(matches[Math.min(active, matches.length - 1)])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setQuery(null)
      return true
    }
    return false
  }

  const popup =
    matches.length > 0 ? (
      <ul className={`${s.menu} ${s[placement]}`} role="listbox" aria-label="언급할 사람">
        {matches.map((p, i) => (
          <li key={p.loginId}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              className={i === active ? `${s.item} ${s.active}` : s.item}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p)
              }}
            >
              <strong>{p.name}</strong>
              <small>@{p.loginId}</small>
            </button>
          </li>
        ))}
      </ul>
    ) : null

  return { ref, detect, onKeyDown, popup, close: () => setQuery(null) }
}
