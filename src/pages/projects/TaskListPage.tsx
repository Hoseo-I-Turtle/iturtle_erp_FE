import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown, Clock, MessageCircle, Search } from 'lucide-react'
import { Avatar, Card, Checkbox, Empty, Loadable } from '../../components/ui'
import { ApiError } from '../../api/client'
import {
  bulkUpdateTasks,
  notifyTasksChanged,
  useTaskFormOptions,
  useTaskList,
  useTasksChanged,
  type TaskFormOptions,
  type TaskListData,
  type TaskListFilter,
  type TaskSort,
} from '../../api/tasks'
import { PRIORITY_NAME, STATUS_NAME, TYPE_NAME, type TaskPriority, type TaskStatus, type TaskType } from '../../mocks/tasks'
import s from './TaskListPage.module.css'

const STATUS_SETS: { value: string; label: string; statuses: TaskStatus[] }[] = [
  { value: 'open', label: '할 일 · 진행 중 · 검토', statuses: ['TODO', 'IN_PROGRESS', 'REVIEW'] },
  { value: 'TODO', label: '할 일', statuses: ['TODO'] },
  { value: 'IN_PROGRESS', label: '진행 중', statuses: ['IN_PROGRESS'] },
  { value: 'REVIEW', label: '검토', statuses: ['REVIEW'] },
]
const SORTS: { value: TaskSort; label: string }[] = [
  { value: 'dueOn', label: '기한 순' },
  { value: 'priority', label: '우선순위 순' },
  { value: 'updatedAt,desc', label: '최근 바뀐 순' },
  { value: 'taskNo,desc', label: '최근 만든 순' },
]
const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']
const TYPES: TaskType[] = ['TASK', 'BUG', 'RESEARCH']
const STATUS_TONE: Record<TaskStatus, string> = { TODO: s.sTODO, IN_PROGRESS: s.sIN_PROGRESS, REVIEW: s.sREVIEW, DONE: s.sDONE }
const PRIORITY_TONE: Record<TaskPriority, string> = { URGENT: s.pURGENT, HIGH: s.pHIGH, NORMAL: s.pNORMAL, LOW: s.pLOW }

/** 프로젝트 작업 목록 (디자인: 06 Screens · 추가 › Screen · 작업 목록) */
export function TaskListPage() {
  const { key } = useParams()
  const options = useTaskFormOptions(key)
  return (
    <Card className={s.card}>
      <Loadable resource={options} label="작업 목록">
        {(o) => (o ? <TaskTable projectKey={key ?? o.projectKey} o={o} /> : null)}
      </Loadable>
    </Card>
  )
}

