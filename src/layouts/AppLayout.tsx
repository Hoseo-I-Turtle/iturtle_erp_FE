import { Navigate, Outlet } from 'react-router-dom'
import { Info } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { getDataMode } from '../lib/dataMode'
import s from './layout.module.css'

export function AppLayout() {
  const mode = getDataMode()
  // 목업 / 실서버를 아직 고르지 않았으면 선택 화면으로
  if (!mode) return <Navigate to="/start" replace />

  return (
    <div className={s.app}>
      <Sidebar mode={mode} />
      <main className={s.main}>
        {mode === 'live' && (
          <div className={s.liveBanner}>
            <Info size={16} />
            실서버 모드예요. API 를 아직 연결하지 않은 화면은 목업 데이터를 보여 줘요.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
