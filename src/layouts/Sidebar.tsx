import { NavLink, useNavigate } from 'react-router-dom'
import { ThemeDecor } from '../components/theme/ThemeDecor'
import { ThemeObjects } from '../components/theme/ThemeObjects'
import { Database, LogOut, Server, Settings } from 'lucide-react'
import { clearDataMode, MODE_SWITCHABLE, type DataMode } from '../lib/dataMode'
import { Avatar, BrandLogo } from '../components/ui'
import { logout } from '../api/client'
import { useMe } from '../api/members'
import { MEMBER_TYPE_NAME } from '../mocks/members'
import type { MemberStatusCode } from '../api/types'
import { navFor } from './nav'
import s from './layout.module.css'

const STATUS_NAME: Record<MemberStatusCode, string> = { ACTIVE: '재실', ON_LEAVE: '휴학', GRADUATED: '졸업', LEFT: '퇴실' }

/** open · onClose 는 좁은 화면에서만 쓰인다: 사이드바가 옆에서 밀려 나오는 서랍이 된다 */
export function Sidebar({ mode, open, onClose }: { mode: DataMode; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const me = useMe().data

  const signOut = () => {
    if (mode === 'live') void logout()
    else navigate('/login?logout')
  }

  return (
    // 메뉴(링크)를 누르면 서랍을 닫는다
    <aside className={open ? `${s.sidebar} ${s.sidebarOpen}` : s.sidebar} onClick={(e) => (e.target as HTMLElement).closest('a') && onClose()}>
      <ThemeDecor area="sidebar" />
      <ThemeObjects slot="sidebar" />
      <NavLink to="/" className={`${s.logo} ${s.brand}`} aria-label="iturtle 홈">
        <BrandLogo height={48} gap={19} />
      </NavLink>

      <nav className={s.nav}>
        {navFor(me === undefined ? undefined : (me?.roles ?? null)).map((section, i) => (
          <div key={section.title ?? i} className={s.navSection}>
            {section.title && <div className={s.navSectionTitle}>{section.title}</div>}
            {section.items.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => (isActive ? `${s.navItem} ${s.active}` : s.navItem)}
              >
                <Icon size={22} strokeWidth={2} />
                <span>{label}</span>
                {badge ? <span className={s.navBadge}>{badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* 목업 / 실서버 바꾸기는 개발 서버에만 있다 (운영 빌드는 실서버만) */}
      {MODE_SWITCHABLE && (
        <button
          type="button"
          className={s.modeBadge}
          onClick={() => {
            clearDataMode()
            navigate('/start')
          }}
          title="목업 / 실서버 바꾸기"
        >
          {mode === 'mock' ? <Database size={14} /> : <Server size={14} />}
          {mode === 'mock' ? '목업 데이터' : '실서버'}
          <span>바꾸기</span>
        </button>
      )}

      <div className={s.user}>
        <Avatar name={me?.name ?? '…'} src={me?.photoUrl} size={44} colorIndex={0} />
        <div className={s.userText}>
          <div className={s.userName}>{me?.name ?? ''}</div>
          <div className={s.userMeta}>{me ? `${MEMBER_TYPE_NAME[me.memberType]} · ${STATUS_NAME[me.status]}` : ''}</div>
        </div>
        <NavLink to="/settings" aria-label="설정" title="설정" className={s.userSettings}>
          <Settings size={18} strokeWidth={2} />
        </NavLink>
        <button type="button" aria-label="로그아웃" title="로그아웃" className={s.userSettings} onClick={signOut}>
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>
    </aside>
  )
}
