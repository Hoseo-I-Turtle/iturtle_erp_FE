// 프로젝트 설정: 일반 · 라벨 · 보관 · 삭제 (Penpot 06 · 프로젝트 설정 · 일반 / 라벨 / 보관 · 삭제)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Calendar, Check, Info, Lock, Pencil, Plus, TriangleAlert, Users, X } from 'lucide-react'
import { Button, Card, ConfirmDialog, Empty, Field, FormError, FormRow, Loadable, Note, OptionCard, TextArea, TextInput, ToggleChip } from '../../../components/ui'
import { errorText } from '../../../api/content'
import {
  deleteLabel,
  deleteProject,
  saveLabel,
  saveProjectGeneral,
  setProjectArchived,
  useProjectGeneral,
  useProjectLabels,
  type GeneralPatch,
  type ProjectGeneral,
} from '../../../api/projectSettings'
import { getDataMode } from '../../../lib/dataMode'
import { LABEL_COLORS, type ProjectLabel } from '../../../mocks/projectLabels'
import { PROJECT_CATEGORY_NAME, type ProjectCategory } from '../../../mocks/projects'
import s from './settings.module.css'

const isLive = () => getDataMode() === 'live'

/* ================= 일반 ================= */

export function GeneralTab({ projectKey }: { projectKey: string }) {
  const res = useProjectGeneral(projectKey)
  return (
    <Loadable resource={res} label="프로젝트 정보">
      {(g) => <GeneralForm key={JSON.stringify(g)} g={g} />}
    </Loadable>
  )
}

