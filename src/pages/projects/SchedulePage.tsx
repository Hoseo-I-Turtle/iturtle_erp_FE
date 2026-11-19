// 프로젝트 일정표 — Penpot "06 Screens · 추가" 의 일정표 (간트) · (담당자별) · (마일스톤) 화면.
// 축은 % 로 그려 카드 너비에 맞춰 늘어난다. 끌기는 그때 트랙 너비를 재서 픽셀 → 날 수로 바꾼다.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bookmark,
  CalendarDays,
  ChartGantt,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Info,
  List,
  Plus,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Card, FilterSelect, Loadable, Switch } from '../../components/ui'
import { ApiError } from '../../api/client'
import { whenLive, type Resource } from '../../api/useResource'
import {
  createView,
  dayMd,
  dayMdw,
  dayNum,
  dayStr,
  deleteView,
  listViews,
  saveTaskAssignee,
  saveTaskDates,
  SCHED_STATUS_NAME,
  todayNum,
  useSchedule,
  type ScheduleData,
  type ScheduleView,
  type SchedMilestone,
  type SchedStatus,
  type SchedTask,
  type ViewFilters,
  type ViewScale,
  type ViewType,
} from '../../api/schedule'
import s from './SchedulePage.module.css'

export function SchedulePage() {
  const { key } = useParams()
  const res = useSchedule(key)
  return (
    <Loadable resource={res} label="일정표">
      {(d) => <ScheduleView d={d} res={res} />}
    </Loadable>
  )
}

// ───────────────────────── 축 ─────────────────────────

type Tick = { day: number; label?: string }
type Axis = { start: number; days: number; major: Tick[]; minor: Tick[] }

const ymd = (n: number) => dayStr(n).split('-').map(Number) as [number, number, number]
const monthStart = (y: number, m: number) => dayNum(`${y}-${String(m).padStart(2, '0')}-01`)
/** n 이 든 달의 1일에서 k 달 뒤 1일 */
const addMonths = (n: number, k: number) => {
  const [y, m] = ymd(n)
  const t = y * 12 + (m - 1) + k
  return monthStart(Math.floor(t / 12), (t % 12) + 1)
}
const mondayOf = (n: number) => n - ((new Date(n * 86400000).getUTCDay() + 6) % 7)

function monthTicks(from: number, to: number, withYear: boolean): Tick[] {
  const out: Tick[] = []
  for (let d = addMonths(from, 0); d < to; d = addMonths(d, 1)) {
    const [y, m] = ymd(d)
    const first = out.length === 0
    out.push({ day: Math.max(d, from), label: withYear && (first || m === 1) ? `${y}년 ${m}월` : `${m}월` })
  }
  return out
}

function makeAxis(scale: ViewScale, anchor: number): Axis {
  if (scale === 'WEEK') {
    const start = mondayOf(anchor) - 14
    const days = 77
    const minor: Tick[] = []
    for (let w = 0; w < 11; w++) minor.push({ day: start + w * 7, label: dayMd(start + w * 7) })
    return { start, days, major: monthTicks(start, start + days, true), minor }
  }
  if (scale === 'MONTH') {
    const start = addMonths(anchor, -1)
    const end = addMonths(start, 6)
    const minor: Tick[] = []
    for (let d = mondayOf(start) + 7; d < end; d += 7) minor.push({ day: d, label: dayMd(d) })
    return { start, days: end - start, major: monthTicks(start, end, true), minor }
  }
  const [y, m] = ymd(anchor)
  const start = monthStart(y, Math.floor((m - 1) / 3) * 3 + 1)
  const end = addMonths(start, 12)
  const major: Tick[] = []
  for (let d = start; d < end; d = addMonths(d, 3)) {
    const [qy, qm] = ymd(d)
    major.push({ day: d, label: `${qy}년 ${Math.floor((qm - 1) / 3) + 1}분기` })
  }
  return { start, days: end - start, major, minor: monthTicks(start, end, false).map((t) => ({ ...t, label: t.label?.replace(/^.*년 /, '') })) }
}

/** 이전 · 다음: 주 = 4주, 월 = 3달, 분기 = 한 분기 */
const shiftAnchor = (scale: ViewScale, anchor: number, dir: number) => (scale === 'WEEK' ? anchor + dir * 28 : addMonths(anchor, dir * 3))

const rangeLabel = (a: Axis) => {
  const [y1, m1, d1] = ymd(a.start)
  const [y2, m2, d2] = ymd(a.start + a.days - 1)
  return `${y1}.${String(m1).padStart(2, '0')}.${String(d1).padStart(2, '0')} – ${y2}.${String(m2).padStart(2, '0')}.${String(d2).padStart(2, '0')}`
}

/** 날 → 트랙 안 % (범위 밖이면 0 · 100 으로 자른다) */
const pctOf = (a: Axis, d: number) => Math.min(100, Math.max(0, ((d - a.start) / a.days) * 100))

// ───────────────────────── 화면 ─────────────────────────

