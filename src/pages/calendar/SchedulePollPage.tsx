import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock, Kanban, MapPin, TriangleAlert } from 'lucide-react'
import { Breadcrumb, Card, Chip, Columns, Loadable } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { ApiError } from '../../api/client'
import { getDataMode } from '../../lib/dataMode'
import { whenLive } from '../../api/useResource'
import { confirmPoll, remindPoll, saveMyPollResponse, slotKeyToIso, useMeetingPoll, type PollView } from '../../api/communication'
import { MyAvailabilityGrid } from './poll/MyAvailabilityGrid'
import { PendingCard, PollInfoCard, PollLegend, RecommendCard } from './poll/PollSideCards'
import { ResultGrid } from './poll/ResultGrid'
import { pad, type PollWindow } from './poll/time'
import s from './SchedulePollPage.module.css'

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)
/** 칠한 뒤 이만큼 손을 떼면 저장한다 */
const SAVE_DELAY = 800

export function SchedulePollPage() {
  const { id } = useParams()
  const poll = useMeetingPoll(id)
  return (
    <>
      <PageHeader title="모임 날짜 정하기" subtitle="가능한 시간을 칠하면 모두가 되는 시간을 찾아 드려요" action={null} />
      <Loadable resource={poll} label="모임 날짜 정하기">
        {(p) => <PollBody key={p.id} poll={p} reload={poll.reload} />}
      </Loadable>
    </>
  )
}

function PollBody({ poll, reload }: { poll: PollView; reload: () => void }) {
  const ME = poll.meName
  const [mine, setMine] = useState(() => new Set(poll.myAvailability))
  const [pick, setPick] = useState(0)
  const [confirmed, setConfirmed] = useState<PollWindow | null>(null)
  const [reminded, setReminded] = useState<Set<string>>(() => new Set())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  // 확정 · 취소됐거나 마감이 지나면 응답을 바꿀 수 없다 (MP-4 CL014 · CL015)
  const canRespond = poll.iAmTarget && poll.status === 'OPEN' && !poll.closed
  const durationHours = poll.durationSlots * poll.slotHours
  const slotLabel = poll.slotHours >= 1 ? `${poll.slotHours}시간 칸` : `${Math.round(poll.slotHours * 60)}분 칸`

  /* ---- 끌어서 칠하기 ---- */
  const paintMode = useRef<boolean | null>(null)
  useEffect(() => {
    const stop = () => (paintMode.current = null)
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])
  const paint = (key: string, value: boolean) => {
    if (!canRespond) return
    setMine((prev) => {
      if (prev.has(key) === value) return prev
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  }

  /* ---- 내 응답 저장 (MP-4, 실서버만 · 칠하기를 멈추면) ---- */
  const savedRef = useRef(mine)
  useEffect(() => {
    if (getDataMode() !== 'live' || mine === savedRef.current) return
    const timer = window.setTimeout(() => {
      const snapshot = mine
      setSaveState('saving')
      saveMyPollResponse(poll.pollId, [...snapshot].map((k) => slotKeyToIso(poll, k)))
        .then(() => {
          savedRef.current = snapshot
          setSaveState('saved')
          setError('')
        })
        .catch((e) => {
          setMine(savedRef.current)
          setSaveState('idle')
          setError(errText(e, '응답을 저장하지 못했어요.'))
        })
    }, SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [mine, poll])

  /* ---- 집계 ---- */
  const people = useMemo(
    () =>
      [...poll.others, ...(poll.iAmTarget ? [{ name: ME, role: '', availability: [...mine] }] : [])].map((p) => ({
        ...p,
        set: new Set(p.availability),
      })),
    [mine, poll, ME],
  )
  const respondents = people.length
  const total = poll.targetCount ?? poll.others.length + 1 + poll.pending.length

  const windows = useMemo(() => {
    const out: PollWindow[] = []
    poll.days.forEach((_, d) => {
      for (let i = 0; i + poll.durationSlots <= poll.hours.length; i++) {
        const keys = poll.hours.slice(i, i + poll.durationSlots).map((h) => `${d}-${h}`)
        const ok = people.filter((p) => keys.every((k) => p.set.has(k)))
        out.push({
          day: d,
          start: poll.hours[i],
          keys,
          count: ok.length,
          missing: people.filter((p) => !ok.includes(p)).map((p) => p.name),
        })
      }
    })
    return out.sort((a, b) => b.count - a.count || a.day - b.day || a.start - b.start).slice(0, 3)
  }, [people, poll])

  const chosen = windows[Math.min(pick, windows.length - 1)]
  const highlighted = new Set(chosen?.keys)

  // 서버에서 이미 확정된 시간
  const confirmedKey = confirmed ? confirmed.keys[0] : poll.confirmedKey
  const confirmedLabel = (() => {
    if (!confirmedKey) return null
    const [d, h] = confirmedKey.split('-').map(Number)
    return `${poll.days[d].long} ${pad(h)}`
  })()

  const confirmTime = async () => {
    if (!chosen) return
    setError('')
    try {
      await whenLive(() => confirmPoll(poll.pollId, slotKeyToIso(poll, chosen.keys[0])))
      setConfirmed(chosen)
    } catch (e) {
      setError(errText(e, '시간을 확정하지 못했어요.'))
      reload()
    }
  }

  const remind = async (p: { name: string; memberId?: number }) => {
    setReminded((prev) => new Set(prev).add(p.name))
    try {
      await whenLive(() => remindPoll(poll.pollId, p.memberId ? [p.memberId] : undefined))
    } catch (e) {
      setReminded((prev) => {
        const next = new Set(prev)
        next.delete(p.name)
        return next
      })
      setError(errText(e, '알림을 보내지 못했어요.'))
    }
  }

  return (
    <Columns
      sideWidth={380}
      main={
        <Card className={s.poll}>
          <Breadcrumb items={[{ label: '캘린더', to: '/calendar' }, { label: '모임 날짜 정하기' }]} />
          <h2 className={s.title}>{poll.title}</h2>
          <div className={s.chips}>
            {poll.project && (
              <Chip tone="tint" icon={Kanban}>
                프로젝트 · {poll.project}
              </Chip>
            )}
            <Chip tone="tint" icon={Clock}>
              모임 길이 {durationHours}시간
            </Chip>
            {poll.place && (
              <Chip tone="tint" icon={MapPin}>
                {poll.place}
              </Chip>
            )}
            <Chip tone="warning" icon={TriangleAlert}>
              응답 마감 {poll.deadline}
            </Chip>
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--status-negative)', margin: '8px 0' }}>
              {error}
            </p>
          )}

          <div className={s.grids}>
            {/* 내 응답 */}
            {poll.iAmTarget && (
              <MyAvailabilityGrid poll={poll} mine={mine} canRespond={canRespond} saveState={saveState} paintModeRef={paintMode} paint={paint} />
            )}

            {/* 전체 결과 */}
            <ResultGrid poll={poll} people={people} respondents={respondents} total={total} highlighted={highlighted} />
          </div>

          <PollLegend />
        </Card>
      }
      side={
        <>
          <RecommendCard
            poll={poll}
            windows={windows}
            pick={pick}
            onPick={setPick}
            durationHours={durationHours}
            respondents={respondents}
            total={total}
            confirmedLabel={confirmedLabel}
            canConfirm={poll.isCreator && poll.status === 'OPEN'}
            onConfirm={confirmTime}
          />
          <PendingCard pending={poll.pending} canRemind={poll.isCreator && poll.status === 'OPEN'} reminded={reminded} onRemind={remind} />
          <PollInfoCard poll={poll} slotLabel={slotLabel} />
        </>
      }
    />
  )
}
