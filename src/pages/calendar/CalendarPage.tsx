import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button, Card, Columns, Loadable, Segmented } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { addDays, monthWeeks, parseYmd, ymd } from '../../lib/date'
import type { CalEvent, EventLayer } from '../../mocks/calendar'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import { saveCalendarSettings, useCalendarEvents, useCalendarSettings, type CalendarSettings } from '../../api/communication'
import { KindLegendCard, LayerFilterCard, SelectedDayCard } from './view/CalendarSideCards'
import { DayList, MonthList } from './view/EventLists'
import { MonthGrid } from './view/MonthGrid'
import s from './CalendarPage.module.css'

type View = 'month' | 'week' | 'day' | 'list'
const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: '월' },
  { value: 'week', label: '주' },
  { value: 'day', label: '일' },
  { value: 'list', label: '목록' },
]

export function CalendarPage() {
  const settings = useCalendarSettings()
  return (
    <>
      <PageHeader
        title="캘린더"
        subtitle="연구실 공용 일정과 내 일정"
        action={<Button icon={Plus}>일정 추가</Button>}
      />
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
              <MonthGrid
                weeks={shownWeeks}
                cursor={cursor}
                view={view}
                todayKey={todayKey}
                selectedKey={selectedKey}
                byDate={byDate}
                onSelect={setSelected}
              />
            )}

            {view === 'day' && <DayList selected={selected} selectedEvents={selectedEvents} />}

            {view === 'list' && <MonthList monthEvents={monthEvents} />}
          </Card>
        }
        side={
          <>
            <LayerFilterCard layers={layers} onlyMine={onlyMine} saveError={saveError} onChange={changeView} />
            <KindLegendCard />
            <SelectedDayCard selected={selected} selectedEvents={selectedEvents} />
          </>
        }
      />
    </>
  )
}
