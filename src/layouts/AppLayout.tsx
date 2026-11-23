import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { Info, Lock, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeDecor } from '../components/theme/ThemeDecor'
import { ThemeObjects } from '../components/theme/ThemeObjects'
import { MouseEffects } from '../components/theme/MouseEffects'
import { getDataMode, MODE_SWITCHABLE } from '../lib/dataMode'
import { fetchSsoAppName } from '../api/members'
import { UploadModalHost } from '../pages/library/upload/UploadModalHost'
import s from './layout.module.css'

const SERVICE_NAME: Record<string, string> = { vault: 'Vault', jenkins: 'Jenkins', penpot: 'Penpot' }

/**
 * SSO 로 서비스에 들어가려 했는데 그 서비스의 접근 역할이 없을 때.
 * 백엔드(SsoAppAccessFilter)가 인가 코드를 주지 않고 /?denied=<client_id> 로 돌려보낸다.
 */
function DeniedBanner({ clientId, live, onClose }: { clientId: string; live: boolean; onClose: () => void }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    if (!live) return
    let alive = true
    fetchSsoAppName(clientId)
      .then((n) => alive && setName(n))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [clientId, live])

  return (
    <div className={s.deniedBanner} role="alert">
      <Lock size={16} />
      <span>
        {name ?? SERVICE_NAME[clientId] ?? clientId} 에 들어갈 권한이 없어요. <Link to="/profile">내 프로필</Link>의 서비스 권한에서 확인 · 신청할 수
        있어요.
      </span>
      <button type="button" aria-label="안내 닫기" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}

export function AppLayout() {
  const mode = getDataMode()
  const [params, setParams] = useSearchParams()
  // 목업 / 실서버를 아직 고르지 않았으면 선택 화면으로 (개발 서버만 — 운영 빌드는 늘 실서버)
  if (!mode) return <Navigate to="/start" replace />

  const denied = params.get('denied')

  return (
    <div className={s.app}>
      <ThemeDecor area="page" />
      <ThemeObjects slot="page" />
      <MouseEffects />
      <Sidebar mode={mode} />
      <main className={s.main}>
        <ThemeObjects slot="header" />
        {denied && (
          <DeniedBanner
            clientId={denied}
            live={mode === 'live'}
            onClose={() => {
              const next = new URLSearchParams(params)
              next.delete('denied')
              setParams(next, { replace: true })
            }}
          />
        )}
        {MODE_SWITCHABLE && mode === 'live' && (
          <div className={s.liveBanner}>
            <Info size={16} />
            실서버 모드예요. API 를 아직 연결하지 않은 화면은 목업 데이터를 보여 줘요.
          </div>
        )}
        <Outlet />
      </main>
      <UploadModalHost />
    </div>
  )
}
