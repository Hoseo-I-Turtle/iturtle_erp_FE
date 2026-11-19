import type { MutableRefObject } from 'react'
import type { PollView } from '../../../api/communication'
import { DateRow } from './DateRow'
import { pad } from './time'
import s from '../SchedulePollPage.module.css'

type Props = {
  poll: PollView
  mine: Set<string>
  canRespond: boolean
  saveState: 'idle' | 'saving' | 'saved'
  /** 끌어서 칠하는 중이면 칠할 값 (true 칠하기 · false 지우기), 아니면 null */
  paintModeRef: MutableRefObject<boolean | null>
  paint: (key: string, value: boolean) => void
}

/** 내 응답: 가능한 칸을 끌어서 칠한다 (개인 일정 칸은 나만 보임) */
export function MyAvailabilityGrid({ poll, mine, canRespond, saveState, paintModeRef, paint }: Props) {
  return (
    <div className={s.gridBlock}>
      <div className={s.gridHead}>
        <h3>내 응답</h3>
        <span>
          {!canRespond ? '응답을 바꿀 수 없어요' : saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : '끌어서 칠하기'}
        </span>
      </div>
      <div className={s.table} onPointerLeave={() => (paintModeRef.current = null)}>
        <DateRow days={poll.days} />
        {poll.hours.map((h) => (
          <div key={h} className={s.row}>
            <span className={s.time}>{pad(h)}</span>
            {poll.days.map((_, d) => {
              const key = `${d}-${h}`
              if (key in poll.myBusy)
                return (
                  <span key={key} className={`${s.cell} ${s.busy}`} title="내 개인 일정 (나만 보임)">
                    {poll.myBusy[key]}
                  </span>
                )
              const on = mine.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${poll.days[d].label} ${pad(h)}`}
                  className={`${s.cell} ${on ? s.mineOn : s.mineOff}`}
                  disabled={!canRespond}
                  onPointerDown={(e) => {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                    paintModeRef.current = !on
                    paint(key, !on)
                  }}
                  onPointerEnter={() => paintModeRef.current !== null && paint(key, paintModeRef.current)}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && paint(key, !on)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
