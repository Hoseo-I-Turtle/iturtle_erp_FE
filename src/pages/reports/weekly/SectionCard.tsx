import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { Chip } from '../../../components/ui'
import type { GithubActivity, MyWeekReport, ReportFields, ReportSectionView } from '../../../api/content'
import { FIELDS, sectionReady } from './constants'
import { TaskBox } from './TaskBox'
import s from '../WeeklyReportPage.module.css'

/**
 * 보고의 프로젝트 칸 하나 (2026-11-20): 한 일 · 계획 · 이슈 + 그 프로젝트 작업 · GitHub 활동. 접고 펼 수 있다.
 * readOnly(지난 주 · 남의 보고, ERP-39)면 글은 읽기만, 작업은 칩만, 제출 준비 표시는 없다.
 */
export function SectionCard({
  section,
  report,
  github,
  editable,
  onEdit,
  onRemoveTask,
  onRestoreTask,
  readOnly = false,
  children,
}: {
  section: ReportSectionView
  report: Pick<MyWeekReport, 'tasks'> & Partial<Pick<MyWeekReport, 'excluded'>>
  github: GithubActivity | undefined
  editable: boolean
  onEdit?: (projectKey: string, key: keyof ReportFields, value: string) => void
  onRemoveTask?: (key: string) => void
  onRestoreTask?: (key: string) => void
  readOnly?: boolean
  /** 칸 아래에 붙일 것 (칸 코멘트 등) */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const tasks = report.tasks.filter((t) => t.projectKey === section.projectKey)
  const excluded = readOnly ? [] : (report.excluded ?? []).filter((t) => t.projectKey === section.projectKey)
  const rows = github?.rows.filter((r) => r.projectKey === section.projectKey) ?? []
  const ready = sectionReady(section)
  return (
    <section className={s.section}>
      <button type="button" className={s.sectionHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <FolderKanban size={16} />
        <strong>{section.projectName}</strong>
        <span className={s.sectionKey}>{section.projectKey}</span>
        <span className={s.grow} />
        {section.detached ? (
          <Chip tone="muted">진행 중 아님 · 쓴 내용만 남김</Chip>
        ) : readOnly ? null : ready ? (
          <Chip tone="tint">채움</Chip>
        ) : (
          <Chip tone="warning">한 일 · 계획을 채워야 제출할 수 있어요</Chip>
        )}
      </button>
      {open && (
        <div className={s.sectionBody}>
          {FIELDS.map(({ key, label }) =>
            readOnly ? (
              <div key={key} className={s.field}>
                <span>{label}</span>
                <p className={s.readonly}>{section.fields[key] || '—'}</p>
              </div>
            ) : (
              <label key={key} className={s.field}>
                <span>
                  {label}
                  {key !== 'issues' && !section.detached && ' *'}
                </span>
                <textarea
                  value={section.fields[key]}
                  rows={2}
                  readOnly={!editable}
                  onChange={(e) => onEdit?.(section.projectKey, key, e.target.value)}
                />
              </label>
            ),
          )}
          {(tasks.length > 0 || excluded.length > 0) && (
            <TaskBox tasks={tasks} excluded={excluded} onRemove={onRemoveTask} onRestore={onRestoreTask} readOnly={readOnly} />
          )}
          {rows.length > 0 && (
            <ul className={s.sectionGithub}>
              {rows.map((r) => (
                <li key={r.repo + r.branch}>
                  <span>
                    {r.repo} <span className={s.branch}>{r.branch}</span>
                  </span>
                  <span>커밋 {r.commits}</span>
                  <span className={s.add}>+{r.add}</span>
                  <span className={s.del}>−{r.del}</span>
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
      )}
    </section>
  )
}
