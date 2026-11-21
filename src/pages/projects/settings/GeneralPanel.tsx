import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Check, KeyRound, Lock, PauseCircle, PlayCircle, Sprout, TriangleAlert, Users } from 'lucide-react'
import { Button, Card } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import {
  KEY_PATTERN,
  changeProjectKey,
  checkProjectKey,
  errText,
  mockCheckKey,
  updateProject,
  useCreateOptions,
  type GeneralPatch,
  type KeyCheck,
  type ProjectSettings,
} from '../../../api/projectSettings'
import type { ProjectStatusLive } from '../../../api/projects'
import s from './panels.module.css'

type Props = { settings: ProjectSettings; onChange: (p: Partial<ProjectSettings>) => void }

/** 프로젝트 관리자가 고를 수 있는 상태 (보관은 보관 · 삭제 메뉴에서) */
const STATUS_OPTIONS: { value: Exclude<ProjectStatusLive, 'ARCHIVED'>; label: string; hint: string; icon: typeof Sprout }[] = [
  { value: 'PREPARING', label: '준비', hint: '아직 시작 전이에요', icon: Sprout },
  { value: 'ACTIVE', label: '진행', hint: '주간 보고에 이 프로젝트 칸이 생겨요', icon: PlayCircle },
  { value: 'ON_HOLD', label: '보류', hint: '잠시 멈췄어요', icon: PauseCircle },
  { value: 'DONE', label: '완료', hint: '끝났어요 (보관은 따로)', icon: CheckCircle2 },
]

