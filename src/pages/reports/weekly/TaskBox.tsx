import { useState } from 'react'
import { Kanban, Plus, X } from 'lucide-react'
import { Chip } from '../../../components/ui'
import type { MyWeekReport } from '../../../api/content'
import s from '../WeeklyReportPage.module.css'

/**
 * 작업 연동: 그 주 내 작업 칩 · 빼기 · 뺀 작업 되돌리기.
 * readOnly(제출한 보고 · 지난 주 · 남의 보고, ERP-39)면 칩만 보여 주고 빼기 · 넣기는 없다.
 */
export function TaskBox({
  tasks,
  excluded = [],
  onRemove,
  onRestore,
  readOnly = false,
}: {
  tasks: MyWeekReport['tasks']
  excluded?: MyWeekReport['excluded']
  onRemove?: (key: string) => void
  onRestore?: (key: string) => void
  readOnly?: boolean
}) {
  const [picking, setPicking] = useState(false)
  const doneCount = tasks.filter((t) => t.status === '완료').length
  if (readOnly) {
    return (
      <div className={s.tasks}>
        <div className={s.boxHead}>
          <Kanban size={18} />
          <strong>작업 연동</strong>
          <span className={s.grow} />
          <small>
            그 주 완료 {doneCount} · 진행 중 {tasks.length - doneCount}
          </small>
        </div>
        <div className={s.taskChips}>
          {tasks.map((t) => (
            <span key={t.key} className={s.taskChip}>
              <Chip tone={t.status === '완료' ? 'brand' : t.status === '검토' ? 'warning' : 'tint'} className={t.status === '완료' ? s.doneChip : undefined}>
                {t.status}
              </Chip>
              <strong>{t.key}</strong> {t.title}
            </span>
          ))}
        </div>
      </div>
    )
  }
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
            <button type="button" aria-label="빼기" onClick={() => onRemove?.(t.key)}>
              <X size={14} />
            </button>
          </span>
        ))}
        {/* 백엔드는 자동 채우기 대상이 아닌 작업을 받지 않는다 (WR-3 P238). 그래서 "작업 넣기"는 뺀 작업 되돌리기다 */}
        <button
          type="button"
          className={s.addTask}
          onClick={() => setPicking((v) => !v)}
          disabled={excluded.length === 0}
          title={excluded.length === 0 ? '뺀 작업이 없어요' : undefined}
        >
          <Plus size={14} /> 작업 넣기
        </button>
      </div>
      {picking && excluded.length > 0 && (
        <div className={s.taskChips}>
          {excluded.map((t) => (
            <button
              key={t.key}
              type="button"
              className={s.addTask}
              onClick={() => {
                onRestore?.(t.key)
                if (excluded.length === 1) setPicking(false)
              }}
            >
              <Plus size={14} /> <strong>{t.key}</strong> {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
