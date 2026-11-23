import { Calendar, ClipboardList, Kanban, ListChecks, Megaphone, MessageCircle, Shield, SquareCheck, Wallet } from 'lucide-react'
import type { NotiType } from '../../mocks/notifications'

const MAP = {
  MENTION: { icon: MessageCircle, color: 'var(--brand-500)' },
  TASK: { icon: Kanban, color: 'var(--status-warning-text)' },
  NOTICE: { icon: Megaphone, color: 'var(--status-negative)' },
  CALENDAR: { icon: Calendar, color: 'var(--brand-500)' },
  ACCESS: { icon: Shield, color: '#1e8a52' },
  REPORT: { icon: ClipboardList, color: 'var(--brand-500)' },
  VOTE: { icon: SquareCheck, color: 'var(--brand-500)' },
  ASSIGN: { icon: ListChecks, color: 'var(--brand-500)' },
  LEDGER: { icon: Wallet, color: '#1e8a52' },
} as const

export function NotificationIcon({ type, size = 18 }: { type: NotiType; size?: number }) {
  const { icon: Icon, color } = MAP[type]
  return <Icon size={size} color={color} />
}
