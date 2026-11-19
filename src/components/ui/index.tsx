import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, X, type LucideIcon } from 'lucide-react'
import s from './ui.module.css'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Card ---------- */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx(s.card, className)} {...rest} />
}

/* ---------- SectionHead ---------- */
type SectionHeadProps = {
  icon?: LucideIcon
  title: ReactNode
  /** 제목 바로 뒤 (예: 개수 칩) */
  extra?: ReactNode
  link?: { to: string; label: string }
  onDark?: boolean
}
export function SectionHead({ icon: Icon, title, extra, link, onDark }: SectionHeadProps) {
  return (
    <div className={cx(s.sectionHead, onDark && s.onDark)}>
      {Icon && <Icon size={20} strokeWidth={2} />}
      <h2 className={s.sectionTitle} style={extra ? { flex: 'none' } : undefined}>
        {title}
      </h2>
      {extra}
      {link && (
        <Link to={link.to} className={s.sectionLink} style={{ marginLeft: 'auto' }}>
          {link.label}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  )
}

/* ---------- Chip ---------- */
export type ChipTone = 'brand' | 'tint' | 'danger' | 'warning' | 'count' | 'muted'
type ChipProps = { tone?: ChipTone; icon?: LucideIcon; children: ReactNode; className?: string }
export function Chip({ tone = 'brand', icon: Icon, children, className }: ChipProps) {
  return (
    <span className={cx(s.chip, s[`chip-${tone}`], className)}>
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
    </span>
  )
}

/* ---------- Avatar ---------- */
const AVATAR_COLORS = ['var(--brand-300)', 'var(--brand-400)', 'var(--brand-200)', 'var(--brand-500)']
export function Avatar({ name, size = 26, colorIndex }: { name: string; size?: number; colorIndex?: number }) {
  const idx = colorIndex ?? [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length
  return (
    <span
      className={s.avatar}
      style={{ width: size, height: size, background: AVATAR_COLORS[idx] }}
      title={name}
    >
      {name.slice(0, 1)}
    </span>
  )
}
export function AvatarStack({ names, size = 26 }: { names: string[]; size?: number }) {
  return (
    <span className={s.avatarStack}>
      {names.map((n, i) => (
        <Avatar key={n + i} name={n} size={size} colorIndex={i % AVATAR_COLORS.length} />
      ))}
    </span>
  )
}

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** icon: 테두리 있는 정사각 아이콘 버튼, ghost: 배경 없는 아이콘 버튼 */
  variant?: 'primary' | 'secondary' | 'tint' | 'light' | 'ghost' | 'icon'
  icon?: LucideIcon
}
export function Button({ variant = 'primary', icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx(s.button, s[`button-${variant}`], className)} {...rest}>
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </button>
  )
}

/* ---------- IconButton ---------- */
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  dot?: boolean
}
export function IconButton({ icon: Icon, label, dot, className, ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} className={cx(s.iconButton, className)} {...rest}>
      <Icon size={20} strokeWidth={2} />
      {dot && <span className={s.dot} />}
    </button>
  )
}

/* ---------- Progress ---------- */
type ProgressProps = { value: number; height?: number; color?: string; track?: string }
export function Progress({ value, height = 8, color, track }: ProgressProps) {
  return (
    <div
      className={s.progress}
      style={{ height, background: track }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={s.progressBar} style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

/* ---------- Columns: 본문 + 오른쪽 360px 사이드 ---------- */
export function Columns({ main, side, sideWidth = 360 }: { main: ReactNode; side: ReactNode; sideWidth?: number }) {
  return (
    <div className={s.columns} style={{ '--side-w': `${sideWidth}px` } as CSSProperties}>
      <div className={s.column}>{main}</div>
      <div className={s.column}>{side}</div>
    </div>
  )
}

/* ---------- Breadcrumb ---------- */
export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className={s.crumb} aria-label="위치">
      {items.map((it, i) => (
        <span key={it.label} className={s.crumbItem}>
          {i > 0 && <ChevronRight size={14} />}
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

/* ---------- Checkbox ---------- */
type CheckboxProps = {
  checked: boolean
  onChange?: (checked: boolean) => void
  color?: string
  size?: number
  children?: ReactNode
  className?: string
}
export function Checkbox({ checked, onChange, color = 'var(--brand-400)', size = 18, children, className }: CheckboxProps) {
  return (
    <label className={cx(s.checkbox, className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
      <span
        className={s.checkboxBox}
        style={{
          width: size,
          height: size,
          background: checked ? color : 'var(--surface-card)',
          borderColor: checked ? color : 'var(--brand-400)',
        }}
      >
        {checked && <Check size={size - 6} strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

/* ---------- Segmented ---------- */
type SegmentedProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}
export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={s.segmented} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cx(s.segment, o.value === value && s.segmentOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- PillTabs (진한 선택 탭 + 개수) ---------- */
type PillTabsProps<T extends string> = {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}
export function PillTabs<T extends string>({ value, options, onChange }: PillTabsProps<T>) {
  return (
    <div className={s.pillTabs} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cx(s.pillTab, o.value === value && s.pillTabOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className={s.pillCount}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------- FilterSelect (알약 모양 드롭다운) ---------- */
type FilterSelectProps = {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}
export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className={cx(s.filter, value && s.filterOn)}>
      <span>{value || label}</span>
      <ChevronDown size={14} />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}: 전체</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ---------- ListItem: 연한 배경 행 (앞 · 제목/설명 · 뒤) ---------- */
type ListItemProps = {
  title: ReactNode
  meta?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  to?: string
  onClick?: () => void
  /** plain: 배경 없이 */
  plain?: boolean
  className?: string
}
export function ListItem({ title, meta, leading, trailing, to, onClick, plain, className }: ListItemProps) {
  const body = (
    <>
      {leading}
      <span className={s.liText}>
        <span className={s.liTitle}>{title}</span>
        {meta && <span className={s.liMeta}>{meta}</span>}
      </span>
      {trailing}
    </>
  )
  const cls = cx(s.li, plain && s.liPlain, (to || onClick) && s.liLink, className)
  if (to)
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    )
  return <div className={cls}>{body}</div>
}

/* ---------- Note: 연한 파랑 안내 상자 ---------- */
export function Note({ icon: Icon, children, tone = 'info' }: { icon: LucideIcon; children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div className={cx(s.note, tone === 'warning' && s.noteWarning)}>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  )
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx(s.switch, checked && s.switchOn)}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

/* ---------- Select (테두리 있는 드롭다운) ---------- */
type SelectProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label?: string
  width?: number
}
export function Select<T extends string>({ value, options, onChange, label, width }: SelectProps<T>) {
  return (
    <span className={s.select} style={{ width }}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </span>
  )
}

/* ---------- Modal ---------- */
type ModalProps = {
  title: ReactNode
  badge?: ReactNode
  onClose: () => void
  footer?: ReactNode
  width?: number
  children: ReactNode
}
export function Modal({ title, badge, onClose, footer, width = 1120, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <header className={s.modalHead}>
          <h2>{title}</h2>
          {badge}
          <button type="button" className={s.modalClose} onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </header>
        <div className={s.modalBody}>{children}</div>
        {footer && <footer className={s.modalFoot}>{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------- Empty ---------- */
export function Empty({ children }: { children: ReactNode }) {
  return <p className={s.empty}>{children}</p>
}

/* ---------- KeyValue ---------- */
export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className={s.kv}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Loadable } from './Loadable'
