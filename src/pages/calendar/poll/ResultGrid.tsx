import type { PollView } from '../../../api/communication'
import { DateRow } from './DateRow'
import { pad, type PollPerson } from './time'
import s from '../SchedulePollPage.module.css'

type Props = {
  poll: PollView
  people: PollPerson[]
  respondents: number
  total: number
  /** 추천 시간대로 강조할 칸 */
  highlighted: Set<string>
}

/** 전체 결과: 칸마다 가능 인원 (진할수록 많음) */
export function ResultGrid({ poll, people, respondents, total, highlighted }: Props) {
  const countAt = (key: string) => people.filter((p) => p.set.has(key)).length
  return (
    <div className={s.gridBlock}>
      <div className={s.gridHead}>
        <h3>전체 결과</h3>
        <span>
          {total}명 중 {respondents}명 응답
        </span>
      </div>
      <div className={s.table}>
        <DateRow days={poll.days} />
        {poll.hours.map((h) => (
          <div key={h} className={s.row}>
            <span className={s.time}>{pad(h)}</span>
            {poll.days.map((_, d) => {
              const key = `${d}-${h}`
              const n = countAt(key)
              const alpha = Math.max(0.06, respondents ? n / respondents : 0)
              return (
                <span
                  key={key}
                  className={`${s.cell} ${s.heat} ${highlighted.has(key) ? s.recommended : ''}`}
                  style={{
                    background: `rgba(63, 101, 147, ${alpha})`,
                    color: alpha >= 0.6 ? 'var(--text-on-dark)' : 'var(--brand-500)',
                  }}
                  title={people
                    .filter((p) => p.set.has(key))
                    .map((p) => p.name)
                    .join(', ')}
                >
                  {n}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
