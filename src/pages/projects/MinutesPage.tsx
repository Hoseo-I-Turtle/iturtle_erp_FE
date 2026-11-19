import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, ClipboardList, Clock, FileText, ListChecks, MapPin, Pencil, Plus, Save, TriangleAlert, Kanban, X } from 'lucide-react'
import { Avatar, Breadcrumb, Button, Card, Checkbox, Chip, Columns, Empty, ListItem, Loadable, Note, SectionHead } from '../../components/ui'
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
  type MinuteSection,
  type MinuteView,
} from '../../api/content'
import s from './MinutesPage.module.css'
import { useProjectHeader } from '../../api/projects'

type SectionKey = MinuteSection
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'agenda', label: '안건' },
  { key: 'discussion', label: '논의 내용' },
  { key: 'decisions', label: '결정 사항' },
]

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
  const [draft, setDraft] = useState<Record<SectionKey, string>>({ agenda: '', discussion: '', decisions: '' })
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
          <div className={s.titleRow}>
            <h2>{m.title}</h2>
            {editing ? (
              <>
                <Button variant="secondary" icon={X} onClick={() => setEditing(false)}>
                  취소
                </Button>
                <Button icon={Save} onClick={save} disabled={saving}>
                  저장
                </Button>
              </>
            ) : (
              <Button variant="secondary" icon={Pencil} onClick={startEdit}>
                수정
              </Button>
            )}
          </div>
          {error && (
            <Note icon={TriangleAlert} tone="warning">
              {error}
            </Note>
          )}
          <div className={s.chips}>
            <Chip tone="tint" icon={Clock}>
              {m.when}
            </Chip>
            <Chip tone="tint" icon={MapPin}>
              {m.place}
            </Chip>
            <Chip tone="tint" icon={Calendar}>
              {m.event}
            </Chip>
            <span className={s.template}>
              <FileText size={14} /> {m.template}
            </span>
          </div>
          <div className={s.people}>
            <span className={s.peopleLabel}>참석</span>
            {m.attendees.map((n) => (
              <span key={n} className={s.person}>
                <Avatar name={n} size={20} /> {n}
              </span>
            ))}
            {m.absent.length > 0 && <span className={s.peopleLabel}>불참</span>}
            {m.absent.map((n) => (
              <span key={n} className={`${s.person} ${s.absent}`}>
                <Avatar name={n} size={20} /> {n}
              </span>
            ))}
          </div>

          {SECTIONS.map(({ key: k, label }) => (
            <section key={k} className={s.section}>
              <h3>{label}</h3>
              {editing ? (
                <textarea
                  className={s.textarea}
                  value={draft[k]}
                  rows={Math.max(3, draft[k].split('\n').length + 1)}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  placeholder="한 줄에 하나씩"
                />
              ) : (
                <ul>
                  {m[k].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className={s.todos}>
            <div className={s.todoHead}>
              <ListChecks size={18} />
              <span>할 일 {m.todos.length}</span>
              <span className={s.grow} />
              <Button icon={Plus} onClick={makeTasks} disabled={selected.length === 0}>
                선택한 {selected.length}개 작업으로 만들기
              </Button>
            </div>
            {m.todos.map((t) => (
              <div key={t.id} className={selected.includes(t.id) ? `${s.todo} ${s.todoOn}` : s.todo}>
                {t.task ? (
                  <Kanban size={16} className={s.taskIcon} />
                ) : (
                  <Checkbox
                    checked={selected.includes(t.id)}
                    onChange={(v) => setSelected((xs) => (v ? [...xs, t.id] : xs.filter((x) => x !== t.id)))}
                  />
                )}
                <span className={s.todoText}>{t.text}</span>
                <Avatar name={t.assignee} size={22} />
                <span className={s.due}>
                  <Clock size={14} /> {t.dueOn}
                </span>
                {t.task && (
                  <Link to={`/projects/${projectKey}/tasks/${t.task.taskKey}`} className={s.taskLink}>
                    <strong>{t.task.taskKey}</strong> · {t.task.status}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      }
      side={
        <>
          {conflict && editing && (
            <div className={s.conflict} role="alert">
              <TriangleAlert size={18} />
              <div>
                <strong>다른 사람이 먼저 저장했어요</strong>
                <p>
                  {conflict.who} · {conflict.ago}. 내 수정은 덮어쓰지 않았어요. 새 내용을 보고 다시 고쳐 주세요.
                </p>
              </div>
            </div>
          )}
          <Card>
            <SectionHead icon={Clock} title="수정 이력" />
            {d.history.map((h) => (
              <ListItem
                key={h.who + h.ago + h.what}
                plain
                leading={<Avatar name={h.who} size={26} />}
                title={<small className={s.histWho}>{h.who}</small>}
                meta={`${h.ago} · ${h.what}`}
                // TODO: 이전 버전 보기 (MM-7 GET /meeting-minutes/{id}/revisions/{version}) — 보여 줄 화면이 아직 없다
                trailing={<button type="button" className={s.view}>보기</button>}
              />
            ))}
          </Card>
          <Card>
            <SectionHead icon={ClipboardList} title="다른 회의록" link={{ to: `/projects/${projectKey}/minutes`, label: '전체' }} />
            {list.others.map((o) => (
              <ListItem
                key={o.title}
                plain
                onClick={o.id ? () => onOpen(o.id) : undefined}
                title={o.title}
                meta={o.meta}
              />
            ))}
            {!isLatest && <ListItem plain onClick={() => onOpen(latest.id)} title={latest.title} meta="최근 회의록으로 돌아가기" />}
          </Card>
        </>
      }
    />
  )
}
