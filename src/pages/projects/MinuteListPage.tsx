import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, ChevronDown, Clock, ListChecks, Search, Users } from 'lucide-react'
import { AvatarStack, Card, Checkbox, Chip, Columns, Empty, Loadable } from '../../components/ui'
import { LoadMore } from '../../components/ui/LoadMore'
import { errorText } from '../../api/content'
import { useLoadMore } from '../../api/useLoadMore'
import {
  checkMinuteAction,
  fetchMoreMinutes,
  useMinuteRows,
  useMyMinuteActions,
  useProjectMembers,
  type MinuteFilter,
  type MinutePeriod,
  type MinuteRow,
  type MyMinuteAction,
} from '../../api/minutes'
import s from './MinuteListPage.module.css'

const PERIODS: { value: MinutePeriod; label: string }[] = [
  { value: 'm3', label: '최근 3개월' },
  { value: 'm6', label: '최근 6개월' },
  { value: 'all', label: '전체 기간' },
]

/** 프로젝트 회의록 탭: 목록 + 나에게 온 할 일 (Penpot `Screen · 회의록 목록`) */
export function MinuteListPage() {
  const { key = '' } = useParams()
  const [keyword, setKeyword] = useState('')
  const [period, setPeriod] = useState<MinutePeriod>('m3')
  const [attendeeId, setAttendeeId] = useState<number | null>(null)
  const filter: MinuteFilter = { keyword, period, attendeeId }
  const rows = useMinuteRows(key, filter)
  // 목록 끝에 닿으면 같은 조건의 다음 페이지를 이어 붙인다
  const more = useLoadMore(rows, rows.data?.hasNext, (d) => fetchMoreMinutes(key, filter, d))
  // 참석자 고르기는 프로젝트 참여자로
  const members = useProjectMembers(key).data ?? []

  return (
    <Columns
      main={
        <Card className={s.card}>
          <div className={s.filters}>
            <label className={s.search}>
              <Search size={18} />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="제목 · 내용 · 참석자 검색"
                aria-label="회의록 검색"
              />
            </label>
            <label className={s.pick}>
              <Calendar size={14} />
              <span>{PERIODS.find((p) => p.value === period)?.label}</span>
              <ChevronDown size={14} />
              <select value={period} onChange={(e) => setPeriod(e.target.value as MinutePeriod)} aria-label="기간">
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={attendeeId ? `${s.pick} ${s.pickOn}` : s.pick}>
              <Users size={14} />
              <span>{members.find((m) => m.id === attendeeId)?.name ?? '참석자'}</span>
              <ChevronDown size={14} />
              <select
                value={attendeeId ?? ''}
                onChange={(e) => setAttendeeId(e.target.value ? Number(e.target.value) : null)}
                aria-label="참석자"
              >
                <option value="">참석자: 전체</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <span className={s.grow} />
            <span className={s.count}>{rows.data ? `${rows.data.total}개` : ''}</span>
          </div>
          <Loadable resource={rows} label="회의록">
            {(d) =>
              d.rows.length === 0 ? (
                <Empty>{keyword || attendeeId ? '조건에 맞는 회의록이 없어요.' : '아직 회의록이 없어요. 오른쪽 위 "회의록 쓰기"로 시작해 보세요.'}</Empty>
              ) : (
                <>
                  <ul className={s.rows}>
                    {d.rows.map((r) => (
                      <MinuteRowItem key={r.minuteId} r={r} projectKey={key} />
                    ))}
                  </ul>
                  <LoadMore more={more} />
                </>
              )
            }
          </Loadable>
        </Card>
      }
      side={<MyActionsCard projectKey={key} />}
    />
  )
}

