import { Link } from 'react-router-dom'
import { Clock, Kanban, ListChecks, Plus } from 'lucide-react'
import { Avatar, Button, Checkbox } from '../../../components/ui'
import type { Minute } from '../../../mocks/minutes'
import s from '../MinutesPage.module.css'

type Props = {
  m: Minute
  projectKey: string
  /** 작업으로 만들 할 일 */
  selected: number[]
  onSelected: (ids: number[]) => void
  onMakeTasks: () => void
}

/** 할 일: 골라서 작업으로 만들기 (이미 만든 것은 작업 링크) */
export function MinuteTodos({ m, projectKey, selected, onSelected, onMakeTasks }: Props) {
  return (
    <div className={s.todos}>
      <div className={s.todoHead}>
        <ListChecks size={18} />
        <span>할 일 {m.todos.length}</span>
        <span className={s.grow} />
        <Button icon={Plus} onClick={onMakeTasks} disabled={selected.length === 0}>
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
              onChange={(v) => onSelected(v ? [...selected, t.id] : selected.filter((x) => x !== t.id))}
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
  )
}