function GeneralForm({ g }: { g: ProjectGeneral }) {
  const initial: GeneralPatch = { name: g.name, categoryCode: g.categoryCode, startsOn: g.startsOn, endsOn: g.endsOn, description: g.description, visibility: g.visibility }
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof GeneralPatch>(k: K, v: GeneralPatch[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setSaved(false)
  }
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  const locked = !g.canManage || g.status === 'ARCHIVED'

  const save = async () => {
    if (!f.name.trim()) return setError('이름을 적어 주세요.')
    if (f.startsOn && f.endsOn && f.endsOn < f.startsOn) return setError('끝 날짜가 시작보다 앞이에요.')
    setBusy(true)
    setError(null)
    try {
      await saveProjectGeneral(g.projectKey, { ...f, name: f.name.trim() }, isLive())
      setSaved(true)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={s.panel}>
      <div className={s.sectionHead}>
        <h2>일반</h2>
        <p>{g.status === 'ARCHIVED' ? '보관된 프로젝트는 고칠 수 없어요. 먼저 보관을 풀어 주세요' : '프로젝트 관리자만 바꿀 수 있어요'}</p>
      </div>
      <FormRow>
        <Field label="이름" required>
          <TextInput value={f.name} disabled={locked} onChange={(v) => set('name', v.slice(0, 50))} trailing={`${f.name.length} / 50`} />
        </Field>
        <Field label="종류">
          <div className={s.pills}>
            {(Object.keys(PROJECT_CATEGORY_NAME) as ProjectCategory[]).map((c) => (
              <ToggleChip key={c} on={f.categoryCode === c} check disabled={locked} onClick={() => set('categoryCode', c)}>
                {PROJECT_CATEGORY_NAME[c]}
              </ToggleChip>
            ))}
          </div>
        </Field>
      </FormRow>
      <FormRow>
        {/* 디자인은 키를 고칠 수 있게 그렸지만 P-4 는 키를 받지 않는다 (만든 뒤 바꿀 수 없음) */}
        <Field label="키" help={`작업 번호(${g.projectKey}-12)와 주소에 쓰여요. 만든 뒤에는 바꿀 수 없어요`}>
          <TextInput value={g.projectKey} onChange={() => {}} disabled />
        </Field>
        <Field label="기간" help="일정표 · 캘린더의 프로젝트 기간으로 보여요">
          <div className={s.period}>
            <TextInput type="date" icon={Calendar} value={f.startsOn} disabled={locked} onChange={(v) => set('startsOn', v)} aria-label="시작" />
            <span>–</span>
            <TextInput type="date" icon={Calendar} value={f.endsOn} min={f.startsOn || undefined} disabled={locked} onChange={(v) => set('endsOn', v)} aria-label="끝" />
          </div>
        </Field>
      </FormRow>
      <Field label="설명">
        <TextArea value={f.description} disabled={locked} onChange={(v) => set('description', v.slice(0, 10000))} rows={3} />
      </Field>
      <Field label="공개 범위">
        <div className={s.options}>
          <OptionCard on={f.visibility === 'LAB'} disabled={locked} icon={Users} title="연구실 공개" desc="연구실 구성원 누구나 보고 읽을 수 있어요. 쓰기는 참여자만" onClick={() => set('visibility', 'LAB')} />
          <OptionCard on={f.visibility === 'PRIVATE'} disabled={locked} icon={Lock} title="참여자만" desc="참여자가 아니면 목록에도 안 보여요" onClick={() => set('visibility', 'PRIVATE')} />
        </div>
      </Field>
      <FormError>{error}</FormError>
      <div className={s.foot}>
        <span>{saved ? '저장했어요' : dirty ? '저장하지 않은 변경이 있어요' : ''}</span>
        <Button variant="secondary" disabled={!dirty || busy} onClick={() => setF(initial)}>
          되돌리기
        </Button>
        <Button icon={Check} disabled={!dirty || busy || locked} onClick={save}>
          {busy ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}

/* ================= 라벨 ================= */

type LabelDraft = { labelId?: number; name: string; color: string; description: string }

export function LabelsTab({ projectKey }: { projectKey: string }) {
  const res = useProjectLabels(projectKey)
  const [draft, setDraft] = useState<LabelDraft>({ name: '', color: LABEL_COLORS[4], description: '' })
  const [editing, setEditing] = useState<LabelDraft | null>(null)
  const [removing, setRemoving] = useState<ProjectLabel | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, after: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const save = (l: LabelDraft, labels: ProjectLabel[], after: () => void) => {
    const name = l.name.trim()
    if (!name) return setError('라벨 이름을 적어 주세요.')
    if (labels.some((x) => x.labelId !== l.labelId && x.name.toLowerCase() === name.toLowerCase())) return setError('같은 이름의 라벨이 이미 있어요.')
    void run(() => saveLabel(projectKey, { ...l, name }, isLive()), after)
  }

  return (
    <Loadable resource={res} label="라벨">
      {({ labels, canManage }) => (
        <Card className={s.panel}>
          <div className={s.sectionHead}>
            <h2>라벨 {labels.length}개</h2>
            <p>작업을 묶어 보고 거를 때 써요. 참여자 누구나 붙일 수 있고, 만들고 고치는 건 프로젝트 관리자만</p>
          </div>
          {canManage && (
            <div className={s.newLabel}>
              <ColorPicker value={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />
              <TextInput
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v.slice(0, 30) })}
                placeholder="새 라벨 이름 (예: 성능)"
                onKeyDown={(e) => e.key === 'Enter' && save(draft, labels, () => setDraft({ ...draft, name: '' }))}
              />
              <Button icon={Plus} disabled={busy} onClick={() => save(draft, labels, () => setDraft({ ...draft, name: '' }))}>
                라벨 만들기
              </Button>
            </div>
          )}
          <FormError>{error}</FormError>
          {labels.length === 0 ? (
            <Empty>아직 라벨이 없어요.</Empty>
          ) : (
            <div className={s.table}>
              <div className={`${s.labelRow} ${s.thead}`}>
                <span>라벨</span>
                <span>설명</span>
                <span>작업</span>
                <span />
              </div>
              {labels.map((l) =>
                editing?.labelId === l.labelId ? (
                  <div key={l.labelId} className={`${s.labelRow} ${s.editing}`}>
                    <span className={s.labelEdit}>
                      <ColorPicker value={editing.color} onChange={(c) => setEditing({ ...editing, color: c })} compact />
                      <TextInput value={editing.name} onChange={(v) => setEditing({ ...editing, name: v.slice(0, 30) })} autoFocus />
                    </span>
                    <TextInput value={editing.description} onChange={(v) => setEditing({ ...editing, description: v })} placeholder="설명 (선택)" />
                    <span>{l.taskCount}개</span>
                    <span className={s.rowActions}>
                      <button type="button" onClick={() => setEditing(null)}>
                        취소
                      </button>
                      <Button icon={Check} disabled={busy} onClick={() => save(editing, labels, () => setEditing(null))}>
                        저장
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div key={l.labelId} className={`${s.labelRow} ${s.item}`}>
                    <span className={s.labelName}>
                      <i style={{ background: l.color }} />
                      <b style={{ background: `${l.color}22`, color: l.color }}>{l.name}</b>
                    </span>
                    <span>{l.description || '—'}</span>
                    <span>{l.taskCount}개</span>
                    <span className={s.rowActions}>
                      {canManage && (
                        <>
                          <button type="button" aria-label={`${l.name} 고치기`} onClick={() => setEditing({ labelId: l.labelId, name: l.name, color: l.color, description: l.description })}>
                            <Pencil size={16} />
                          </button>
                          <button type="button" aria-label={`${l.name} 지우기`} onClick={() => setRemoving(l)}>
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
          <Note icon={Info}>라벨을 지우면 붙어 있던 작업에서도 빠져요. 작업 자체는 그대로예요</Note>
          {removing && (
            <ConfirmDialog
              title={`"${removing.name}" 라벨을 지울까요?`}
              confirmLabel="지우기"
              icon={X}
              danger
              busy={busy}
              onClose={() => setRemoving(null)}
              onConfirm={() => run(() => deleteLabel(projectKey, removing.labelId, isLive()), () => setRemoving(null))}
            >
              <p>작업 {removing.taskCount}개에서 이 라벨이 빠져요. 작업은 지워지지 않아요.</p>
            </ConfirmDialog>
          )}
        </Card>
      )}
    </Loadable>
  )
}

function ColorPicker({ value, onChange, compact }: { value: string; onChange: (c: string) => void; compact?: boolean }) {
  return (
    <span className={compact ? `${s.colors} ${s.colorsCompact}` : s.colors} role="radiogroup" aria-label="색">
      {LABEL_COLORS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value.toLowerCase() === c} aria-label={c} className={value.toLowerCase() === c ? s.colorOn : undefined} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </span>
  )
}

/* ================= 보관 · 삭제 ================= */

export function ArchiveTab({ projectKey }: { projectKey: string }) {
  const res = useProjectGeneral(projectKey)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Loadable resource={res} label="프로젝트 정보">
      {(g) => {
        const archived = g.status === 'ARCHIVED'
        return (
          <Card className={s.panel}>
            <div className={s.sectionHead}>
              <h2>보관 · 삭제</h2>
              <p>보관은 프로젝트 관리자, 삭제는 project-manage 역할이 할 수 있어요</p>
            </div>
            <div className={s.archive}>
              <i>
                <Archive size={20} />
              </i>
              <span>
                <strong>{archived ? '보관된 프로젝트예요' : '프로젝트 보관'}</strong>
                <small>보관하면 읽기만 할 수 있어요. 작업 · 스레드 · 회의록은 그대로 남고, 목록에서는 "보관됨"에서 보여요. 언제든 되돌릴 수 있어요</small>
              </span>
              <Button variant="secondary" icon={Archive} disabled={busy || !g.canManage} onClick={() => run(() => setProjectArchived(g.projectKey, !archived, isLive()))}>
                {archived ? '보관 풀기' : '보관하기'}
              </Button>
            </div>
            <div className={s.dangerBox}>
              <i>
                <TriangleAlert size={20} />
              </i>
              <span>
                <strong>프로젝트 삭제</strong>
                <small>작업 · 스레드 · 회의록 · 자료가 모두 숨겨지고 첨부 파일은 30일 뒤 완전히 지워져요. 프로젝트 키는 다시 쓸 수 없어요</small>
                {/* 명세 확인 필요: 디자인의 "연동 서비스 자원을 어떻게 할지" 선택은 P-5 에 없다. ERP 가 만든 권한 정책만 지운다 */}
                <small>GitHub 저장소 · Jenkins 작업 · Penpot 파일 · Vault 비밀값은 지우지 않고, ERP 가 만든 권한만 거둬요</small>
              </span>
              <Button variant="secondary" disabled={!g.canDelete} className={s.dangerBtn} onClick={() => setConfirming(true)}>
                삭제하기
              </Button>
            </div>
            <FormError>{!confirming && error}</FormError>
            {confirming && (
              <ConfirmDialog
                title={`${g.name}를 삭제할까요?`}
                confirmLabel="삭제"
                icon={X}
                danger
                busy={busy || typed !== g.projectKey}
                onClose={() => {
                  setConfirming(false)
                  setTyped('')
                }}
                onConfirm={() => run(() => deleteProject(g.projectKey, isLive()), () => navigate('/projects'))}
              >
                <p>작업 {g.taskCount}개와 스레드 · 회의록 · 자료가 함께 숨겨져요.</p>
                <Field label={`확인을 위해 프로젝트 키 ${g.projectKey} 를 입력해 주세요`}>
                  <TextInput value={typed} onChange={(v) => setTyped(v.toUpperCase())} trailing={typed === g.projectKey ? '맞아요' : undefined} autoFocus />
                </Field>
                <FormError>{error}</FormError>
              </ConfirmDialog>
            )}
          </Card>
        )
      }}
    </Loadable>
  )
}
