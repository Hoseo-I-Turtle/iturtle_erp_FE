import { NavLink, useNavigate } from 'react-router-dom'
import { Database, FlaskConical, Server, Settings } from 'lucide-react'
import { clearDataMode, type DataMode } from '../lib/dataMode'
import { Avatar } from '../components/ui'
import { NAV } from './nav'
import s from './layout.module.css'

export function Sidebar({ mode }: { mode: DataMode }) {
  const navigate = useNavigate()
  return (
    <aside className={s.sidebar}>
      <NavLink to="/" className={s.logo}>
        <span className={s.logoMark}>
          <FlaskConical size={24} strokeWidth={2} />
        </span>
        <span className={s.logoText}>Iturtle</span>
      </NavLink>

      <nav className={s.nav}>
        {NAV.map((section, i) => (
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

      <div className={s.user}>
        <Avatar name="김민서" size={44} colorIndex={0} />
        <div className={s.userText}>
          <div className={s.userName}>김민서</div>
          <div className={s.userMeta}>학생 · 재실</div>
        </div>
        <NavLink to="/me" aria-label="내 프로필 설정" className={s.userSettings}>
          <Settings size={18} strokeWidth={2} />
        </NavLink>
      </div>
    </aside>
  )
}
