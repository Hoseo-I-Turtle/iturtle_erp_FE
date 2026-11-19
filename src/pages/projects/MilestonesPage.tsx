import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CalendarRange, Clock, FlaskConical, Plus } from 'lucide-react'
import { Button, Card, Chip, Empty, Loadable, Progress } from '../../components/ui'
import { useProjectHeader } from '../../api/projects'
import {
  openMilestoneCreate,
  useMilestoneCreateRequests,
  useMilestones,
  useMilestonesChanged,
  type MilestoneList,
  type MilestoneRow,
} from '../../api/milestones'
import { findProject } from '../../mocks/projects'
import { MilestoneCreateModal } from './MilestoneCreateModal'
import s from './MilestonesPage.module.css'

/** 프로젝트 › 마일스톤 탭: 목록 + 만들기 (머리의 '마일스톤 만들기' 버튼은 openMilestoneCreate 로 창을 연다) */
export function MilestonesPage() {
  const { key } = useParams()
  const list = useMilestones(key)
  const header = useProjectHeader(key)
  // 머리의 '새로 만들기' 메뉴는 ?new=1 로 보낸다: 만들기 창을 연 채로 시작하고 주소에서 new 를 지운다
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(() => params.get('new') === '1')
  useMilestoneCreateRequests(useCallback(() => setCreating(true), []))
  useMilestonesChanged(list.reload)
  useEffect(() => {
    if (params.get('new') !== '1') return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])
  const project = header.data ?? findProject(key)

  return (
    <>
      <Loadable resource={list} label="마일스톤">
        {(d) => <MilestoneListView d={d} projectKey={project.projectKey} />}
      </Loadable>
      {creating && <MilestoneCreateModal projectKey={project.projectKey} projectName={project.name} onClose={() => setCreating(false)} />}
    </>
  )
}

const DAY = 86_400_000
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const dot = (d: string | null) => (d ? d.replace(/-/g, '.') : '')
const daysLeft = (due: string) => Math.round((Date.parse(due) - Date.parse(todayKst())) / DAY)

function MilestoneListView({ d, projectKey }: { d: MilestoneList; projectKey: string }) {
  const open = d.rows.filter((m) => !m.closed)
  const closed = d.rows.filter((m) => m.closed)
  return (
    <Card className={s.card}>
      <div className={s.head}>
        <FlaskConical size={18} />
        <h2>마일스톤</h2>
        <small>
          열림 {open.length} · 닫힘 {closed.length}
        </small>
        <span className={s.grow} />
        <Link to={`/projects/${projectKey}/schedule`} className={s.link}>
          <CalendarRange size={14} /> 일정표에서 보기
        </Link>
      </div>
      {d.rows.length === 0 && (
        <Empty>
          아직 마일스톤이 없어요. 작업을 묶어 기한과 진행률을 볼 수 있어요.
          {d.canManage && (
            <Button variant="tint" icon={Plus} onClick={openMilestoneCreate} className={s.emptyBtn}>
              마일스톤 만들기
            </Button>
          )}
        </Empty>
      )}
      <ul className={s.list}>
        {[...open, ...closed].map((m) => (
          <MilestoneItem key={m.id} m={m} projectKey={projectKey} />
        ))}
      </ul>
      {!d.canManage && <p className={s.note}>마일스톤은 프로젝트 관리자가 만들고 고쳐요.</p>}
    </Card>
  )
}

function MilestoneItem({ m, projectKey }: { m: MilestoneRow; projectKey: string }) {
  const ratio = m.total ? m.done / m.total : 0
  const left = m.dueOn ? daysLeft(m.dueOn) : null
  const risky = !m.closed && left !== null && left >= 0 && left <= 14 && ratio < 0.5
  return (
    <li className={m.closed ? `${s.item} ${s.closed}` : s.item}>
      <div className={s.itemHead}>
        <b className={s.diamond} />
        <strong>{m.name}</strong>
        {m.closed && <Chip tone="muted">닫힘</Chip>}
        {m.overdue && <Chip tone="danger">기한 지남</Chip>}
        {risky && <Chip tone="warning">2주 안 기한 · 절반 미만</Chip>}
        <span className={s.grow} />
        <span className={s.period}>
          <Clock size={13} />
          {m.startOn ? `${dot(m.startOn)} – ` : ''}
          {m.dueOn ? dot(m.dueOn) : '기한 없음'}
          {left !== null && !m.closed && left >= 0 && <em> · D-{left}</em>}
        </span>
      </div>
      {m.description && <p className={s.desc}>{m.description}</p>}
      <div className={s.progress}>
        <Progress value={ratio * 100} color={m.closed ? 'var(--status-positive)' : undefined} />
        <small>
          완료 {m.done} / {m.total}
          {m.openTasks > 0 && ` · 남은 작업 ${m.openTasks}`}
        </small>
        <Link to={`/projects/${projectKey}/tasks`} className={s.link}>
          작업 보기
        </Link>
      </div>
    </li>
  )
}
