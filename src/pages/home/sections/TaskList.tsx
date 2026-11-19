import { Clock } from 'lucide-react'
import { Chip, Empty } from '../../../components/ui'
import type { Task } from '../../../mocks/home'
import s from '../HomePage.module.css'

/** 작업 줄 목록: 키 · 제목 · 프로젝트 · 기한 · 상태 */
export function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <Empty>{empty}</Empty>
  return (
    <ul className={s.listTight}>
      {tasks.map((t) => (
        <li key={t.key} className={s.task}>
          <span className={s.taskKey}>{t.key}</span>
          <div className={s.rowText}>
            <div className={s.rowTitle}>{t.title}</div>
            <div className={s.rowMeta}>{t.project}</div>
          </div>
          {t.due && (
            <Chip tone={t.due.tone} icon={Clock}>
              {t.due.label}
            </Chip>
          )}
          <Chip tone={t.status.tone}>{t.status.label}</Chip>
        </li>
      ))}
    </ul>
  )
}
