// 만들기 · 고치기 화면이 같이 쓰는 입력 요소 (Penpot "06 Screens · 추가" 의 폼 모양)
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Check, Search, type LucideIcon } from 'lucide-react'
import s from './form.module.css'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Field: 라벨 + 입력 + 도움말 ---------- */
type FieldProps = {
  label: string
  required?: boolean
  /** 라벨 옆 작은 글 */
  hint?: ReactNode
  /** 입력 아래 도움말 · 오류 */
  help?: ReactNode
  error?: string | null
  className?: string
  children: ReactNode
}
export function Field({ label, required, hint, help, error, className, children }: FieldProps) {
  return (
    <div className={cx(s.field, className)}>
      <span className={s.label}>
        {label}
        {required && <em aria-label="필수">*</em>}
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error ? <span className={s.error}>{error}</span> : help ? <span className={s.help}>{help}</span> : null}
    </div>
  )
}

/* ---------- TextInput ---------- */
type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string
  onChange: (v: string) => void
  icon?: LucideIcon
  /** 오른쪽 끝 (글자 수 등) */
  trailing?: ReactNode
  invalid?: boolean
}
export function TextInput({ value, onChange, icon: Icon, trailing, invalid, className, ...rest }: TextInputProps) {
  return (
    <label className={cx(s.input, invalid && s.invalid, className)}>
      {Icon && <Icon size={16} />}
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {trailing && <span className={s.trailing}>{trailing}</span>}
    </label>
  )
}

/* ---------- TextArea ---------- */
type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}
export function TextArea({ value, onChange, invalid, className, rows = 3, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={cx(s.textarea, invalid && s.invalid, className)}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

/* ---------- ToggleChip: 켜고 끄는 알약 (대상 · 옵션 고르기) ---------- */
type ToggleChipProps = {
  on: boolean
  onClick: () => void
  icon?: LucideIcon
  /** 켜졌을 때 체크 표시 */
  check?: boolean
  children: ReactNode
  disabled?: boolean
}
export function ToggleChip({ on, onClick, icon: Icon, check, children, disabled }: ToggleChipProps) {
  return (
    <button type="button" className={cx(s.toggle, on && s.toggleOn)} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {on && check ? <Check size={14} /> : Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  )
}

/* ---------- OptionCard: 큰 선택 카드 (둘 중 하나 고르기) ---------- */
type OptionCardProps = {
  on: boolean
  onClick: () => void
  icon?: LucideIcon
  title: ReactNode
  desc?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}
export function OptionCard({ on, onClick, icon: Icon, title, desc, badge, disabled }: OptionCardProps) {
  return (
    <button type="button" className={cx(s.option, on && s.optionOn)} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {Icon && <Icon size={20} />}
      <span className={s.optionText}>
        <strong>
          {title}
          {badge}
        </strong>
        {desc && <small>{desc}</small>}
      </span>
    </button>
  )
}

/* ---------- FormRow: 입력을 가로로 나란히 ---------- */
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.row, className)}>{children}</div>
}

/* ---------- FormActions: 아래 버튼 줄 (왼쪽 안내 + 오른쪽 버튼) ---------- */
export function FormActions({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.actions}>
      {note && <span className={s.actionsNote}>{note}</span>}
      <span className={s.actionsButtons}>{children}</span>
    </div>
  )
}

/* ---------- InlineError: 저장 실패 안내 ---------- */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className={s.formError} role="alert">
      {children}
    </p>
  )
}

/* ---------- SearchBox: 목록 위 검색창 ---------- */
type SearchBoxProps = { value: string; onChange: (v: string) => void; placeholder: string; width?: number; className?: string }
export function SearchBox({ value, onChange, placeholder, width = 260, className }: SearchBoxProps) {
  return (
    <label className={cx(s.searchBox, className)} style={{ width }}>
      <Search size={16} />
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/* ---------- SmallButton: 줄 안에 들어가는 작은 테두리 버튼 ---------- */
type SmallButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon; tone?: 'default' | 'primary' | 'danger' }
export function SmallButton({ icon: Icon, tone = 'default', className, children, ...rest }: SmallButtonProps) {
  return (
    <button type="button" className={cx(s.small, tone !== 'default' && s[`small-${tone}`], className)} {...rest}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}
