import { Calendar, ClipboardList, Kanban, ListChecks, Megaphone, MessageCircle, Shield, SquareCheck } from 'lucide-react'
import type { NotiType } from '../../mocks/notifications'

const MAP = {
  MENTION: { icon: MessageCircle, color: 'var(--accent)' },
  TASK: { icon: Kanban, color: 'var(--status-warning-text)' },
  NOTICE: { icon: Megaphone, color: 'var(--status-negative)' },
  CALENDAR: { icon: Calendar, color: 'var(--accent)' },
  ACCESS: { icon: Shield, color: 'var(--status-positive-text)' },
  REPORT: { icon: ClipboardList, color: 'var(--accent)' },
  VOTE: { icon: SquareCheck, color: 'var(--accent)' },
  ASSIGN: { icon: ListChecks, color: 'var(--accent)' },
} as const

export function NotificationIcon({ type, size = 18 }: { type: NotiType; size?: number }) {
  const { icon: Icon, color } = MAP[type]
  return <Icon size={size} color={color} />
}
