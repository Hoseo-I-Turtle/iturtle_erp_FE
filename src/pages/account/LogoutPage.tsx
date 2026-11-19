import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode } from '../../lib/dataMode'
import { logout } from '../../api/client'
import s from './auth.module.css'

/** 한 번만 낸다 (StrictMode 에서 효과가 두 번 돌아도) */
let started = false

/**
 * /logout 을 화면 주소로 열었을 때 (개발 서버 · 북마크). 백엔드 로그아웃은 POST /logout 이라 여기서 폼을 낸다.
 * 끝나면 백엔드가 /login?logout 으로 보낸다. 운영 nginx 는 /logout 을 백엔드로 넘기므로 보통은 이 화면을 거치지 않는다.
 */
export function LogoutPage() {
  const navigate = useNavigate()
  useEffect(() => {
    if (getDataMode() !== 'live') {
      navigate('/login?logout', { replace: true })
      return
    }
    if (started) return
    started = true
    void logout()
  }, [navigate])

  return (
    <AuthLayout>
      <h1 className={s.title}>로그아웃 중…</h1>
    </AuthLayout>
  )
}
