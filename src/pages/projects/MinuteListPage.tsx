import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, ChevronDown, Clock, ListChecks, Search, Users } from 'lucide-react'
import { AvatarStack, Card, Checkbox, Chip, Columns, Empty, Loadable, Progress, SectionHead } from '../../components/ui'
import { useMinuteListPage, type MinuteListData } from '../../api/minutes'
import { WEEKDAYS, parseYmd } from '../../lib/date'
import type { MinuteListItem } from '../../mocks/minuteList'
import s from './MinuteListPage.module.css'

const EMPTY: MinuteListData = { items: [], total: 0, myActions: [], members: [], projectKey: '', projectName: '', me: '', meId: 0 }
const PERIODS = [
  { months: 3, label: '최근 3개월' },
  { months: 6, label: '최근 6개월' },
  { months: 0, label: '전체 기간' },
]
const PAGE = 5

/** 회의록 목록 (Penpot 06 · 회의록 목록) — MM-1 */
export function MinuteListPage() {
  const { key } = useParams()
  const [keyword, setKeyword] = useState('')
  const [months, setMonths] = useState(3)
  const [attendee, setAttendee] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [done, setDone] = useState<string[]>([])
  const list = useMinuteListPage(key, { keyword, months, attendee })
  const data = list.data ?? EMPTY
  const base = `/projects/${data.projectKey || key}/minutes`

  return (
    <Columns
      sideWidth={380}
      main={
        <Card className={s.card}>
          <div className={s.toolbar}>
            <label className={s.search}>
              <Search size={18} />
              <input type="search" placeholder="제목 · 내용 · 참석자 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </label>
            <label className={s.filter}>
              <Calendar size={14} />
              {PERIODS.find((p) => p.months === months)?.label}
              <ChevronDown size={14} />
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="기간">
                {PERIODS.map((p) => (
                  <option key={p.months} value={p.months}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={attendee ? `${s.filter} ${s.filterOn}` : s.filter}>
              <Users size={14} />
              {attendee || '참석자'}
              <ChevronDown size={14} />
              <select value={attendee} onChange={(e) => setAttendee(e.target.value)} aria-label="참석자">
                <option value="">참석자: 전체</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <span className={s.count}>{data.total}개</span>
          </div>
          <Loadable resource={list} label="회의록 목록">
            {() =>
              data.items.length === 0 ? (
                <Empty>{keyword || attendee ? '조건에 맞는 회의록이 없어요.' : '아직 회의록이 없어요. "회의록 쓰기"로 첫 회의록을 남겨 보세요.'}</Empty>
              ) : (
                <>
                  {data.items.slice(0, shown).map((m) => (
                    <MinuteRow key={m.minuteId} m={m} to={`${base}/${m.minuteId}`} />
                  ))}
                  {data.items.length > shown && (
                    <button type="button" className={s.more} onClick={() => setShown(shown + PAGE)}>
                      {Math.min(PAGE, data.items.length - shown)}개 더 보기
                      <ChevronDown size={14} />
                    </button>
                  )}
                </>
              )
            }
          </Loadable>
        </Card>
      }
      side={
        <Card>
          <SectionHead icon={ListChecks} title="나에게 온 할 일" extra={<b className={s.sideCount}>{data.myActions.filter((a) => !done.includes(a.id)).length}</b>} />
          {data.myActions.length === 0 && <Empty>회의에서 나에게 온 할 일이 없어요.</Empty>}
          {data.myActions.map((a) => (
            <div key={a.id} className={s.todo}>
              <Checkbox checked={done.includes(a.id)} onChange={(v) => setDone(v ? [...done, a.id] : done.filter((x) => x !== a.id))} />
              <span>
                <strong className={done.includes(a.id) ? s.struck : undefined}>{a.text}</strong>
                <small>
                  {a.minuteTitle}
                  <Chip tone={a.late ? 'danger' : 'plain'} icon={Clock} className={s.due}>
                    ~{a.dueOn}
                  </Chip>
                  {a.taskKey && (
                    <Link to={`/projects/${data.projectKey}/tasks/${a.taskKey}`}>
                      <Chip tone="tint" className={s.due}>
                        {a.taskKey}
                      </Chip>
                    </Link>
                  )}
                </small>
              </span>
            </div>
          ))}
          <p className={s.hint}>할 일을 "작업으로 만들기" 하면 보드에도 올라가요</p>
        </Card>
      }
    />
  )
}

function MinuteRow({ m, to }: { m: MinuteListItem; to: string }) {
  const d = parseYmd(m.date)
  const allDone = m.actionCount > 0 && m.actionDone === m.actionCount
  const ratio = m.actionCount ? ((m.actionDone ?? m.convertedTaskCount) / m.actionCount) * 100 : 0
  return (
    <Link to={to} className={m.isNew ? `${s.minute} ${s.fresh}` : s.minute}>
      <span className={s.date}>
        <small>{d.getMonth() + 1}월</small>
        <b>{String(d.getDate()).padStart(2, '0')}</b>
        <small>{WEEKDAYS[d.getDay()]}</small>
      </span>
      <span className={s.text}>
        <strong>
          {m.title}
          {m.isNew && <em>새 글</em>}
        </strong>
        <small>{[m.time, m.place].filter(Boolean).join(' · ')}</small>
      </span>
      {m.attendees.length > 0 ? <AvatarStack names={m.attendees} size={26} /> : <span className={s.people}>참석 {m.attendeeCount}명</span>}
      <span className={s.actions}>
        <span className={allDone ? s.allDone : undefined}>
          <ListChecks size={14} />
          {m.actionDone === null ? `할 일 ${m.actionCount}` : `할 일 ${m.actionDone} / ${m.actionCount}`}
        </span>
        <Progress value={ratio} height={6} color={allDone ? 'var(--status-positive)' : 'var(--accent-2)'} track="var(--surface-card)" />
        <small>작업으로 만든 것 {m.convertedTaskCount}개</small>
      </span>
      <span className={s.author}>
        <b>{m.author}</b>
        <small>수정 {m.edited}</small>
      </span>
    </Link>
  )
}
