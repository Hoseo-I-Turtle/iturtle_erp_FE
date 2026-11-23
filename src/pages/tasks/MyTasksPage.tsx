import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ChevronDown, Clock, Eye } from 'lucide-react'
import { Card, Chip, Columns, Empty, FilterSelect, Loadable, SectionHead, Segmented } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { useMyTasks, type MyTask, type MyTasks } from '../../api/search'
import { PRIORITY_NAME, STATUS_NAME } from '../../mocks/tasks'
import { STATUS_TONE } from '../projects/taskTones'
import s from './MyTasksPage.module.css'

type Tab = 'mine' | 'review' | 'requested'
const EMPTY: MyTasks = { mine: [], review: [], requested: [], me: '' }
const GROUPS: { key: string; label: string; danger?: boolean; test: (t: MyTask) => boolean }[] = [
  { key: 'late', label: '기한 지남', danger: true, test: (t) => t.dueState === 'overdue' },
  { key: 'soon', label: '3일 안', test: (t) => t.dueState === 'soon' },
  { key: 'later', label: '그 뒤', test: (t) => !!t.dueOn && !t.dueState },
  { key: 'none', label: '기한 없음', test: (t) => !t.dueOn },
]

/** 내 작업 (Penpot 06 · 내 작업) — T-1 mine · awaitingMyReview · requesterId */
export function MyTasksPage() {
  const res = useMyTasks()
  const data = res.data ?? EMPTY
  const [tab, setTab] = useState<Tab>('mine')
  const [project, setProject] = useState('')
  const [status, setStatus] = useState('')

  const all = data[tab]
  const list = all.filter((t) => (!project || t.projectKey === project) && (!status || STATUS_NAME[t.status] === status))
  const projects = [...new Set(data.mine.map((t) => t.projectKey))]

  return (
    <>
      <PageHeader title="내 작업" subtitle="여러 프로젝트에서 내가 맡은 작업을 기한 순으로 모아 봐요" />
      <Columns
        sideWidth={320}
        main={
          <Card className={s.card}>
            <div className={s.toolbar}>
              <Segmented
                value={tab}
                options={[
                  { value: 'mine', label: `내가 맡은 ${data.mine.length}` },
                  { value: 'review', label: `검토를 기다리는 ${data.review.length}` },
                  { value: 'requested', label: `내가 요청한 ${data.requested.length}` },
                ]}
                onChange={setTab}
              />
              <span className={s.filters}>
                <FilterSelect label="프로젝트" value={project} options={[...new Set(all.map((t) => t.projectKey))]} onChange={setProject} />
                <FilterSelect label="상태" value={status} options={Object.values(STATUS_NAME)} onChange={setStatus} />
              </span>
            </div>
            <Loadable resource={res} label="내 작업">
              {() =>
                list.length === 0 ? (
                  <Empty>{tab === 'mine' ? '맡은 작업이 없어요.' : tab === 'review' ? '검토를 기다리는 작업이 없어요.' : '요청한 작업이 없어요.'}</Empty>
                ) : (
                  <>
                    {GROUPS.map((g) => {
                      const rows = list.filter(g.test)
                      if (rows.length === 0) return null
                      return (
                        <div key={g.key} className={s.group}>
                          <p className={g.danger ? s.danger : undefined}>
                            {g.label}
                            <b>{rows.length}</b>
                          </p>
                          {rows.map((t) => (
                            <TaskRow key={t.taskKey} t={t} />
                          ))}
                        </div>
                      )
                    })}
                  </>
                )
              }
            </Loadable>
          </Card>
        }
        side={
          <>
            <Card>
              <SectionHead title="프로젝트별" />
              {projects.length === 0 && <Empty>맡은 작업이 없어요.</Empty>}
              {projects.map((p) => {
                const mine = data.mine.filter((t) => t.projectKey === p)
                const late = mine.filter((t) => t.dueState === 'overdue').length
                return (
                  <button key={p} type="button" className={project === p ? `${s.proj} ${s.projOn}` : s.proj} onClick={() => setProject(project === p ? '' : p)}>
                    <span>{p}</span>
                    {late > 0 && <Chip tone="danger">지남 {late}</Chip>}
                    <b>{mine.length}</b>
                  </button>
                )
              })}
            </Card>
            <Card>
              <SectionHead icon={Eye} title="검토를 기다리는 작업" extra={<b className={s.count}>{data.review.length}</b>} />
              {data.review.length === 0 && <Empty>지금은 없어요.</Empty>}
              {data.review.slice(0, 5).map((t) => (
                <Link key={t.taskKey} to={`/projects/${t.projectKey}/tasks/${t.taskKey}`} className={s.review}>
                  <strong>{t.title}</strong>
                  <small>
                    <Chip tone="tint">{t.taskKey}</Chip>
                    {t.assignee ?? '담당 없음'} 이 검토 요청
                  </small>
                </Link>
              ))}
              <p className={s.hint}>내가 요청했거나 내가 관리자인 프로젝트의 "검토" 작업이에요</p>
            </Card>
          </>
        }
      />
    </>
  )
}

function TaskRow({ t }: { t: MyTask }) {
  const high = t.priority === 'HIGH' || t.priority === 'URGENT'
  return (
    <Link to={`/projects/${t.projectKey}/tasks/${t.taskKey}`} className={s.task}>
      <span className={s.key}>{t.taskKey}</span>
      <span className={s.text}>
        <strong>{t.title}</strong>
        <small>
          {[t.projectKey, t.milestone, t.checklist && `체크리스트 ${t.checklist.done}/${t.checklist.total}`, t.commentCount > 0 && `댓글 ${t.commentCount}`].filter(Boolean).join(' · ')}
        </small>
      </span>
      <Chip tone={STATUS_TONE[t.status]}>{STATUS_NAME[t.status]}</Chip>
      <span className={high ? `${s.priority} ${s.high}` : s.priority}>
        {high ? <ArrowUp size={14} /> : <ChevronDown size={14} />}
        {PRIORITY_NAME[t.priority]}
      </span>
      <span className={t.dueState === 'overdue' ? `${s.due} ${s.late}` : s.due}>
        <Clock size={14} />
        {t.dueOn ?? '—'}
      </span>
    </Link>
  )
}
