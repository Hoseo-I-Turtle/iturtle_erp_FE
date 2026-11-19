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
import { ADMIN_TAB_AUTHORITIES, canSeeAdminTab } from '../api/admin'

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

/** 관리 탭 키 (AdminLayout 의 탭 · admin.ts 의 ADMIN_TAB_AUTHORITIES 와 같다) */
export const ADMIN_TABS = Object.keys(ADMIN_TAB_AUTHORITIES)

/** 내 역할로 볼 수 있는 관리 탭. roles 가 null(목업)이면 모두 */
export const visibleAdminTabs = (roles: readonly string[] | null) =>
  roles === null ? ADMIN_TABS : ADMIN_TABS.filter((tab) => canSeeAdminTab(tab, roles))

/**
 * 사이드바 메뉴. 관리 메뉴는 볼 수 있는 관리 탭이 하나라도 있을 때만 (GET /members/me 의 roles 로 판단).
 * roles 가 undefined(아직 불러오는 중)면 관리 메뉴를 감춰 둔다.
 */
export function navFor(roles: readonly string[] | null | undefined): NavSection[] {
  if (roles !== undefined && visibleAdminTabs(roles).length > 0) return NAV
  return NAV.filter((section) => !section.items.some((item) => item.to === '/admin'))
}
