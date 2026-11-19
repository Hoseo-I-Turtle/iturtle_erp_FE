import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Breadcrumb, Card, Columns, Empty, Loadable } from '../../components/ui'
import type { Minute } from '../../mocks/minutes'
import { whenLive, type Resource } from '../../api/useResource'
import {
  convertMinuteActions,
  errorText,
  keepMockMinute,
  saveMinute,
  useMinute,
  useMinuteList,
  type MinuteConflict,
  type MinuteList,
  type MinuteView,
} from '../../api/content'
import { useProjectHeader } from '../../api/projects'
import { MinuteHeader } from './minutes/MinuteHeader'
import { MinuteSections } from './minutes/MinuteSections'
import { ConflictAlert, HistoryCard, OtherMinutesCard } from './minutes/MinuteSideCards'
import { MinuteTodos } from './minutes/MinuteTodos'
import type { MinuteDraft } from './minutes/sections'
import s from './MinutesPage.module.css'

export function MinutesPage() {
  const { key } = useParams()
  // 실서버면 GET /projects/{key} (목업이면 mocks) — 목업 프로젝트 이름이 실서버 화면에 섞이지 않게
  const p = useProjectHeader(key).data ?? { projectKey: key ?? '', name: key ?? '' }
  // 실서버에는 목업에 없는 프로젝트도 있으니 주소의 키를 그대로 쓴다
  const projectKey = key ?? p.projectKey
  const projectName = p.projectKey === projectKey ? p.name : projectKey
  const list = useMinuteList(projectKey)
  return (
    <Loadable resource={list} label="회의록">
      {(l) =>
        l.latest ? (
          <MinutesView list={l} projectKey={projectKey} projectName={projectName} />
        ) : (
          <Card>
            <Empty>아직 회의록이 없어요.</Empty>
          </Card>
        )
      }
    </Loadable>
  )
}

type ViewProps = { list: MinuteList; projectKey: string; projectName: string }

function MinutesView({ list, projectKey, projectName }: ViewProps) {
  const latest = list.latest!
  const [currentId, setCurrentId] = useState(latest.id)
  const detail = useMinute(currentId)
  return (
    <Loadable resource={detail} label="회의록">
      {(d) => (
        <MinuteColumns
          key={d.minute.minuteId}
          detail={detail}
          d={d}
          list={list}
          isLatest={currentId === latest.id}
          onOpen={setCurrentId}
          projectKey={projectKey}
          projectName={projectName}
        />
      )}
    </Loadable>
  )
}

type ColumnsProps = {
  detail: Resource<MinuteView>
  d: MinuteView
  list: MinuteList
  isLatest: boolean
  onOpen: (id: number) => void
  projectKey: string
  projectName: string
}

function MinuteColumns({ detail, d, list, isLatest, onOpen, projectKey, projectName }: ColumnsProps) {
  const m = d.minute
  const latest = list.latest!
  const [selected, setSelected] = useState<number[]>(() => m.todos.filter((t) => !t.task).map((t) => t.id))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<MinuteDraft>({ agenda: '', discussion: '', decisions: '' })
  const [conflict, setConflict] = useState<MinuteConflict | null>(d.initialConflict)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (f: (x: Minute) => Minute) =>
    detail.setData((v) => {
      const next = { ...v, minute: f(v.minute) }
      keepMockMinute(next.minute)
      return next
    })
  const nextTask = useRef(52)

  const startEdit = () => {
    setDraft({ agenda: m.agenda.join('\n'), discussion: m.discussion.join('\n'), decisions: m.decisions.join('\n') })
    setEditing(true)
  }
  const save = async () => {
    const lines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean)
    const edited = { agenda: lines(draft.agenda), discussion: lines(draft.discussion), decisions: lines(draft.decisions) }
    setError(null)
    setSaving(true)
    try {
      const res = await whenLive(() => saveMinute(d, edited))
      if (res === undefined) {
        // 목업: 그 자리에서 바꾼다
        update((x) => ({ ...x, ...edited, version: x.version + 1 }))
      } else if (!res.ok) {
        // 409: 덮어쓰지 않았다. 최신 내용(버전)을 받아 두고, 고치던 내용은 편집기에 남긴다
        detail.setData(() => res.latest)
        setConflict(res.conflict)
        return
      } else {
        detail.setData(() => res.view)
      }
      setEditing(false)
      setConflict(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
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

  return (
    <Columns
      main={
        <Card className={s.main}>
          <Breadcrumb items={[{ label: projectName, to: `/projects/${projectKey}` }, { label: '회의록' }]} />
          <MinuteHeader m={m} editing={editing} saving={saving} error={error} onEdit={startEdit} onCancel={() => setEditing(false)} onSave={save} />
          <MinuteSections m={m} editing={editing} draft={draft} onDraft={setDraft} />
          <MinuteTodos m={m} projectKey={projectKey} selected={selected} onSelected={setSelected} onMakeTasks={makeTasks} />
        </Card>
      }
      side={
        <>
          {conflict && editing && <ConflictAlert conflict={conflict} />}
          <HistoryCard history={d.history} />
          <OtherMinutesCard projectKey={projectKey} others={list.others} latest={latest} isLatest={isLatest} onOpen={onOpen} />
        </>
      }
    />
  )
}