function TaskTable({ projectKey, o }: { projectKey: string; o: TaskFormOptions }) {
  const [statusSet, setStatusSet] = useState('open')
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [labelId, setLabelId] = useState<number | null>(null)
  const [milestoneId, setMilestoneId] = useState<number | null>(null)
  const [priority, setPriority] = useState<TaskPriority | ''>('')
  const [type, setType] = useState<TaskType | ''>('')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<TaskSort>('dueOn')
  const [showDone, setShowDone] = useState(false)

  const filter: TaskListFilter = useMemo(
    () => ({
      statuses: STATUS_SETS.find((x) => x.value === statusSet)?.statuses ?? [],
      assigneeId,
      labelId,
      milestoneId,
      priorities: priority ? [priority] : [],
      typeCodes: type ? [type] : [],
      keyword,
      sort,
      showDone,
      names: {
        assignee: o.members.find((m) => m.id === assigneeId)?.name,
        label: o.labels.find((l) => l.id === labelId)?.name,
        milestone: o.milestones.find((m) => m.id === milestoneId)?.name,
      },
    }),
    [statusSet, assigneeId, labelId, milestoneId, priority, type, keyword, sort, showDone, o],
  )
  const list = useTaskList(projectKey, filter)
  useTasksChanged(list.reload)

  return (
    <>
      <div className={s.filters}>
        <Pick label="상태" value={statusSet} on={statusSet !== 'open'} onChange={setStatusSet} options={STATUS_SETS.map((x) => ({ value: x.value, label: x.label }))} prefix="상태: " />
        <Pick label="담당자" value={assigneeId ? String(assigneeId) : ''} onChange={(v) => setAssigneeId(v ? Number(v) : null)} options={o.members.map((m) => ({ value: String(m.id), label: m.name }))} all />
        <Pick label="라벨" value={labelId ? String(labelId) : ''} onChange={(v) => setLabelId(v ? Number(v) : null)} options={o.labels.map((l) => ({ value: String(l.id), label: l.name }))} all />
        <Pick
          label="마일스톤"
          value={milestoneId ? String(milestoneId) : ''}
          onChange={(v) => setMilestoneId(v ? Number(v) : null)}
          options={o.milestones.map((m) => ({ value: String(m.id), label: m.name }))}
          all
          prefix="마일스톤: "
        />
        <Pick label="우선순위" value={priority} onChange={(v) => setPriority(v as TaskPriority | '')} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_NAME[p] }))} all />
        <Pick label="유형" value={type} onChange={(v) => setType(v as TaskType | '')} options={TYPES.map((t) => ({ value: t, label: TYPE_NAME[t] }))} all />
        <Pick label="정렬" value={sort} on={false} onChange={(v) => setSort(v as TaskSort)} options={SORTS} />
        <span className={s.grow} />
        <label className={s.search}>
          <Search size={16} />
          <input value={keyword} placeholder="번호 · 제목 검색 (2자 이상)" onChange={(e) => setKeyword(e.target.value)} aria-label="작업 검색" />
        </label>
      </div>
      <Loadable resource={list} label="작업">
        {(d) => <Rows d={d} o={o} projectKey={projectKey} showDone={showDone} setShowDone={setShowDone} reload={list.reload} />}
      </Loadable>
    </>
  )
}

