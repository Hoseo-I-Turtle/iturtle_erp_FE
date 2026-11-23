import { formatLongDay, formatShortDay, parseYmd } from '../../../lib/date'
import type { CalEvent } from '../../../mocks/calendar'
import { EventRow } from './EventRow'
import s from '../CalendarPage.module.css'

/** 일 보기: 고른 날의 일정 */
export function DayList({ selected, selectedEvents }: { selected: Date; selectedEvents: CalEvent[] }) {
  return (
    <div className={s.listView}>
      <h3 className={s.listDate}>{formatLongDay(selected)}</h3>
      {selectedEvents.length === 0 && <p className={s.empty}>일정이 없어요.</p>}
      {selectedEvents.map((e) => (
        <EventRow key={e.id} e={e} />
      ))}
    </div>
  )
}

/** 목록 보기: 이 달 일정을 날짜별로 */
export function MonthList({ monthEvents }: { monthEvents: CalEvent[] }) {
  return (
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
  )
}
