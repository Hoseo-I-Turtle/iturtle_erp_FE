import { Link } from 'react-router-dom'
import { Bell, Check, ChevronRight, GitBranch, Lock, Shield } from 'lucide-react'
import { Button, Card, Chip, Switch } from '../../../components/ui'
import type { ProfileData } from '../../../api/admin'
import s from '../ProfilePage.module.css'

/** 내 서비스 권한: 연구실 전체 역할 · 프로젝트별 Vault/Jenkins */
export function ServicePermsCard({ data }: { data: ProfileData }) {
  return (
    <Card>
      <h2 className={s.sideTitle}>
        <Shield size={20} /> 내 서비스 권한
      </h2>
      <div className={s.small}>연구실 전체 · VAULT · JENKINS 읽기 / 쓰기는 프로젝트별</div>
      <div>
        {data.labRoles.length === 0 && <small className={s.hint}>연구실 전체 서비스 역할이 없어요</small>}
        {data.labRoles.map((r) => (
          <Chip key={r} tone="brand">
            {r}
          </Chip>
        ))}
      </div>
      <div className={s.small}>프로젝트별</div>
      {data.projectPerms.length === 0 && <small className={s.hint}>참여 중인 프로젝트가 없어요</small>}
      {data.projectPerms.map((p) => (
        <div key={p.name} className={s.perm}>
          <strong>{p.name}</strong>
          <span>{p.vault}</span>
          <span>{p.jenkins}</span>
        </div>
      ))}
      <Link to="/admin/role-requests" className={s.more}>
        필요한 권한이 없나요? 권한 신청 <ChevronRight size={14} />
      </Link>
    </Card>
  )
}

type GithubProps = {
  github: ProfileData['github']
  githubMsg: { ok: boolean; message: string } | null
  onLink: () => void
  onUnlink: () => void
}

/** GitHub 계정 연결 · 해제 */
export function GithubLinkCard({ github, githubMsg, onLink, onUnlink }: GithubProps) {
  return (
    <Card>
      <h2 className={s.sideTitle}>
        <GitBranch size={20} /> GitHub 연결
      </h2>
      {github ? (
        <div className={s.github}>
          <Check size={18} />
          <span>
            <strong>@{github.login} 연결됨</strong>
            <small>{github.orgLabel}</small>
          </span>
          <Button variant="secondary" onClick={onUnlink}>
            해제
          </Button>
        </div>
      ) : (
        <Button variant="tint" icon={GitBranch} onClick={onLink}>
          GitHub 계정 연결하기
        </Button>
      )}
      {githubMsg && <small className={githubMsg.ok ? s.hint : s.err}>{githubMsg.message}</small>}
      <small className={s.hint}>주간 보고의 GitHub 활동은 이 계정의 커밋으로 모아요.</small>
    </Card>
  )
}

type PrefsProps = { prefs: ProfileData['prefs']; prefError: string; onToggle: (key: string, enabled: boolean) => void }

/** 알림 받기 (필독 · 권한 알림은 끌 수 없음) */
export function NotiPrefsCard({ prefs, prefError, onToggle }: PrefsProps) {
  return (
    <Card>
      <h2 className={s.sideTitle}>
        <Bell size={20} /> 알림 받기
      </h2>
      {prefs.map((p) => (
        <div key={p.key} className={s.pref}>
          <span>{p.label}</span>
          {p.locked ? (
            <span className={s.locked}>
              <Lock size={12} /> 끌 수 없음
            </span>
          ) : (
            <Switch checked={p.enabled} onChange={(v) => onToggle(p.key, v)} label={p.label} />
          )}
        </div>
      ))}
      {prefError && <small className={s.err}>{prefError}</small>}
    </Card>
  )
}
