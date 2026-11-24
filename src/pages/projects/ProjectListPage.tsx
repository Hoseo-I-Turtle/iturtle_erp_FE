import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Clock, FlaskConical, Lock, Plus } from 'lucide-react'
import { AvatarStack, Button, Chip, Empty, Loadable, Progress } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { MY_ROLE_NAME, PROJECT_CATEGORY_NAME } from '../../mocks/projects'
import { LoadMore } from '../../components/ui/LoadMore'
import { useLoadMore } from '../../api/useLoadMore'
import { fetchMoreProjects, projectCategoryName, useProjectList, type ProjectCard as Project, type ProjectListFilter } from '../../api/projects'
import { useMe } from '../../api/members'
import { ServiceIcon, StatusChip } from './common'
import { DeletedProjects } from './create/DeletedProjects'
import { ProjectCreateModal } from './create/ProjectCreateModal'
import s from './ProjectListPage.module.css'

/** 'ALL' 또는 공통코드 PROJECT_CATEGORY 코드 (실서버는 화면 기본 4개 밖의 코드도 온다) */
type Cat = string

export function ProjectListPage() {
  const [cat, setCat] = useState<Cat>('ALL')
  const [mine, setMine] = useState(false)
  const [activeOnly, setActiveOnly] = useState(false)
  const [archived, setArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  // 헤더 '새로 만들기' 메뉴는 /projects?new=1 로 보낸다 → 창을 열고 주소에서 new 를 지운다
  const [params, setParams] = useSearchParams()
  const requested = params.get('new') === '1'
  if (requested && !creating) setCreating(true)
  useEffect(() => {
    if (!requested) return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [requested, params, setParams])
  // 목업은 roles 가 null (역할을 따지지 않는다), 실서버에서 내 정보를 받기 전에는 빈 역할로 본다
  const me = useMe().data
  const roles = me === undefined ? [] : (me?.roles ?? null)
  const canCreate = roles == null || roles.includes('project-create')
  const canRestore = roles == null || roles.includes('project-manage')

  // 실서버는 조건을 서버가 거르고 탭 숫자(categoryCounts)도 서버가 센다. 목업은 화면이 거른다.
  const listFilter: ProjectListFilter = { category: cat, mine, activeOnly, archived }
  const res = useProjectList(listFilter)
  // 목록 끝에 닿으면 같은 조건의 다음 페이지를 이어 붙인다
  const more = useLoadMore(res, res.data?.hasNext, (d) => fetchMoreProjects(listFilter, d))
  // 다시 불러오는 동안에도 탭 숫자는 앞의 값을 보여 준다
  const count = (c: Cat) => res.data?.counts[c] ?? 0
  const filter = (all: Project[]) =>
    all.filter(
      (p) =>
        (cat === 'ALL' || p.categoryCode === cat) &&
        (!mine || p.myRole !== 'NONE') &&
        (!activeOnly || p.status === 'ACTIVE' || p.status === 'PREPARING'),
    )

  // 탭: 서버 개수(categoryCounts)에 나온 카테고리 + 기본 카테고리. 고른 탭은 개수가 0이 되어도 남긴다
  const known = res.data?.categories ?? Object.keys(PROJECT_CATEGORY_NAME).map((code) => ({ code, name: projectCategoryName(code) }))
  const cats = [
    { code: 'ALL', name: '전체' },
    ...known,
    ...(cat !== 'ALL' && !known.some((c) => c.code === cat) ? [{ code: cat, name: projectCategoryName(cat) }] : []),
  ]

  return (
    <>
      <PageHeader
        title="프로젝트"
        subtitle="연구실의 모든 일은 프로젝트로"
        action={
          canCreate ? (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              프로젝트 만들기
            </Button>
          ) : undefined
        }
      />

      <div className={s.toolbar}>
        <div className={s.cats}>
          {cats.map((c) => (
            <button
              key={c.code}
              type="button"
              className={c.code === cat ? `${s.cat} ${s.catOn}` : s.cat}
              onClick={() => setCat(c.code)}
            >
              {c.name} {count(c.code)}
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
          return (
            <>
              {list.length === 0 && !d.hasNext ? (
                <Empty>조건에 맞는 프로젝트가 없어요.</Empty>
              ) : (
                <div className={s.grid}>
                  {list.map((p) => (
                    <ProjectCard key={p.projectKey} p={p} />
                  ))}
                </div>
              )}
              <LoadMore more={more} />
            </>
          )
        }}
      </Loadable>
      <DeletedProjects enabled={canRestore} />
      {creating && canCreate && <ProjectCreateModal onClose={() => setCreating(false)} />}
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

function ProjectCard({ p }: { p: Project }) {
  const pct = Math.round((p.nextMilestone?.ratio ?? 0) * 100)
  return (
    <Link to={`/projects/${p.projectKey}`} className={s.card}>
      <div className={s.cardTop}>
        <Chip tone="tint">{p.categoryName ?? projectCategoryName(p.categoryCode)}</Chip>
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