const VIEWS: { value: ViewType; label: string; icon: LucideIcon }[] = [
  { value: 'GANTT', label: '간트', icon: ChartGantt },
  { value: 'MEMBER', label: '담당자별', icon: Users },
  { value: 'MILESTONE', label: '마일스톤', icon: FlaskConical },
  { value: 'CALENDAR', label: '달력', icon: CalendarDays },
]
const SCALES: { value: ViewScale; label: string }[] = [
  { value: 'WEEK', label: '주' },
  { value: 'MONTH', label: '월' },
  { value: 'QUARTER', label: '분기' },
]
const SUBTITLE: Record<ViewType, string> = {
  GANTT: '마일스톤과 작업을 기간으로 봐요',
  MEMBER: '담당자별로 누가 언제 바쁜지 봐요',
  MILESTONE: '마일스톤을 로드맵으로 봐요',
  CALENDAR: '달력으로 기한을 봐요',
}

type Preview = { taskKey: string; start: number | null; due: number | null; assigneeId?: number | null }

function ScheduleView({ d, res }: { d: ScheduleData; res: Resource<ScheduleData> }) {
  const today = todayNum()
  const [viewType, setViewType] = useState<ViewType>('GANTT')
  const [scale, setScale] = useState<ViewScale>('WEEK')
  const [anchor, setAnchor] = useState(today)
  const [filters, setFilters] = useState<ViewFilters>({ hideDone: true })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const axis = useMemo(() => makeAxis(scale, anchor), [scale, anchor])

  const milestoneName = (id: number | null | undefined) => d.milestones.find((m) => m.id === id)?.name ?? ''
  const memberName = (id: number | null | undefined) => d.members.find((m) => m.memberId === id)?.name ?? ''

  // 끌기 중이면 그 작업은 미리보기 값으로 그린다
  const tasks = useMemo(
    () =>
      d.tasks
        .map((t) =>
          preview?.taskKey === t.taskKey
            ? { ...t, start: preview.start, due: preview.due, ...(preview.assigneeId !== undefined ? { assigneeId: preview.assigneeId, assignee: d.members.find((m) => m.memberId === preview.assigneeId)?.name ?? null } : {}) }
            : t,
        )
        .filter((t) => !(filters.hideDone && t.status === 'DONE'))
        .filter((t) => filters.assigneeId == null || t.assigneeId === filters.assigneeId)
        .filter((t) => filters.milestoneId == null || t.milestoneId === filters.milestoneId),
    [d.tasks, d.members, preview, filters],
  )

  const applyView = (v: ScheduleView) => {
    setViewType(v.viewType)
    setScale(v.scale)
    setFilters(v.filters)
    setAnchor(today)
  }

  /** 기간 · 담당자를 화면에서 먼저 바꾸고 저장한다. 실패하면 다시 불러온다 */
  const commit = async (t: SchedTask, next: { start: number | null; due: number | null }, assigneeId?: number | null) => {
    const datesChanged = next.start !== t.start || next.due !== t.due
    const whoChanged = assigneeId !== undefined && assigneeId !== t.assigneeId
    if (!datesChanged && !whoChanged) return
    res.setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((x) =>
        x.taskKey === t.taskKey
          ? { ...x, ...next, startGuessed: x.startGuessed && !d.supportsStart, ...(whoChanged ? { assigneeId: assigneeId ?? null, assignee: memberName(assigneeId) || null } : {}) }
          : x,
      ),
    }))
    try {
      let version = t.version
      if (datesChanged) version = (await whenLive(() => saveTaskDates(t.taskKey, version, next, d.supportsStart))) ?? version
      if (whoChanged) version = (await whenLive(() => saveTaskAssignee(t.taskKey, version, assigneeId ?? null))) ?? version
      res.setData((prev) => ({ ...prev, tasks: prev.tasks.map((x) => (x.taskKey === t.taskKey ? { ...x, version } : x)) }))
      setError(null)
    } catch (e) {
      setError(`${t.taskKey}: ${e instanceof ApiError ? e.message : '저장하지 못했어요. 잠시 뒤 다시 해 주세요.'}`)
      res.reload()
    }
  }

  const drag = useDrag(axis, d, setPreview, commit)

  return (
    <Card className={s.card}>
      <div className={s.toolbar}>
        <div className={s.viewPicker} role="tablist" aria-label="보기 종류">
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" role="tab" aria-selected={viewType === value} className={viewType === value ? `${s.view} ${s.viewOn}` : s.view} onClick={() => setViewType(value)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {viewType !== 'CALENDAR' && (
          <>
            <div className={s.scale} role="tablist" aria-label="눈금">
              {SCALES.map((o) => (
                <button key={o.value} type="button" role="tab" aria-selected={scale === o.value} className={scale === o.value ? `${s.seg} ${s.segOn}` : s.seg} onClick={() => setScale(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className={s.nav}>
              <button type="button" aria-label="이전" onClick={() => setAnchor((a) => shiftAnchor(scale, a, -1))}>
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => setAnchor(today)}>
                오늘
              </button>
              <button type="button" aria-label="다음" onClick={() => setAnchor((a) => shiftAnchor(scale, a, 1))}>
                <ChevronRight size={14} />
              </button>
            </div>
            <strong className={s.range}>{rangeLabel(axis)}</strong>
          </>
        )}
        <span className={s.grow} />
        {viewType === 'GANTT' && (
          <FilterSelect
            label="마일스톤"
            value={milestoneName(filters.milestoneId)}
            options={d.milestones.map((m) => m.name)}
            onChange={(v) => setFilters((f) => ({ ...f, milestoneId: d.milestones.find((m) => m.name === v)?.id ?? null }))}
          />
        )}
        {viewType !== 'MILESTONE' && (
          <FilterSelect
            label="담당자"
            value={memberName(filters.assigneeId)}
            options={d.members.map((m) => m.name)}
            onChange={(v) => setFilters((f) => ({ ...f, assigneeId: d.members.find((m) => m.name === v)?.memberId ?? null }))}
          />
        )}
        <label className={s.toggle}>
          <Switch checked={!!filters.hideDone} onChange={(v) => setFilters((f) => ({ ...f, hideDone: v }))} label="완료 숨김" />
          완료 숨김
        </label>
        <SavedViews projectKey={d.projectKey} current={{ viewType, scale, filters }} onApply={applyView} />
      </div>

      {error && (
        <p className={s.error} role="alert">
          <TriangleAlert size={14} /> {error}
        </p>
      )}

      {viewType === 'GANTT' && <GanttView d={d} tasks={tasks} axis={axis} today={today} drag={drag} preview={preview} hideDone={!!filters.hideDone} milestoneFilter={filters.milestoneId ?? null} />}
      {viewType === 'MEMBER' && <MemberView d={d} tasks={tasks} axis={axis} today={today} drag={drag} preview={preview} assigneeFilter={filters.assigneeId ?? null} />}
      {viewType === 'MILESTONE' && (
        <MilestoneView
          d={d}
          axis={axis}
          today={today}
          hideDone={!!filters.hideDone}
          onOpen={(id) => {
            setFilters((f) => ({ ...f, milestoneId: id }))
            setViewType('GANTT')
          }}
        />
      )}
      {viewType === 'CALENDAR' && (
        <div className={s.calendarSoon}>
          <CalendarDays size={28} />
          <strong>달력 보기는 준비 중이에요</strong>
          <span>작업 · 마일스톤 기한은 지금 연구실 캘린더에서 볼 수 있어요.</span>
          <Link to="/calendar" className={s.linkBtn}>
            캘린더 열기 <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {viewType !== 'CALENDAR' && <Legend viewType={viewType} d={d} />}
      <span className={s.srOnly} aria-live="polite">
        {SUBTITLE[viewType]}
      </span>
    </Card>
  )
}

// ───────────────────────── 끌기 ─────────────────────────

type DragMode = 'move' | 'start' | 'end'
type DragApi = {
  enabled: boolean
  /** 이 작업에서 쓸 수 있는 손잡이 */
  modes: (t: SchedTask) => DragMode[]
  begin: (e: ReactPointerEvent, t: SchedTask, mode: DragMode, laneSwitch?: boolean) => void
  active: string | null
}

function useDrag(
  axis: Axis,
  d: ScheduleData,
  setPreview: (p: Preview | null) => void,
  commit: (t: SchedTask, next: { start: number | null; due: number | null }, assigneeId?: number | null) => void,
): DragApi {
  const [active, setActive] = useState<string | null>(null)
  const axisRef = useRef(axis)
  useEffect(() => {
    axisRef.current = axis
  }, [axis])

  const modes = (t: SchedTask): DragMode[] => {
    if (!d.canEdit || t.due === null || t.start === null) return []
    // 시작일을 서버가 모르면 막대 = 기한 하루. 옮기기 = 기한 바꾸기, 시작 손잡이는 없다
    return d.supportsStart ? ['move', 'start', 'end'] : ['move']
  }

  const begin = (e: ReactPointerEvent, t: SchedTask, mode: DragMode, laneSwitch = false) => {
    if (!modes(t).includes(mode) || e.button !== 0) return
    const track = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-track]')
    if (!track) return
    e.preventDefault()
    e.stopPropagation()
    const width = track.getBoundingClientRect().width
    const x0 = e.clientX
    const start0 = t.start as number
    const due0 = t.due as number
    let last: Preview = { taskKey: t.taskKey, start: start0, due: due0 }
    let moved = false
    setActive(t.taskKey)

    const laneAt = (x: number, y: number): number | null | undefined => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-lane]')
      if (!el) return undefined
      return el.dataset.lane === 'none' ? null : Number(el.dataset.lane)
    }
    const onMove = (ev: PointerEvent) => {
      const delta = Math.round(((ev.clientX - x0) / width) * axisRef.current.days)
      let start = start0
      let due = due0
      if (mode === 'move') {
        start += delta
        due += delta
      } else if (mode === 'start') start = Math.min(start0 + delta, due0)
      else due = Math.max(due0 + delta, start0)
      const lane = laneSwitch ? laneAt(ev.clientX, ev.clientY) : undefined
      if (delta !== 0 || lane !== undefined) moved = true
      last = { taskKey: t.taskKey, start, due, ...(lane !== undefined ? { assigneeId: lane } : {}) }
      setPreview(last)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setActive(null)
      setPreview(null)
      if (moved) commit(t, { start: last.start, due: last.due }, last.assigneeId)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return { enabled: d.canEdit, modes, begin, active }
}

// ───────────────────────── 공통 조각 ─────────────────────────

const STATUS_CLASS: Record<SchedStatus, string> = { TODO: s.stTodo, IN_PROGRESS: s.stDoing, REVIEW: s.stReview, DONE: s.stDone }

/** 축 머리 (월 · 분기 + 주 · 월) 와 오늘 선 · 눈금선을 그리는 바탕 */
function Timeline({ axis, today, label, children }: { axis: Axis; today: number; label: string; children: ReactNode }) {
  const todayIn = today >= axis.start && today < axis.start + axis.days
  const todayPct = ((today + 0.5 - axis.start) / axis.days) * 100
  return (
    <div className={s.timeline}>
      <div className={s.head}>
        <div className={s.headLeft}>{label}</div>
        <div className={s.headTrack}>
          {axis.major.map((t) => (
            <span key={`M${t.day}`} className={s.major} style={{ left: `${pctOf(axis, t.day)}%` }}>
              {t.label}
            </span>
          ))}
          {axis.minor.map((t) => (
            <span key={`m${t.day}`} className={s.minor} style={{ left: `${pctOf(axis, t.day)}%` }}>
              {t.label}
            </span>
          ))}
          {todayIn && (
            <span className={s.todayChip} style={{ left: `${todayPct}%` }}>
              오늘 {dayMd(today)}
            </span>
          )}
        </div>
      </div>
      <div className={s.body}>
        <div className={s.gridBg} aria-hidden>
          {axis.minor.map((t) => (
            <i key={`l${t.day}`} className={s.minorLine} style={{ left: `${pctOf(axis, t.day)}%` }} />
          ))}
          {axis.major.slice(1).map((t) => (
            <i key={`L${t.day}`} className={s.majorLine} style={{ left: `${pctOf(axis, t.day)}%` }} />
          ))}
          {todayIn && <i className={s.todayLine} style={{ left: `${todayPct}%` }} />}
        </div>
        {children}
      </div>
    </div>
  )
}

const initial = (name: string | null) => (name ? name.slice(0, 1) : '?')

/** 작업 막대 (간트 · 담당자별 같이 씀) */
function TaskBar({ t, axis, today, drag, preview, laneSwitch, label }: { t: SchedTask; axis: Axis; today: number; drag: DragApi; preview: Preview | null; laneSwitch?: boolean; label: 'dates' | 'key' }) {
  if (t.due === null || t.start === null) {
    return (
      <span className={s.noDate}>
        <Clock size={12} /> 기한 없음
      </span>
    )
  }
  const from = t.start
  const to = t.due + 1
  if (to <= axis.start || from >= axis.start + axis.days) return null
  const left = pctOf(axis, from)
  const width = Math.max(pctOf(axis, to) - left, 0.6)
  const late = t.status !== 'DONE' && t.due < today
  const lateDays = today - t.due
  const modes = drag.modes(t)
  const dragging = drag.active === t.taskKey || preview?.taskKey === t.taskKey
  const span = t.due - t.start + 1
  const text = label === 'key' ? `${t.taskKey}${span >= 7 ? ` · ${dayMd(t.start)}–${dayMd(t.due)}` : ''}` : span >= 5 ? `${dayMd(t.start)} – ${dayMd(t.due)}` : ''
  return (
    <>
      <div
        className={`${s.bar} ${STATUS_CLASS[t.status]} ${late ? s.late : ''} ${dragging ? s.dragging : ''} ${modes.includes('move') ? s.movable : ''} ${t.startGuessed ? s.guessed : ''}`}
        style={{ left: `${left}%`, width: `${width}%` }}
        onPointerDown={(e) => drag.begin(e, t, 'move', laneSwitch)}
        tabIndex={0}
        aria-label={`${t.taskKey} ${t.title}, ${dayMdw(t.start)}부터 ${dayMdw(t.due)}까지, ${SCHED_STATUS_NAME[t.status]}`}
      >
        {modes.includes('start') && <span className={`${s.handle} ${s.handleL}`} onPointerDown={(e) => drag.begin(e, t, 'start', false)} />}
        {label === 'dates' && <span className={s.avatar}>{initial(t.assignee)}</span>}
        <span className={s.barText}>{text}</span>
        {modes.includes('end') && <span className={`${s.handle} ${s.handleR}`} onPointerDown={(e) => drag.begin(e, t, 'end', false)} />}
        {!dragging && (
          <span className={s.tip} role="tooltip">
            <strong>
              {t.taskKey} · {t.title}
            </strong>
            <span>
              <em>기간</em>
              {t.startGuessed ? `기한 ${dayMdw(t.due)} (시작일 없음)` : `${dayMdw(t.start)} – ${dayMdw(t.due)} · ${span}일`}
            </span>
            <span className={late ? s.tipBad : undefined}>
              <em>상태</em>
              {SCHED_STATUS_NAME[t.status]}
              {late ? ` · 기한 ${lateDays}일 지남` : ''}
            </span>
            <span>
              <em>담당</em>
              {t.assignee ?? '없음'}
            </span>
            {t.checklist && (
              <span>
                <em>체크리스트</em>
                {t.checklist.done} / {t.checklist.total}
              </span>
            )}
          </span>
        )}
      </div>
      {late && label === 'dates' && (
        <span className={s.lateChip} style={{ left: `calc(${Math.min(left + width, 92)}% + 6px)` }}>
          <TriangleAlert size={11} /> {lateDays}일 지남
        </span>
      )}
    </>
  )
}

function Legend({ viewType, d }: { viewType: ViewType; d: ScheduleData }) {
  const note =
    viewType === 'MILESTONE'
      ? '막대 색은 작업 상태 비율이에요. 2주 안에 기한인데 절반도 못 했으면 위험으로 표시해요. 줄을 누르면 그 마일스톤의 간트로 가요'
      : !d.canEdit
        ? '작업을 고칠 권한이 없어 보기만 할 수 있어요'
        : viewType === 'MEMBER'
          ? '빨간 칸은 한 사람에게 작업이 3개 이상 겹친 기간이에요. 막대를 다른 사람 줄로 끌면 담당자가 바뀌어요'
          : d.supportsStart
            ? '막대를 끌어 기간을, 양 끝을 끌어 시작 · 기한을 바꿔요'
            : '막대를 끌면 기한이 바뀌어요. 작업 시작일은 아직 저장할 수 없어 기한 하루로 보여요'
  return (
    <div className={s.legend}>
      <span className={s.lg}>
        <i className={s.stTodo} /> 할 일
      </span>
      <span className={s.lg}>
        <i className={s.stDoing} /> 진행 중
      </span>
      <span className={s.lg}>
        <i className={s.stReview} /> 검토
      </span>
      {viewType === 'MILESTONE' ? (
        <span className={s.lg}>
          <i className={s.stDoneDark} /> 완료
        </span>
      ) : (
        <span className={s.lg}>
          <i className={s.lgLate} /> 기한 지남
        </span>
      )}
      {viewType !== 'MEMBER' && (
        <span className={s.lg}>
          <b className={s.lgDiamond} /> 마일스톤 기한
        </span>
      )}
      {viewType === 'MEMBER' && (
        <span className={s.lg}>
          <i className={s.lgOver} /> 겹침 많음
        </span>
      )}
      <span className={s.grow} />
      <span className={s.legendNote}>
        <Info size={14} /> {note}
      </span>
    </div>
  )
}

// ───────────────────────── 간트 ─────────────────────────

function GanttView({ d, tasks, axis, today, drag, preview, hideDone, milestoneFilter }: { d: ScheduleData; tasks: SchedTask[]; axis: Axis; today: number; drag: DragApi; preview: Preview | null; hideDone: boolean; milestoneFilter: number | null }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const byStart = (a: SchedTask, b: SchedTask) => (a.start ?? Infinity) - (b.start ?? Infinity) || (a.due ?? Infinity) - (b.due ?? Infinity)
  const open = d.milestones.filter((m) => !m.closed)
  const closed = hideDone ? [] : d.milestones.filter((m) => m.closed)
  const groups: { id: string; milestone: SchedMilestone | null; tasks: SchedTask[] }[] = [...open, ...closed]
    .filter((m) => milestoneFilter === null || m.id === milestoneFilter)
    .map((m) => ({ id: `m${m.id}`, milestone: m, tasks: tasks.filter((t) => t.milestoneId === m.id).sort(byStart) }))
  const known = new Set(d.milestones.map((m) => m.id))
  if (milestoneFilter === null) {
    const loose = tasks.filter((t) => t.milestoneId === null || !known.has(t.milestoneId)).sort(byStart)
    if (loose.length) groups.push({ id: 'none', milestone: null, tasks: loose })
  }
  const isCollapsed = (g: (typeof groups)[number]) => collapsed[g.id] ?? !!g.milestone?.closed

  if (!groups.length)
    return (
      <Timeline axis={axis} today={today} label="작업">
        <p className={s.empty}>보여 줄 마일스톤 · 작업이 없어요. 거르기를 바꿔 보세요.</p>
      </Timeline>
    )

  return (
    <Timeline axis={axis} today={today} label="작업">
      {groups.map((g) => {
        const m = g.milestone
        const shut = isCollapsed(g)
        return (
          <div key={g.id} role="rowgroup">
            <div className={`${s.row} ${s.groupRow}`}>
              <button type="button" className={s.groupLeft} onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !shut }))} aria-expanded={!shut}>
                {shut ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {m ? <FlaskConical size={14} className={m.closed ? s.mutedIcon : undefined} /> : <List size={14} />}
                <strong className={m?.closed ? s.mutedText : undefined}>{m ? m.name : '마일스톤 없음'}</strong>
                <small>{m ? `${m.done} / ${m.total}${m.closed ? ' · 닫힘' : ''}` : g.tasks.length}</small>
              </button>
              <div className={s.track} data-track>
                {m && <MilestoneBar m={m} axis={axis} />}
              </div>
            </div>
            {!shut &&
              g.tasks.map((t) => (
                <div key={t.taskKey} className={s.row}>
                  <Link to={`../tasks/${t.taskKey}`} relative="path" className={s.taskLeft}>
                    <small>{t.taskKey}</small>
                    <span>{t.title}</span>
                  </Link>
                  <div className={s.track} data-track>
                    <TaskBar t={t} axis={axis} today={today} drag={drag} preview={preview} label="dates" />
                  </div>
                </div>
              ))}
          </div>
        )
      })}
    </Timeline>
  )
}

