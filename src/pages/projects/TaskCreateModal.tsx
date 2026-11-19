import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, CircleUser, FlaskConical, ListChecks, Plus, SquareCheck, X } from 'lucide-react'
import { Button, Chip, Loadable, Modal, Switch } from '../../components/ui'
import { ApiError } from '../../api/client'
import { createTask, notifyTasksChanged, useTaskFormOptions, type TaskCreateOpen, type TaskDraft, type TaskFormOptions } from '../../api/tasks'
import { PRIORITY_NAME, TYPE_NAME, type TaskPriority, type TaskType } from '../../mocks/tasks'
import s from './TaskCreateModal.module.css'

const TITLE_MAX = 200
const TYPES: TaskType[] = ['TASK', 'BUG', 'RESEARCH']
const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']

type Props = { projectKey: string; open: TaskCreateOpen; onClose: () => void }

/** 작업 만들기 창 (디자인: 06 Screens · 추가 › Screen · 작업 만들기) */
export function TaskCreateModal({ projectKey, open, onClose }: Props) {
  const options = useTaskFormOptions(projectKey)
  return (
    <Modal title="새 작업" onClose={onClose} width={900} badge={options.data && <Chip tone="tint">{options.data.projectName}</Chip>}>
      <Loadable resource={options} label="작업 만들기">
        {(o) => (o ? <TaskForm o={o} open={open} onClose={onClose} /> : null)}
      </Loadable>
    </Modal>
  )
}

const emptyDraft = (o: TaskFormOptions, open: TaskCreateOpen): TaskDraft => ({
  projectKey: o.projectKey,
  title: '',
  description: '',
  typeCode: 'TASK',
  priority: 'NORMAL',
  assigneeMemberId: o.members.some((m) => m.id === o.me.id) ? o.me.id : null,
  dueOn: null,
  milestoneId: null,
  labelIds: [],
  checklist: [],
  initialStatus: open.initialStatus ?? 'TODO',
})

