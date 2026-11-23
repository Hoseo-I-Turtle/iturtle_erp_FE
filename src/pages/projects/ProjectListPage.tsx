import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Clock, FlaskConical, Lock, Plus } from 'lucide-react'
import { AvatarStack, Button, Chip, Empty, Loadable, Progress } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { MY_ROLE_NAME, PROJECT_CATEGORY_NAME, type ProjectCategory, type ProjectSummary } from '../../mocks/projects'
import { useProjectList } from '../../api/projects'
import { ServiceIcon, StatusChip } from './common'
import { ProjectCreateModal } from './ProjectCreateModal'
import s from './ProjectListPage.module.css'

type Cat = 'ALL' | ProjectCategory

export function ProjectListPage() {
  const [cat, setCat] = useState<Cat>('ALL')
  const [mine, setMine] = useState(false)
  const [activeOnly, setActiveOnly] = useState(false)
  const [archived, setArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  // 실서버는 조건을 서버가 거르고 탭 숫자(categoryCounts)도 서버가 센다. 목업은 화면이 거른다.
  const res = useProjectList({ category: cat, mine, activeOnly, archived })
  // 다시 불러오는 동안에도 탭 숫자는 앞의 값을 보여 준다
  const count = (c: Cat) => res.data?.counts[c] ?? 0
  const filter = (all: ProjectSummary[]) =>
    all.filter(
      (p) =>
        (cat === 'ALL' || p.categoryCode === cat) &&
        (!mine || p.myRole !== 'NONE') &&
        (!activeOnly || p.status === 'ACTIVE' || p.status === 'PREPARING'),
    )

  const cats: Cat[] = ['ALL', ...(Object.keys(PROJECT_CATEGORY_NAME) as ProjectCategory[])]

  return (
    <>
      <PageHeader
        title="프로젝트"
        subtitle="연구실의 모든 일은 프로젝트로"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            프로젝트 만들기
          </Button>
        }
      />
      {creating && (
        <ProjectCreateModal
          onClose={() => setCreating(false)}
          onCreated={(projectKey, failed) => {
            setCreating(false)
            // 연동 서비스 연결이 실패했으면 설정 화면으로 보내 다시 하게 한다
            navigate(failed.length ? `/projects/${projectKey}/settings` : `/projects/${projectKey}`)
          }}
        />
      )}

      <div className={s.toolbar}>
        <div className={s.cats}>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={c === cat ? `${s.cat} ${s.catOn}` : s.cat}
              onClick={() => setCat(c)}
            >
              {c === 'ALL' ? '전체' : PROJECT_CATEGORY_NAME[c]} {count(c)}
            </button>
          ))}
        </div>
        <div className={s.opts}>
          <Toggle on={mine} onClick={() => setMine(!mine)}>
            내 프로젝트
          </Toggle>
          <Toggle on={activeOnly} onClick={() => setActiveOnly(!activeOnly)}>
            진행
          </Toggle>
          <Toggle on={archived} onClick={() => setArchived(!archived)}>
            보관 포함
          </Toggle>
        </div>
      </div>

      <Loadable resource={res} label="프로젝트 목록">
        {(d) => {
          const list = filter(d.projects)
          return list.length === 0 ? (
            <Empty>조건에 맞는 프로젝트가 없어요.</Empty>
          ) : (
            <div className={s.grid}>
              {list.map((p) => (
                <ProjectCard key={p.projectKey} p={p} />
              ))}
            </div>
          )
        }}
      </Loadable>
    </>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={on ? `${s.toggle} ${s.toggleOn}` : s.toggle} onClick={onClick} aria-pressed={on}>
      {on && <Check size={14} />}
      {children}
    </button>
  )
}

function ProjectCard({ p }: { p: ProjectSummary }) {
  const pct = Math.round((p.nextMilestone?.ratio ?? 0) * 100)
  return (
    <Link to={`/projects/${p.projectKey}`} className={s.card}>
      <div className={s.cardTop}>
        <Chip tone="tint">{PROJECT_CATEGORY_NAME[p.categoryCode]}</Chip>
        <span className={s.key}>{p.projectKey}</span>
        {p.visibility === 'PRIVATE' && (
          <Chip tone="warning" icon={Lock}>
            비공개
          </Chip>
        )}
        <span className={s.grow} />
        <StatusChip status={p.status} />
      </div>
      <h2 className={s.name}>{p.name}</h2>
      <p className={s.summary}>{p.summary}</p>
      {p.nextMilestone ? (
        <>
          <div className={s.ms}>
            <FlaskConical size={14} />
            <span>마일스톤 · {p.nextMilestone.name}</span>
            <strong>{pct}%</strong>
          </div>
          <Progress value={pct} />
        </>
      ) : (
        <div className={s.ms}>
          <FlaskConical size={14} />
          <span>열린 마일스톤 없음</span>
        </div>
      )}
      <div className={s.bottom}>
        <AvatarStack names={p.memberPreview} />
        {p.services.map((sv) => (
          <ServiceIcon key={sv} code={sv} className={s.svc} />
        ))}
        <span className={s.grow} />
        <span className={s.role}>{MY_ROLE_NAME[p.myRole]}</span>
        {p.nextMilestone && (
          <span className={s.due}>
            <Clock size={14} />
            {p.nextMilestone.dueOn}
          </span>
        )}
      </div>
    </Link>
  )
}
