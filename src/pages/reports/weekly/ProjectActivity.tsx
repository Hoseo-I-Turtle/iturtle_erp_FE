import { FolderKanban, GitBranch } from 'lucide-react'
import type { GithubActivity, MyWeekReport, ReportTaskChip } from '../../../api/content'
import { TaskBox } from './TaskBox'
import s from '../WeeklyReportPage.module.css'

type GithubRows = GithubActivity['rows']
type ActivityActions = {
  readOnly?: boolean
  onRemoveTask?: (key: string) => void
  onRestoreTask?: (key: string) => void
}

export function ProjectActivity({
  tasks,
  excluded = [],
  githubRows,
  readOnly,
  onRemoveTask,
  onRestoreTask,
}: ActivityActions & { tasks: ReportTaskChip[]; excluded?: ReportTaskChip[]; githubRows: GithubRows }) {
  return (
    <>
      {(tasks.length > 0 || excluded.length > 0) && (
        <TaskBox tasks={tasks} excluded={excluded} onRemove={onRemoveTask} onRestore={onRestoreTask} readOnly={readOnly} />
      )}
      {githubRows.length > 0 && (
        <div>
          <div className={s.boxHead}>
            <GitBranch size={16} />
            <strong>GitHub 활동</strong>
          </div>
          <ul className={s.sectionGithub}>
            {githubRows.map((r) => (
              <li key={JSON.stringify([r.repo, r.branch])}>
                <span>
                  {r.repo} {r.branch && <span className={s.branch}>{r.branch}</span>}
                </span>
                <span>커밋 {r.commits}</span>
                <span className={s.add}>+{r.add}</span>
                <span className={s.del}>−{r.del}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/** 보고 칸이 없는 프로젝트에도 그 주의 작업과 GitHub 활동이 있을 수 있다. */
export function AdditionalProjectActivity({
  report,
  github,
  ...actions
}: ActivityActions & {
  report: Pick<MyWeekReport, 'sections' | 'tasks'> & Partial<Pick<MyWeekReport, 'excluded'>>
  github?: GithubActivity
}) {
  const sectionKeys = new Set(report.sections.map((section) => section.projectKey))
  const tasks = report.tasks.filter((task) => !sectionKeys.has(task.projectKey))
  const excluded = actions.readOnly ? [] : (report.excluded ?? []).filter((task) => !sectionKeys.has(task.projectKey))
  const rows = github?.rows ?? []
  const projects = new Set([...tasks.map((t) => t.projectKey), ...excluded.map((t) => t.projectKey)])
  for (const row of rows) {
    if (row.projectKey && !sectionKeys.has(row.projectKey)) projects.add(row.projectKey)
  }

  return [...projects].map((projectKey) => (
    <section key={projectKey} className={s.section}>
      <h3 className={s.sectionHead}>
        <FolderKanban size={16} />
        <strong>{projectKey}</strong>
      </h3>
      <div className={s.sectionBody}>
        <ProjectActivity
          tasks={tasks.filter((task) => task.projectKey === projectKey)}
          excluded={excluded.filter((task) => task.projectKey === projectKey)}
          githubRows={rows.filter((row) => row.projectKey === projectKey)}
          {...actions}
        />
      </div>
    </section>
  ))
}
