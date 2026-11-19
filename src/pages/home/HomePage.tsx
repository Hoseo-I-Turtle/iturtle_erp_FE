import { Kanban, ListChecks, SquareCheck } from 'lucide-react'
import { Card, Loadable, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import {
  useHomeMustCheck,
  useHomeMyTasks,
  useHomeProjects,
  useHomeRecentNotices,
  useHomeReviewTasks,
  useHomeServices,
  useHomeWeekEvents,
} from '../../api/communication'
import { RecentNoticesCard, ServiceLinksCard, WeekEventsCard } from './sections/HomeSideCards'
import { MustCheckSection } from './sections/MustCheckSection'
import { MyProjectsGrid } from './sections/MyProjectsGrid'
import { TaskList } from './sections/TaskList'
import s from './HomePage.module.css'

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
            <MustCheckSection mustCheck={mustCheck} />
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
          <MyProjectsGrid myProjects={myProjects} />
        </div>

        <div className={s.right}>
          {/* 이번 주 일정 */}
          <WeekEventsCard weekEvents={weekEvents} />

          {/* 최근 공지 */}
          <RecentNoticesCard recentNotices={recentNotices} />

          {/* 서비스 바로 가기 */}
          <ServiceLinksCard services={services} />
        </div>
      </div>
    </>
  )
}
