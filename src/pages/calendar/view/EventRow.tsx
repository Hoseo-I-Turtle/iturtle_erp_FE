import { eventRefOf, openEventEditor } from '../../../api/calendarEvents'
import type { CalEvent } from '../../../mocks/calendar'
import { barColor, eventMeta } from './eventStyle'
import s from '../CalendarPage.module.css'

/** 일정 한 줄: 색 막대 · 제목 · 시간/장소. 공용 · 내 일정은 누르면 고치기 창이 열린다 */
export function EventRow({ e, compact }: { e: CalEvent; compact?: boolean }) {
  const ref = e.layer === 'public' || e.layer === 'personal' ? eventRefOf(e.id) : null
  const body = (
    <>
      <span className={s.rowBar} style={{ background: barColor(e) }} />
      <div className={s.rowText}>
        <div className={s.rowTitle}>{e.title}</div>
        <div className={s.rowMeta}>{eventMeta(e)}</div>
      </div>
    </>
  )
  const cls = compact ? `${s.row} ${s.rowCompact}` : s.row
  return ref ? (
    <button type="button" className={`${cls} ${s.rowButton}`} onClick={() => openEventEditor(ref)} title="눌러서 보기 · 고치기">
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
