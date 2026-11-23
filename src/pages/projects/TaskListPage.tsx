import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, MessageCircle, Search } from 'lucide-react'
import { Avatar, Card, Checkbox, Chip, Empty, FilterSelect, FormError, Loadable } from '../../components/ui'
import { errorText } from '../../api/content'
import { bulkAssign, bulkTransition, useTaskList, type ListTask, type TaskListData } from '../../api/tasks'
import { invalidateAll } from '../../api/useResource'
import { getDataMode } from '../../lib/dataMode'
import { PRIORITY_NAME, STATUS_NAME, TYPE_NAME, type TaskStatus } from '../../mocks/tasks'
import { PRIORITY_TONE, STATUS_TONE } from './taskTones'
import s from './TaskListPage.module.css'

const EMPTY: TaskListData = { tasks: [], members: [], labels: [], milestones: [], projectKey: '', projectName: '', me: '', meId: 0, canWrite: false }

const byName = <T extends string>(m: Record<T, string>, name: string) => (Object.keys(m) as T[]).find((k) => m[k] === name)

/** 작업 목록 (Penpot 06 · 작업 목록) — T-1 */
export function TaskListPage() {
  const { key } = useParams()
  const list = useTaskList(key)
  const data = list.data ?? EMPTY

  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')
  const [label, setLabel] = useState('')
  const [milestone, setMilestone] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const st = byName(STATUS_NAME, status)
    const pr = byName(PRIORITY_NAME, priority)
    const ty = byName(TYPE_NAME, type)
    const kw = keyword.trim().toLowerCase()
    return data.tasks.filter(
      (t) =>
        (st ? t.status === st : showDone || t.status !== 'DONE') &&
        (!assignee || (assignee === '없음' ? !t.assignee : t.assignee === assignee)) &&
        (!label || t.labels.includes(label)) &&
        (!milestone || t.milestone === milestone) &&
        (!pr || t.priority === pr) &&
        (!ty || t.type === ty) &&
        (!kw || t.taskKey.toLowerCase().includes(kw) || t.title.toLowerCase().includes(kw)),
    )
  }, [data.tasks, status, assignee, label, milestone, priority, type, keyword, showDone])

  const doneCount = data.tasks.filter((t) => t.status === 'DONE').length
  const pickedTasks = rows.filter((t) => picked.includes(t.taskKey))
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))

  /** 일괄 변경: 목업은 화면 데이터만, 실서버는 T-5 · T-7 */
  const bulk = async (change: (t: ListTask) => void, live: () => Promise<void>) => {
    setError(null)
    try {
      if (getDataMode() === 'live') await live()
      else {
        pickedTasks.forEach(change)
        invalidateAll()
      }
      setPicked([])
    } catch (e) {
      setError(errorText(e, '바꾸지 못했어요.'))
    }
  }

  return (
    <Card className={s.card}>
      <div className={s.filters}>
        <FilterSelect label="상태" value={status} options={Object.values(STATUS_NAME)} onChange={setStatus} />
        <FilterSelect label="담당자" value={assignee} options={[...data.members.map((m) => m.name), '없음']} onChange={setAssignee} />
        <FilterSelect label="라벨" value={label} options={data.labels.map((l) => l.name)} onChange={setLabel} />
        <FilterSelect label="마일스톤" value={milestone} options={data.milestones.map((m) => m.name)} onChange={setMilestone} />
        <FilterSelect label="우선순위" value={priority} options={Object.values(PRIORITY_NAME)} onChange={setPriority} />
        <FilterSelect label="유형" value={type} options={Object.values(TYPE_NAME)} onChange={setType} />
        <label className={s.search}>
          <Search size={16} />
          <input type="search" placeholder="번호 · 제목 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </label>
      </div>

      <Loadable resource={list} label="작업 목록">
        {() =>
          rows.length === 0 ? (
            <Empty>조건에 맞는 작업이 없어요.</Empty>
          ) : (
            <div className={s.table} role="table">
              <div className={`${s.row} ${s.thead}`} role="row">
                <span />
                <span>번호</span>
                <span>제목</span>
                <span>상태</span>
                <span>담당자</span>
                <span>우선순위</span>
                <span>기한</span>
                <span>마일스톤</span>
                <span>댓글</span>
              </div>
              {rows.map((t) => (
                <div key={t.taskKey} className={`${s.row} ${s.task}`} role="row">
                  <Checkbox checked={picked.includes(t.taskKey)} onChange={() => toggle(t.taskKey)} />
                  <span className={s.key}>{t.taskKey}</span>
                  <Link to={`/projects/${data.projectKey}/tasks/${t.taskKey}`} className={s.title}>
                    {t.title}
                  </Link>
                  <span>
                    <Chip tone={STATUS_TONE[t.status]}>{STATUS_NAME[t.status]}</Chip>
                  </span>
                  <span className={s.person}>
                    {t.assignee ? (
                      <>
                        <Avatar name={t.assignee} size={22} />
                        {t.assignee}
                      </>
                    ) : (
                      <em>없음</em>
                    )}
                  </span>
                  <span>
                    <Chip tone={PRIORITY_TONE[t.priority]} className={t.priority === 'NORMAL' || t.priority === 'LOW' ? s.soft : undefined}>
                      {PRIORITY_NAME[t.priority]}
                    </Chip>
                  </span>
                  <span>
                    {t.dueOn ? (
                      <Chip
                        tone={t.dueState === 'overdue' ? 'danger' : t.dueState === 'soon' ? 'warning' : 'plain'}
                        icon={Clock}
                        className={t.dueState ? undefined : s.soft}
                      >
                        {t.dueOn}
                      </Chip>
                    ) : (
                      <em>—</em>
                    )}
                  </span>
                  <span className={s.milestone}>{t.milestone ?? '—'}</span>
                  <span className={s.comments}>
                    <MessageCircle size={14} />
                    {t.commentCount}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </Loadable>

      <FormError>{error}</FormError>
      <div className={s.foot}>
        <span>
          {rows.length}개{!showDone && !status && doneCount > 0 ? ` · 완료 ${doneCount}개는 숨김` : ''}
        </span>
        {!status && doneCount > 0 && (
          <button type="button" className={s.pill} onClick={() => setShowDone(!showDone)}>
            {showDone ? '완료 숨기기' : '완료 보기'}
          </button>
        )}
        {data.canWrite && (
          <span className={s.bulk}>
            {pickedTasks.length > 0 ? `선택한 작업 ${pickedTasks.length}개 일괄 변경` : '작업을 고르면 한 번에 바꿀 수 있어요'}
            <select
              aria-label="상태 일괄 변경"
              disabled={pickedTasks.length === 0}
              value=""
              onChange={(e) => {
                const to = e.target.value as TaskStatus
                void bulk(
                  (t) => (t.status = to),
                  () => bulkTransition(pickedTasks, to),
                )
              }}
            >
              <option value="">상태</option>
              {(Object.keys(STATUS_NAME) as TaskStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_NAME[k]}
                </option>
              ))}
            </select>
            <select
              aria-label="담당자 일괄 변경"
              disabled={pickedTasks.length === 0}
              value=""
              onChange={(e) => {
                const m = data.members.find((x) => String(x.id) === e.target.value)
                void bulk(
                  (t) => (t.assignee = m?.name ?? null),
                  () => bulkAssign(pickedTasks, m?.id ?? null),
                )
              }}
            >
              <option value="">담당자</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="none">담당자 없음</option>
            </select>
          </span>
        )}
      </div>
    </Card>
  )
}