function MilestoneBar({ m, axis }: { m: SchedMilestone; axis: Axis }) {
  if (m.due === null) return <span className={s.noDate}>기한 없음</span>
  const from = m.start ?? m.due
  const to = m.due + 1
  if (to <= axis.start || from >= axis.start + axis.days) return null
  const left = pctOf(axis, from)
  const width = Math.max(pctOf(axis, to) - left, 0.6)
  const ratio = m.total ? m.done / m.total : 0
  const dueIn = m.due >= axis.start && m.due < axis.start + axis.days
  const nearEnd = pctOf(axis, to) > 92
  return (
    <>
      <span className={`${s.msTrack} ${m.closed ? s.msClosed : ''}`} style={{ left: `${left}%`, width: `${width}%` }}>
        <i style={{ width: `${ratio * 100}%` }} />
      </span>
      {dueIn && (
        <>
          <b className={`${s.diamond} ${m.closed ? s.diamondDone : ''}`} style={{ left: `${pctOf(axis, to)}%` }} />
          <span className={`${s.msDue} ${nearEnd ? s.msDueLeft : ''} ${m.closed ? s.msDueDone : ''}`} style={{ left: `${pctOf(axis, to)}%` }}>
            {dayMd(m.due)}
            {m.closed ? ' 닫힘' : ''}
          </span>
        </>
      )}
    </>
  )
}

