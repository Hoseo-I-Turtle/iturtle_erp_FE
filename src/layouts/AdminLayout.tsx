import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Eye, GitBranch, Lock, Plus, Settings, Shield, User, Users, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui'
import { PageHeader } from './PageHeader'
import s from './layout.module.css'

const TABS: { to: string; label: string; icon: LucideIcon; action?: string }[] = [
  { to: 'members', label: '구성원', icon: Users, action: '구성원 추가' },
  { to: 'presets', label: '권한 프리셋', icon: Shield, action: '프리셋 만들기' },
  { to: 'signups', label: '가입 신청', icon: User },
  { to: 'role-requests', label: '권한 신청', icon: Lock },
  { to: 'audit', label: '감사 로그', icon: Eye },
  { to: 'codes', label: '공통코드', icon: Settings, action: '코드 그룹 추가' },
  { to: 'github', label: 'GitHub', icon: GitBranch },
]

/** 관리 화면 공통: 제목 + 탭 */
export function AdminLayout() {
  const { pathname } = useLocation()
  const sub = pathname.split('/')[2]
  const tab = TABS.find((t) => t.to === sub) ?? TABS[0]
  return (
    <>
      <PageHeader
        title="관리"
        subtitle={sub === 'members' ? '구성원 · 권한 · 운영 설정 (관리 역할이 있는 메뉴만 보여요)' : '구성원 · 권한 · 운영 설정'}
        action={tab.action ? <Button icon={Plus}>{tab.action}</Button> : null}
      />
      <nav className={s.projectTabs} aria-label="관리 메뉴">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`/admin/${to}`}
            className={({ isActive }) => (isActive ? `${s.projectTab} ${s.projectTabOn}` : s.projectTab)}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
