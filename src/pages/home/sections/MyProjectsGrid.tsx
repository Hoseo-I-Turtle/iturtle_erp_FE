import { Link } from 'react-router-dom'
import { AvatarStack, Chip, Empty, Loadable, Progress } from '../../../components/ui'
import type { Resource } from '../../../api/useResource'
import type { ProjectSummary } from '../../../mocks/home'
import s from '../HomePage.module.css'

/** 내 프로젝트 카드 격자 */
export function MyProjectsGrid({ myProjects }: { myProjects: Resource<ProjectSummary[]> }) {
  return (
    <Loadable resource={myProjects} label="내 프로젝트">
      {(projects) =>
        projects.length === 0 ? (
          <Empty>참여 중인 프로젝트가 없어요.</Empty>
        ) : (
          <div className={s.projects}>
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className={s.project}>
                <div className={s.projectTop}>
                  <Chip tone="tint">{p.category}</Chip>
                  <span className={s.projectCode}>{p.code}</span>
                </div>
                <div className={s.projectName}>{p.name}</div>
                <div className={s.projectMs}>
                  <span>마일스톤 · {p.milestone}</span>
                  <strong>{p.progress}%</strong>
                </div>
                <Progress value={p.progress} />
                <div className={s.projectBottom}>
                  <AvatarStack names={p.members} />
                  <span>{p.activity}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      }
    </Loadable>
  )
}
