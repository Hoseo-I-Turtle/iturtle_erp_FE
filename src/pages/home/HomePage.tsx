import { Link } from 'react-router-dom'
import {
  Calendar,
  ClipboardList,
  Clock,
  GitBranch,
  Image,
  Kanban,
  LayoutGrid,
  ListChecks,
  Lock,
  Megaphone,
  Pin,
  Play,
  SquareCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { AvatarStack, Card, Chip, Empty, Loadable, Progress, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import type { MustCheckKind, Service, Task } from '../../mocks/home'
import {
  useHomeMustCheck,
  useHomeMyTasks,
  useHomeProjects,
  useHomeRecentNotices,
  useHomeReviewTasks,
  useHomeServices,
  useHomeWeekEvents,
} from '../../api/communication'
import s from './HomePage.module.css'

const KIND_ICON: Record<MustCheckKind, LucideIcon> = {
  notice: Megaphone,
  vote: SquareCheck,
  'schedule-poll': Calendar,
  report: ClipboardList,
}

const SERVICE_ICON: Record<Service['icon'], LucideIcon> = {
  penpot: Image,
  jenkins: Play,
  vault: Lock,
  github: GitBranch,
}

// 홈 API 는 따로 없다. 칸마다 따로 불러, 한 칸이 실패해도 나머지는 보인다 (docs/api/60-common.md 1장)
export function HomePage() {
  const mustCheck = useHomeMustCheck()
  const myTasks = useHomeMyTasks()
  const reviewTasks = useHomeReviewTasks()
  const myProjects = useHomeProjects()
  const weekEvents = useHomeWeekEvents()
  const recentNotices = useHomeRecentNotices()
  const services = useHomeServices()

  // 꼭 확인할 것 · 검토 대기는 비면 칸을 숨긴다
  const showMustCheck = !(mustCheck.data && mustCheck.data.length === 0)
  const showReview = !!reviewTasks.data?.length || !!reviewTasks.error

  return (
    <>
      <PageHeader title="홈" subtitle="오늘 확인할 것과 내 일을 한눈에" />

      <div className={s.body}>
        <div className={s.left}>
          {/* 꼭 확인할 것 */}
          {showMustCheck && (
            <section className={s.mustCheck}>
              <SectionHead
                icon={TriangleAlert}
                title="꼭 확인할 것"
                extra={mustCheck.data && <Chip tone="count">{mustCheck.data.length}</Chip>}
                onDark
              />
              <Loadable resource={mustCheck} label="꼭 확인할 것">
                {(items) => (
                  <ul className={s.list}>
                    {items.map((m) => {
                      const Icon = KIND_ICON[m.kind]
                      return (
                        <li key={m.id} className={s.mustItem}>
                          <Icon size={20} strokeWidth={2} className={s.mustIcon} />
                          <Chip tone="brand">{m.label}</Chip>
                          <div className={s.rowText}>
                            <div className={s.mustTitle}>{m.title}</div>
                            <div className={s.mustMeta}>{m.meta}</div>
                          </div>
                          <Link to={m.to} className={s.mustAction}>
                            {m.action}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Loadable>
            </section>
          )}

          {/* 내 작업 */}
          <Card className={s.tasksCard}>
            <SectionHead icon={ListChecks} title="내 작업" link={{ to: '/projects', label: '모두 보기' }} />
            <Loadable resource={myTasks} label="내 작업">
              {(tasks) => <TaskList tasks={tasks} empty="담당한 작업이 없어요." />}
            </Loadable>
          </Card>

          {/* 검토를 기다리는 작업 (비면 숨김) */}
          {showReview && (
            <Card className={s.tasksCard}>
              <SectionHead icon={SquareCheck} title="검토를 기다리는 작업" />
              <Loadable resource={reviewTasks} label="검토를 기다리는 작업">
                {(tasks) => <TaskList tasks={tasks} empty="검토할 작업이 없어요." />}
              </Loadable>
            </Card>
          )}

          {/* 내 프로젝트 */}
          <SectionHead icon={Kanban} title="내 프로젝트" link={{ to: '/projects', label: '프로젝트 목록' }} />
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
        </div>

        <div className={s.right}>
          {/* 이번 주 일정 */}
          <Card>
            <SectionHead icon={Calendar} title="이번 주 일정" link={{ to: '/calendar', label: '캘린더' }} />
            <Loadable resource={weekEvents} label="이번 주 일정">
              {(events) =>
                events.length === 0 ? (
                  <Empty>일정 없음</Empty>
                ) : (
                  <ul className={s.list}>
                    {events.map((e) => (
                      <li key={e.id} className={s.event}>
                        <span className={s.eventBar} style={{ background: e.color }} />
                        <div className={s.rowText}>
                          <div className={s.rowTitle}>{e.title}</div>
                          <div className={s.rowMeta}>{e.meta}</div>
                        </div>
                        <Chip tone="tint">{e.scope}</Chip>
                      </li>
                    ))}
                  </ul>
                )
              }
            </Loadable>
          </Card>

          {/* 최근 공지 */}
          <Card>
            <SectionHead icon={Megaphone} title="최근 공지" link={{ to: '/notices', label: '전체' }} />
            <Loadable resource={recentNotices} label="최근 공지">
              {(notices) =>
                notices.length === 0 ? (
                  <Empty>공지가 없어요.</Empty>
                ) : (
                  <ul className={s.list}>
                    {notices.map((n) => (
                      <li key={n.id}>
                        <Link to={`/notices/${n.id}`} className={s.notice}>
                          {n.pinned && <Pin size={16} strokeWidth={2} className={s.noticePin} />}
                          <div className={s.rowText}>
                            <div className={s.rowTitle}>{n.title}</div>
                            <div className={s.rowMeta}>{n.meta}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            </Loadable>
          </Card>

          {/* 서비스 바로 가기 */}
          <Card>
            <SectionHead icon={LayoutGrid} title="서비스 바로 가기" />
            <Loadable resource={services} label="서비스 바로 가기">
              {(list) => (
                <div className={s.services}>
                  {list.map((svc) => {
                    const Icon = SERVICE_ICON[svc.icon]
                    return (
                      <a
                        key={svc.name}
                        href={svc.enabled ? svc.url ?? '#' : undefined}
                        aria-disabled={!svc.enabled}
                        className={svc.enabled ? s.service : `${s.service} ${s.serviceDisabled}`}
                      >
                        <Icon size={22} strokeWidth={2} />
                        <span className={s.serviceName}>{svc.name}</span>
                        <span className={s.serviceDesc}>{svc.desc}</span>
                      </a>
                    )
                  })}
                </div>
              )}
            </Loadable>
          </Card>
        </div>
      </div>
    </>
  )
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
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
