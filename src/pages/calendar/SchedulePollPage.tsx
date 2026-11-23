import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Clock, Info, Kanban, MapPin, TriangleAlert, Users } from 'lucide-react'
import { Avatar, Breadcrumb, Button, Card, Chip, Columns, KeyValue, Loadable, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { ApiError } from '../../api/client'
import { getDataMode } from '../../lib/dataMode'
import { whenLive } from '../../api/useResource'
import { confirmPoll, remindPoll, saveMyPollResponse, slotKeyToIso, useMeetingPoll, type PollView } from '../../api/communication'
import s from './SchedulePollPage.module.css'

/** 시간 단위 숫자 → 'HH:mm' (10.5 → 10:30) */
const pad = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)
/** 칠한 뒤 이만큼 손을 떼면 저장한다 */
const SAVE_DELAY = 800

type Window = { day: number; start: number; keys: string[]; count: number; missing: string[] }

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
  const [confirmed, setConfirmed] = useState<Window | null>(null)
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
  const countAt = (key: string) => people.filter((p) => p.set.has(key)).length

  const windows = useMemo(() => {
    const out: Window[] = []
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

  const first = poll.days[0]
  const last = poll.days[poll.days.length - 1]
  const range = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`

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
              <div className={s.gridBlock}>
                <div className={s.gridHead}>
                  <h3>내 응답</h3>
                  <span>
                    {!canRespond ? '응답을 바꿀 수 없어요' : saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : '끌어서 칠하기'}
                  </span>
                </div>
                <div className={s.table} onPointerLeave={() => (paintMode.current = null)}>
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
                              paintMode.current = !on
                              paint(key, !on)
                            }}
                            onPointerEnter={() => paintMode.current !== null && paint(key, paintMode.current)}
                            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && paint(key, !on)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 결과 */}
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
                            color: alpha >= 0.6 ? 'var(--text-on-dark)' : 'var(--accent)',
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
          </div>

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
        </Card>
      }
      side={
        <>
          <Card>
            <SectionHead icon={Check} title={`추천 시간대 (${durationHours}시간)`} />
            {windows.map((w, i) => (
              <button key={w.keys[0]} type="button" className={i === pick ? `${s.rec} ${s.recOn}` : s.rec} onClick={() => setPick(i)}>
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
              poll.isCreator &&
              poll.status === 'OPEN' && (
                <Button icon={Check} className={s.confirmBtn} onClick={confirmTime}>
                  {pick + 1}번 시간으로 확정
                </Button>
              )
            )}
            <p className={s.note}>확정하면 공용 캘린더에 일정이 생기고 참여 대상 {total}명이 참석자가 돼요.</p>
          </Card>

          <Card>
            <SectionHead icon={Users} title={`아직 응답하지 않음 ${poll.pending.length}명`} />
            <ul className={s.pending}>
              {poll.pending.map((p) => (
                <li key={p.name}>
                  <Avatar name={p.name} size={28} />
                  <span>
                    {p.name} · {p.role}
                  </span>
                  {/* 알림 다시 보내기는 만든 사람만 (MP-5) */}
                  {poll.isCreator && poll.status === 'OPEN' && (
                    <button type="button" onClick={() => remind(p)} disabled={reminded.has(p.name)}>
                      {reminded.has(p.name) ? '보냈어요' : '알림 다시 보내기'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

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
        </>
      }
    />
  )
}

function DateRow({ days }: { days: PollView['days'] }) {
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
