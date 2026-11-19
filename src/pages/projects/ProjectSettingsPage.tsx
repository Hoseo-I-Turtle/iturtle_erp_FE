import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Clock } from 'lucide-react'
import { Button, Card, Loadable, Note } from '../../components/ui'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import {
  AccessSaveError,
  requestVaultPath,
  retryProvision,
  saveServiceAccess,
  useServiceAccess,
  type AccessState,
  type ServiceAccessView,
} from '../../api/projects'
import type { SyncService } from './settings/levels'
import { MemberOverridesCard } from './settings/MemberOverridesCard'
import { RoleDefaultsCard } from './settings/RoleDefaultsCard'
import { ServiceToggleCard } from './settings/ServiceToggleCard'
import type { SettingsMenuItem } from './settings/menu'
import { SettingsMenu } from './settings/SettingsMenu'
import type { SyncState } from './settings/SyncStatus'
import s from './ProjectSettingsPage.module.css'

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

export function ProjectSettingsPage() {
  const { key } = useParams()
  const [menu, setMenu] = useState<SettingsMenuItem>('서비스 권한')
  const access = useServiceAccess(key)

  return (
    <div className={s.layout}>
      <SettingsMenu value={menu} onChange={setMenu} />

      <div className={s.content}>
        {menu !== '서비스 권한' ? (
          <Card>
            <h2 className={s.h}>{menu}</h2>
            <p className={s.muted}>이 설정 화면은 아직 디자인이 없어 준비 중이에요.</p>
          </Card>
        ) : (
          <Loadable resource={access} label="서비스 권한">
            {(v) => <AccessPanel key={JSON.stringify(v.state)} projectKey={key ?? ''} view={v} onSaved={(nv) => access.setData(() => nv)} />}
          </Loadable>
        )}
      </div>
    </div>
  )
}

function AccessPanel({ projectKey, view, onSaved }: { projectKey: string; view: ServiceAccessView; onSaved: (v: ServiceAccessView) => void }) {
  const [saved, setSaved] = useState<AccessState>(view.state)
  const [st, setSt] = useState<AccessState>(view.state)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 프로비저닝: 서비스마다 상태 · 오류 문구. 'retrying' 은 다시 시도를 기다리는 중
  const [sync, setSync] = useState<Record<SyncService, SyncState>>({
    VAULT: { status: view.vault.status, error: view.vault.error },
    JENKINS: { status: view.jenkins.status, error: view.jenkins.error },
  })
  const [pending, setPending] = useState(view.vault.pending)
  const [pathDraft, setPathDraft] = useState('')
  const [pathMsg, setPathMsg] = useState<string | null>(null)
  const dirty = JSON.stringify(st) !== JSON.stringify(saved)

  const retry = (svc: SyncService) => {
    setSync((x) => ({ ...x, [svc]: { ...x[svc], status: 'retrying' } }))
    whenLive(() => retryProvision(projectKey, svc))
      .then((nv) => {
        if (nv === undefined) {
          // 목업: 잠깐 기다렸다가 성공으로
          window.setTimeout(() => setSync((x) => ({ ...x, [svc]: { status: 'DONE', error: null } })), 1200)
          return
        }
        const r = nv ? (svc === 'VAULT' ? nv.vault : nv.jenkins) : null
        setSync((x) => ({
          ...x,
          [svc]:
            !r || r.status === 'PENDING'
              ? { status: 'FAILED', error: '아직 처리 중이에요. 잠시 뒤 새로 고쳐 보세요.' }
              : { status: r.status, error: r.error },
        }))
      })
      .catch((e: unknown) => setSync((x) => ({ ...x, [svc]: { status: 'FAILED', error: errMsg(e, '다시 시도하지 못했어요.') } })))
  }

  const save = () => {
    const before = saved
    const after = st
    setError(null)
    setSaved(after)
    setSaving(true)
    whenLive(() => saveServiceAccess(projectKey, view, before, after))
      .then((nv) => {
        // 서버가 돌려준 최신 값으로 맞춘다 (화면은 key 로 다시 그려진다)
        if (nv) onSaved(nv)
      })
      .catch((e: unknown) => {
        // 백엔드에 한 번에 저장하는 API 가 없어 서비스 설정(P-17) · 구성원(P-18) 을 나눠 저장한다.
        // 앞의 것만 저장되고 실패하면 저장된 상태를 기준으로 삼아, 남은 바뀐 값은 다시 저장할 수 있게 둔다
        const partial = e instanceof AccessSaveError ? e.saved : null
        setSaved(partial ? partial.state : before)
        const cause = e instanceof AccessSaveError ? e.reason : e
        setError(
          partial
            ? `일부만 저장됐어요. ${errMsg(cause, '나머지를 저장하지 못했어요.')}`
            : errMsg(cause, '저장하지 못했어요. 잠시 뒤 다시 해 주세요.'),
        )
      })
      .finally(() => setSaving(false))
  }

  const requestPath = () => {
    const path = pathDraft.trim()
    if (!path) return
    setPathMsg(null)
    setPending((p) => [...p, path])
    setPathDraft('')
    whenLive(() => requestVaultPath(projectKey, path)).catch((e: unknown) => {
      setPending((p) => p.filter((x) => x !== path))
      setPathDraft(path)
      setPathMsg(errMsg(e, '신청하지 못했어요.'))
    })
  }

  return (
    <>
      <ServiceToggleCard
        projectKey={projectKey}
        view={view}
        vaultOn={st.vaultOn}
        jenkinsOn={st.jenkinsOn}
        onVaultOn={(v) => setSt({ ...st, vaultOn: v })}
        onJenkinsOn={(v) => setSt({ ...st, jenkinsOn: v })}
        sync={sync}
        onRetry={retry}
        pending={pending}
        pathDraft={pathDraft}
        onPathDraft={setPathDraft}
        onRequestPath={requestPath}
        pathMsg={pathMsg}
      />
      <RoleDefaultsCard roles={st.roles} onChange={(r, level) => setSt({ ...st, roles: { ...st.roles, [r]: level } })} />
      <MemberOverridesCard members={view.members} state={st} onChange={(name, o) => setSt({ ...st, members: { ...st.members, [name]: o } })} />

      <Note icon={Clock} tone="warning">
        {view.notice}
      </Note>
      <div className={s.actions}>
        {error && <span className={s.fail}>{error}</span>}
        {!error && dirty && <span className={s.muted}>저장하지 않은 변경이 있어요</span>}
        <Button variant="secondary" onClick={() => setSt(saved)} disabled={!dirty || saving}>
          취소
        </Button>
        <Button icon={Check} onClick={save} disabled={!dirty || saving}>
          저장
        </Button>
      </div>
    </>
  )
}