// ───────────────────────── 담당자별 ─────────────────────────

function MemberView({ d, tasks, axis, today, drag, preview, assigneeFilter }: { d: ScheduleData; tasks: SchedTask[]; axis: Axis; today: number; drag: DragApi; preview: Preview | null; assigneeFilter: number | null }) {
  const people: { id: number | null; name: string; sub: string }[] = [
    ...d.members.map((m) => ({ id: m.memberId, name: m.name, sub: [m.role === 'MANAGER' ? '프로젝트 관리자' : '참여자', m.note].filter(Boolean).join(' · ') })),
    { id: null, name: '담당 없음', sub: '' },
  ].filter((p) => assigneeFilter === null || p.id === assigneeFilter)

  return (
    <Timeline axis={axis} today={today} label="담당자">
      {people.map((p) => {
        const mine = tasks.filter((t) => t.assigneeId === p.id && t.due !== null && t.start !== null).sort((a, b) => (a.start as number) - (b.start as number))
        const undated = tasks.filter((t) => t.assigneeId === p.id && (t.due === null || t.start === null))
        if (p.id === null && !mine.length && !undated.length) return null
        // 겹치지 않게 줄을 나눈다
        const laneEnds: number[] = []
        const laneOf = new Map<string, number>()
        for (const t of mine) {
          let i = laneEnds.findIndex((end) => end < (t.start as number))
          if (i < 0) {
            laneEnds.push(t.due as number)
            i = laneEnds.length - 1
          } else laneEnds[i] = t.due as number
          laneOf.set(t.taskKey, i)
        }
        const lanes = Math.max(laneEnds.length, 1) + (undated.length ? 1 : 0)
        const over = overloadRanges(mine.filter((t) => t.status !== 'DONE'))
        const busy = mine.filter((t) => t.status !== 'DONE').length + undated.filter((t) => t.status !== 'DONE').length
        return (
          <div key={p.id ?? 'none'} className={`${s.row} ${s.laneRow}`} style={{ height: lanes * 30 + 24 }} data-lane={p.id ?? 'none'}>
            <div className={s.personLeft}>
              <span className={p.id === null ? `${s.bigAvatar} ${s.bigAvatarNone}` : s.bigAvatar}>{initial(p.id === null ? null : p.name)}</span>
              <span className={s.personText}>
                <strong className={p.id === null ? s.mutedText : undefined}>{p.name}</strong>
                {p.sub && <small>{p.sub}</small>}
              </span>
              <span className={over.length ? `${s.load} ${s.loadOver}` : s.load}>
                {over.length > 0 && <TriangleAlert size={11} />} 작업 {busy}
              </span>
            </div>
            <div className={s.track} data-track>
              {over.map(([a, b]) => (
                <i key={a} className={s.overload} style={{ left: `${pctOf(axis, a)}%`, width: `${pctOf(axis, b + 1) - pctOf(axis, a)}%` }} />
              ))}
              {mine.map((t) => (
                <div key={t.taskKey} className={s.lane} style={{ top: 12 + (laneOf.get(t.taskKey) ?? 0) * 30 }}>
                  <TaskBar t={t} axis={axis} today={today} drag={drag} preview={preview} laneSwitch label="key" />
                </div>
              ))}
              {undated.length > 0 && (
                <div className={s.lane} style={{ top: 12 + Math.max(laneEnds.length, 1) * 30 }}>
                  <span className={s.noDate}>
                    <Clock size={12} /> 기한 없음 · {undated.map((t) => t.taskKey).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </Timeline>
  )
}

/** 작업 3개 이상이 겹친 날 구간들 [시작, 끝] */
function overloadRanges(list: SchedTask[]): [number, number][] {
  if (list.length < 3) return []
  const lo = Math.min(...list.map((t) => t.start as number))
  const hi = Math.max(...list.map((t) => t.due as number))
  const out: [number, number][] = []
  let open: number | null = null
  for (let day = lo; day <= hi + 1; day++) {
    const n = list.filter((t) => (t.start as number) <= day && day <= (t.due as number)).length
    if (n >= 3 && open === null) open = day
    if (n < 3 && open !== null) {
      out.push([open, day - 1])
      open = null
    }
  }
  return out
}

// ───────────────────────── 마일스톤 로드맵 ─────────────────────────

function MilestoneView({ d, axis, today, hideDone, onOpen }: { d: ScheduleData; axis: Axis; today: number; hideDone: boolean; onOpen: (id: number) => void }) {
  const list = d.milestones.filter((m) => !(hideDone && m.closed))
  if (!list.length)
    return (
      <Timeline axis={axis} today={today} label="마일스톤">
        <p className={s.empty}>마일스톤이 없어요. 마일스톤 탭에서 만들 수 있어요.</p>
      </Timeline>
    )
  return (
    <Timeline axis={axis} today={today} label="마일스톤">
      {list.map((m) => {
        const own = d.tasks.filter((t) => t.milestoneId === m.id)
        const count = (st: SchedStatus) => own.filter((t) => t.status === st).length
        const loaded = own.length
        const total = Math.max(m.total, loaded)
        // 불러온 작업(완료는 180일까지)으로 상태 비율을 그리고, 모자라는 완료 수는 서버 진행률로 채운다
        const done = Math.max(m.done, count('DONE'))
        const segs: [string, number][] = [
          [m.closed ? s.segDoneClosed : s.segDone, done],
          [s.stReview, count('REVIEW')],
          [s.stDoing, count('IN_PROGRESS')],
          [s.stTodo, Math.max(total - done - count('REVIEW') - count('IN_PROGRESS'), 0)],
        ]
        const ratio = total ? done / total : 0
        const pct = Math.round(ratio * 100)
        const left = m.due === null ? null : today <= m.due ? m.due - today : null
        const risky = !m.closed && left !== null && left <= 14 && ratio < 0.5
        const late = !m.closed && m.due !== null && m.due < today
        const from = m.start ?? m.due
        const visible = m.due !== null && from !== null && m.due + 1 > axis.start && from < axis.start + axis.days
        const l = visible ? pctOf(axis, from as number) : 0
        const w = visible ? Math.max(pctOf(axis, (m.due as number) + 1) - l, 0.6) : 0
        const meta = m.closed ? `닫힘 · ${m.due !== null ? dayMd(m.due) : '기한 없음'} · 작업 ${total}` : !total ? '작업 아직 없음' : `기한 ${m.due !== null ? dayMd(m.due) : '없음'} · 완료 ${done} / ${total}`
        return (
          <div key={m.id} className={`${s.row} ${s.msRow}`}>
            <button type="button" className={s.msLeft} onClick={() => onOpen(m.id)} title="이 마일스톤의 간트 보기">
              <FlaskConical size={16} className={m.closed ? s.doneIcon : undefined} />
              <span className={s.personText}>
                <strong className={m.closed ? s.mutedText : undefined}>{m.name}</strong>
                <small>{meta}</small>
              </span>
            </button>
            <div className={s.track} data-track>
              {visible && (
                <>
                  <span className={total ? s.stack : `${s.stack} ${s.stackDraft}`} style={{ left: `${l}%`, width: `${w}%` }}>
                    {total > 0 && segs.map(([cls, n], i) => (n > 0 ? <i key={i} className={cls} style={{ flexGrow: n }} /> : null))}
                    <em className={pct > 30 || m.closed ? s.stackOn : undefined}>{total ? `${pct}%` : '초안'}</em>
                  </span>
                  <b className={`${s.diamond} ${m.closed ? s.diamondDone : ''}`} style={{ left: `${pctOf(axis, (m.due as number) + 1)}%` }} />
                  {(risky || late) && (
                    <span className={late ? `${s.risk} ${s.riskBad}` : s.risk} style={{ left: `calc(${Math.min(l + w, 80)}% + 14px)` }}>
                      <TriangleAlert size={11} /> {late ? '기한 지남' : `위험 · ${left}일 남음, ${pct}%`}
                    </span>
                  )}
                </>
              )}
              {m.due === null && <span className={s.noDate}>기한 없음</span>}
            </div>
          </div>
        )
      })}
    </Timeline>
  )
}

// ───────────────────────── 저장한 보기 ─────────────────────────

const VIEW_ICON: Record<ViewType, LucideIcon> = { GANTT: ChartGantt, MEMBER: Users, MILESTONE: FlaskConical, CALENDAR: CalendarDays }
const VIEW_LABEL: Record<ViewType, string> = { GANTT: '간트', MEMBER: '담당자별', MILESTONE: '마일스톤', CALENDAR: '달력' }
const SCALE_LABEL: Record<ViewScale, string> = { WEEK: '주', MONTH: '월', QUARTER: '분기' }

function SavedViews({ projectKey, current, onApply }: { projectKey: string; current: { viewType: ViewType; scale: ViewScale; filters: ViewFilters }; onApply: (v: ScheduleView) => void }) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<ScheduleView[]>([])
  const [server, setServer] = useState(false)
  const [picked, setPicked] = useState<ScheduleView['viewId'] | null>(null)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'PRIVATE' | 'PROJECT'>('PRIVATE')
  const [msg, setMsg] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    listViews(projectKey)
      .then((r) => {
        if (!alive) return
        setViews(r.views)
        setServer(r.serverSupported)
      })
      .catch(() => alive && setMsg('저장한 보기를 불러오지 못했어요.'))
    return () => {
      alive = false
    }
  }, [projectKey])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const describe = (v: Pick<ScheduleView, 'viewType' | 'scale' | 'filters'>) =>
    [VIEW_LABEL[v.viewType], v.viewType === 'CALENDAR' ? null : SCALE_LABEL[v.scale], v.filters.hideDone ? '완료 숨김' : null, v.filters.assigneeId != null ? '담당자 거름' : null, v.filters.milestoneId != null ? '마일스톤 거름' : null]
      .filter(Boolean)
      .join(' · ')

  const save = async () => {
    const n = name.trim()
    if (!n) return
    try {
      const v = await createView(projectKey, { name: n, scope: server ? scope : 'PRIVATE', ...current }, server)
      setViews((list) => [...list, v])
      setPicked(v.viewId)
      setName('')
      setMsg(v.local ? '이 브라우저에만 저장했어요 (나만).' : null)
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : '저장하지 못했어요.')
    }
  }
  const remove = async (v: ScheduleView) => {
    try {
      await deleteView(projectKey, v)
      setViews((list) => list.filter((x) => x.viewId !== v.viewId))
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : '지우지 못했어요.')
    }
  }

  return (
    <div className={s.saved} ref={box}>
      <button type="button" className={open ? `${s.savedBtn} ${s.savedBtnOn}` : s.savedBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bookmark size={14} /> 보기 저장
      </button>
      {open && (
        <div className={s.popover} role="dialog" aria-label="저장한 보기">
          <p className={s.popTitle}>저장한 보기</p>
          {views.length === 0 && <p className={s.popEmpty}>아직 저장한 보기가 없어요. 지금 보기를 이름 붙여 저장해 보세요.</p>}
          {views.map((v) => {
            const Icon = VIEW_ICON[v.viewType]
            const on = picked === v.viewId
            return (
              <div key={v.viewId} className={on ? `${s.viewItem} ${s.viewItemOn}` : s.viewItem}>
                <button
                  type="button"
                  className={s.viewItemMain}
                  onClick={() => {
                    setPicked(v.viewId)
                    onApply(v)
                    setOpen(false)
                  }}
                >
                  <Icon size={16} />
                  <span>
                    <strong>{v.name}</strong>
                    <small>{describe(v)}</small>
                  </span>
                </button>
                <span className={s.scopeChip}>{v.scope === 'PROJECT' ? '프로젝트' : '나만'}</span>
                {on && <Check size={14} />}
                <button type="button" className={s.viewDel} aria-label={`${v.name} 지우기`} onClick={() => remove(v)}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
          <div className={s.popLine} />
          <form
            className={s.newView}
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Plus size={14} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="지금 보기를 새 이름으로 저장" maxLength={40} aria-label="보기 이름" />
            <select value={server ? scope : 'PRIVATE'} onChange={(e) => setScope(e.target.value as 'PRIVATE' | 'PROJECT')} aria-label="공개 범위" disabled={!server}>
              <option value="PRIVATE">나만</option>
              <option value="PROJECT">프로젝트 공유</option>
            </select>
            <button type="submit" disabled={!name.trim()}>
              저장
            </button>
          </form>
          <p className={s.popHint}>{msg ?? `지금: ${describe(current)}${server ? '' : ' · 프로젝트 공유는 서버 준비 후 쓸 수 있어요'}`}</p>
        </div>
      )}
    </div>
  )
}
