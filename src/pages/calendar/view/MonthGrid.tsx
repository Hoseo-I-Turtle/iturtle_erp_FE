import { WEEKDAYS, ymd } from '../../../lib/date'
import { openEventEditor } from '../../../api/calendarEvents'
import type { CalEvent } from '../../../mocks/calendar'
import { chipStyle } from './eventStyle'
import s from '../CalendarPage.module.css'

type Props = {
  /** 보여 줄 주 (월 보기는 전체, 주 보기는 고른 날의 주) */
  weeks: Date[][]
  cursor: Date
  view: 'month' | 'week'
  todayKey: string
  selectedKey: string
  byDate: Map<string, CalEvent[]>
  onSelect: (d: Date) => void
}

/** 월 · 주 보기: 요일 머리 + 날짜 칸 (칸 안에 일정 칩) */
export function MonthGrid({ weeks, cursor, view, todayKey, selectedKey, byDate, onSelect }: Props) {
  return (
    <>
      <div className={s.weekdays}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? s.sun : undefined}>
            {w}
          </div>
        ))}
      </div>
      <div className={s.grid}>
        {weeks.map((week) => (
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
                  onClick={() => onSelect(d)}
                  onDoubleClick={() => openEventEditor({ date: key })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(d)}
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
  )
}
