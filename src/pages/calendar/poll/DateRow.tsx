import type { PollView } from '../../../api/communication'
import s from '../SchedulePollPage.module.css'

/** 표 맨 위 날짜 줄 */
export function DateRow({ days }: { days: PollView['days'] }) {
  return (
    <div className={s.row}>
      <span className={s.time} />
      {days.map((d) => (
        <span key={d.key} className={s.date}>
          {d.label}
        </span>
      ))}
    </div>
  )
}
