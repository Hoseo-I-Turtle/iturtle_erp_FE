import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Info, Link2, MapPin, Users, X } from 'lucide-react'
import { Button, Card, Checkbox, Chip, Columns, Empty, Field, FormError, FormRow, Loadable, Note, Progress, Segmented, Select, TextArea, TextInput, ToggleChip } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { addDaysYmd } from '../../api/communication'
import { errorText } from '../../api/content'
import { createMeetingPoll, useActiveMembers, useMeetingPollList, type PollDraft, type PollListItem } from '../../api/events'
import { todayKst } from '../../api/projects'
import type { MemberRef } from '../../api/types'
import { getDataMode } from '../../lib/dataMode'
import { monthWeeks, parseYmd, WEEKDAYS, ymd } from '../../lib/date'
import s from './PollCreatePage.module.css'

const TYPES: [MemberRef['memberType'], string][] = [
  ['PROFESSOR', '교수'],
  ['STUDENT', '학생'],
  ['INTERN', '인턴'],
]
const HOURS = Array.from({ length: 33 }, (_, i) => {
  const m = 7 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))
const short = (day: string) => {
  const d = parseYmd(day)
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`
}

/** 모임 날짜 정하기 만들기 (Penpot 06 · 모임 날짜 만들기) — MP-1, MP-2 */
export function PollCreatePage() {
  const navigate = useNavigate()
  const today = todayKst()
  const people = useActiveMembers()
  const members = people.data?.members ?? []
  const meId = people.data?.meId ?? 0
  const [status, setStatus] = useState<PollListItem['status']>('OPEN')
  const polls = useMeetingPollList(status)

  const [f, setF] = useState<PollDraft>({
    title: '',
    description: '',
    candidateDates: [],
    dayStartTime: '10:00',
    dayEndTime: '19:00',
    slotMinutes: 60,
    durationMinutes: 60,
    location: '',
    onlineUrl: '',
    closesDay: addDaysYmd(today, 2),
    closesTime: '18:00',
    all: false,
    memberTypes: [],
    memberIds: [],
  })
  const [includeMe, setIncludeMe] = useState(true)
  const [month, setMonth] = useState(() => new Date(parseYmd(today).getFullYear(), parseYmd(today).getMonth(), 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PollDraft>(k: K, v: PollDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  const toggleDate = (day: string) => {
    if (day < today) return
    if (f.candidateDates.includes(day)) set('candidateDates', f.candidateDates.filter((d) => d !== day))
    else if (f.candidateDates.length < 14) set('candidateDates', [...f.candidateDates, day].sort())
  }

  // 대상 = 전체 ∪ 구분 ∪ 직접 고른 사람 (+ 나)
  const targets = members.filter((m) => f.all || f.memberTypes.includes(m.type) || f.memberIds.includes(m.id) || (includeMe && m.id === meId))
  const slots = Math.max(0, Math.floor((toMin(f.dayEndTime) - toMin(f.dayStartTime)) / f.slotMinutes))
  const durations = Array.from({ length: Math.max(1, Math.floor((toMin(f.dayEndTime) - toMin(f.dayStartTime)) / 30)) }, (_, i) => (i + 1) * 30).slice(0, 12)

  const submit = async () => {
    if (!f.title.trim()) return setError('제목을 적어 주세요.')
    if (f.candidateDates.length === 0) return setError('후보 날짜를 하나 이상 골라 주세요.')
    if (slots <= 0) return setError('하루 끝이 시작보다 뒤여야 해요.')
    if (f.durationMinutes > toMin(f.dayEndTime) - toMin(f.dayStartTime)) return setError('모임 길이가 하루 범위보다 길어요.')
    if (targets.length === 0) return setError('참여 대상을 골라 주세요.')
    setBusy(true)
    setError(null)
    try {
      const draft: PollDraft = { ...f, title: f.title.trim(), memberIds: includeMe && !f.all ? [...new Set([...f.memberIds, meId])] : f.memberIds }
      const id = await createMeetingPoll(draft, getDataMode() === 'live', targets.length)
      // 목업에는 새로 만든 모임의 상세가 없어 목록에 남는 것만 보여 준다
      if (getDataMode() === 'live') navigate(`/calendar/polls/${id}`)
      else {
        setF((p) => ({ ...p, title: '', description: '', candidateDates: [] }))
        setStatus('OPEN')
        setBusy(false)
      }
    } catch (e) {
      setError(errorText(e, '만들지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="모임 날짜 정하기" subtitle="후보 날짜를 올리면 각자 되는 시간을 칠해요" action={null} />
      <Columns
        sideWidth={380}
        main={
          <Card className={s.card}>
            <div className={s.head}>
              <Link to="/calendar">
                <ChevronLeft size={16} />
                캘린더
              </Link>
              <h2>새 모임 날짜 정하기</h2>
              <small>만들면 대상에게 알림이 가요</small>
            </div>
            <Field label="제목" required>
              <TextInput value={f.title} onChange={(v) => set('title', v.slice(0, 100))} placeholder="예: DEFME 중간 점검 회의" />
            </Field>
            <Field label="설명" hint="1,000자 이하">
              <TextArea value={f.description} onChange={(v) => set('description', v.slice(0, 1000))} rows={2} placeholder="무엇을 정하는 모임인지 적어 주세요" />
            </Field>

            <Field label="후보 날짜" required hint="1~14개 · 오늘 이후 · 띄엄띄엄 골라도 돼요">
              <div className={s.dates}>
                <div className={s.cal}>
                  <div className={s.calHead}>
                    <button type="button" aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                      <ChevronLeft size={14} />
                    </button>
                    <strong>
                      {month.getFullYear()}년 {month.getMonth() + 1}월
                    </strong>
                    <button type="button" aria-label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className={s.calGrid}>
                    {WEEKDAYS.map((d) => (
                      <span key={d} className={s.dow}>
                        {d}
                      </span>
                    ))}
                    {monthWeeks(month.getFullYear(), month.getMonth())
                      .flat()
                      .map((d) => {
                        const key = ymd(d)
                        const on = f.candidateDates.includes(key)
                        const off = key < today || d.getMonth() !== month.getMonth()
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={key < today}
                            aria-pressed={on}
                            className={`${on ? s.dayOn : ''} ${off ? s.dayOff : ''} ${key === today ? s.dayToday : ''}`}
                            onClick={() => toggleDate(key)}
                          >
                            {d.getDate()}
                          </button>
                        )
                      })}
                  </div>
                </div>
                <div className={s.picked}>
                  <small>고른 날짜 {f.candidateDates.length}개</small>
                  <div>
                    {f.candidateDates.map((d) => (
                      <button key={d} type="button" onClick={() => toggleDate(d)}>
                        {short(d)}
                        <X size={12} />
                      </button>
                    ))}
                    {f.candidateDates.length === 0 && <em>달력에서 날짜를 눌러 고르세요</em>}
                  </div>
                </div>
              </div>
            </Field>

            <FormRow>
              <Field label="하루 시작" required>
                <Select block value={f.dayStartTime} options={HOURS.map((h) => ({ value: h, label: h }))} onChange={(v) => set('dayStartTime', v)} label="하루 시작" />
              </Field>
              <Field label="하루 끝" required>
                <Select block value={f.dayEndTime} options={HOURS.map((h) => ({ value: h, label: h }))} onChange={(v) => set('dayEndTime', v)} label="하루 끝" />
              </Field>
              <Field label="칸 크기" required>
                <Segmented
                  value={String(f.slotMinutes)}
                  options={[
                    { value: '30', label: '30분' },
                    { value: '60', label: '1시간' },
                  ]}
                  onChange={(v) => set('slotMinutes', v === '30' ? 30 : 60)}
                />
              </Field>
              <Field label="모임 길이" required>
                <Select
                  block
                  value={String(f.durationMinutes)}
                  options={durations.map((m) => ({ value: String(m), label: m % 60 ? `${Math.floor(m / 60) ? `${Math.floor(m / 60)}시간 ` : ''}30분` : `${m / 60}시간` }))}
                  onChange={(v) => set('durationMinutes', Number(v))}
                  label="모임 길이"
                />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="장소">
                <TextInput icon={MapPin} value={f.location} onChange={(v) => set('location', v.slice(0, 200))} placeholder="회의실" />
              </Field>
              <Field label="온라인 링크">
                <TextInput icon={Link2} type="url" value={f.onlineUrl} onChange={(v) => set('onlineUrl', v.slice(0, 500))} placeholder="https://" />
              </Field>
            </FormRow>
            <Field label="응답 마감" required>
              <div className={s.closes}>
                <TextInput type="date" icon={Calendar} value={f.closesDay} min={today} onChange={(v) => set('closesDay', v)} aria-label="응답 마감 날짜" />
                <TextInput type="time" icon={Clock} value={f.closesTime} step={1800} onChange={(v) => set('closesTime', v)} aria-label="응답 마감 시각" />
              </div>
            </Field>

            <Field label="참여 대상" required hint="아래에서 고른 것을 모두 합쳐요 · 재실 구성원만">
              <div className={s.pills}>
                <ToggleChip on={f.all} check icon={Users} onClick={() => set('all', !f.all)}>
                  전체 구성원
                </ToggleChip>
                {TYPES.map(([t, label]) => (
                  <ToggleChip key={t} on={!f.all && f.memberTypes.includes(t)} check disabled={f.all} onClick={() => set('memberTypes', f.memberTypes.includes(t) ? f.memberTypes.filter((x) => x !== t) : [...f.memberTypes, t])}>
                    {label}
                  </ToggleChip>
                ))}
              </div>
              <Loadable resource={people} label="구성원">
                {() => (
                  <div className={s.people}>
                    {members.map((m) => {
                      const auto = f.all || f.memberTypes.includes(m.type)
                      const on = auto || f.memberIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={auto}
                          className={on ? s.personOn : undefined}
                          aria-pressed={on}
                          onClick={() => set('memberIds', f.memberIds.includes(m.id) ? f.memberIds.filter((x) => x !== m.id) : [...f.memberIds, m.id])}
                        >
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Loadable>
              <Checkbox checked={includeMe} onChange={setIncludeMe} className={s.me}>
                나도 대상에 넣기 <small>· 빼면 결과 보기와 확정만 해요</small>
              </Checkbox>
            </Field>

            <FormError>{error}</FormError>
            <div className={s.foot}>
              <span>
                대상 {targets.length}명 · 후보 {f.candidateDates.length}일 × {slots}칸 = {f.candidateDates.length * slots}칸
              </span>
              <Button variant="secondary" onClick={() => navigate('/calendar')}>
                취소
              </Button>
              <Button icon={Check} onClick={submit} disabled={busy}>
                {busy ? '만드는 중…' : '만들고 알림 보내기'}
              </Button>
            </div>
          </Card>
        }
        side={
          <>
            <Card>
              <div className={s.sideHead}>
                <strong>모임 날짜 정하기</strong>
                <Segmented
                  value={status}
                  options={[
                    { value: 'OPEN', label: '진행 중' },
                    { value: 'CONFIRMED', label: '확정' },
                    { value: 'CANCELLED', label: '취소' },
                  ]}
                  onChange={setStatus}
                />
              </div>
              <Loadable resource={polls} label="모임 날짜 목록">
                {(list) =>
                  list.length === 0 ? (
                    <Empty>해당하는 모임이 없어요.</Empty>
                  ) : (
                    <>
                      {list.map((p) => (
                        <Link key={p.pollId} to={`/calendar/polls/${p.pollId}`} className={s.poll}>
                          <span className={s.pollTitle}>
                            <strong>{p.title}</strong>
                            {p.state === 'todo' ? <Chip tone="danger">응답 안 함</Chip> : p.state === 'mine' ? <Chip tone="tint">내가 만듦</Chip> : p.state === 'done' ? <Chip tone="positive">응답함</Chip> : null}
                          </span>
                          <small>{p.confirmed ? `${p.creator} · 확정 ${p.confirmed}` : `${p.creator} · 마감 ${p.closes} · ${p.dday}`}</small>
                          <span className={s.pollBar}>
                            <Progress value={p.targetCount ? (p.respondedCount / p.targetCount) * 100 : 0} height={6} />
                            <b>
                              응답 {p.respondedCount}/{p.targetCount}명
                            </b>
                          </span>
                        </Link>
                      ))}
                    </>
                  )
                }
              </Loadable>
            </Card>
            <Note icon={Info}>확정하면 공용 캘린더에 일정이 만들어지고 대상에게 알림이 가요. 내가 대상이거나 만든 것만 여기에 보여요.</Note>
          </>
        }
      />
    </>
  )
}
