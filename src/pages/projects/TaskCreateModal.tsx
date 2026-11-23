import { useState } from 'react'
import { Check, ListChecks, Plus, X } from 'lucide-react'
import { Button, Chip, Field, FormError, FormRow, Modal, Select, Switch, TextInput } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { errorText } from '../../api/content'
import { addMockTask, createTask, useTaskList, type TaskDraft } from '../../api/tasks'
import { getDataMode } from '../../lib/dataMode'
import { PRIORITY_NAME, TYPE_NAME, type TaskPriority, type TaskType } from '../../mocks/tasks'
import s from './TaskCreateModal.module.css'

const blank = (meId: number | null): TaskDraft => ({
  title: '',
  description: '',
  type: 'TASK',
  priority: 'NORMAL',
  assigneeId: meId,
  dueOn: '',
  milestoneId: null,
  labelIds: [],
  status: 'TODO',
  checklist: [],
})

const opts = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((v) => ({ value: v, label: m[v] }))

type Props = {
  projectKey: string
  onClose: () => void
  /** 만든 작업 번호 */
  onCreated: (taskKey: string) => void
}

/** 새 작업 (Penpot 06 · 작업 만들기) — T-2 */
export function TaskCreateModal({ projectKey, onClose, onCreated }: Props) {
  const meta = useTaskList(projectKey)
  const data = meta.data
  const [f, setF] = useState<TaskDraft>(() => blank(null))
  const [touchedAssignee, setTouchedAssignee] = useState(false)
  const [item, setItem] = useState('')
  const [again, setAgain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<string | null>(null)
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  // 담당자는 처음에 나로 채운다 (참여자 목록을 받은 뒤)
  const assigneeId = touchedAssignee ? f.assigneeId : (data?.members.find((m) => m.id === data.meId)?.id ?? null)
  // 담당자가 없으면 진행 중으로 시작할 수 없다 (P103)
  const status = assigneeId === null ? 'TODO' : f.status

  const addItem = () => {
    const v = item.trim()
    if (!v) return
    set('checklist', [...f.checklist, v.slice(0, 200)])
    setItem('')
  }

  const submit = async () => {
    if (!data) return
    if (!f.title.trim()) return setError('제목을 적어 주세요.')
    const draft: TaskDraft = { ...f, title: f.title.trim(), assigneeId, status }
    setBusy(true)
    setError(null)
    try {
      const taskKey = getDataMode() === 'live' ? await createTask(data.projectKey, draft) : addMockTask(data, draft)
      if (again) {
        // 하나 더: 유형 · 담당자 · 마일스톤 · 라벨은 그대로 두고 내용만 비운다
        setF((p) => ({ ...p, title: '', description: '', checklist: [], dueOn: '' }))
        setMade(taskKey)
        setBusy(false)
      } else onCreated(taskKey)
    } catch (e) {
      setError(errorText(e, '작업을 만들지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="새 작업"
      badge={data && <Chip tone="tint">{data.projectName}</Chip>}
      width={900}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <Switch checked={again} onChange={setAgain} label="만들고 하나 더" />
          <span className={s.footText}>
            <strong>만들고 하나 더</strong>
            {made ? ` · ${made} 을 만들었어요` : data ? ` · 요청자는 나(${data.me})로 기록돼요` : ''}
          </span>
          <Button variant="secondary" onClick={onClose}>
            {made ? '닫기' : '취소'}
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy || !data}>
            {busy ? '만드는 중…' : '작업 만들기'}
          </Button>
        </div>
      }
    >
      <Field label="제목">
        <TextInput
          value={f.title}
          onChange={(v) => set('title', v.slice(0, 200))}
          placeholder="무엇을 해야 하나요?"
          trailing={`${f.title.length} / 200`}
          autoFocus
        />
      </Field>

      <Field label="설명" hint="Markdown · @이름 · DEFME-12 링크">
        <MarkdownEditor value={f.description} onChange={(v) => set('description', v)} projectKey={projectKey} placeholder="자세한 내용 (선택)" minHeight={130} />
      </Field>

      <FormRow>
        <Field label="유형">
          <Select block value={f.type} options={opts<TaskType>(TYPE_NAME)} onChange={(v) => set('type', v)} label="유형" />
        </Field>
        <Field label="우선순위">
          <Select block value={f.priority} options={opts<TaskPriority>(PRIORITY_NAME)} onChange={(v) => set('priority', v)} label="우선순위" />
        </Field>
        <Field label="담당자">
          <Select
            block
            value={assigneeId === null ? '' : String(assigneeId)}
            options={[{ value: '', label: '없음' }, ...(data?.members ?? []).map((m) => ({ value: String(m.id), label: m.name }))]}
            onChange={(v) => {
              setTouchedAssignee(true)
              set('assigneeId', v ? Number(v) : null)
            }}
            label="담당자"
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="기한">
          <TextInput type="date" value={f.dueOn} onChange={(v) => set('dueOn', v)} aria-label="기한" />
        </Field>
        <Field label="마일스톤">
          <Select
            block
            value={f.milestoneId === null ? '' : String(f.milestoneId)}
            options={[
              { value: '', label: '없음' },
              ...(data?.milestones ?? []).filter((m) => !m.closed).map((m) => ({ value: String(m.id), label: m.name })),
            ]}
            onChange={(v) => set('milestoneId', v ? Number(v) : null)}
            label="마일스톤"
          />
        </Field>
        <Field label="처음 상태" help={assigneeId === null ? '담당자가 없으면 진행 중으로 시작할 수 없어요' : undefined}>
          <Select
            block
            value={status}
            options={[
              { value: 'TODO', label: '할 일' },
              ...(assigneeId === null ? [] : [{ value: 'IN_PROGRESS' as const, label: '진행 중' }]),
            ]}
            onChange={(v) => set('status', v)}
            label="처음 상태"
          />
        </Field>
      </FormRow>

      <div className={s.labels}>
        <span>라벨</span>
        {(data?.labels ?? []).map((l) => {
          const on = f.labelIds.includes(l.id)
          return (
            <button
              key={l.id}
              type="button"
              className={on ? `${s.label} ${s.labelOn}` : s.label}
              aria-pressed={on}
              onClick={() => set('labelIds', on ? f.labelIds.filter((x) => x !== l.id) : [...f.labelIds, l.id])}
            >
              {on ? <X size={14} /> : <i style={{ background: l.color }} />}
              {l.name}
            </button>
          )
        })}
        {data && data.labels.length === 0 && <em>이 프로젝트에는 아직 라벨이 없어요</em>}
      </div>

      <section className={s.checklist}>
        <div className={s.checkHead}>
          <ListChecks size={18} />
          <strong>체크리스트</strong>
          <span>0 / {f.checklist.length}</span>
        </div>
        {f.checklist.map((c, i) => (
          <div key={i} className={s.item}>
            <i />
            <span>{c}</span>
            <button type="button" aria-label={`${c} 빼기`} onClick={() => set('checklist', f.checklist.filter((_, j) => j !== i))}>
              <X size={14} />
            </button>
          </div>
        ))}
        <div className={s.addItem}>
          <input
            value={item}
            placeholder="항목을 적고 Enter"
            maxLength={200}
            onChange={(e) => setItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
          />
          <button type="button" onClick={addItem} disabled={!item.trim()}>
            <Plus size={14} />
            항목 추가
          </button>
        </div>
      </section>

      <FormError>{error ?? meta.error}</FormError>
    </Modal>
  )
}