function MinuteRowItem({ r, projectKey }: { r: MinuteRow; projectKey: string }) {
  const navigate = useNavigate()
  const pct = r.actionTotal ? Math.round((r.actionDone / r.actionTotal) * 100) : 0
  const allDone = r.actionTotal > 0 && r.actionDone === r.actionTotal
  // 임시 저장은 이어 쓰기로, 게시된 것은 보기로
  const to = r.draft ? `/projects/${projectKey}/minutes/${r.minuteId}/edit` : `/projects/${projectKey}/minutes/${r.minuteId}`
  return (
    <li>
      <button type="button" className={r.isNew ? `${s.row} ${s.rowNew}` : s.row} onClick={() => navigate(to)}>
        <span className={s.date} aria-label={`${r.month}월 ${r.day}일 ${r.weekday}요일`}>
          <small>{r.month}월</small>
          <strong>{String(r.day).padStart(2, '0')}</strong>
          <small>{r.weekday}</small>
        </span>
        <span className={s.main}>
          <span className={s.titleLine}>
            <strong className={s.title}>{r.title}</strong>
            {r.isNew && <span className={s.newBadge}>새 글</span>}
            {r.draft && <Chip tone="warning">임시 저장</Chip>}
          </span>
          <span className={s.meta}>
            {r.time}
            {r.place && ` · ${r.place}`}
          </span>
        </span>
        <span className={s.people}>
          <AvatarStack names={r.attendees} size={24} />
        </span>
        <span className={s.todo}>
          <span className={allDone ? `${s.todoLabel} ${s.todoAll}` : s.todoLabel}>
            <ListChecks size={14} /> 할 일 {r.actionDone} / {r.actionTotal}
          </span>
          <span className={s.bar} aria-hidden>
            <span className={allDone ? `${s.fill} ${s.fillAll}` : s.fill} style={{ width: `${pct}%` }} />
          </span>
          <small>작업으로 만든 것 {r.converted}개</small>
        </span>
        <span className={s.author}>
          {r.author}
          <small>{r.edited}</small>
        </span>
      </button>
    </li>
  )
}

/** 오른쪽: 나에게 온 할 일 (프로젝트를 넘나들어). 연구실 회의 할 일은 여기서 바로 체크 */
function MyActionsCard({ projectKey }: { projectKey: string }) {
  const mine = useMyMinuteActions()
  const [error, setError] = useState<string | null>(null)
  const check = async (a: MyMinuteAction) => {
    setError(null)
    mine.setData((list) => list.filter((x) => x.actionId !== a.actionId))
    try {
      await checkMinuteAction(a.minuteId, a.actionId, true)
    } catch (e) {
      setError(errorText(e, '체크하지 못했어요.'))
      mine.reload()
    }
  }
  return (
    <Card className={s.side}>
      <div className={s.sideHead}>
        <ListChecks size={18} />
        <strong>나에게 온 할 일</strong>
        <span className={s.grow} />
        <span className={s.sideCount}>{mine.data?.length ?? ''}</span>
      </div>
      <Loadable resource={mine} label="나에게 온 할 일">
        {(list) =>
          list.length === 0 ? (
            <Empty>지금 맡은 할 일이 없어요.</Empty>
          ) : (
            <ul className={s.mine}>
              {list.map((a) => (
                <li key={a.actionId} className={s.mineItem}>
                  {a.lab && !a.taskKey ? (
                    <Checkbox checked={false} onChange={() => void check(a)}>
                      <span className={s.sr}>{a.content} 끝냄</span>
                    </Checkbox>
                  ) : (
                    <span className={s.mineDot} aria-hidden />
                  )}
                  <span className={s.mineText}>
                    <Link to={a.projectKey ? `/projects/${a.projectKey}/minutes/${a.minuteId}` : `/projects/${projectKey}/minutes`}>{a.content}</Link>
                    <small>
                      {a.minuteTitle}
                      {a.due && (
                        <span className={a.overdue ? `${s.due} ${s.dueOver}` : s.due}>
                          <Clock size={12} /> {a.due}
                        </span>
                      )}
                      {a.taskKey && a.projectKey && (
                        <Link className={s.taskChip} to={`/projects/${a.projectKey}/tasks/${a.taskKey}`}>
                          {a.taskKey}
                        </Link>
                      )}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
      {error && <p className={s.error}>{error}</p>}
      <p className={s.hint}>할 일을 "작업으로 만들기" 하면 보드에도 올라가요</p>
    </Card>
  )
}
