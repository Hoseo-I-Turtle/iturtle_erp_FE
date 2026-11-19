import type { CalEvent } from '../../../mocks/calendar'
import { barColor, eventMeta } from './eventStyle'
import s from '../CalendarPage.module.css'

/** 일정 한 줄: 색 막대 · 제목 · 시간/장소 */
export function EventRow({ e, compact }: { e: CalEvent; compact?: boolean }) {
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
