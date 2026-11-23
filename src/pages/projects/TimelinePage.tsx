import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bookmark,
  CalendarDays,
  ChartNoAxesColumn,
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
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, Card, Empty, FilterSelect, Loadable, Switch } from '../../components/ui'
import { errorText } from '../../api/content'
import { todayKst } from '../../api/projects'
import { setMilestoneClosed, useTimeline, type TimelineData } from '../../api/timeline'
import { getDataMode } from '../../lib/dataMode'
import { STATUS_NAME } from '../../mocks/tasks'
import type { TimelineMilestone, TimelineTask } from '../../mocks/timeline'
import s from './TimelinePage.module.css'

type View = 'GANTT' | 'ASSIGNEE' | 'MILESTONE' | 'CALENDAR'
type Range = 'WEEK' | 'MONTH' | 'QUARTER'
type SavedView = { name: string; view: View; range: Range; milestone: string; assignee: string; hideDone: boolean; shared?: boolean }

const VIEWS: { value: View; label: string; icon: LucideIcon }[] = [
  { value: 'GANTT', label: '간트', icon: ChartNoAxesColumn },
  { value: 'ASSIGNEE', label: '담당자별', icon: Users },
  { value: 'MILESTONE', label: '마일스톤', icon: FlaskConical },
  { value: 'CALENDAR', label: '달력', icon: CalendarDays },
]
const RANGES: { value: Range; label: string; days: number; step: number }[] = [
  { value: 'WEEK', label: '주', days: 77, step: 7 },
  { value: 'MONTH', label: '월', days: 140, step: 28 },
  { value: 'QUARTER', label: '분기', days: 182, step: 91 },
]
const PRESETS: SavedView[] = [
  { name: '이번 스프린트', view: 'GANTT', range: 'WEEK', milestone: '', assignee: '', hideDone: true, shared: true },
  { name: '내 작업', view: 'GANTT', range: 'WEEK', milestone: '', assignee: '@me', hideDone: true },
  { name: '마일스톤 로드맵', view: 'MILESTONE', range: 'QUARTER', milestone: '', assignee: '', hideDone: false, shared: true },
  { name: '담당자별 이번 달', view: 'ASSIGNEE', range: 'MONTH', milestone: '', assignee: '', hideDone: true, shared: true },
]
const EMPTY: TimelineData = { tasks: [], milestones: [], events: [], members: [], projectKey: '', projectName: '', me: '', canManage: false }

/* ---------- 날짜를 "일 번호"로 다룬다 ---------- */
const DAY = 86400000
const num = (ymd: string) => Math.round(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / DAY)
const date = (n: number) => new Date(n * DAY)
const ymdOf = (n: number) => date(n).toISOString().slice(0, 10)
const md = (n: number) => `${date(n).getUTCMonth() + 1}/${date(n).getUTCDate()}`
const mdOf = (ymd: string) => md(num(ymd))
/** 그 주 월요일 */
const monday = (n: number) => n - ((date(n).getUTCDay() + 6) % 7)

const isLate = (t: TimelineTask, today: number) => !!t.dueOn && t.status !== 'DONE' && num(t.dueOn) < today
const total = (m: TimelineMilestone) => m.counts.todo + m.counts.doing + m.counts.review + m.counts.done

const viewsKey = (projectKey: string) => `iturtle.timelineViews.${projectKey}`
function loadViews(projectKey: string): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(viewsKey(projectKey)) ?? '[]') as SavedView[]
  } catch {
    return []
  }
}

