import { useState } from 'react'
import { Check, Clock, SquareCheck } from 'lucide-react'
import { Button, Chip, Progress } from '../../../components/ui'
import { ApiError } from '../../../api/client'
import { whenLive } from '../../../api/useResource'
import { putMyVote, type VoteOptionView, type VoteView } from '../../../api/communication'
import s from '../NoticeDetailPage.module.css'

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** 공지 안 투표: 고르기 · 결과 · 선택 바꾸기 */
export function VoteBox({ noticeId, vote: initial, meName }: { noticeId: number; vote: VoteView; meName: string }) {
  const [vote, setVote] = useState(initial)
  const [options, setOptions] = useState(initial.options)
  // 투표 안 했고 아직 할 수 있으면 바로 고르는 상태로 연다
  const [editing, setEditing] = useState(!initial.voted && initial.canVote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mineCount = options.filter((o) => o.mine).length
  // 내가 고른 것이 생기거나 없어지면 참여 인원도 함께 바뀐다
  const participants = vote.participantCount - (vote.voted ? 1 : 0) + (mineCount > 0 ? 1 : 0)
  const counts = options.map((o) => o.count ?? 0)
  const maxVotes = Math.max(...counts)

  const toggle = (id: string) => {
    if (!editing) return
    setOptions((prev) => {
      const picked = prev.filter((o) => o.mine).length
      return prev.map((o): VoteOptionView => {
        if (o.id === id) {
          if (!o.mine && vote.multiple && vote.maxChoices && picked >= vote.maxChoices) return o
          return o.mine ? unpick(o) : pick(o)
        }
        if (!vote.multiple && o.mine) return unpick(o)
        return o
      })
    })
  }
  const pick = (o: VoteOptionView): VoteOptionView => ({
    ...o,
    mine: true,
    count: o.count === null ? null : o.count + 1,
    voters: vote.named ? [meName, ...o.voters] : o.voters,
  })
  const unpick = (o: VoteOptionView): VoteOptionView => ({
    ...o,
    mine: false,
    count: o.count === null ? null : Math.max(0, o.count - 1),
    voters: o.voters.filter((v) => v !== meName),
  })

  const finish = async () => {
    const picked = options.filter((o) => o.mine).map((o) => o.id)
    if (picked.length === 0) return setError('하나 이상 골라 주세요.')
    setError('')
    setSaving(true)
    try {
      const next = await whenLive(() => putMyVote(noticeId, picked))
      if (next) {
        setVote(next)
        setOptions(next.options)
      } else {
        setVote((v) => ({ ...v, voted: true, participantCount: participants }))
      }
      setEditing(false)
    } catch (err) {
      setOptions(vote.options)
      setError(errText(err, '투표를 저장하지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    setError('')
    setEditing(true)
  }

  return (
    <section className={s.vote}>
      <div className={s.voteHead}>
        <SquareCheck size={20} />
        <h3>{vote.question}</h3>
        <span className={s.voteHeadChips}>
          <Chip tone="tint" className={s.whiteChip}>
            {vote.multiple ? (vote.maxChoices ? `최대 ${vote.maxChoices}개 선택` : '복수 선택') : '단일 선택'} · {vote.named ? '기명' : '익명'}
          </Chip>
          <Chip tone="warning" icon={Clock}>
            마감 {vote.dday}
          </Chip>
        </span>
      </div>

      {options.map((o) => {
        const pct = vote.eligible && o.count !== null ? Math.round((o.count / vote.eligible) * 100) : 0
        const shown = o.voters.slice(0, 4)
        const rest = (o.count ?? o.voters.length) - shown.length
        return (
          <button
            key={o.id}
            type="button"
            className={o.mine ? `${s.option} ${s.optionMine}` : s.option}
            onClick={() => toggle(o.id)}
            aria-pressed={o.mine}
            disabled={!editing || saving}
          >
            <span className={s.optionTop}>
              <span className={o.mine ? `${s.box} ${s.boxOn}` : s.box}>{o.mine && <Check size={14} strokeWidth={3} />}</span>
              <span className={s.optionLabel}>{o.label}</span>
              {/* 결과 공개 전이면 숫자가 오지 않는다 */}
              <span className={s.optionCount}>{o.count === null ? '결과 비공개' : `${o.count}명 · ${pct}%`}</span>
            </span>
            {o.count !== null && (
              <Progress value={pct} height={6} color={o.count === maxVotes ? 'var(--brand-400)' : 'var(--brand-200)'} />
            )}
            {vote.named && shown.length > 0 && (
              <span className={s.optionVoters}>
                {shown.join(', ')}
                {rest > 0 && ` 외 ${rest}명`}
              </span>
            )}
          </button>
        )
      })}

      <div className={s.voteFoot}>
        <span>
          {vote.eligible}명 중 {participants}명 참여
          {vote.canChange ? ' · 마감 전까지 바꿀 수 있어요' : !vote.named && vote.voted ? ' · 익명 투표는 바꿀 수 없어요' : ''}
        </span>
        {editing ? (
          <Button variant="primary" onClick={finish} disabled={saving}>
            투표 완료
          </Button>
        ) : (
          (vote.canChange || vote.canVote) && (
            <Button variant="secondary" onClick={startEdit}>
              {vote.voted ? '선택 바꾸기' : '투표하기'}
            </Button>
          )
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--status-negative)', marginTop: 6 }}>
          {error}
        </p>
      )}
    </section>
  )
}
