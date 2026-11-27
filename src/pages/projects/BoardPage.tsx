import { useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, ListChecks, MessageCircle, Plus, Search, SquareCheck, TriangleAlert, User } from 'lucide-react'
import { Avatar, FilterSelect, Loadable } from '../../components/ui'
import { PRIORITY_NAME, STATUS_NAME, TYPE_NAME, type Task, type TaskPriority, type TaskStatus } from '../../mocks/tasks'
import { ApiError } from '../../api/client'
import { whenLive, type Resource } from '../../api/useResource'
import { moveTaskInColumn, transitionRule, transitionTask, useBoard, type BoardData, type BoardPosition, type BoardTask } from '../../api/projects'
import { openTaskCreate, useTasksChanged } from '../../api/tasks'
import s from './BoardPage.module.css'

const COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const TASK_AREAS = ['백엔드', '화면', '앱'] as const
const AREAS = ['전체', ...TASK_AREAS] as const
type Area = (typeof AREAS)[number]
type TaskArea = (typeof TASK_AREAS)[number]

const AREA_LABELS: Record<TaskArea, string[]> = {
  백엔드: ['백엔드', 'backend'],
  화면: ['화면', '프론트엔드', 'frontend', 'admin'],
  앱: ['앱', 'app', 'mobile'],
}

// 분야 라벨이나 제목 머리말이 없는 기존 데프미 작업의 분야.
const LEGACY_AREAS: Partial<Record<string, TaskArea>> = {
  'DEFME-1': '화면',
  'DEFME-6': '앱',
  'DEFME-7': '앱',
  'DEFME-8': '백엔드',
}

function matchesArea(task: BoardTask, area: TaskArea) {
  const labels = task.labels.map((label) => label.trim().toLowerCase())
  const assigned = TASK_AREAS.filter((name) =>
    AREA_LABELS[name].some((label) => labels.includes(label)),
  )
  if (assigned.length) return assigned.includes(area)

  const prefix = task.title.match(/^\s*\((백엔드|화면|앱)\)/)?.[1]
  return (prefix ?? LEGACY_AREAS[task.taskKey]) === area
}

const COLUMN_NOTE: Partial<Record<TaskStatus, string>> = {
  REVIEW: '요청자 · 프로젝트 관리자가 완료',
  DONE: '최근 14일',
}
const PRIORITY_TONE: Record<TaskPriority, string> = {
  LOW: s.pLow,
  NORMAL: s.pNormal,
  HIGH: s.pHigh,
  URGENT: s.pUrgent,
}

export function BoardPage() {
  const { key } = useParams()
  const board = useBoard(key)
  useTasksChanged(board.reload)
  return (
    <Loadable resource={board} label="보드">
      {(d) => <BoardView key={d.projectKey} d={d} board={board} />}
    </Loadable>
  )
}

/** 서버 거절 메시지 (P102 · P103 · P104 · P105 · P107 · P101 …) 를 열 오류 칸에 그대로 보여 준다 */
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : '저장하지 못했어요. 잠시 뒤 다시 해 주세요.')

/** dragged 를 before 카드 바로 앞으로 옮긴 새 목록 (before 가 없으면 그 자리에서 상태만 바꾼다) */
function placeBefore(list: BoardTask[], dragged: BoardTask, beforeKey: string | null) {
  if (!beforeKey) return list.map((x) => (x.taskKey === dragged.taskKey ? dragged : x))
  const rest = list.filter((x) => x.taskKey !== dragged.taskKey)
  const i = rest.findIndex((x) => x.taskKey === beforeKey)
  return i < 0 ? [...rest, dragged] : [...rest.slice(0, i), dragged, ...rest.slice(i)]
}

