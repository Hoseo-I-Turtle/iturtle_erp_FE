import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ChevronLeft, ChevronRight, ClipboardList, LayoutGrid, Plus, Users } from 'lucide-react'
import { Button, Card, Checkbox, Columns, Loadable, Segmented, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { addDays, formatLongDay, formatShortDay, monthWeeks, parseYmd, WEEKDAYS, ymd } from '../../lib/date'
import { KIND_META, LAYER_META, type CalEvent, type EventLayer } from '../../mocks/calendar'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import { saveCalendarSettings, useCalendarEvents, useCalendarSettings, type CalendarSettings } from '../../api/communication'
import { EventCreateModal } from './EventCreateModal'
import s from './CalendarPage.module.css'

type View = 'month' | 'week' | 'day' | 'list'
const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
  { value: 'list', label: '목록' },
]

/** 일정 칩 색 — 공용은 종류 색, 나머지는 레이어 색 */
function chipStyle(e: CalEvent) {
  if (e.layer === 'public') {
    const c = KIND_META[e.kind].color
    return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }
  }
  if (e.layer === 'personal') return { background: 'rgba(128,170,211,0.35)', color: 'var(--accent)' }
  if (e.layer === 'member') return { background: 'var(--surface-disabled)', color: 'var(--text-disabled)' }
  return { background: 'var(--surface-disabled)', color: 'var(--text-muted)' }
}
function barColor(e: CalEvent) {
  return e.layer === 'public' ? KIND_META[e.kind].color : LAYER_META[e.layer].color
}
function eventMeta(e: CalEvent) {
  return [
    e.time ?? '하루 종일',
    LAYER_META[e.layer].short,
    e.place,
    e.attendees && `참석 ${e.attendees}명`,
    e.note,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function CalendarPage() {
  const settings = useCalendarSettings()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  return (
    <>
      <PageHeader
        title="캘린더"
        subtitle="연구실 공용 일정과 내 일정"
        action={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Button variant="secondary" icon={Users} onClick={() => navigate('/calendar/polls/new')}>
              모임 날짜 정하기
            </Button>
            <Button icon={Plus} onClick={() => setAdding(true)}>
              일정 추가
            </Button>
          </span>
        }
      />
      {adding && <EventCreateModal onClose={() => setAdding(false)} onCreated={() => setAdding(false)} />}
      <Loadable resource={settings} label="캘린더 설정">
        {(st) => <CalendarView settings={st} />}
      </Loadable>
    </>
  )
}

/** 보기 체크 → 내 캘린더 설정 (개인 일정 층은 설정에 없어 화면에서만 끈다) */
const toSettings = (layers: Record<EventLayer, boolean>, onlyMine: boolean): CalendarSettings => ({
  showShared: layers.public,
  sharedScope: onlyMine ? 'ATTENDING_ONLY' : 'ALL',
  showMemberEvents: layers.member,
  showTaskDue: layers.task,
})

function CalendarView({ settings }: { settings: CalendarSettings }) {
  const [today] = useState(() => new Date())
  const todayKey = ymd(today)

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState<View>('month')
  const [layers, setLayers] = useState<Record<EventLayer, boolean>>({
    public: settings.showShared,
    personal: true,
    member: settings.showMemberEvents,
    task: settings.showTaskDue,
  })
  const [onlyMine, setOnlyMine] = useState(settings.sharedScope === 'ATTENDING_ONLY')
  const [saveError, setSaveError] = useState('')

  // 보기 체크를 바꾸면 바로 반영하고 설정에 저장한다. 실패하면 되돌린다
  const changeView = (nextLayers: Record<EventLayer, boolean>, nextOnlyMine: boolean) => {
    const prev = { layers, onlyMine }
    setLayers(nextLayers)
    setOnlyMine(nextOnlyMine)
    setSaveError('')
    if (nextLayers.personal !== layers.personal) return
    whenLive(() => saveCalendarSettings(toSettings(nextLayers, nextOnlyMine))).catch((e) => {
      setLayers(prev.layers)
      setOnlyMine(prev.onlyMine)
      setSaveError(e instanceof ApiError ? e.message : '보기 설정을 저장하지 못했어요.')
    })
  }

  const weeks = monthWeeks(cursor.getFullYear(), cursor.getMonth())
  // 달력에 보이는 칸 전체 기간으로 부른다 (최대 6주)
  const range = useCalendarEvents(ymd(weeks[0][0]), ymd(weeks[weeks.length - 1][6]))
  const events = range.data

  const visible = useMemo(
    () => (events ?? []).filter((e) => layers[e.layer] && !(onlyMine && e.layer === 'public' && !e.mine)),
    [events, layers, onlyMine],
  )
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of visible) m.set(e.date, [...(m.get(e.date) ?? []), e])
    for (const list of m.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    return m
  }, [visible])

  const selectedKey = ymd(selected)
  const shownWeeks = view === 'week' ? weeks.filter((w) => w.some((d) => ymd(d) === selectedKey)) : weeks
  const selectedEvents = byDate.get(selectedKey) ?? []

  const move = (dir: -1 | 1) => {
    if (view === 'week' || view === 'day') {
      const next = addDays(selected, dir * (view === 'week' ? 7 : 1))
      setSelected(next)
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1))
    } else {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
    }
  }
  const goToday = () => {
    setSelected(today)
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const monthEvents = visible
    .filter((e) => {
      const d = parseYmd(e.date)
      return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()
    })
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))

  return (
    <>
      <Columns
        sideWidth={300}
        main={
          <Card className={s.calendar}>
            <div className={s.toolbar}>
              <Button variant="icon" icon={ChevronLeft} aria-label="이전" onClick={() => move(-1)} />
              <h2 className={s.month}>
                {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
              </h2>
              <Button variant="icon" icon={ChevronRight} aria-label="다음" onClick={() => move(1)} />
              <Button variant="tint" onClick={goToday}>
                오늘
              </Button>
              <span className={s.spacer} />
              <Segmented value={view} options={VIEWS} onChange={setView} />
            </div>
            {range.loading && <p className={s.empty} aria-busy="true">일정을 불러오는 중…</p>}
            {range.error && (
              <p className={s.empty} role="alert">
                일정을 불러오지 못했어요: {range.error}{' '}
                <Button variant="tint" onClick={range.reload}>
                  다시 시도
                </Button>
              </p>
            )}

            {(view === 'month' || view === 'week') && (
              <>
                <div className={s.weekdays}>
                  {WEEKDAYS.map((w, i) => (
                    <div key={w} className={i === 0 ? s.sun : undefined}>
                      {w}
                    </div>
                  ))}
                </div>
                <div className={s.grid}>
                  {shownWeeks.map((week) => (
                    <div key={ymd(week[0])} className={view === 'week' ? `${s.week} ${s.weekTall}` : s.week}>
                      {week.map((d) => {
                        const key = ymd(d)
                        const outside = d.getMonth() !== cursor.getMonth()
                        const cls = [
                          s.day,
                          key === todayKey && s.isToday,
                          key === selectedKey && s.isSelected,
                          outside && s.outside,
                        ]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <div
                            key={key}
                            className={cls}
                            onClick={() => setSelected(d)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setSelected(d)}
                          >
                            <span className={`${s.dayNum} ${d.getDay() === 0 && !outside ? s.sun : ''}`}>
                              {d.getDate()}
                            </span>
                            {(byDate.get(key) ?? []).map((e) => (
                              <span key={e.id} className={s.event} style={chipStyle(e)}>
                                {e.title}
                                {e.time && e.layer !== 'member' && ` ${e.time}`}
                              </span>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}

            {view === 'day' && (
              <div className={s.listView}>
                <h3 className={s.listDate}>{formatLongDay(selected)}</h3>
                {selectedEvents.length === 0 && <p className={s.empty}>일정이 없어요.</p>}
                {selectedEvents.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </div>
            )}

            {view === 'list' && (
              <div className={s.listView}>
                {monthEvents.length === 0 && <p className={s.empty}>이 달에는 일정이 없어요.</p>}
                {monthEvents.map((e, i) => (
                  <div key={e.id}>
                    {(i === 0 || monthEvents[i - 1].date !== e.date) && (
                      <h3 className={s.listDate}>{formatShortDay(parseYmd(e.date))}</h3>
                    )}
                    <EventRow e={e} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        }
        side={
          <>
            <Card className={s.side}>
              <SectionHead icon={LayoutGrid} title="보기" />
              {(Object.keys(LAYER_META) as EventLayer[]).map((l) => (
                <Checkbox
                  key={l}
                  checked={layers[l]}
                  color={LAYER_META[l].color}
                  onChange={(v) => changeView({ ...layers, [l]: v }, onlyMine)}
                >
                  <span className={s.layerText}>
                    <strong>{LAYER_META[l].label}</strong>
                    <small>{LAYER_META[l].desc}</small>
                  </span>
                </Checkbox>
              ))}
              <Checkbox checked={onlyMine} onChange={(v) => changeView(layers, v)}>
                <span className={s.layerText}>
                  <strong>내가 참석자인 공용 일정만</strong>
                </span>
              </Checkbox>
              {saveError && (
                <p className={s.empty} role="alert">
                  {saveError}
                </p>
              )}
            </Card>

            <Card>
              <SectionHead title="일정 종류" />
              <div className={s.legend}>
                {Object.values(KIND_META).map((k) => (
                  <span key={k.label} className={s.legendItem}>
                    <i style={{ background: k.color }} />
                    {k.label}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHead icon={Calendar} title={formatLongDay(selected)} />
              {selectedEvents.length === 0 && <p className={s.empty}>일정이 없어요.</p>}
              {selectedEvents.map((e) => (
                <EventRow key={e.id} e={e} compact />
              ))}
              {/* 명세 확인 필요: POST /meeting-minutes 는 참석자 · 프로젝트 키가 필요하고 연구실 회의록 화면 경로가 없어 아직 연결하지 않음 */}
              <Button variant="tint" icon={ClipboardList} className={s.minutesBtn}>
                이 날 회의록 만들기
              </Button>
            </Card>
          </>
        }
      />
    </>
  )
}

function EventRow({ e, compact }: { e: CalEvent; compact?: boolean }) {
  return (
    <div className={compact ? `${s.row} ${s.rowCompact}` : s.row}>
      <span className={s.rowBar} style={{ background: barColor(e) }} />
      <div className={s.rowText}>
        <div className={s.rowTitle}>{e.title}</div>
        <div className={s.rowMeta}>{eventMeta(e)}</div>
      </div>
    </div>
  )
}
