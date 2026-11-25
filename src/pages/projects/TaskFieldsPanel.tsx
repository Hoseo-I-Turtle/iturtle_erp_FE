import { ChevronDown, Clock, SquareCheck } from 'lucide-react'
import { Avatar, Chip, Dropdown, type DropdownOption } from '../../components/ui'
import { PRIORITY_NAME, STATUS_NAME, TYPE_NAME, type TaskPriority, type TaskStatus } from '../../mocks/tasks'
import type { BoardTask, TaskFields } from '../../api/projects'
import type { TaskFormOptions } from '../../api/tasks'
import s from './TaskDetailPage.module.css'

type Props = {
  task: BoardTask
  status: TaskStatus
  cancelled: boolean
  fields: TaskFields
  /** 고칠 수 있으면 후보 (없으면 읽기만) */
  options: TaskFormOptions | null
  onChange: (next: Partial<TaskFields>) => void
}

const PRIORITIES = Object.keys(PRIORITY_NAME) as TaskPriority[]
const md = (iso: string) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

/** 작업 상세 오른쪽 속성 칸. 고칠 수 있으면 바로 고친다 (ERP-12, T-4) */
export function TaskFieldsPanel({ task, status, cancelled, fields, options, onChange }: Props) {
  const o = options
  const nameOf = (id: number | null) => (id === null ? null : (o?.members.find((m) => m.id === id)?.name ?? task.assignee))
  const milestoneName = o?.milestones.find((m) => m.id === fields.milestoneId)?.name ?? task.milestone
  const labelNames = o ? o.labels.filter((l) => fields.labelIds.includes(l.id)).map((l) => l.name) : task.labels
  const badPeriod = !!fields.startOn && !!fields.dueOn && fields.dueOn < fields.startOn

  return (
    <dl className={s.props}>
      <dt>상태</dt>
      <dd>
        {cancelled ? <span className={s.statusChip}>취소</span> : <span className={`${s.statusChip} ${s[`st${status}`]}`}>{STATUS_NAME[status] ?? status}</span>}
      </dd>

      <dt>담당자</dt>
      <dd>
        {o ? (
          <select className={s.propSelect} value={fields.assigneeId ?? ''} onChange={(e) => onChange({ assigneeId: e.target.value ? Number(e.target.value) : null })} aria-label="담당자">
            <option value="">없음</option>
            {o.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.tags.length > 0 ? ` · ${m.tags.join(', ')}` : ''}
              </option>
            ))}
          </select>
        ) : nameOf(fields.assigneeId) ? (
          <Person name={nameOf(fields.assigneeId)!} />
        ) : (
          '없음'
        )}
      </dd>

      <dt>요청자</dt>
      <dd>
        <Person name={task.requester} />
      </dd>

      <dt>우선순위</dt>
      <dd>
        {o ? (
          <PropSelect label="우선순위" value={fields.priority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_NAME[p] }))} onChange={(priority) => onChange({ priority })} />
        ) : (
          <Chip tone={fields.priority === 'URGENT' ? 'danger' : fields.priority === 'HIGH' ? 'warning' : 'tint'}>{PRIORITY_NAME[fields.priority]}</Chip>
        )}
      </dd>

      <dt>유형</dt>
      <dd>
        <Chip tone="brand" icon={SquareCheck}>
          {task.typeName ?? TYPE_NAME[task.type]}
        </Chip>
      </dd>

      <dt>시작일</dt>
      <dd>
        {o ? (
          <input className={s.propSelect} type="date" value={fields.startOn} max={fields.dueOn || undefined} onChange={(e) => onChange({ startOn: e.target.value })} aria-label="시작일" />
        ) : (
          md(fields.startOn) || '없음'
        )}
      </dd>

      <dt>기한</dt>
      <dd>
        {o ? (
          <input className={s.propSelect} type="date" value={fields.dueOn} min={fields.startOn || undefined} onChange={(e) => onChange({ dueOn: e.target.value })} aria-label="기한" />
        ) : fields.dueOn ? (
          <Chip tone={task.dueState === 'overdue' ? 'danger' : 'warning'} icon={Clock}>
            {md(fields.dueOn)}
          </Chip>
        ) : (
          '없음'
        )}
        {badPeriod && <small className={s.warn}>기한이 시작일보다 앞이에요</small>}
      </dd>

      <dt>라벨</dt>
      <dd className={s.labels}>
        {o
          ? o.labels.map((l) => {
              const on = fields.labelIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  className={on ? `${s.labelToggle} ${s.labelOn}` : s.labelToggle}
                  style={on ? { borderColor: l.color } : undefined}
                  onClick={() => onChange({ labelIds: on ? fields.labelIds.filter((x) => x !== l.id) : [...fields.labelIds, l.id] })}
                  aria-pressed={on}
                >
                  {l.name}
                </button>
              )
            })
          : labelNames.map((l) => (
              <Chip key={l} tone="tint">
                {l}
              </Chip>
            ))}
      </dd>

      <dt>마일스톤</dt>
      <dd>
        {o ? (
          <PropSelect
            label="마일스톤"
            value={fields.milestoneId}
            options={[
              { value: null, label: '없음' },
              ...(fields.milestoneId !== null && !o.milestones.some((m) => m.id === fields.milestoneId) ? [{ value: fields.milestoneId, label: `${milestoneName} (닫힘)` }] : []),
              ...o.milestones.map((m) => ({ value: m.id as number | null, label: m.name })),
            ]}
            onChange={(milestoneId) => onChange({ milestoneId })}
          />
        ) : (
          (milestoneName ?? '없음')
        )}
      </dd>
    </dl>
  )
}

/** 속성 칸의 고르기 (테마 드롭다운) */
function PropSelect<T>({ label, value, options, onChange }: { label: string; value: T; options: DropdownOption<T>[]; onChange: (v: T) => void }) {
  return (
    <Dropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      searchable="auto"
      triggerClassName={s.propSelect}
      trigger={(sel, open) => (
        <>
          <span className={s.propSelectText}>{sel?.label ?? ''}</span>
          <ChevronDown size={14} className={open ? s.propChevOpen : undefined} />
        </>
      )}
    />
  )
}

function Person({ name }: { name: string }) {
  return (
    <span className={s.person}>
      <Avatar name={name} size={20} />
      {name}
    </span>
  )
}