/** 설정 › 일반: 이름 · 키 · 설명 · 종류 · 기간 · 공개 범위 · 상태 (P-4, 키는 P-5b) */
export function GeneralPanel({ settings, onChange }: Props) {
  const options = useCreateOptions()
  const [f, setF] = useState(() => pick(settings))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const archived = settings.status === 'ARCHIVED'
  const base = pick(settings)
  const dirty = JSON.stringify(f) !== JSON.stringify(base)
  const periodBad = !!f.startsOn && !!f.endsOn && f.endsOn < f.startsOn
  const readOnly = archived || !settings.canManage
  // 진행 ↔ 다른 상태: 주간 보고 대상(진행 중 프로젝트만 칸이 생김)이 바뀐다
  const reportChanges = f.status !== base.status && (f.status === 'ACTIVE' || base.status === 'ACTIVE')

  const save = () => {
    const patch: GeneralPatch = {}
    if (f.name !== base.name) patch.name = f.name.trim()
    if (f.categoryCode !== base.categoryCode) patch.categoryCode = f.categoryCode
    if (f.description !== base.description) patch.description = f.description.trim() || null
    if (f.visibility !== base.visibility) patch.visibility = f.visibility
    if (f.startsOn !== base.startsOn) patch.startsOn = f.startsOn || null
    if (f.endsOn !== base.endsOn) patch.endsOn = f.endsOn || null
    if (f.status !== base.status) patch.status = f.status
    setSaving(true)
    setMsg(null)
    whenLive(() => updateProject(settings.projectKey, patch))
      .then(() => {
        onChange(f)
        setMsg({ ok: true, text: '저장했어요' })
      })
      .catch((e: unknown) => setMsg({ ok: false, text: errText(e, '저장하지 못했어요.') }))
      .finally(() => setSaving(false))
  }

  return (
    <>
      <Card className={s.card}>
        <header className={s.head}>
          <h2>일반</h2>
          <p>프로젝트 이름 · 설명 · 기간 · 공개 범위 · 상태{archived && ' — 보관된 프로젝트는 고칠 수 없어요 (보관 · 삭제에서 풀기)'}</p>
        </header>

        <label className={s.field}>
          <span className={s.label}>이름</span>
          <span className={s.input}>
            <input value={f.name} maxLength={50} disabled={readOnly} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </span>
        </label>

        <label className={s.field}>
          <span className={s.label}>설명</span>
          <textarea className={s.textarea} rows={4} value={f.description} disabled={readOnly} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>

        <div className={s.grid}>
          <label className={s.field}>
            <span className={s.label}>종류</span>
            <span className={s.input}>
              <select value={f.categoryCode} disabled={readOnly} onChange={(e) => setF({ ...f, categoryCode: e.target.value })}>
                {(options.data?.categories ?? [{ code: f.categoryCode, name: f.categoryCode }]).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className={s.field}>
            <span className={s.label}>기간</span>
            <span className={s.period}>
              <span className={s.input}>
                <input type="date" value={f.startsOn} disabled={readOnly} onChange={(e) => setF({ ...f, startsOn: e.target.value })} aria-label="시작" />
              </span>
              <span className={s.muted}>–</span>
              <span className={s.input}>
                <input type="date" value={f.endsOn} disabled={readOnly} onChange={(e) => setF({ ...f, endsOn: e.target.value })} aria-label="끝" />
              </span>
            </span>
            {periodBad && <span className={`${s.hint} ${s.bad}`}>끝 날이 시작보다 앞이에요</span>}
          </div>
        </div>

        <div className={s.field}>
          <span className={s.label}>공개 범위</span>
          <div className={s.options}>
            <button type="button" disabled={readOnly} className={f.visibility === 'LAB' ? `${s.option} ${s.optionOn}` : s.option} onClick={() => setF({ ...f, visibility: 'LAB' })}>
              <Users size={18} />
              <span>
                <strong>연구실 공개</strong>
                <small>구성원 누구나 보고 읽어요. 쓰기는 참여자만</small>
              </span>
            </button>
            <button type="button" disabled={readOnly} className={f.visibility === 'PRIVATE' ? `${s.option} ${s.optionOn}` : s.option} onClick={() => setF({ ...f, visibility: 'PRIVATE' })}>
              <Lock size={18} />
              <span>
                <strong>참여자만</strong>
                <small>참여자가 아니면 목록에도 안 보여요</small>
              </span>
            </button>
          </div>
        </div>

        {!archived && (
          <div className={s.field}>
            <span className={s.label}>상태</span>
            <div className={s.statusOptions}>
              {STATUS_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  disabled={readOnly}
                  className={f.status === value ? `${s.option} ${s.optionOn}` : s.option}
                  onClick={() => setF({ ...f, status: value })}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
            </div>
            {reportChanges && (
              <p className={s.warn}>
                <TriangleAlert size={14} />
                {f.status === 'ACTIVE'
                  ? '진행으로 바꾸면 참여자의 주간 보고에 이 프로젝트 칸이 생겨요.'
                  : '진행이 아니게 되면 이번 주부터 주간 보고에 이 프로젝트 칸이 생기지 않아요 (이미 쓴 보고는 그대로).'}
              </p>
            )}
            {!settings.canManage && <span className={s.hint}>상태는 프로젝트 관리자가 바꿔요</span>}
          </div>
        )}

        <div className={s.actions}>
          {msg && <span className={msg.ok ? s.okText : s.failText}>{msg.text}</span>}
          {!msg && dirty && <span className={s.muted}>저장하지 않은 변경이 있어요</span>}
          <Button variant="secondary" onClick={() => setF(base)} disabled={!dirty || saving}>
            취소
          </Button>
          <Button icon={Check} onClick={save} disabled={!dirty || saving || periodBad || !f.name.trim() || readOnly}>
            저장
          </Button>
        </div>
      </Card>

      <KeyCard settings={settings} readOnly={readOnly} />
    </>
  )
}

const pick = (p: ProjectSettings) => ({
  name: p.name,
  description: p.description,
  categoryCode: p.categoryCode,
  startsOn: p.startsOn,
  endsOn: p.endsOn,
  visibility: p.visibility,
  status: p.status,
})

/** 키 바꾸기 (P-5b). Vault · Jenkins 를 켠 프로젝트는 서버가 막는다 (P151) — 미리 알려 준다 */
function KeyCard({ settings, readOnly }: { settings: ProjectSettings; readOnly: boolean }) {
  const navigate = useNavigate()
  const [key, setKey] = useState(settings.projectKey)
  const [check, setCheck] = useState<KeyCheck | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = key !== settings.projectKey
  const blocked = settings.servicesOn || settings.projectKey === 'LAB'

  useEffect(() => {
    if (!changed || !KEY_PATTERN.test(key)) return
    const t = window.setTimeout(() => {
      whenLive(() => checkProjectKey(key)).then((r) => setCheck(r ?? mockCheckKey(key))).catch(() => setCheck(null))
    }, 300)
    return () => window.clearTimeout(t)
  }, [key, changed])
  const current: KeyCheck | null = !changed
    ? null
    : !KEY_PATTERN.test(key)
      ? { projectKey: key, available: false, reason: 'INVALID', movedTo: null }
      : check?.projectKey === key
        ? check
        : null

  const submit = () => {
    setSaving(true)
    setError(null)
    whenLive(() => changeProjectKey(settings.projectKey, key))
      .then(() => navigate(`/projects/${key}/settings?tab=general`, { replace: true }))
      .catch((e: unknown) => setError(errText(e, '키를 바꾸지 못했어요.')))
      .finally(() => setSaving(false))
  }

  return (
    <Card className={s.card}>
      <header className={s.head}>
        <h2>
          <KeyRound size={18} /> 프로젝트 키
        </h2>
        <p>작업 번호({settings.projectKey}-12)와 주소에 쓰여요</p>
      </header>
      <div className={s.keyRow}>
        <span className={s.input}>
          <input
            value={key}
            maxLength={10}
            disabled={readOnly || blocked}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            aria-label="새 키"
          />
          {current && (
            <small className={current.available ? s.okText : s.failText}>
              {current.available ? '사용할 수 있어요' : current.reason === 'INVALID' ? '대문자 · 숫자 2~10자' : '이미 쓰고 있거나 예전에 쓴 키예요'}
            </small>
          )}
        </span>
        <Button variant="secondary" onClick={submit} disabled={!current?.available || saving || readOnly || blocked}>
          키 바꾸기
        </Button>
      </div>
      <p className={s.warn}>
        <TriangleAlert size={14} />
        {blocked
          ? 'Vault · Jenkins 서비스 권한을 켠 프로젝트는 키를 바꿀 수 없어요. 서비스 권한을 먼저 끄고 바꿔 주세요.'
          : '키를 바꾸면 작업 번호와 주소가 바뀌어요. 옛 주소로 들어오면 새 키로 안내하고, 옛 키는 다시 쓸 수 없어요.'}
      </p>
      {error && <p className={s.failText}>{error}</p>}
    </Card>
  )
}
