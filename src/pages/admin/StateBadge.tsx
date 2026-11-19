import type { ReactNode } from 'react'
import a from './admin.module.css'

export type StateTone = 'ok' | 'warn' | 'bad' | 'off' | 'info'

/** 관리 화면의 상태 표시 (재실 · 잠김 · 대기 · 승인 …) */
export function StateBadge({ tone, children }: { tone: StateTone; children: ReactNode }) {
  return <span className={`${a.state} ${a[tone]}`}>{children}</span>
}
