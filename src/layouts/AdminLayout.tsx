import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Eye, GitBranch, Lock, Plus, Settings, Shield, User, Users, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui'
import { useMe } from '../api/members'
import { PageHeader } from './PageHeader'
import { visibleAdminTabs } from './nav'
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

/**
 * 관리 화면 공통: 제목 + 탭. 탭은 내 역할(GET /members/me 의 roles)로 볼 수 있는 것만 (admin.ts 의 canSeeAdminTab).
 * 목업이면 모두 보여 준다. 볼 수 있는 탭이 없으면 홈으로, 볼 수 없는 탭 주소로 오면 볼 수 있는 첫 탭으로 보낸다.
 * 실제 권한 검사는 서버가 한다 (화면은 메뉴만 감춘다).
 */
export function AdminLayout() {
  const { pathname } = useLocation()
  const me = useMe()
  const sub = pathname.split('/')[2]

  // 내 역할을 아직 모르면 탭을 그리지 않는다 (불러오지 못했으면 오류 문구)
  if (me.data === undefined) {
    return (
      <>
        <PageHeader title="관리" subtitle="구성원 · 권한 · 운영 설정" action={null} />
        {me.error && <p className={s.adminNotice}>{me.error}</p>}
      </>
    )
  }

  const visible = visibleAdminTabs(me.data?.roles ?? null)
  const tabs = TABS.filter((t) => visible.includes(t.to))
  if (tabs.length === 0) return <Navigate to="/" replace />
  const tab = tabs.find((t) => t.to === sub)
  if (!tab) return <Navigate to={`/admin/${tabs[0].to}`} replace />

  return (
    <>
      <PageHeader
        title="관리"
        subtitle={sub === 'members' ? '구성원 · 권한 · 운영 설정 (관리 역할이 있는 메뉴만 보여요)' : '구성원 · 권한 · 운영 설정'}
        action={tab.action ? <Button icon={Plus}>{tab.action}</Button> : null}
      />
      <nav className={s.projectTabs} aria-label="관리 메뉴">
        {tabs.map(({ to, label, icon: Icon }) => (
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
