import { Check, Clock, X } from 'lucide-react'
import type { ProvisionStatus } from '../../../api/projects'
import { SYNC_TEXT, type SyncService } from './levels'
import s from '../ProjectSettingsPage.module.css'

/** 서비스마다 프로비저닝 상태 · 오류 문구. 'retrying' 은 다시 시도를 기다리는 중 */
export type SyncState = { status: ProvisionStatus | 'retrying'; error: string | null }

/** 프로비저닝 결과 칩 */
export function SyncChip({ svc, state: x }: { svc: SyncService; state: SyncState }) {
  if (x.status === 'DONE')
    return (
      <span className={`${s.sync} ${s.syncOk}`}>
        <Check size={14} /> {SYNC_TEXT[svc].ok}
      </span>
    )
  if (x.status === 'FAILED' || x.status === 'retrying')
    return (
      <span className={`${s.sync} ${s.syncFail}`}>
        <X size={14} /> {SYNC_TEXT[svc].fail}
      </span>
    )
  return (
    <span className={s.sync}>
      <Clock size={14} /> {SYNC_TEXT[svc].pending}
    </span>
  )
}

/** 실패했을 때만: 사유 · 다시 시도 */
export function SyncFail({ state: x, fallback, onRetry }: { state: SyncState; fallback: string; onRetry: () => void }) {
  if (x.status !== 'FAILED' && x.status !== 'retrying') return null
  return (
    <span className={s.fail}>
      {x.error ?? fallback}{' '}
      <button type="button" onClick={onRetry} disabled={x.status === 'retrying'}>
        {x.status === 'retrying' ? '다시 시도하는 중…' : '다시 시도'}
      </button>
    </span>
  )
}
