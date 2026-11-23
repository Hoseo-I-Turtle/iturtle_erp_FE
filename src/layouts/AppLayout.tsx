import { Navigate, Outlet } from 'react-router-dom'
import { Info } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { MouseEffects } from '../components/theme/MouseEffects'
import { ThemeDecor } from '../components/theme/ThemeDecor'
import { ThemeObjects } from '../components/theme/ThemeObjects'
import { getDataMode } from '../lib/dataMode'
import s from './layout.module.css'

export function AppLayout() {
  const mode = getDataMode()
  // 목업 / 실서버를 아직 고르지 않았으면 선택 화면으로
  if (!mode) return <Navigate to="/start" replace />

  return (
    <div className={s.app}>
      {/* 테마의 장식 오브젝트(본문 뒤)와 마우스 효과(맨 위). 둘 다 설정에서 끌 수 있다 */}
      <ThemeDecor area="page" />
      <ThemeObjects slot="page" />
      <MouseEffects />
      <Sidebar mode={mode} />
      <main className={s.main}>
        <ThemeObjects slot="header" />
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
