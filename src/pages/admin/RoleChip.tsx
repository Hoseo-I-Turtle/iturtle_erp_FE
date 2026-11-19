import { Check } from 'lucide-react'
import s from './admin.module.css'

/** 역할 코드 칩 — 켜져 있으면 체크 + 진한 배경, 누르면 켜고 끈다 */
export function RoleChip({ code, on, onToggle, title }: { code: string; on: boolean; onToggle?: () => void; title?: string }) {
  return (
    <button
      type="button"
      className={on ? `${s.role} ${s.roleOn}` : s.role}
      onClick={onToggle}
      aria-pressed={on}
      title={title}
      disabled={!onToggle}
    >
      {on && <Check size={14} />}
      {code}
    </button>
  )
}
