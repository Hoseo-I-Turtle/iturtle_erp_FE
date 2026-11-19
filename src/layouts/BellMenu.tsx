import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { IconButton } from '../components/ui'
import { notificationStore, useNotifications } from '../lib/notificationStore'
import s from './layout.module.css'

/** 헤더 종: 안 읽은 알림 미리보기 (실서버면 1분마다 안 읽은 수를 확인) */
export function BellMenu() {
  const navigate = useNavigate()
  const { items, unreadCount } = useNotifications()
  const unread = items.filter((n) => !n.read)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => notificationStore.start(), [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className={s.bellWrap} ref={ref}>
      <IconButton icon={Bell} label={`알림 ${unreadCount}개`} dot={unreadCount > 0} onClick={() => setOpen(!open)} aria-expanded={open} />
      {open && (
        <div className={s.bellMenu} role="menu">
          <div className={s.bellHead}>
            <strong>알림 {unreadCount}</strong>
            <button type="button" onClick={notificationStore.markAllRead}>
              모두 읽음
            </button>
          </div>
          {unread.length === 0 && <p className={s.bellEmpty}>새 알림이 없어요.</p>}
          {unread.slice(0, 5).map((n) => (
            <button
              key={n.id}
              type="button"
              role="menuitem"
              className={s.bellItem}
              onClick={() => {
                notificationStore.markRead(n.id)
                setOpen(false)
                navigate(n.to)
              }}
            >
              <i />
              <span>{n.short}</span>
              <small>{n.ago}</small>
            </button>
          ))}
          <Link to="/notifications" className={s.bellAll} onClick={() => setOpen(false)}>
            모든 알림 보기
          </Link>
        </div>
      )}
    </div>
  )
}
