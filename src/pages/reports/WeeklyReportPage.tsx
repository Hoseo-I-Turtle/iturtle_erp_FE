import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, GitBranch, GitCommitHorizontal, Kanban, MessageCircle, Plus, RefreshCw, Send, TriangleAlert, Users, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Columns, Empty, Loadable, Note, Segmented, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { ago } from '../../api/types'
import { whenLive, type Resource } from '../../api/useResource'
import {
  errorText,
  keepMockReport,
  refreshGithubActivity,
  reportWeeks,
  saveMyReport,
  submitMyReport,
  useGithubActivity,
  useLastWeek,
  useMyReport,
  useWeekSubmissions,
  type GithubActivity,
  type MyWeekReport,
  type ReportFields,
} from '../../api/content'
import s from './WeeklyReportPage.module.css'

type Tab = 'mine' | 'status' | 'members'
type Fields = ReportFields
const FIELDS: { key: keyof Fields; label: string }[] = [
  { key: 'done', label: '이번 주 한 일' },
  { key: 'next', label: '다음 주 계획' },
  { key: 'issues', label: '이슈 · 도움 필요' },
]
const STATE_LABEL = { SUBMITTED: '제출', LATE: '늦은 제출', MISSING: '미제출' } as const

export function WeeklyReportPage() {
  const [weeks] = useState(reportWeeks)
  const [tab, setTab] = useState<Tab>('mine')
  const [weekIdx, setWeekIdx] = useState(weeks.length - 1)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const refreshTimer = useRef<number | undefined>(undefined)

  const week = weeks[weekIdx]
  const isCurrent = weekIdx === weeks.length - 1
  const currentWeek = weeks[weeks.length - 1].weekStartOn

  const mine = useMyReport(week.weekStartOn, isCurrent)
  const subs = useWeekSubmissions(week.weekStartOn)
  const last = useLastWeek(currentWeek)
  const gh = useGithubActivity(week.weekStartOn, mine.data?.meId)

  /** 내 보고를 바꾼다 (목업은 주를 옮겨도 남게 기억) */
  const setMine = (f: (r: MyWeekReport) => MyWeekReport) =>
    mine.setData((r) => {
      const next = f(r)
      keepMockReport(week.weekStartOn, next)
      return next
    })

  // 입력이 멈추면 1초 뒤 자동 저장 (WR-3). 목업은 상태만 바꾼다
  const scheduleSave = (fields: Fields, excludedKeys: string[]) => {
    setSaveState('saving')
    window.clearTimeout(timer.current)
    const weekStartOn = week.weekStartOn
    timer.current = window.setTimeout(async () => {
      try {
        const saved = await whenLive(() => saveMyReport(weekStartOn, fields, excludedKeys))
        if (saved) mine.setData((r) => ({ ...r, reportId: saved.reportId, submitted: saved.submitted, editable: saved.editable }))
        setSaveState('saved')
      } catch (e) {
        setSaveState('error')
        setError(errorText(e))
      }
    }, 1000)
  }
  const edit = (k: keyof Fields, v: string) => {
    const r = mine.data
    if (!r) return
    const fields = { ...r.fields, [k]: v }
    setMine((x) => ({ ...x, fields }))
    scheduleSave(fields, r.excludedKeys)
  }
  const copyLastWeek = () => {
    const r = mine.data
    if (!r || !last.data) return
    const fields = { ...r.fields, ...last.data.copy }
    setMine((x) => ({ ...x, fields }))
    scheduleSave(fields, r.excludedKeys)
  }
  const removeTask = (key: string) => {
    const r = mine.data
    if (!r) return
    const excludedKeys = [...r.excludedKeys, key]
    setMine((x) => ({ ...x, tasks: x.tasks.filter((t) => t.key !== key), excludedKeys }))
    scheduleSave(r.fields, excludedKeys)
  }
  const submit = async () => {
    const r = mine.data
    if (!r || r.submitted) return
    setError(null)
    window.clearTimeout(timer.current)
    setMine((x) => ({ ...x, submitted: true }))
    try {
      const saved = await whenLive(() => submitMyReport(week.weekStartOn, r))
      if (saved) mine.setData(() => saved)
      subs.reload()
    } catch (e) {
      setError(errorText(e, '제출하지 못했어요.'))
      mine.setData((x) => ({ ...x, submitted: false }))
    }
  }
  const refreshGithub = async (g: Resource<GithubActivity>) => {
    setError(null)
    try {
      const res = await whenLive(() => refreshGithubActivity())
      g.setData((x) => ({ ...x, fetchedAgo: res?.lastFetchedAt ? ago(res.lastFetchedAt) : '방금' }))
      // 새로 훑는 작업은 따로 돈다. 1분쯤 뒤 숫자를 다시 받는다 (WR-7)
      if (res) {
        window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(g.reload, 60000)
      }
    } catch (e) {
      setError(errorText(e, '새로 받지 못했어요.'))
    }
  }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(refreshTimer.current)
    },
    [],
  )

  const submissions = subs.data ?? []
  const total = submissions.length
  const count = (st: keyof typeof STATE_LABEL) => submissions.filter((x) => x.state === st).length
  const submitted = mine.data?.submitted ?? false

  return (
    <>
      <PageHeader
        title="주간 보고"
        subtitle={`${week.label} (${week.range}) · 마감 ${week.deadline}`}
        action={
          <Button icon={submitted ? Check : Send} onClick={submit} disabled={!isCurrent || !mine.data}>
            {submitted ? '제출함' : '제출하기'}
          </Button>
        }
      />
      <Columns
        main={
          <Card className={s.main}>
            <div className={s.top}>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'mine', label: '내 보고' },
                  { value: 'status', label: '제출 현황' },
                  { value: 'members', label: '구성원별 보고' },
                ]}
              />
              <span className={s.grow} />
              <Button variant="icon" icon={ChevronLeft} aria-label="이전 주" onClick={() => setWeekIdx(Math.max(0, weekIdx - 1))} disabled={weekIdx === 0} />
              {!isCurrent && <Button variant="icon" icon={ChevronRight} aria-label="다음 주" onClick={() => setWeekIdx(weekIdx + 1)} />}
              {tab === 'mine' && isCurrent && (
                <>
                  <span className={s.saveState}>
                    {submitted
                      ? '제출함 · 확인 전까지 고칠 수 있어요'
                      : saveState === 'saving'
                        ? '저장 중…'
                        : saveState === 'error'
                          ? '저장하지 못했어요'
                          : '작성 중 · 자동 저장됨'}
                  </span>
                  <button type="button" className={s.copy} onClick={copyLastWeek}>
                    <RefreshCw size={16} /> 지난 주 복사
                  </button>
                </>
              )}
            </div>

            {error && (
              <Note icon={TriangleAlert} tone="warning">
                {error}
              </Note>
            )}

            {tab === 'mine' && (
              <Loadable resource={mine} label="내 보고">
                {(r) =>
                  isCurrent ? (
                    <>
                      {FIELDS.map(({ key, label }) => (
                        <label key={key} className={s.field}>
                          <span>{label}</span>
                          <textarea value={r.fields[key]} rows={2} readOnly={!r.editable} onChange={(e) => edit(key, e.target.value)} />
                        </label>
                      ))}

                      <TaskBox tasks={r.tasks} onRemove={removeTask} />

                      <Loadable resource={gh} label="GitHub 활동">
                        {(g) => <GithubBox g={g} onRefresh={() => refreshGithub(gh)} />}
                      </Loadable>
                    </>
                  ) : (
                    FIELDS.map(({ key, label }) => (
                      <div key={key} className={s.field}>
                        <span>{label}</span>
                        <p className={s.readonly}>{r.fields[key] || '—'}</p>
                      </div>
                    ))
                  )
                }
              </Loadable>
            )}

            {tab === 'status' && (
              <Loadable resource={subs} label="제출 현황">
                {(list) => (
                  <ul className={s.statusList}>
                    {list.map((x) => (
                      <li key={x.name}>
                        <Avatar name={x.name} size={28} />
                        <strong>{x.name}</strong>
                        <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Loadable>
            )}

            {tab === 'members' && (
              <Loadable resource={subs} label="구성원별 보고">
                {(list) => (
                  <ul className={s.memberReports}>
                    {list
                      .filter((x) => x.summary)
                      .map((x) => (
                        <li key={x.name}>
                          <Avatar name={x.name} size={28} />
                          <div>
                            <strong>{x.name}</strong>
                            <p>{x.summary}</p>
                          </div>
                          <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </Loadable>
            )}
          </Card>
        }
        side={
          <>
            <Card>
              <SectionHead icon={Users} title={`${week.label} 제출 현황`} />
              <div className={s.bar}>
                <i style={{ width: `${total ? (count('SUBMITTED') / total) * 100 : 0}%`, background: 'var(--status-positive)' }} />
                <i style={{ width: `${total ? (count('LATE') / total) * 100 : 0}%`, background: 'var(--status-warning-text)' }} />
              </div>
              <div className={s.counts}>
                <span className={s.cOk}>제출 {count('SUBMITTED')}</span>
                <span className={s.cLate}>늦은 제출 {count('LATE')}</span>
                <span>미제출 {count('MISSING')}</span>
              </div>
              <ul className={s.notYet}>
                {submissions
                  .filter((x) => x.state !== 'SUBMITTED')
                  .map((x) => (
                    <li key={x.name}>
                      <Avatar name={x.name} size={26} />
                      <span>{x.name}</span>
                      <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
                    </li>
                  ))}
              </ul>
              <p className={s.hint}>모든 구성원이 서로의 보고를 볼 수 있어요.</p>
            </Card>

            <Card>
              <SectionHead icon={MessageCircle} title="지난 주 보고 코멘트" />
              <Loadable resource={last} label="지난 주 코멘트">
                {(l) =>
                  l.comment ? (
                    <div className={s.comment}>
                      <Avatar name={l.comment.author} size={28} colorIndex={3} />
                      <div>
                        <div className={s.commentHead}>
                          <strong>{l.comment.author}</strong>
                          {l.comment.confirmed && (
                            <span className={s.confirmed}>
                              <Check size={12} /> 확인함
                            </span>
                          )}
                        </div>
                        <p>{l.comment.body}</p>
                      </div>
                    </div>
                  ) : (
                    <Empty>지난 주 보고에 코멘트가 없어요.</Empty>
                  )
                }
              </Loadable>
            </Card>

            <Note icon={Clock} tone="warning">
              {mine.data?.dueText ?? '마감'}. 제출한 뒤에도 교수님이 확인하기 전까지는 고칠 수 있어요.
            </Note>
          </>
        }
      />
    </>
  )
}

function TaskBox({ tasks, onRemove }: { tasks: MyWeekReport['tasks']; onRemove: (key: string) => void }) {
  const doneCount = tasks.filter((t) => t.status === '완료').length
  return (
    <div className={s.tasks}>
      <div className={s.boxHead}>
        <Kanban size={18} />
        <strong>작업 연동</strong>
        <span className={s.grow} />
        <small>
          이번 주 완료 {doneCount} · 진행 중 {tasks.length - doneCount}
        </small>
      </div>
      <div className={s.taskChips}>
        {tasks.map((t) => (
          <span key={t.key} className={s.taskChip}>
            <Chip tone={t.status === '완료' ? 'brand' : t.status === '검토' ? 'warning' : 'tint'} className={t.status === '완료' ? s.doneChip : undefined}>
              {t.status}
            </Chip>
            <strong>{t.key}</strong> {t.title}
            <button type="button" aria-label="빼기" onClick={() => onRemove(t.key)}>
              <X size={14} />
            </button>
          </span>
        ))}
        {/* 명세 확인 필요: 자동 채우기 대상이 아닌 작업은 넣을 수 없다 (WR-3 P238). 뺀 작업 되돌리기용으로 남겨 둠 */}
        <button type="button" className={s.addTask}>
          <Plus size={14} /> 작업 넣기
        </button>
      </div>
    </div>
  )
}

function GithubBox({ g, onRefresh }: { g: GithubActivity; onRefresh: () => void }) {
  return (
    <div className={s.github}>
      <div className={s.boxHead}>
        <GitBranch size={18} />
        <strong>GitHub 활동</strong>
        <span className={s.grow} />
        <small>마지막으로 받은 시각 · {g.fetchedAgo}</small>
        <button type="button" className={s.copy} onClick={onRefresh}>
          <RefreshCw size={16} /> 지금 새로 받기
        </button>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th>저장소 / 브랜치</th>
            <th>커밋</th>
            <th>추가</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => (
            <tr key={r.repo + r.branch}>
              <td>
                <GitBranch size={14} /> {r.repo} <span className={s.branch}>{r.branch}</span>
              </td>
              <td>{r.commits}</td>
              <td className={s.add}>+{r.add}</td>
              <td className={s.del}>−{r.del}</td>
            </tr>
          ))}
          <tr className={s.sum}>
            <td>
              <GitCommitHorizontal size={14} /> 합계 · 병합 커밋 {g.mergeCount}개와 lock 파일 제외
            </td>
            <td>{g.totals.c}</td>
            <td className={s.add}>+{g.totals.add}</td>
            <td className={s.del}>−{g.totals.del}</td>
          </tr>
        </tbody>
      </table>
      <p className={s.hint}>
        줄 수는 참고 지표예요. 리팩터링이나 자동 생성 코드로 크게 달라질 수 있어요. 같은 커밋이 여러 브랜치에 있으면 한 번만 세요.
      </p>
    </div>
  )
}
