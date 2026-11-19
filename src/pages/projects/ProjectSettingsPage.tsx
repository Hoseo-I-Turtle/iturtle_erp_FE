import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Clock, List, Lock, Play, Shield, Users, X } from 'lucide-react'
import { Avatar, Button, Card, Loadable, Note, Select, Switch } from '../../components/ui'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import {
  requestVaultPath,
  retryProvision,
  saveServiceAccess,
  useServiceAccess,
  type AccessOverride,
  type AccessState,
  type JenkinsLevel,
  type ProvisionStatus,
  type ServiceAccessView,
  type VaultLevel,
} from '../../api/projects'
import s from './ProjectSettingsPage.module.css'

const MENU = ['일반', '참여자', '라벨', '연동 서비스', '서비스 권한', '보관 · 삭제'] as const
type Menu = (typeof MENU)[number]

const VAULT: Record<VaultLevel, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기' }
const JENKINS: Record<JenkinsLevel, string> = { NONE: '없음', READ: '읽기', BUILD: '빌드' }
const opts = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((v) => ({ value: v, label: m[v] }))

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** 프로비저닝 결과 칩 문구 */
const SYNC_TEXT = {
  VAULT: { ok: '정책 · 그룹 만들어짐', fail: '정책 · 그룹 만들기 실패', pending: '정책 · 그룹 만드는 중' },
  JENKINS: { ok: '항목 역할 만들어짐', fail: '항목 역할 만들기 실패', pending: '항목 역할 만드는 중' },
}

