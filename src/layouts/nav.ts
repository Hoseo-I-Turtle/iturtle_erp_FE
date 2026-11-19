import {
  Calendar,
  ClipboardList,
  Folder,
  House,
  Kanban,
  Megaphone,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: number }
export type NavSection = { title?: string; items: NavItem[] }

export const NAV: NavSection[] = [
  {
    items: [
      { to: '/', label: '홈', icon: House },
      { to: '/notices', label: '공지사항', icon: Megaphone, badge: 2 },
      { to: '/calendar', label: '캘린더', icon: Calendar },
    ],
  },
  {
    title: '프로젝트',
    items: [
      { to: '/projects', label: '프로젝트', icon: Kanban },
      { to: '/reports', label: '주간 보고', icon: ClipboardList },
    ],
  },
  {
    title: '자료 · 사람',
    items: [
      { to: '/library', label: '자료실', icon: Folder },
      { to: '/members', label: '구성원', icon: Users },
    ],
  },
  {
    title: '관리',
    items: [{ to: '/admin', label: '관리', icon: Shield }],
  },
]
