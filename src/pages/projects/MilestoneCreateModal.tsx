import { useState } from 'react'
import { Calendar, CalendarRange, Check, ListChecks, Plus, TriangleAlert, X } from 'lucide-react'
import { Button, Chip, Loadable, Modal } from '../../components/ui'
import { ApiError } from '../../api/client'
import { createMilestone, notifyMilestonesChanged, useTaskPicks, type MilestoneForm, type TaskPick } from '../../api/milestones'
import s from './MilestoneCreateModal.module.css'

const NAME_MAX = 50

type Props = { projectKey: string; projectName: string; onClose: () => void }

/** 마일스톤 만들기 창 (디자인: 06 Screens · 추가 › Screen · 마일스톤 만들기) */
export function MilestoneCreateModal({ projectKey, projectName, onClose }: Props) {
  const picks = useTaskPicks(projectKey)
  return (
    <Modal title="새 마일스톤" onClose={onClose} width={720} badge={<Chip tone="tint">{projectName}</Chip>}>
      <Loadable resource={picks} label="작업 목록">
        {(p) => <MilestoneFormView projectKey={projectKey} picks={p} onClose={onClose} />}
      </Loadable>
    </Modal>
  )
}

/** 서버 오류를 붙일 칸 */
const SLOT_OF: Record<string, 'name' | 'period' | 'tasks'> = { P030: 'name', P042: 'period', P100: 'tasks', P170: 'tasks' }

function MilestoneFormView({ projectKey, picks, onClose }: { projectKey: string; picks: TaskPick[]; onClose: () => void }) {
  const [f, setF] = useState<MilestoneForm>({ name: '', description: '', startOn: null, dueOn: null, taskKeys: [] })
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ slot: 'name' | 'period' | 'tasks' | 'form'; message: string } | null>(null)
  const set = <K extends keyof MilestoneForm>(k: K, v: MilestoneForm[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setError(null)
  }

  const nameOk = f.name.trim().length > 0 && f.name.length <= NAME_MAX
  const badPeriod = !!f.startOn && !!f.dueOn && f.dueOn < f.startOn
  const byKey = new Map(picks.map((t) => [t.taskKey, t]))
  const rest = picks.filter((t) => !f.taskKeys.includes(t.taskKey))
  const moving = f.taskKeys.filter((k) => byKey.get(k)?.milestone).length
  const errorAt = (slot: 'name' | 'period' | 'tasks' | 'form') => (error?.slot === slot ? error.message : null)

  const submit = async () => {
    if (!nameOk || !f.dueOn || badPeriod || saving) return
    setSaving(true)
    setError(null)
    try {
      await createMilestone(projectKey, f)
      notifyMilestonesChanged()
      onClose()
    } catch (e) {
      if (e instanceof ApiError) setError({ slot: SLOT_OF[e.code] ?? 'form', message: e.message })
      else setError({ slot: 'form', message: '마일스톤을 만들지 못했어요. 잠시 뒤 다시 해 주세요.' })
    } finally {
      setSaving(false)
    }
  }

  const periodMsg = errorAt('period') ?? (badPeriod ? '기한은 시작일과 같거나 뒤여야 해요' : null)

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className={s.field}>
        <span className={s.label}>
          이름 <b className={s.req}>*</b>
        </span>
        <span className={s.input}>
          <input autoFocus value={f.name} maxLength={NAME_MAX} placeholder="예: v1.3 — 프로젝트 화면" onChange={(e) => set('name', e.target.value)} />
          <small>
            {f.name.length} / {NAME_MAX}
          </small>
        </span>
        {errorAt('name') && <small className={s.hintBad}>{errorAt('name')}</small>}
      </label>

      <label className={s.field}>
        <span className={s.label}>설명</span>
        <textarea className={s.textarea} rows={3} maxLength={2000} value={f.description} placeholder="이 마일스톤에서 끝낼 것" onChange={(e) => set('description', e.target.value)} />
      </label>

      <div className={s.grid}>
        <label className={s.field}>
          <span className={s.label}>시작일</span>
          <span className={s.input}>
            <CalendarRange size={16} />
            <input type="date" value={f.startOn ?? ''} max={f.dueOn ?? undefined} onChange={(e) => set('startOn', e.target.value || null)} />
          </span>
          <small className={periodMsg ? s.hintBad : s.hint}>{periodMsg ?? '비워 두면 이전 마일스톤 기한 다음 날부터로 그려요'}</small>
        </label>
        <label className={s.field}>
          <span className={s.label}>
            기한 <b className={s.req}>*</b>
          </span>
          <span className={s.input}>
            <Calendar size={16} />
            <input type="date" required value={f.dueOn ?? ''} min={f.startOn ?? undefined} onChange={(e) => set('dueOn', e.target.value || null)} />
          </span>
          <small className={s.hint}>일정표 · 캘린더에 ◆ 로 보여요</small>
        </label>
      </div>

      <div className={s.tasks}>
        <div className={s.tasksHead}>
          <ListChecks size={16} />
          <strong>작업 묶기</strong>
          <small className={s.count}>{f.taskKeys.length}개</small>
          <span className={s.grow} />
          <small className={s.hint}>나중에 작업 상세에서도 고를 수 있어요</small>
        </div>
        <div className={s.chips}>
          {f.taskKeys.map((k) => (
            <button key={k} type="button" className={s.taskChip} onClick={() => set('taskKeys', f.taskKeys.filter((x) => x !== k))} aria-label={`${k} 빼기`}>
              <X size={13} />
              <b>{k}</b> {byKey.get(k)?.title}
            </button>
          ))}
          {picking ? (
            <select
              className={s.pick}
              autoFocus
              value=""
              onBlur={() => setPicking(false)}
              onChange={(e) => {
                if (e.target.value) set('taskKeys', [...f.taskKeys, e.target.value])
                setPicking(false)
              }}
            >
              <option value="">작업 고르기</option>
              {rest.map((t) => (
                <option key={t.taskKey} value={t.taskKey}>
                  {t.taskKey} {t.title}
                  {t.milestone ? ` (지금: ${t.milestone})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className={s.addChip} disabled={rest.length === 0} onClick={() => setPicking(true)}>
              <Plus size={13} /> {picks.length === 0 ? '열린 작업이 없어요' : '작업 고르기'}
            </button>
          )}
        </div>
        {(errorAt('tasks') || moving > 0) && (
          <small className={errorAt('tasks') ? s.hintBad : s.hint}>
            {errorAt('tasks') ?? `${moving}개는 다른 마일스톤에서 이 마일스톤으로 옮겨져요`}
          </small>
        )}
      </div>

      {errorAt('form') && (
        <p className={s.error} role="alert">
          <TriangleAlert size={14} /> {errorAt('form')}
        </p>
      )}

      <div className={s.foot}>
        <span className={s.footNote}>진행률은 묶인 작업의 완료 비율이에요</span>
        <span className={s.grow} />
        <Button variant="secondary" type="button" onClick={onClose}>
          취소
        </Button>
        <Button icon={Check} type="submit" disabled={!nameOk || !f.dueOn || badPeriod || saving}>
          {saving ? '만드는 중…' : '마일스톤 만들기'}
        </Button>
      </div>
    </form>
  )
}