/** 일정표 (Penpot 06 · 일정표 간트 · 담당자별 · 마일스톤 · 달력). initialView 로 마일스톤 탭에서도 쓴다 */
export function TimelinePage({ initialView = 'GANTT' }: { initialView?: View }) {
  const { key } = useParams()
  const tl = useTimeline(key)
  const data = tl.data ?? EMPTY
  const today = num(todayKst())

  const [view, setView] = useState<View>(initialView)
  const [range, setRange] = useState<Range>(initialView === 'MILESTONE' ? 'QUARTER' : 'WEEK')
  const [offset, setOffset] = useState(0)
  const [milestone, setMilestone] = useState('')
  const [assignee, setAssignee] = useState('')
  const [hideDone, setHideDone] = useState(true)
  const [folded, setFolded] = useState<number[]>([])
  const [viewsOpen, setViewsOpen] = useState(false)
  const [saved, setSaved] = useState<SavedView[]>(() => loadViews(key ?? ''))
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cfg = RANGES.find((r) => r.value === range)!
  // 창의 시작: 주 = 오늘 2~3주 전 월요일, 월 · 분기 = 지난달 1일
  const start = useMemo(() => {
    if (range === 'WEEK') return monday(today - 17) + offset * cfg.step
    const d = date(today)
    return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1 + offset * (range === 'QUARTER' ? 3 : 1), 1) / DAY)
  }, [range, offset, today, cfg.step])
  const end = start + cfg.days
  const pos = (n: number) => ((n - start) / cfg.days) * 100

  const msFilter = data.milestones.find((m) => m.name === milestone)
  const who = assignee === '@me' ? data.me : assignee
  const tasks = data.tasks.filter(
    (t) =>
      (!hideDone || t.status !== 'DONE') &&
      (!msFilter || t.milestoneId === msFilter.id) &&
      (!who || (who === '담당 없음' ? !t.assignee : t.assignee === who)),
  )
  const milestones = data.milestones.filter((m) => (!msFilter || m.id === msFilter.id) && (!hideDone || view === 'MILESTONE' || !m.closed || view === 'GANTT'))

  /* ---------- 눈금 ---------- */
  const ticks = useMemo(() => {
    const out: { n: number; label: string }[] = []
    if (range === 'QUARTER') {
      for (let n = start; n < end; n++) if (date(n).getUTCDate() === 1) out.push({ n, label: `${date(n).getUTCMonth() + 1}월` })
    } else {
      const every = range === 'WEEK' ? 7 : 14
      for (let n = monday(start); n < end; n += every) if (n >= start) out.push({ n, label: md(n) })
    }
    return out
  }, [range, start, end])
  const heads = useMemo(() => {
    const out: { n: number; label: string }[] = []
    for (let n = start; n < end; n++) {
      const d = date(n)
      const first = n === start
      if (range === 'QUARTER') {
        if (first || (d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0))
          out.push({ n, label: `${d.getUTCFullYear()}년 ${Math.floor(d.getUTCMonth() / 3) + 1}분기` })
      } else if (first || d.getUTCDate() === 1)
        out.push({ n, label: first || d.getUTCMonth() === 0 ? `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월` : `${d.getUTCMonth() + 1}월` })
    }
    return out
  }, [range, start, end])

  const rangeLabel =
    view === 'CALENDAR'
      ? ''
      : range === 'QUARTER'
        ? `${heads[0]?.label ?? ''} – ${heads[heads.length - 1]?.label ?? ''}`
        : `${ymdOf(start).replace(/-/g, '.')} – ${ymdOf(end - 1).replace(/-/g, '.')}`

  const apply = (v: SavedView) => {
    setView(v.view)
    setRange(v.range)
    setMilestone(v.milestone)
    setAssignee(v.assignee)
    setHideDone(v.hideDone)
    setOffset(0)
    setViewsOpen(false)
  }
  const saveView = () => {
    const name = newName.trim()
    if (!name) return
    const next = [...saved.filter((v) => v.name !== name), { name, view, range, milestone, assignee, hideDone }]
    setSaved(next)
    setNewName('')
    try {
      localStorage.setItem(viewsKey(data.projectKey), JSON.stringify(next))
    } catch {
      /* 저장하지 못해도 이번 접속 동안은 쓸 수 있다 */
    }
  }
  const describe = (v: SavedView) =>
    [VIEWS.find((x) => x.value === v.view)?.label, RANGES.find((x) => x.value === v.range)?.label, v.assignee === '@me' ? '담당자 = 나' : v.assignee, v.milestone, v.hideDone ? '완료 숨김' : '완료 포함']
      .filter(Boolean)
      .join(' · ')

  const closeMilestone = async (m: TimelineMilestone) => {
    setError(null)
    try {
      await setMilestoneClosed(data.projectKey, m, !m.closed, getDataMode() === 'live')
    } catch (e) {
      setError(errorText(e, '마일스톤을 바꾸지 못했어요.'))
    }
  }

  /* ---------- 막대 ---------- */
  const barStyle = (a: number, b: number): CSSProperties => ({ left: `${pos(a)}%`, width: `${Math.max(pos(b + 1) - pos(a), 1.2)}%` })
  const Bar = ({ t, label }: { t: TimelineTask; label?: string }) =>
    t.startOn && t.dueOn ? (
      <Link
        to={`/projects/${data.projectKey}/tasks/${t.taskKey}`}
        className={`${s.bar} ${s[`bar-${t.status}`]} ${isLate(t, today) ? s.barLate : ''}`}
        style={barStyle(num(t.startOn), num(t.dueOn))}
        title={`${t.taskKey} · ${t.title}\n기간 ${mdOf(t.startOn)} – ${mdOf(t.dueOn)}\n상태 ${STATUS_NAME[t.status]}${isLate(t, today) ? ` · 기한 ${today - num(t.dueOn)}일 지남` : ''}\n담당 ${t.assignee ?? '없음'}${t.checklist ? `\n체크리스트 ${t.checklist.done} / ${t.checklist.total}` : ''}`}
      >
        <span>{label ?? `${mdOf(t.startOn)} – ${mdOf(t.dueOn)}`}</span>
      </Link>
    ) : null

  const Grid = () => (
    <div className={s.grid} aria-hidden>
      {ticks.map((t) => (
        <i key={t.n} style={{ left: `${pos(t.n)}%` }} />
      ))}
      {today >= start && today < end && (
        <b style={{ left: `${pos(today)}%` }}>
          <em>오늘 {md(today)}</em>
        </b>
      )}
    </div>
  )
  const Head = ({ title }: { title: string }) => (
    <>
      <div className={`${s.row} ${s.head}`}>
        <span className={s.left}>{title}</span>
        <div className={s.lane}>
          {heads.map((h) => (
            <span key={h.n} className={s.month} style={{ left: `${pos(h.n)}%` }}>
              {h.label}
            </span>
          ))}
        </div>
      </div>
      <div className={`${s.row} ${s.head} ${s.headTicks}`}>
        <span className={s.left} />
        <div className={s.lane}>
          {ticks.map((t) => (
            <span key={t.n} className={s.tick} style={{ left: `${pos(t.n)}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </>
  )

  /* ---------- 간트 ---------- */
  const gantt = () => {
    const groups: { m: TimelineMilestone | null; tasks: TimelineTask[] }[] = [
      ...milestones.map((m) => ({ m, tasks: tasks.filter((t) => t.milestoneId === m.id) })),
      { m: null, tasks: tasks.filter((t) => t.milestoneId === null) },
    ].filter((g) => g.m !== null || g.tasks.length > 0)
    return (
      <div className={s.chart}>
        <Head title="작업" />
        {groups.map(({ m, tasks: ts }) => {
          const id = m?.id ?? 0
          const open = !folded.includes(id) && !(m?.closed && hideDone)
          const sum = m ? total(m) : ts.length
          return (
            <div key={id}>
              <div className={`${s.row} ${s.group}`}>
                <button
                  type="button"
                  className={s.left}
                  onClick={() => setFolded(folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id])}
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {m ? <FlaskConical size={14} /> : <List size={14} />}
                  <strong className={m?.closed ? s.dim : undefined}>{m ? m.name : '마일스톤 없음'}</strong>
                  <small>{m ? `${m.counts.done} / ${sum}${m.closed ? ' · 닫힘' : ''}` : sum}</small>
                </button>
                <div className={s.lane}>
                  {m?.startOn && m.dueOn && (
                    <>
                      <span className={s.msTrack} style={barStyle(num(m.startOn), num(m.dueOn))}>
                        <i style={{ width: `${sum ? (m.counts.done / sum) * 100 : 0}%` }} />
                      </span>
                      <span className={m.closed ? `${s.msDue} ${s.msClosed}` : s.msDue} style={{ left: `${pos(num(m.dueOn) + 1)}%` }}>
                        {mdOf(m.dueOn)}
                        {m.closed ? ' 닫힘' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {open &&
                ts.map((t) => (
                  <div key={t.taskKey} className={s.row}>
                    <Link to={`/projects/${data.projectKey}/tasks/${t.taskKey}`} className={`${s.left} ${s.taskName}`}>
                      <small>{t.taskKey}</small>
                      <span>{t.title}</span>
                    </Link>
                    <div className={s.lane}>
                      <Bar t={t} />
                      {t.startOn && t.dueOn && isLate(t, today) && (
                        <span className={s.late} style={{ left: `${pos(num(t.dueOn) + 1)}%` }}>
                          <TriangleAlert size={12} />
                          {today - num(t.dueOn)}일 지남
                        </span>
                      )}
                      {!t.dueOn && (
                        <span className={s.noDate}>
                          <Clock size={12} />
                          기한 없음 · 작업 상세에서 기한을 정해 주세요
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )
        })}
        <Grid />
      </div>
    )
  }

  /* ---------- 담당자별 ---------- */
  const byAssignee = () => {
    const people = [...data.members.map((m) => ({ name: m.name as string | null, role: m.role })), { name: null, role: '' }]
    return (
      <div className={s.chart}>
        <Head title="담당자" />
        {people.map((p) => {
          const mine = tasks.filter((t) => t.assignee === p.name && t.startOn && t.dueOn).sort((a, b) => a.startOn!.localeCompare(b.startOn!))
          if (p.name === null && mine.length === 0) return null
          // 겹치지 않게 줄을 나눈다
          const lanes: TimelineTask[][] = []
          for (const t of mine) {
            const lane = lanes.find((l) => num(l[l.length - 1].dueOn!) < num(t.startOn!))
            if (lane) lane.push(t)
            else lanes.push([t])
          }
          return (
            <div key={p.name ?? 'none'} className={`${s.row} ${s.person}`} style={{ minHeight: Math.max(1, lanes.length) * 30 + 14 }}>
              <span className={s.left}>
                {p.name ? <Avatar name={p.name} size={28} /> : <span className={s.nobody}>?</span>}
                <span className={s.personText}>
                  <strong className={p.name ? undefined : s.dim}>{p.name ?? '담당 없음'}</strong>
                  {p.role && <small>{p.role}</small>}
                </span>
                <span className={lanes.length >= 3 ? `${s.count} ${s.countOver}` : s.count}>
                  {lanes.length >= 3 && <TriangleAlert size={12} />}
                  작업 {mine.length}
                </span>
              </span>
              <div className={s.lane}>
                {lanes.map((l, i) => (
                  <div key={i} className={s.subLane}>
                    {l.map((t) => (
                      <Bar key={t.taskKey} t={t} label={`${t.taskKey} · ${mdOf(t.startOn!)}–${mdOf(t.dueOn!)}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <Grid />
      </div>
    )
  }

  /* ---------- 마일스톤 로드맵 ---------- */
  const roadmap = () => (
    <div className={s.chart}>
      <Head title="마일스톤" />
      {data.milestones
        .filter((m) => !msFilter || m.id === msFilter.id)
        .map((m) => {
          const sum = total(m)
          const pct = sum ? Math.round((m.counts.done / sum) * 100) : 0
          const left = m.dueOn ? num(m.dueOn) - today : null
          const risk = !m.closed && sum > 0 && left !== null && left <= 14 && pct < 50
          return (
            <div key={m.id} className={`${s.row} ${s.ms}`}>
              <span className={s.left}>
                <FlaskConical size={16} />
                <span className={s.personText}>
                  <strong className={m.closed ? s.dim : undefined}>{m.name}</strong>
                  <small>
                    {m.closed
                      ? `닫힘${m.dueOn ? ` · ${mdOf(m.dueOn)}` : ''} · 작업 ${sum}`
                      : sum === 0
                        ? '계획 · 작업 아직 없음'
                        : `기한 ${m.dueOn ? mdOf(m.dueOn) : '없음'} · 완료 ${m.counts.done} / ${sum}`}
                  </small>
                </span>
                {risk && (
                  <span className={`${s.count} ${s.countOver}`}>
                    <TriangleAlert size={12} />
                    위험
                  </span>
                )}
                {data.canManage && (
                  <button type="button" className={s.msToggle} onClick={() => closeMilestone(m)}>
                    {m.closed ? '다시 열기' : '닫기'}
                  </button>
                )}
              </span>
              <div className={s.lane}>
                {m.startOn && m.dueOn && (
                  <>
                    <span className={sum === 0 ? `${s.seg} ${s.segDraft}` : s.seg} style={barStyle(num(m.startOn), num(m.dueOn))}>
                      {sum === 0 ? (
                        <em>초안</em>
                      ) : (
                        <>
                          <i className={s.segDone} style={{ flex: m.counts.done }} />
                          <i className={s.segReview} style={{ flex: m.counts.review }} />
                          <i className={s.segDoing} style={{ flex: m.counts.doing }} />
                          <i className={s.segTodo} style={{ flex: m.counts.todo }} />
                          <em>{pct}%</em>
                        </>
                      )}
                    </span>
                    <span className={s.diamond} style={{ left: `${pos(num(m.dueOn) + 1)}%` }} />
                  </>
                )}
              </div>
            </div>
          )
        })}
      <Grid />
    </div>
  )

  /* ---------- 달력 ---------- */
  const calendar = () => {
    const t = date(today)
    const first = Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, 1) / DAY)
    const month = date(first).getUTCMonth()
    const days: number[] = []
    for (let n = monday(first); days.length < 42; n++) days.push(n)
    const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7)).filter((w) => w.some((n) => date(n).getUTCMonth() === month))
    return (
      <>
        <p className={s.calTitle}>
          {date(first).getUTCFullYear()}년 {month + 1}월
        </p>
        <div className={s.cal}>
          {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
            <span key={d} className={i > 4 ? `${s.dow} ${s.weekend}` : s.dow}>
              {d}
            </span>
          ))}
          {weeks.flat().map((n) => {
            const d = date(n)
            const ymd = ymdOf(n)
            const out = d.getUTCMonth() !== month
            const items = [
              ...data.milestones.filter((m) => m.dueOn === ymd).map((m) => ({ k: `m${m.id}`, cls: m.closed ? s.calMsClosed : s.calMs, text: `◆ ${m.name}${m.closed ? ' 닫힘' : ''}`, to: undefined as string | undefined })),
              ...data.events.filter((e) => e.date === ymd).map((e) => ({ k: e.id, cls: s.calEvent, text: `${e.time ?? ''} ${e.title}`.trim(), to: undefined as string | undefined })),
              ...tasks
                .filter((x) => x.dueOn === ymd)
                .map((x) => ({ k: x.taskKey, cls: `${s.calTask} ${isLate(x, today) ? s.calLate : ''} ${s[`dot-${x.status}`]}`, text: `${x.taskKey} ${x.title}`, to: `/projects/${data.projectKey}/tasks/${x.taskKey}` })),
            ]
            return (
              <div key={n} className={`${s.cell} ${out ? s.out : ''} ${d.getUTCDay() === 0 || d.getUTCDay() === 6 ? s.weekend : ''}`}>
                <span className={n === today ? `${s.dayNo} ${s.todayNo}` : s.dayNo}>
                  {d.getUTCDate() === 1 ? `${d.getUTCMonth() + 1}월 1일` : d.getUTCDate()}
                  {n === today && <em>오늘</em>}
                </span>
                {items.slice(0, 3).map((it) =>
                  it.to ? (
                    <Link key={it.k} to={it.to} className={it.cls} title={it.text}>
                      {it.text}
                    </Link>
                  ) : (
                    <span key={it.k} className={it.cls} title={it.text}>
                      {it.text}
                    </span>
                  ),
                )}
                {items.length > 3 && <small className={s.more}>+{items.length - 3}개 더</small>}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <Card className={s.card}>
      <div className={s.toolbar}>
        <div className={s.views} role="tablist" aria-label="보기">
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? s.viewOn : undefined} onClick={() => { setView(value); setOffset(0) }}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        {view !== 'CALENDAR' && (
          <div className={s.ranges} role="tablist" aria-label="범위">
            {RANGES.map((r) => (
              <button key={r.value} type="button" role="tab" aria-selected={range === r.value} className={range === r.value ? s.rangeOn : undefined} onClick={() => { setRange(r.value); setOffset(0) }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className={s.nav}>
          <button type="button" aria-label="앞으로" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={() => setOffset(0)}>
            오늘
          </button>
          <button type="button" aria-label="뒤로" onClick={() => setOffset(offset + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
        <span className={s.rangeLabel}>{rangeLabel}</span>
        <span className={s.filters}>
          <FilterSelect label="마일스톤" value={milestone} options={data.milestones.map((m) => m.name)} onChange={setMilestone} />
          <FilterSelect label="담당자" value={assignee === '@me' ? data.me : assignee} options={[...data.members.map((m) => m.name), '담당 없음']} onChange={setAssignee} />
          <label className={s.hideDone}>
            <Switch checked={hideDone} onChange={setHideDone} label="완료 숨김" />
            완료 숨김
          </label>
          <span className={s.savedWrap}>
            <button type="button" className={s.savedBtn} aria-expanded={viewsOpen} onClick={() => setViewsOpen(!viewsOpen)}>
              <Bookmark size={14} />
              보기 저장
            </button>
            {viewsOpen && (
              <div className={s.popover}>
                <p>저장한 보기</p>
                {[...PRESETS, ...saved].map((v) => {
                  const on = v.view === view && v.range === range && v.milestone === milestone && v.assignee === assignee && v.hideDone === hideDone
                  const Icon = v.assignee === '@me' ? User : (VIEWS.find((x) => x.value === v.view)?.icon ?? Bookmark)
                  return (
                    <div key={v.name} className={on ? `${s.viewItem} ${s.viewItemOn}` : s.viewItem}>
                      <button type="button" onClick={() => apply(v)}>
                        <Icon size={16} />
                        <span>
                          <strong>{v.name}</strong>
                          <small>{describe(v)}</small>
                        </span>
                        <em>{v.shared ? '프로젝트' : '나만'}</em>
                        {on && <Check size={14} />}
                      </button>
                      {!PRESETS.includes(v) && (
                        <button
                          type="button"
                          aria-label={`${v.name} 지우기`}
                          className={s.viewDel}
                          onClick={() => {
                            const next = saved.filter((x) => x !== v)
                            setSaved(next)
                            try {
                              localStorage.setItem(viewsKey(data.projectKey), JSON.stringify(next))
                            } catch {
                              /* 무시 */
                            }
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
                <hr />
                <div className={s.newView}>
                  <Plus size={14} />
                  <input
                    value={newName}
                    placeholder="지금 보기를 새 이름으로 저장"
                    maxLength={30}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveView()}
                  />
                  <button type="button" onClick={saveView} disabled={!newName.trim()}>
                    저장
                  </button>
                </div>
                {/* 명세 확인 필요: 보기 저장 · 프로젝트 공유는 API 가 없어 이 브라우저에만 저장한다 */}
                <small>내가 저장한 보기는 이 브라우저에만 남아요</small>
              </div>
            )}
          </span>
        </span>
      </div>

      {error && <p className={s.error}>{error}</p>}
      <Loadable resource={tl} label="일정표">
        {() =>
          data.tasks.length === 0 && data.milestones.length === 0 ? (
            <Empty>아직 작업이나 마일스톤이 없어요.</Empty>
          ) : (
            <div className={s.frame}>{view === 'GANTT' ? gantt() : view === 'ASSIGNEE' ? byAssignee() : view === 'MILESTONE' ? roadmap() : calendar()}</div>
          )
        }
      </Loadable>

      <div className={s.legend}>
        {view === 'CALENDAR' ? (
          <>
            <span>
              <i className={s.lgDot} />
              작업 기한 (점 = 상태)
            </span>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              마일스톤 기한
            </span>
            <span>
              <i style={{ background: 'var(--surface-tint)' }} />
              회의 · 세미나
            </span>
            <span>
              <i style={{ background: 'var(--status-negative-bg)' }} />
              기한 지남
            </span>
          </>
        ) : (
          <>
            <span>
              <i style={{ background: 'var(--accent-soft)' }} />
              할 일
            </span>
            <span>
              <i style={{ background: 'var(--accent-2)' }} />
              진행 중
            </span>
            <span>
              <i style={{ background: 'var(--status-review)' }} />
              검토
            </span>
            {view !== 'MILESTONE' && (
              <span>
                <i style={{ background: 'var(--surface-card)', boxShadow: 'inset 0 0 0 1.5px var(--status-negative)' }} />
                기한 지남
              </span>
            )}
            <span>
              <i className={s.lgDiamond} />
              마일스톤 기한
            </span>
          </>
        )}
        <em>
          <Info size={14} />
          {view === 'GANTT'
            ? '막대를 누르면 작업 상세로 가요. 기한은 작업 상세에서 바꿔요'
            : view === 'ASSIGNEE'
              ? '빨간 표시는 같은 사람에게 작업이 3줄 이상 겹친 경우예요'
              : view === 'MILESTONE'
                ? '막대 색은 작업 상태 비율이에요. 2주 안에 기한인데 절반도 못 했으면 위험으로 표시해요'
                : '작업을 누르면 작업 상세로 가요'}
        </em>
      </div>
    </Card>
  )
}
