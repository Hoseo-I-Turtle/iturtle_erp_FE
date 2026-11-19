import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Breadcrumb, Card, Columns, Loadable } from '../../components/ui'
import type { Minute } from '../../mocks/minutes'
import { whenLive, type Resource } from '../../api/useResource'
import { convertMinuteActions, errorText, keepMockMinute, useMinute, useMinuteList, type MinuteList, type MinuteView } from '../../api/content'
import { useProjectHeader } from '../../api/projects'
import { MinuteHeader } from './minutes/MinuteHeader'
import { MinuteSections } from './minutes/MinuteSections'
import { HistoryCard, OtherMinutesCard } from './minutes/MinuteSideCards'
import { MinuteTodos } from './minutes/MinuteTodos'
import s from './MinutesPage.module.css'

/** 회의록 하나 보기 (minutes/:minuteId). 고치기는 쓰기 화면(minutes/:minuteId/edit)으로 */
export function MinutesPage() {
  const { key, minuteId } = useParams()
  // 실서버면 GET /projects/{key} (목업이면 mocks) — 목업 프로젝트 이름이 실서버 화면에 섞이지 않게
  const p = useProjectHeader(key).data ?? { projectKey: key ?? '', name: key ?? '' }
  // 실서버에는 목업에 없는 프로젝트도 있으니 주소의 키를 그대로 쓴다
  const projectKey = key ?? p.projectKey
  const projectName = p.projectKey === projectKey ? p.name : projectKey
  const list = useMinuteList(projectKey)
  const detail = useMinute(Number(minuteId))
  return (
    <Loadable resource={detail} label="회의록">
      {(d) => <MinuteColumns key={d.minute.minuteId} detail={detail} d={d} list={list.data} projectKey={projectKey} projectName={projectName} />}
    </Loadable>
  )
}

type ColumnsProps = {
  detail: Resource<MinuteView>
  d: MinuteView
  list: MinuteList | undefined
  projectKey: string
  projectName: string
}

function MinuteColumns({ detail, d, list, projectKey, projectName }: ColumnsProps) {
  const navigate = useNavigate()
  const m = d.minute
  const base = `/projects/${projectKey}/minutes`
  const [selected, setSelected] = useState<number[]>(() => m.todos.filter((t) => !t.task).map((t) => t.id))
  const [error, setError] = useState<string | null>(null)
  // 목업은 언제나 고칠 수 있게 보여 준다
  const canEdit = d.raw ? d.raw.permissions.edit : true

  const update = (f: (x: Minute) => Minute) =>
    detail.setData((v) => {
      const next = { ...v, minute: f(v.minute) }
      keepMockMinute(next.minute)
      return next
    })
  const nextTask = useRef(52)

  const makeTasks = async () => {
    setError(null)
    try {
      const changed = await whenLive(() => convertMinuteActions(m.minuteId, selected))
      if (changed === undefined) {
        update((x) => ({
          ...x,
          todos: x.todos.map((t) => (selected.includes(t.id) && !t.task ? { ...t, task: { taskKey: `${projectKey}-${nextTask.current++}`, status: '할 일' } } : t)),
        }))
      } else {
        update((x) => ({ ...x, todos: x.todos.map((t) => changed.find((c) => c.id === t.id) ?? t) }))
      }
      setSelected([])
    } catch (e) {
      setError(errorText(e, '작업으로 만들지 못했어요.'))
    }
  }

  // 다른 회의록: 최근 것 + 나머지에서 지금 보는 것을 뺀다
  const others = list
    ? [...(list.latest ? [{ id: list.latest.id, title: list.latest.title, meta: '최근 회의록' }] : []), ...list.others].filter((o) => o.id !== m.minuteId)
    : []

  return (
    <Columns
      main={
        <Card className={s.main}>
          <Breadcrumb items={[{ label: projectName, to: `/projects/${projectKey}` }, { label: '회의록', to: base }, { label: m.title }]} />
          <MinuteHeader m={m} canEdit={canEdit} error={error} onEdit={() => navigate(`${base}/${m.minuteId}/edit`)} />
          <MinuteSections m={m} />
          <MinuteTodos m={m} projectKey={projectKey} selected={selected} onSelected={setSelected} onMakeTasks={makeTasks} />
        </Card>
      }
      side={
        <>
          <HistoryCard history={d.history} />
          {others.length > 0 && <OtherMinutesCard projectKey={projectKey} others={others} onOpen={(id) => navigate(`${base}/${id}`)} />}
        </>
      }
    />
  )
}
