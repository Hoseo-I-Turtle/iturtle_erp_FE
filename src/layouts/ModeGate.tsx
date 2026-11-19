import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getDataMode } from '../lib/dataMode'

/** 목업 / 실서버를 아직 고르지 않았으면 (새로고침 직후 등) 시작 화면으로 보낸다 */
export function ModeGate({ children }: { children: ReactNode }) {
  if (!getDataMode()) return <Navigate to="/start" replace />
  return <>{children}</>
}