function BoardView({ d, board }: { d: BoardData; board: Resource<BoardData> }) {
  const { tasks, me } = d
  const [area, setArea] = useState<Area>('전체')
  const [people, setPeople] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [milestone, setMilestone] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [lanes, setLanes] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  const [error, setError] = useState<{ col: TaskStatus; msg: string } | null>(null)

  const memberNames = d.memberNames
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort()
  const setTasks = (f: (prev: BoardTask[]) => BoardTask[]) => board.setData((b) => ({ ...b, tasks: f(b.tasks) }))

  const visible = tasks.filter(
    (x) =>
      (area === '전체' || matchesArea(x, area)) &&
      (people.length === 0 || (x.assignee && people.includes(x.assignee))) &&
      (!label || x.labels.includes(label)) &&
      (!milestone || x.milestone === milestone) &&
      (!priority || PRIORITY_NAME[x.priority] === priority) &&
      (!type || TYPE_NAME[x.type] === type) &&
      (!mineOnly || x.assignee === me),
  )

  /**
   * 카드 옮기기. beforeKey 가 있으면 그 카드 바로 위에 놓는다 (카드 위에 놓았을 때).
   * 다른 열이면 T-7 상태 옮기기, 같은 열이면 T-4 순서 바꾸기 (boardPosition).
   */
  const move = (taskKey: string, to: TaskStatus, beforeKey: string | null = null) => {
    const task = tasks.find((x) => x.taskKey === taskKey)
    if (!task || taskKey === beforeKey) return
    const sameCol = task.status === to
    if (sameCol && !beforeKey) return
    // 반려 · 다시 열기처럼 사유가 필요한 이동은 사유를 물어 함께 보낸다 (없으면 서버가 P107 · P106 으로 거절)
    let reason: string | undefined
    if (!sameCol) {
      // 화면에서 먼저 막는 규칙 (서버 TaskService.TRANSITIONS 와 같은 표. 서버도 다시 검사한다)
      const rule = transitionRule(task.status, to)
      if (!rule) {
        setError({ col: to, msg: `${STATUS_NAME[task.status]}에서 ${STATUS_NAME[to]}로는 옮길 수 없어요` })
        return
      }
      if (to === 'IN_PROGRESS' && task.status === 'TODO' && !task.assignee) {
        setError({ col: to, msg: '담당자가 없는 작업은 진행 중으로 옮길 수 없어요' })
        return
      }
      if (rule.byRequester && task.requester !== me && !d.isManager) {
        setError({ col: to, msg: '요청자나 프로젝트 관리자만 옮길 수 있어요' })
        return
      }
      if (!rule.byRequester && task.assignee !== me && !d.isManager) {
        setError({ col: to, msg: '담당자나 프로젝트 관리자만 옮길 수 있어요' })
        return
      }
      if (rule.reason) {
        const typed = window.prompt(task.status === 'REVIEW' ? '반려 사유를 적어 주세요 (댓글로 남아요)' : '다시 여는 사유를 적어 주세요 (댓글로 남아요)')?.trim()
        if (!typed) return
        reason = typed
      }
    }
    setError(null)

    // 놓을 자리: 새 열에서 before 카드의 바로 위 카드 (거르기 전 전체 목록 기준)
    const colList = tasks.filter((x) => x.status === to && x.taskKey !== taskKey)
    const bi = beforeKey ? colList.findIndex((x) => x.taskKey === beforeKey) : -1
    const position: BoardPosition | undefined = beforeKey
      ? { afterTaskKey: bi > 0 ? colList[bi - 1].taskKey : null, beforeTaskKey: beforeKey }
      : undefined

    const prev = tasks
    setTasks((list) => placeBefore(list, { ...task, status: to }, beforeKey))

    whenLive(async () => {
      if (sameCol && position) {
        await moveTaskInColumn(taskKey, position)
        return
      }
      const r = await transitionTask(taskKey, { toStatus: to, version: task.version ?? 0, reason, boardPosition: position })
      // 자리를 주지 않았으면 서버는 새 열의 맨 위에 놓는다 → 화면도 맞춘다 (새 version 도 받는다)
      setTasks((list) => {
        if (position) return list.map((x) => (x.taskKey === taskKey ? r.task : x))
        const without = list.filter((x) => x.taskKey !== taskKey)
        const first = without.findIndex((x) => x.status === to)
        return first < 0 ? [...without, r.task] : [...without.slice(0, first), r.task, ...without.slice(first)]
      })
    }).catch((e: unknown) => {
      setTasks(() => prev)
      setError({ col: to, msg: errMsg(e) })
      // 보드가 낡았으면 (P101 버전 · P117 자리) 새로 불러온다
      if (e instanceof ApiError && (e.code === 'P101' || e.code === 'P117')) board.reload()
    })
  }

  const onDrop = (e: DragEvent, col: TaskStatus, beforeKey: string | null = null) => {
    e.preventDefault()
    e.stopPropagation()
    const k = e.dataTransfer.getData('text/plain')
    setOverCol(null)
    setDragging(null)
    move(k, col, beforeKey)
  }

  const togglePerson = (n: string) => setPeople((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))

  return (
    <>
      <div className={s.filters}>
        <div className={s.areas} role="group" aria-label="작업 분야">
          {AREAS.map((name) => (
            <button
              key={name}
              type="button"
              className={s.area}
              aria-pressed={name === area}
              onClick={() => setArea(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className={s.people} role="group" aria-label="담당자로 거르기">
          {memberNames.map((n) => (
            <button
              key={n}
              type="button"
              className={people.length === 0 || people.includes(n) ? s.person : `${s.person} ${s.personOff}`}
              onClick={() => togglePerson(n)}
              aria-pressed={people.includes(n)}
            >
              <Avatar name={n} size={26} />
            </button>
          ))}
        </div>
        <FilterSelect label="라벨" value={label} options={uniq(tasks.flatMap((x) => x.labels))} onChange={setLabel} />
        <FilterSelect label="마일스톤" value={milestone} options={uniq(tasks.map((x) => x.milestone))} onChange={setMilestone} />
        <FilterSelect label="우선순위" value={priority} options={Object.values(PRIORITY_NAME)} onChange={setPriority} />
        <FilterSelect label="유형" value={type} options={Object.values(TYPE_NAME)} onChange={setType} />
        <span className={s.grow} />
        <button type="button" className={mineOnly ? `${s.opt} ${s.optOn}` : s.opt} onClick={() => setMineOnly(!mineOnly)}>
          내 작업만
        </button>
        <button type="button" className={lanes ? `${s.opt} ${s.optOn}` : s.opt} onClick={() => setLanes(!lanes)}>
          담당자별 줄
        </button>
      </div>

      <div className={s.columns}>
        {COLUMNS.map((col) => {
          const list = visible.filter((x) => x.status === col)
          const groups = lanes ? uniq(list.map((x) => x.assignee ?? '담당자 없음')) : [null]
          return (
            <section
              key={col}
              className={overCol === col ? `${s.col} ${s.colOver}` : s.col}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col)
              }}
              onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => onDrop(e, col)}
            >
              <header className={s.colHead}>
                <span className={`${s.colChip} ${s[`c${col}`]}`}>{STATUS_NAME[col]}</span>
                <span className={s.colCount}>{list.length}</span>
                <button
                  type="button"
                  className={s.add}
                  aria-label={`${STATUS_NAME[col]}에 작업 추가`}
                  onClick={() => openTaskCreate({ initialStatus: col === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO' })}
                >
                  <Plus size={16} />
                </button>
              </header>
              {COLUMN_NOTE[col] && <p className={s.colNote}>{COLUMN_NOTE[col]}</p>}

              <ColumnBody>
              {groups.map((g) => (
                <div key={g ?? 'all'} className={s.lane}>
                  {g && <div className={s.laneHead}>{g}</div>}
                  {list
                    .filter((x) => !g || (x.assignee ?? '담당자 없음') === g)
                    .map((x) => (
                      <TaskCard
                        key={x.taskKey}
                        task={x}
                        projectKey={d.projectKey}
                        dragging={dragging === x.taskKey}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', x.taskKey)
                          setDragging(x.taskKey)
                        }}
                        onDragEnd={() => setDragging(null)}
                        onDrop={(e) => onDrop(e, col, x.taskKey)}
                      />
                    ))}
                </div>
              ))}
              </ColumnBody>

              {error?.col === col && (
                <div className={s.error} role="alert">
                  <TriangleAlert size={16} />
                  {error.msg}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

/** 한 칸에 한 번에 보여 줄 카드 수. 넘으면 칸 안에서 스크롤한다 */
const VISIBLE_CARDS = 10

/**
 * 칸의 카드 자리: 카드가 10개를 넘으면 10번째 카드 아래까지만 보이고 칸 안에서 스크롤한다.
 * 카드 높이가 제각각이라 10번째 카드의 실제 위치를 재서 높이를 정한다 (창 크기가 바뀌면 다시 잰다).
 */
function ColumnBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const cards = el.querySelectorAll<HTMLElement>('[data-task-card]')
      const last = cards[VISIBLE_CARDS - 1]
      // 아래 여백 4px: 마지막 카드의 그림자가 잘리지 않게
      el.style.maxHeight = cards.length > VISIBLE_CARDS && last ? `${Math.ceil(last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop) + 4}px` : ''
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
  return (
    <div ref={ref} className={s.colBody}>
      {children}
    </div>
  )
}

type CardProps = {
  task: Task
  projectKey: string
  dragging: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  /** 이 카드 위에 놓으면 그 바로 위 자리로 */
  onDrop: (e: DragEvent) => void
}
function TaskCard({ task: x, projectKey, dragging, onDragStart, onDragEnd, onDrop }: CardProps) {
  const TypeIcon = x.type === 'BUG' ? TriangleAlert : x.type === 'RESEARCH' ? Search : SquareCheck
  return (
    <Link
      to={`/projects/${projectKey}/tasks/${x.taskKey}`}
      className={dragging ? `${s.card} ${s.dragging}` : s.card}
      data-task-card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <span className={s.cardTop}>
        <TypeIcon size={14} className={x.type === 'BUG' ? s.bug : undefined} />
        <span className={s.key}>{x.taskKey}</span>
        <span className={`${s.prio} ${PRIORITY_TONE[x.priority]}`}>{PRIORITY_NAME[x.priority]}</span>
      </span>
      <span className={s.title}>{x.title}</span>
      {x.labels.length > 0 && (
        <span className={s.labels}>
          {x.labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      )}
      <span className={s.cardBottom}>
        {x.dueOn && (
          <span className={`${s.due} ${x.dueState ? s[x.dueState] : ''}`}>
            <Clock size={14} />
            {x.dueOn}
          </span>
        )}
        {x.checklist && (
          <span className={s.meta}>
            <ListChecks size={14} />
            {x.checklist.done}/{x.checklist.total}
          </span>
        )}
        {x.commentCount > 0 && (
          <span className={s.meta}>
            <MessageCircle size={14} />
            {x.commentCount}
          </span>
        )}
        <span className={s.grow} />
        {x.assignee ? (
          <Avatar name={x.assignee} size={24} />
        ) : (
          <span className={s.noOne} title="담당자 없음">
            <User size={12} />
          </span>
        )}
      </span>
    </Link>
  )
}
