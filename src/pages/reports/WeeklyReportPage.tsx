import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { Button, Card, Columns, Loadable, Note, Segmented } from '../../components/ui'
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
import { sectionReady } from './weekly/constants'
import { GithubBox } from './weekly/GithubBox'
import { SectionCard } from './weekly/SectionCard'
import { LastWeekCommentCard, SubmissionSummaryCard } from './weekly/SideCards'
import { MemberReportList, SubmissionStatusList } from './weekly/SubmissionLists'
import { TaskBox } from './weekly/TaskBox'
import s from './WeeklyReportPage.module.css'

type Tab = 'mine' | 'status' | 'members'

/**
 * 주간 보고 (PRJ-4). 2026-11-20 부터 한 사람 한 장 안에 진행 중 프로젝트마다 칸(한 일 · 계획 · 이슈) + 공통 메모.
 */
export function WeeklyReportPage() {
  const [weeks] = useState(reportWeeks)
  const [tab, setTab] = useState<Tab>('mine')
  const [weekIdx, setWeekIdx] = useState(weeks.length - 1)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const refreshTimer = useRef<number | undefined>(undefined)
  // 이 화면에서 "작업 넣기"로 되돌린 작업 (주마다). 저장 때 excluded: false 로 보내 서버에 남은 '뺌'을 푼다
  const restored = useRef(new Map<string, Set<string>>())

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
  const scheduleSave = (report: MyWeekReport) => {
    setSaveState('saving')
    window.clearTimeout(timer.current)
    const weekStartOn = week.weekStartOn
    const includedKeys = [...(restored.current.get(weekStartOn) ?? [])].filter((k) => !report.excludedKeys.includes(k))
    timer.current = window.setTimeout(async () => {
      try {
        const saved = await whenLive(() => saveMyReport(weekStartOn, report, report.excludedKeys, includedKeys))
        // 서버가 칸을 진행 프로젝트에 맞춰 바꿨을 수 있어 칸 모양(있고 없음 · detached)은 받고, 쓰는 중인 글은 화면 것을 둔다
        if (saved)
          mine.setData((r) => ({
            ...r,
            reportId: saved.reportId,
            submitted: saved.submitted,
            editable: saved.editable,
            sections: saved.sections.map((x) => ({ ...x, fields: r.sections.find((y) => y.projectKey === x.projectKey)?.fields ?? x.fields })),
          }))
        setSaveState('saved')
      } catch (e) {
        setSaveState('error')
        setError(errorText(e))
      }
    }, 1000)
  }
  const update = (f: (r: MyWeekReport) => MyWeekReport) => {
    const r = mine.data
    if (!r) return
    const next = f(r)
    setMine(() => next)
    scheduleSave(next)
  }
  const editSection = (projectKey: string, key: keyof ReportFields, v: string) =>
    update((r) => ({
      ...r,
      sections: r.sections.map((x) => (x.projectKey === projectKey ? { ...x, fields: { ...x.fields, [key]: v } } : x)),
    }))
  const editNote = (v: string) => update((r) => ({ ...r, note: v }))
  /** 지난 주 칸마다 계획을 이번 주 같은 프로젝트 칸의 한 일로 (칸별 복사) */
  const copyLastWeek = () => {
    const copy = last.data?.copy
    if (!copy) return
    update((r) => ({
      ...r,
      sections: r.sections.map((x) => (copy[x.projectKey] ? { ...x, fields: { ...x.fields, ...copy[x.projectKey] } } : x)),
    }))
  }
  const removeTask = (key: string) => {
    restored.current.get(week.weekStartOn)?.delete(key)
    update((r) => {
      const chip = r.tasks.find((t) => t.key === key)
      return {
        ...r,
        tasks: r.tasks.filter((t) => t.key !== key),
        excluded: chip ? [...r.excluded, chip] : r.excluded,
        excludedKeys: [...r.excludedKeys, key],
      }
    })
  }
  /** 뺀 작업을 다시 넣는다. 서버는 자동 채우기 대상(그 주에 완료 · 진행한 내 작업)만 받아서(P238) 뺀 작업만 되돌릴 수 있다 */
  const restoreTask = (key: string) => {
    const set = restored.current.get(week.weekStartOn) ?? new Set<string>()
    set.add(key)
    restored.current.set(week.weekStartOn, set)
    update((r) => {
      const chip = r.excluded.find((t) => t.key === key)
      if (!chip) return r
      return { ...r, tasks: [...r.tasks, chip], excluded: r.excluded.filter((t) => t.key !== key), excludedKeys: r.excludedKeys.filter((k) => k !== key) }
    })
  }
  const submit = async () => {
    const r = mine.data
    if (!r || r.submitted) return
    setError(null)
    const empty = r.sections.filter((x) => !sectionReady(x))
    if (empty.length > 0) {
      setError(`${empty.map((x) => x.projectName).join(', ')} 칸의 이번 주 한 일과 다음 주 계획을 채워야 제출할 수 있어요.`)
      return
    }
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
  const submitted = mine.data?.submitted ?? false

  return (
    <>
      <PageHeader
        title="주간 보고"
        subtitle={`${week.label} (${week.range}) · 마감 ${mine.data?.deadline ?? week.deadline}`}
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
                {(r) => {
                  const sectionKeys = new Set(r.sections.map((x) => x.projectKey))
                  const otherTasks = r.tasks.filter((t) => !sectionKeys.has(t.projectKey))
                  const otherExcluded = r.excluded.filter((t) => !sectionKeys.has(t.projectKey))
                  return isCurrent ? (
                    <>
                      <p className={s.hint}>
                        진행 중인 프로젝트마다 칸이 있어요. 칸마다 이번 주 한 일과 다음 주 계획을 채우면 제출할 수 있어요. 제출하면 칸이 그대로 굳어요.
                      </p>
                      {r.sections.map((x) => (
                        <SectionCard
                          key={x.projectKey}
                          section={x}
                          report={r}
                          github={gh.data}
                          editable={r.editable}
                          onEdit={editSection}
                          onRemoveTask={removeTask}
                          onRestoreTask={restoreTask}
                        />
                      ))}

                      <label className={s.field}>
                        <span>공통 메모 · 프로젝트 밖 일 (선택)</span>
                        <textarea value={r.note} rows={2} readOnly={!r.editable} onChange={(e) => editNote(e.target.value)} />
                      </label>

                      {(otherTasks.length > 0 || otherExcluded.length > 0) && (
                        <TaskBox tasks={otherTasks} excluded={otherExcluded} onRemove={removeTask} onRestore={restoreTask} />
                      )}

                      <Loadable resource={gh} label="GitHub 활동">
                        {(g) => <GithubBox g={g} onRefresh={() => refreshGithub(gh)} />}
                      </Loadable>
                    </>
                  ) : (
                    // 지난 주: 칸마다 그 주 작업 · GitHub 활동까지 읽기만 (ERP-39)
                    <>
                      {r.sections.map((x) => (
                        <SectionCard key={x.projectKey} section={x} report={r} github={gh.data} editable={false} readOnly />
                      ))}
                      {r.note && (
                        <div className={s.field}>
                          <span>공통 메모</span>
                          <p className={s.readonly}>{r.note}</p>
                        </div>
                      )}
                      {otherTasks.length > 0 && <TaskBox tasks={otherTasks} readOnly />}
                      <Loadable resource={gh} label="GitHub 활동">
                        {(g) => <GithubBox g={g} />}
                      </Loadable>
                    </>
                  )
                }}
              </Loadable>
            )}

            {tab === 'status' && (
              <Loadable resource={subs} label="제출 현황">
                {(list) => <SubmissionStatusList list={list} />}
              </Loadable>
            )}

            {tab === 'members' && (
              <Loadable resource={subs} label="구성원별 보고">
                {(list) => <MemberReportList list={list} />}
              </Loadable>
            )}
          </Card>
        }
        side={
          <>
            <SubmissionSummaryCard weekLabel={week.label} submissions={submissions} />
            <LastWeekCommentCard last={last} />

            <Note icon={Clock} tone="warning">
              {mine.data?.dueText ?? '마감'}. 제출한 뒤에도 교수님이 확인하기 전까지는 고칠 수 있어요. 진행 중인 프로젝트에 참여한 사람만 보고 대상이에요.
            </Note>
          </>
        }
      />
    </>
  )
}
