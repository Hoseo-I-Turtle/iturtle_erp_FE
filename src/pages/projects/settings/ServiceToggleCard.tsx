import { Lock, Play, Shield } from 'lucide-react'
import { Card, Switch } from '../../../components/ui'
import type { ServiceAccessView } from '../../../api/projects'
import type { SyncService } from './levels'
import { SyncChip, SyncFail, type SyncState } from './SyncStatus'
import s from '../ProjectSettingsPage.module.css'

type Props = {
  projectKey: string
  view: ServiceAccessView
  vaultOn: boolean
  jenkinsOn: boolean
  onVaultOn: (v: boolean) => void
  onJenkinsOn: (v: boolean) => void
  sync: Record<SyncService, SyncState>
  onRetry: (svc: SyncService) => void
  /** 승인 기다리는 추가 Vault 경로 */
  pending: string[]
  pathDraft: string
  onPathDraft: (v: string) => void
  onRequestPath: () => void
  pathMsg: string | null
}

/** 프로젝트 서비스 권한: Vault · Jenkins 켜기, 프로비저닝 상태, 기존 Vault 경로 묶기 신청 */
export function ServiceToggleCard({
  projectKey,
  view,
  vaultOn,
  jenkinsOn,
  onVaultOn,
  onJenkinsOn,
  sync,
  onRetry,
  pending,
  pathDraft,
  onPathDraft,
  onRequestPath,
  pathMsg,
}: Props) {
  return (
    <Card>
      <h2 className={s.h}>
        <Shield size={20} /> 프로젝트 서비스 권한
      </h2>
      <div className={s.svc}>
        <Switch checked={vaultOn} onChange={onVaultOn} label="Vault 사용" />
        <span className={s.svcIcon}>
          <Lock size={18} />
        </span>
        <div className={s.svcText}>
          <strong>Vault</strong>
          <small>
            경로 {view.vault.paths[0] ?? `secret/projects/${projectKey.toLowerCase()}/`} (프로젝트 키로 고정)
            {view.vault.paths.length > 1 && ` · 묶은 경로 ${view.vault.paths.slice(1).join(', ')}`}
          </small>
          {pending.map((p) => (
            <span key={p} className={s.pending}>
              추가 경로 {p} · sso-admin 승인 대기
            </span>
          ))}
          <SyncFail state={sync.VAULT} fallback="Vault 정책을 만들지 못했어요" onRetry={() => onRetry('VAULT')} />
          <span className={s.pathReq}>
            <input
              value={pathDraft}
              onChange={(e) => onPathDraft(e.target.value)}
              placeholder="기존 경로 묶기 · secret/…/"
              aria-label="묶을 기존 Vault 경로"
            />
            <button type="button" onClick={onRequestPath} disabled={!pathDraft.trim()}>
              신청
            </button>
          </span>
          {pathMsg && <span className={s.fail}>{pathMsg}</span>}
        </div>
        <SyncChip svc="VAULT" state={sync.VAULT} />
      </div>
      <div className={s.svc}>
        <Switch checked={jenkinsOn} onChange={onJenkinsOn} label="Jenkins 사용" />
        <span className={s.svcIcon}>
          <Play size={18} />
        </span>
        <div className={s.svcText}>
          <strong>Jenkins</strong>
          <small>{view.jenkins.jobs.length ? `작업 패턴 ${view.jenkins.jobs.join(', ')}` : '연결한 Jenkins 작업이 없어요'}</small>
          <SyncFail state={sync.JENKINS} fallback="Jenkins 가 응답하지 않았어요" onRetry={() => onRetry('JENKINS')} />
        </div>
        <SyncChip svc="JENKINS" state={sync.JENKINS} />
      </div>
      <p className={s.muted}>
        하루 한 번 Vault · Jenkins 의 실제 설정과 비교해 빠진 것은 다시 만들어요. ERP 가 만든 prj- 이름만 건드려요.
      </p>
    </Card>
  )
}
