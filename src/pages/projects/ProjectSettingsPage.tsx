import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Check, Clock } from 'lucide-react'
import { Button, Loadable, Note } from '../../components/ui'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import {
  AccessSaveError,
  createCustomRole,
  deleteCustomRole,
  requestVaultPath,
  retryProvision,
  saveServiceAccess,
  updateCustomRole,
  useServiceAccess,
  type AccessState,
  type ServiceAccessView,
} from '../../api/projects'
import type { SyncService } from './settings/levels'
import { MemberOverridesCard } from './settings/MemberOverridesCard'
import { RoleDefaultsCard } from './settings/RoleDefaultsCard'
import { ServiceToggleCard } from './settings/ServiceToggleCard'
import { MENU_TAB, menuOfTab, type SettingsMenuItem } from './settings/menu'
import { useProjectSettings, type ProjectSettings } from '../../api/projectSettings'
import { ArchiveDeletePanel } from './settings/ArchiveDeletePanel'
import { GeneralPanel } from './settings/GeneralPanel'
import { LabelsPanel } from './settings/LabelsPanel'
import { LinksPanel } from './settings/LinksPanel'
import { MembersPanel } from './settings/MembersPanel'
import { SettingsMenu } from './settings/SettingsMenu'
import type { SyncState } from './settings/SyncStatus'
import s from './ProjectSettingsPage.module.css'

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

export function ProjectSettingsPage() {
  const { key } = useParams()
  const [params, setParams] = useSearchParams()
  const menu = menuOfTab(params.get('tab'))
  const setMenu = (m: SettingsMenuItem) => setParams({ tab: MENU_TAB[m] }, { replace: true })

  return (
    <div className={s.layout}>
      <SettingsMenu value={menu} onChange={setMenu} />

      <div className={s.content}>
        {menu === '서비스 권한' ? <ServiceAccessSection projectKey={key ?? ''} /> : <SettingsSection key={key} projectKey={key ?? ''} menu={menu} />}
      </div>
    </div>
  )
}

/** 일반 · 참여자 · 라벨 · 보관 · 삭제 (P-3 · P-24 를 한 번 받아 패널끼리 나눠 쓴다) */
function SettingsSection({ projectKey, menu }: { projectKey: string; menu: SettingsMenuItem }) {
  const settings = useProjectSettings(projectKey)
  const patch = (p: Partial<ProjectSettings>) => settings.setData((prev) => ({ ...prev, ...p }))
  return (
    <Loadable resource={settings} label="프로젝트 설정">
      {(v) =>
        menu === '일반' ? (
          <GeneralPanel key={v.projectKey} settings={v} onChange={patch} />
        ) : menu === '참여자' ? (
          <MembersPanel settings={v} onChange={patch} onReload={settings.reload} />
        ) : menu === '라벨' ? (
          <LabelsPanel settings={v} onChange={patch} />
        ) : menu === '연동 서비스' ? (
          <LinksPanel settings={v} />
        ) : (
          <ArchiveDeletePanel settings={v} onChange={patch} />
        )
      }
    </Loadable>
  )
}

function ServiceAccessSection({ projectKey }: { projectKey: string }) {
  const access = useServiceAccess(projectKey)
  return (
    <Loadable resource={access} label="서비스 권한">
      {(v) => <AccessPanel key={JSON.stringify(v.state)} projectKey={projectKey} view={v} onSaved={(nv) => access.setData(() => nv)} />}
    </Loadable>
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
  // 프로젝트 역할 (ERP-27): 바꾸면 바로 저장하고 서버가 준 P-16 으로 화면을 맞춘다
  const [roleBusy, setRoleBusy] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const roleCall = (call: () => Promise<ServiceAccessView>, mock: (v: ServiceAccessView) => ServiceAccessView) => {
    setRoleBusy(true)
    setRoleError(null)
    return whenLive(call)
      .then((nv) => {
        onSaved(nv ?? mock(view))
        return true
      })
      .catch((e: unknown) => {
        setRoleError(errMsg(e, '역할을 저장하지 못했어요.'))
        return false
      })
      .finally(() => setRoleBusy(false))
  }

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
      <RoleDefaultsCard
        roles={st.roles}
        onChange={(r, level) => setSt({ ...st, roles: { ...st.roles, [r]: level } })}
        customRoles={view.customRoles}
        busy={roleBusy}
        error={roleError}
        onCreate={(name, vault, jenkins) =>
          roleCall(
            () => createCustomRole(projectKey, name, vault, jenkins),
            (v) => ({ ...v, customRoles: [...v.customRoles, { roleId: Date.now(), name, vault, jenkins, memberCount: 0 }] }),
          )
        }
        onUpdate={(roleId, patch) =>
          void roleCall(
            () => updateCustomRole(projectKey, roleId, patch),
            (v) => ({ ...v, customRoles: v.customRoles.map((r) => (r.roleId === roleId ? { ...r, ...patch } : r)) }),
          )
        }
        onDelete={(roleId) =>
          void roleCall(
            () => deleteCustomRole(projectKey, roleId),
            (v) => ({
              ...v,
              customRoles: v.customRoles.filter((r) => r.roleId !== roleId),
              members: v.members.map((m) => (m.customRoleId === roleId ? { ...m, customRoleId: null, customRoleName: null } : m)),
            }),
          )
        }
      />
      <MemberOverridesCard
        members={view.members}
        customRoles={view.customRoles}
        state={st}
        onChange={(name, o) => setSt({ ...st, members: { ...st.members, [name]: o } })}
      />

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