export function ProjectSettingsPage() {
  const { key } = useParams()
  const [menu, setMenu] = useState<Menu>('서비스 권한')
  const access = useServiceAccess(key)

  return (
    <div className={s.layout}>
      <nav className={s.menu}>
        {MENU.map((m) => (
          <button key={m} type="button" className={m === menu ? `${s.menuItem} ${s.menuOn}` : s.menuItem} onClick={() => setMenu(m)}>
            {m}
          </button>
        ))}
      </nav>

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
  const [sync, setSync] = useState<Record<'VAULT' | 'JENKINS', { status: ProvisionStatus | 'retrying'; error: string | null }>>({
    VAULT: { status: view.vault.status, error: view.vault.error },
    JENKINS: { status: view.jenkins.status, error: view.jenkins.error },
  })
  const [pending, setPending] = useState(view.vault.pending)
  const [pathDraft, setPathDraft] = useState('')
  const [pathMsg, setPathMsg] = useState<string | null>(null)
  const dirty = JSON.stringify(st) !== JSON.stringify(saved)

  const retry = (svc: 'VAULT' | 'JENKINS') => {
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
        // 명세 확인 필요: 서비스 설정(P-17) · 구성원(P-18) 을 나눠 저장해서, 앞의 것만 저장되고 실패할 수 있다
        setSaved(before)
        setError(errMsg(e, '저장하지 못했어요. 잠시 뒤 다시 해 주세요.'))
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

  const syncChip = (svc: 'VAULT' | 'JENKINS') => {
    const x = sync[svc]
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
  const syncFail = (svc: 'VAULT' | 'JENKINS', fallback: string) => {
    const x = sync[svc]
    if (x.status !== 'FAILED' && x.status !== 'retrying') return null
    return (
      <span className={s.fail}>
        {x.error ?? fallback}{' '}
        <button type="button" onClick={() => retry(svc)} disabled={x.status === 'retrying'}>
          {x.status === 'retrying' ? '다시 시도하는 중…' : '다시 시도'}
        </button>
      </span>
    )
  }

  return (
    <>
      <Card>
        <h2 className={s.h}>
          <Shield size={20} /> 프로젝트 서비스 권한
        </h2>
        <div className={s.svc}>
          <Switch checked={st.vaultOn} onChange={(v) => setSt({ ...st, vaultOn: v })} label="Vault 사용" />
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
            {syncFail('VAULT', 'Vault 정책을 만들지 못했어요')}
            <span className={s.pathReq}>
              <input
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                placeholder="기존 경로 묶기 · secret/…/"
                aria-label="묶을 기존 Vault 경로"
              />
              <button type="button" onClick={requestPath} disabled={!pathDraft.trim()}>
                신청
              </button>
            </span>
            {pathMsg && <span className={s.fail}>{pathMsg}</span>}
          </div>
          {syncChip('VAULT')}
        </div>
        <div className={s.svc}>
          <Switch checked={st.jenkinsOn} onChange={(v) => setSt({ ...st, jenkinsOn: v })} label="Jenkins 사용" />
          <span className={s.svcIcon}>
            <Play size={18} />
          </span>
          <div className={s.svcText}>
            <strong>Jenkins</strong>
            <small>{view.jenkins.jobs.length ? `작업 패턴 ${view.jenkins.jobs.join(', ')}` : '연결한 Jenkins 작업이 없어요'}</small>
            {syncFail('JENKINS', 'Jenkins 가 응답하지 않았어요')}
          </div>
          {syncChip('JENKINS')}
        </div>
        <p className={s.muted}>
          하루 한 번 Vault · Jenkins 의 실제 설정과 비교해 빠진 것은 다시 만들어요. ERP 가 만든 prj- 이름만 건드려요.
        </p>
      </Card>

      <Card>
        <h2 className={s.h}>
          <Users size={20} /> 역할별 기본 수준
        </h2>
        {(['MANAGER', 'MEMBER'] as const).map((r) => (
          <div key={r} className={s.roleRow}>
            <span className={s.roleName}>{r === 'MANAGER' ? '프로젝트 관리자' : '참여자'}</span>
            <span className={s.svcLabel}>Vault</span>
            <Select
              value={st.roles[r].vault}
              options={opts(VAULT)}
              width={130}
              label="Vault 기본 수준"
              onChange={(v) => setSt({ ...st, roles: { ...st.roles, [r]: { ...st.roles[r], vault: v } } })}
            />
            <span className={s.svcLabel}>Jenkins</span>
            <Select
              value={st.roles[r].jenkins}
              options={opts(JENKINS)}
              width={130}
              label="Jenkins 기본 수준"
              onChange={(v) => setSt({ ...st, roles: { ...st.roles, [r]: { ...st.roles[r], jenkins: v } } })}
            />
          </div>
        ))}
      </Card>

      <Card>
        <h2 className={s.h}>
          <List size={20} /> 구성원별
        </h2>
        <div className={s.table}>
          <div className={s.thead}>
            <span>구성원</span>
            <span>프로젝트 역할</span>
            <span>Vault</span>
            <span>Jenkins</span>
          </div>
          {view.members.map((m) => {
            const o: AccessOverride = st.members[m.name] ?? { vault: 'DEFAULT', jenkins: 'DEFAULT' }
            const def = st.roles[m.role]
            const custom = o.vault !== 'DEFAULT' || o.jenkins !== 'DEFAULT'
            const set = (patch: Partial<AccessOverride>) => setSt({ ...st, members: { ...st.members, [m.name]: { ...o, ...patch } } })
            return (
              <div key={m.memberId ?? m.name} className={custom ? `${s.trow} ${s.custom}` : s.trow}>
                <span className={s.who}>
                  <Avatar name={m.name} size={24} /> {m.name}
                </span>
                <span className={s.muted}>
                  {m.role === 'MANAGER' ? '프로젝트 관리자' : '참여자'}
                  {m.note && ` · ${m.note}`}
                </span>
                <Select
                  value={o.vault}
                  width={130}
                  label={`${m.name} Vault`}
                  options={[{ value: 'DEFAULT', label: `기본값 (${VAULT[def.vault]})` }, ...opts(VAULT).map((x) => ({ ...x, label: `${x.label} (개별)` }))]}
                  onChange={(v) => set({ vault: v })}
                />
                <Select
                  value={o.jenkins}
                  width={130}
                  label={`${m.name} Jenkins`}
                  options={[{ value: 'DEFAULT', label: `기본값 (${JENKINS[def.jenkins]})` }, ...opts(JENKINS).map((x) => ({ ...x, label: `${x.label} (개별)` }))]}
                  onChange={(v) => set({ jenkins: v })}
                />
              </div>
            )
          })}
        </div>
      </Card>

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
