import { Check, Info, Users } from 'lucide-react'
import { Avatar, Button, Card, KeyValue, SectionHead } from '../../../components/ui'
import type { PollView } from '../../../api/communication'
import { pad, type PollWindow } from './time'
import s from '../SchedulePollPage.module.css'

/** 칸 색 설명 */
export function PollLegend() {
  return (
    <div className={s.legend}>
      <span>
        <i className={s.swMine} />
        내가 가능
      </span>
      <span>
        <i className={s.swBusy} />내 개인 일정 (나만 보임)
      </span>
      <span>
        <i className={s.swHeat} />
        가능 인원 (진할수록 많음)
      </span>
      <span>
        <i className={s.swRec} />
        추천 시간대
      </span>
    </div>
  )
}

type RecommendProps = {
  poll: PollView
  windows: PollWindow[]
  pick: number
  onPick: (i: number) => void
  durationHours: number
  respondents: number
  total: number
  confirmedLabel: string | null
  /** 확정은 만든 사람만, 열려 있을 때만 (MP-6) */
  canConfirm: boolean
  onConfirm: () => void
}

/** 추천 시간대 · 확정 */
export function RecommendCard({ poll, windows, pick, onPick, durationHours, respondents, total, confirmedLabel, canConfirm, onConfirm }: RecommendProps) {
  return (
    <Card>
      <SectionHead icon={Check} title={`추천 시간대 (${durationHours}시간)`} />
      {windows.map((w, i) => (
        <button key={w.keys[0]} type="button" className={i === pick ? `${s.rec} ${s.recOn}` : s.rec} onClick={() => onPick(i)}>
          <span className={s.rank}>{i + 1}</span>
          <span className={s.recText}>
            <strong>
              {poll.days[w.day].long} {pad(w.start)} – {pad(w.start + durationHours)}
            </strong>
            <small>{w.missing.length === 0 ? '응답한 모두 가능' : `${w.missing.join(', ')} 불가`}</small>
          </span>
          <span className={s.recCount}>
            {w.count}/{respondents}명
          </span>
        </button>
      ))}
      {confirmedLabel ? (
        <p className={s.confirmed}>
          <Check size={16} /> {confirmedLabel}으로 확정했어요
        </p>
      ) : (
        // 확정은 만든 사람만 (MP-6)
        canConfirm && (
          <Button icon={Check} className={s.confirmBtn} onClick={onConfirm}>
            {pick + 1}번 시간으로 확정
          </Button>
        )
      )}
      <p className={s.note}>확정하면 공용 캘린더에 일정이 생기고 참여 대상 {total}명이 참석자가 돼요.</p>
    </Card>
  )
}

type PendingProps = {
  pending: PollView['pending']
  /** 알림 다시 보내기는 만든 사람만 (MP-5) */
  canRemind: boolean
  reminded: Set<string>
  onRemind: (p: PollView['pending'][number]) => void
}

/** 아직 응답하지 않은 사람 · 알림 다시 보내기 */
export function PendingCard({ pending, canRemind, reminded, onRemind }: PendingProps) {
  return (
    <Card>
      <SectionHead icon={Users} title={`아직 응답하지 않음 ${pending.length}명`} />
      <ul className={s.pending}>
        {pending.map((p) => (
          <li key={p.name}>
            <Avatar name={p.name} size={28} />
            <span>
              {p.name} · {p.role}
            </span>
            {/* 알림 다시 보내기는 만든 사람만 (MP-5) */}
            {canRemind && (
              <button type="button" onClick={() => onRemind(p)} disabled={reminded.has(p.name)}>
                {reminded.has(p.name) ? '보냈어요' : '알림 다시 보내기'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** 모임 정보: 만든 사람 · 대상 · 후보 범위 · 마감 */
export function PollInfoCard({ poll, slotLabel }: { poll: PollView; slotLabel: string }) {
  const first = poll.days[0]
  const last = poll.days[poll.days.length - 1]
  const range = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`
  return (
    <Card>
      <SectionHead icon={Info} title="정보" />
      <KeyValue
        items={[
          ['만든 사람', poll.creator],
          ['참여 대상', poll.audience],
          [
            '후보',
            `${range(first.key)} – ${range(last.key)} · ${pad(poll.hours[0])} – ${pad(poll.hours.at(-1)! + poll.slotHours)} · ${slotLabel}`,
          ],
          ['마감', `${poll.deadline} · ${poll.dday}`],
        ]}
      />
    </Card>
  )
}