function TaskForm({ o, open, onClose }: { o: TaskFormOptions; open: TaskCreateOpen; onClose: () => void }) {
  const navigate = useNavigate()
  const [d, setD] = useState<TaskDraft>(() => emptyDraft(o, open))
  const [again, setAgain] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [pickLabel, setPickLabel] = useState(false)
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  const titleOk = d.title.trim().length > 0 && d.title.length <= TITLE_MAX
  const noAssigneeInProgress = d.initialStatus === 'IN_PROGRESS' && !d.assigneeMemberId

  const addItem = () => {
    const v = newItem.trim()
    if (!v) return
    set('checklist', [...d.checklist, v])
    setNewItem('')
  }

  const submit = async () => {
    if (!titleOk || noAssigneeInProgress || saving) return
    setSaving(true)
    setError(null)
    try {
      const r = await createTask(d)
      notifyTasksChanged()
      if (again) {
        // 같은 유형 · 마일스톤 · 담당자로 이어서 만든다
        setD((x) => ({ ...x, title: '', description: '', checklist: [], labelIds: x.labelIds }))
        setNotice(`${r.taskKey} 를 만들었어요.${r.warnings.length ? ` ${r.warnings.join(' ')}` : ''}`)
      } else {
        onClose()
        navigate(`/projects/${o.projectKey}/tasks/${r.taskKey}`, { state: r.warnings.length ? { warnings: r.warnings } : undefined })
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '작업을 만들지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const labelById = new Map(o.labels.map((l) => [l.id, l]))
  const restLabels = o.labels.filter((l) => !d.labelIds.includes(l.id))

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className={s.field}>
        <span className={s.label}>제목</span>
        <span className={s.input}>
          <input
            autoFocus
            value={d.title}
            maxLength={TITLE_MAX}
            placeholder="무엇을 할지 한 줄로 적어 주세요"
            onChange={(e) => set('title', e.target.value)}
          />
          <small>
            {d.title.length} / {TITLE_MAX}
          </small>
        </span>
      </label>

      <label className={s.desc}>
        <span className={s.descHead}>
          <span className={s.label}>설명</span>
          <small>Markdown · @이름 · {o.projectKey}-12 링크</small>
        </span>
        <textarea value={d.description} rows={4} placeholder="배경, 할 일, 끝났다고 볼 기준을 적어 주세요" onChange={(e) => set('description', e.target.value)} />
      </label>

      <div className={s.grid}>
        <SelectField label="유형" icon={<SquareCheck size={16} />} value={d.typeCode} onChange={(v) => set('typeCode', v as TaskType)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_NAME[t]}
            </option>
          ))}
        </SelectField>
        <SelectField label="우선순위" value={d.priority} onChange={(v) => set('priority', v as TaskPriority)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_NAME[p]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="담당자"
          icon={<CircleUser size={16} />}
          value={d.assigneeMemberId ? String(d.assigneeMemberId) : ''}
          onChange={(v) => set('assigneeMemberId', v ? Number(v) : null)}
        >
          <option value="">없음</option>
          {o.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === o.me.id ? ' (나)' : ''}
            </option>
          ))}
        </SelectField>

        <label className={s.field}>
          <span className={s.label}>기한</span>
          <span className={s.input}>
            <Calendar size={16} />
            <input type="date" value={d.dueOn ?? ''} onChange={(e) => set('dueOn', e.target.value || null)} />
          </span>
        </label>
        <SelectField
          label="마일스톤"
          icon={<FlaskConical size={16} />}
          value={d.milestoneId ? String(d.milestoneId) : ''}
          onChange={(v) => set('milestoneId', v ? Number(v) : null)}
        >
          <option value="">없음</option>
          {o.milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="처음 상태"
          value={d.initialStatus}
          onChange={(v) => set('initialStatus', v as TaskDraft['initialStatus'])}
          hint="담당자가 없으면 진행 중으로 시작할 수 없어요"
          bad={noAssigneeInProgress}
        >
          <option value="TODO">할 일</option>
          <option value="IN_PROGRESS">진행 중</option>
        </SelectField>
      </div>

      <div className={s.labels}>
        <span className={s.label}>라벨</span>
        {d.labelIds.map((id) => (
          <button key={id} type="button" className={s.labelChip} onClick={() => set('labelIds', d.labelIds.filter((x) => x !== id))} aria-label={`${labelById.get(id)?.name} 빼기`}>
            <X size={13} />
            {labelById.get(id)?.name}
          </button>
        ))}
        {pickLabel && restLabels.length > 0 ? (
          <select
            className={s.labelPick}
            autoFocus
            value=""
            onBlur={() => setPickLabel(false)}
            onChange={(e) => {
              if (e.target.value) set('labelIds', [...d.labelIds, Number(e.target.value)])
              setPickLabel(false)
            }}
          >
            <option value="">라벨 고르기</option>
            {restLabels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : (
          <button type="button" className={s.addChip} disabled={restLabels.length === 0} onClick={() => setPickLabel(true)}>
            <Plus size={13} />
            {o.labels.length === 0 ? '라벨 없음 (설정에서 만들어요)' : '라벨 추가'}
          </button>
        )}
      </div>

      <div className={s.checklist}>
        <div className={s.checkHead}>
          <ListChecks size={16} />
          <strong>체크리스트</strong>
          <small>0 / {d.checklist.length}</small>
        </div>
        {d.checklist.map((c, i) => (
          <div key={`${i}-${c}`} className={s.checkItem}>
            <span className={s.box} />
            <span className={s.checkText}>{c}</span>
            <button type="button" aria-label={`${c} 빼기`} onClick={() => set('checklist', d.checklist.filter((_, j) => j !== i))}>
              <X size={14} />
            </button>
          </div>
        ))}
        <div className={s.checkAdd}>
          <Plus size={14} />
          <input
            value={newItem}
            maxLength={200}
            placeholder="항목 추가 (Enter)"
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
            onBlur={addItem}
          />
        </div>
      </div>

      {(error || notice) && <p className={error ? s.error : s.notice}>{error ?? notice}</p>}

      <div className={s.foot}>
        <Switch checked={again} onChange={setAgain} label="만들고 하나 더" />
        <span className={s.again}>만들고 하나 더</span>
        <span className={s.footNote}>· 요청자는 나({o.me.name})로 기록돼요</span>
        <span className={s.grow} />
        <Button variant="secondary" type="button" onClick={onClose}>
          취소
        </Button>
        <Button icon={Check} type="submit" disabled={!titleOk || noAssigneeInProgress || saving || !o.canWrite}>
          {saving ? '만드는 중…' : '작업 만들기'}
        </Button>
      </div>
      {!o.canWrite && <p className={s.error}>이 프로젝트에 작업을 만들 권한이 없어요.</p>}
    </form>
  )
}

function SelectField({
  label,
  icon,
  value,
  onChange,
  hint,
  bad,
  children,
}: {
  label: string
  icon?: ReactNode
  value: string
  onChange: (v: string) => void
  hint?: string
  bad?: boolean
  children: ReactNode
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <span className={s.input}>
        {icon}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      </span>
      {hint && <small className={bad ? s.hintBad : s.hint}>{hint}</small>}
    </label>
  )
}