function Rows({
  d,
  o,
  projectKey,
  showDone,
  setShowDone,
  reload,
}: {
  d: TaskListData
  o: TaskFormOptions
  projectKey: string
  showDone: boolean
  setShowDone: (v: boolean) => void
  reload: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keys = d.rows.map((r) => r.taskKey)
  const sel = picked.filter((k) => keys.includes(k))
  const allOn = sel.length > 0 && sel.length === keys.length
  const toggle = (k: string, on: boolean) => setPicked((p) => (on ? [...p, k] : p.filter((x) => x !== k)))

  const bulk = async (change: Parameters<typeof bulkUpdateTasks>[1]) => {
    if (!sel.length) return
    setBusy(true)
    setError(null)
    try {
      await bulkUpdateTasks(sel, change)
      setPicked([])
      notifyTasksChanged()
      reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '바꾸지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={s.table} role="table" aria-label="작업 목록">
        <div className={`${s.row} ${s.head}`} role="row">
          <span role="columnheader">
            <Checkbox checked={allOn} onChange={(on) => setPicked(on ? keys : [])} size={16} />
          </span>
          <span role="columnheader">번호</span>
          <span role="columnheader">제목</span>
          <span role="columnheader">상태</span>
          <span role="columnheader">담당자</span>
          <span role="columnheader">우선순위</span>
          <span role="columnheader">기한</span>
          <span role="columnheader">마일스톤</span>
          <span role="columnheader">댓글</span>
        </div>
        {d.rows.length === 0 && <Empty>조건에 맞는 작업이 없어요.</Empty>}
        {d.rows.map((t) => (
          <div key={t.taskKey} className={`${s.row} ${sel.includes(t.taskKey) ? s.rowOn : ''}`} role="row">
            <span role="cell">
              <Checkbox checked={sel.includes(t.taskKey)} onChange={(on) => toggle(t.taskKey, on)} size={16} />
            </span>
            <Link role="cell" className={s.key} to={`/projects/${projectKey}/tasks/${t.taskKey}`}>
              {t.taskKey}
            </Link>
            <Link role="cell" className={s.title} to={`/projects/${projectKey}/tasks/${t.taskKey}`}>
              {t.title}
              {t.cancelled && <em className={s.cancelled}>취소</em>}
            </Link>
            <span role="cell">
              <span className={`${s.chip} ${STATUS_TONE[t.status]}`}>{STATUS_NAME[t.status]}</span>
            </span>
            <span role="cell" className={s.who}>
              {t.assignee ? (
                <>
                  <Avatar name={t.assignee} size={20} />
                  {t.assignee}
                </>
              ) : (
                <span className={s.none}>없음</span>
              )}
            </span>
            <span role="cell">
              <span className={`${s.chip} ${PRIORITY_TONE[t.priority]}`}>{PRIORITY_NAME[t.priority]}</span>
            </span>
            <span role="cell">
              {t.dueOn ? (
                <span className={`${s.due} ${t.dueState === 'overdue' ? s.dueLate : t.dueState === 'soon' ? s.dueSoon : ''}`}>
                  <Clock size={14} />
                  {t.dueOn}
                </span>
              ) : (
                <span className={s.none}>—</span>
              )}
            </span>
            <span role="cell" className={s.ms}>
              {t.milestone ?? <span className={s.none}>—</span>}
            </span>
            <span role="cell" className={s.comments}>
              <MessageCircle size={14} />
              {t.commentCount}
            </span>
          </div>
        ))}
      </div>

      {error && <p className={s.error}>{error}</p>}

      <footer className={s.foot}>
        <span>
          {d.rows.length}개{!showDone && d.doneHidden > 0 ? ` · 완료 ${d.doneHidden}개는 숨김` : ''}
        </span>
        <button type="button" className={s.toggle} onClick={() => setShowDone(!showDone)}>
          {showDone ? '완료 숨기기' : '완료 보기'}
        </button>
        <span className={s.grow} />
        {sel.length > 0 ? (
          <>
            <span className={s.bulkLabel}>선택한 {sel.length}개 일괄 변경</span>
            <BulkPick
              label="담당자"
              disabled={busy}
              options={[{ value: 'none', label: '담당 없음' }, ...o.members.map((m) => ({ value: String(m.id), label: m.name }))]}
              onPick={(v) => void bulk({ assigneeMemberId: v === 'none' ? null : Number(v) })}
            />
            <BulkPick
              label="우선순위"
              disabled={busy}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_NAME[p] }))}
              onPick={(v) => void bulk({ priority: v as TaskPriority })}
            />
            <BulkPick
              label="마일스톤"
              disabled={busy}
              options={[{ value: 'none', label: '마일스톤 없음' }, ...o.milestones.map((m) => ({ value: String(m.id), label: m.name }))]}
              onPick={(v) => void bulk({ milestoneId: v === 'none' ? null : Number(v) })}
            />
          </>
        ) : (
          <span className={s.bulkHint}>작업을 고르면 담당자 · 우선순위 · 마일스톤을 한 번에 바꿀 수 있어요</span>
        )}
      </footer>
    </>
  )
}

/** 알약 모양 고르기 (값이 있으면 진하게) */
function Pick({
  label,
  value,
  options,
  onChange,
  all,
  prefix = '',
  on,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  all?: boolean
  prefix?: string
  on?: boolean
}) {
  const current = options.find((x) => x.value === value)
  const active = on ?? !!value
  return (
    <label className={`${s.pick} ${active ? s.pickOn : ''}`}>
      <span>{current ? `${prefix}${current.label}` : label}</span>
      <ChevronDown size={14} />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {all && <option value="">{label}: 전체</option>}
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function BulkPick({ label, options, onPick, disabled }: { label: string; options: { value: string; label: string }[]; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <label className={s.bulk}>
      <ChevronDown size={14} />
      <span>{label}</span>
      <select
        value=""
        disabled={disabled}
        aria-label={`고른 작업 ${label} 바꾸기`}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value)
        }}
      >
        <option value="">{label} 바꾸기</option>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  )
}
