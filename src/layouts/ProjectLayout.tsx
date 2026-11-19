import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ClipboardList,
  FlaskConical,
  Folder,
  House,
  Kanban,
  ListChecks,
  MessageSquare,
  Plus,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../components/ui'
import { PageHeader } from './PageHeader'
import { findProject, MY_ROLE_NAME } from '../mocks/projects'
import { projectCategoryName, useProjectHeader } from '../api/projects'
import s from './layout.module.css'

const TABS: { to: string; label: string; icon: LucideIcon; action?: string; actionTo?: string; subtitle?: string; hideTabs?: boolean }[] = [
  { to: '', label: '개요', icon: House, action: '작업 만들기' },
  { to: 'board', label: '보드', icon: Kanban, action: '작업 만들기', subtitle: '보드 · 상태 흐름은 모든 프로젝트가 같아요' },
  { to: 'tasks', label: '작업 목록', icon: ListChecks, action: '작업 만들기' },
  { to: 'milestones', label: '마일스톤', icon: FlaskConical, action: '마일스톤 만들기' },
  { to: 'threads', label: '스레드', icon: MessageSquare, action: '글 쓰기', actionTo: 'threads/new', subtitle: '글과 답글로 이야기하고, 고정 글은 게시판처럼 모아 봐요' },
  { to: 'minutes', label: '회의록', icon: ClipboardList, action: '회의록 쓰기', subtitle: '회의록 · 할 일은 바로 작업이 돼요', hideTabs: true },
  { to: 'files', label: '자료', icon: Folder, action: '자료 올리기' },
  { to: 'settings', label: '설정', icon: Settings, subtitle: '설정 · 프로젝트 관리자만 바꿀 수 있어요' },
]

/** 프로젝트 안 화면 공통: 제목 + 탭 */
export function ProjectLayout() {
  const { key } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 실서버면 GET /projects/{key}, 목업이면 mocks 에서 찾는다. 불러오는 동안은 이전 값 또는 목업으로 자리만 채운다.
  const header = useProjectHeader(key)
  const p = header.data ?? findProject(key)
  const loadingHeader = header.data === undefined
  const base = `/projects/${key ?? p.projectKey}`
  const sub = pathname.slice(base.length + 1).split('/')[0]
  const tab = TABS.find((t) => t.to === sub) ?? TABS[0]
  // 작업 상세 (tasks/DEFME-44) 는 탭 없이 보여 준다
  const isTaskDetail = sub === 'tasks' && pathname.split('/').length > 4

  const subtitle = [
    projectCategoryName(p.categoryCode),
    p.projectKey,
    p.visibility === 'LAB' ? '연구실 공개' : '비공개',
    p.myRole === 'NONE' ? '참여 안 함' : MY_ROLE_NAME[p.myRole].replace('내가 ', '내가 프로젝트 '),
  ].join(' · ')

  return (
    <>
      <PageHeader
        title={loadingHeader ? (header.error ? '프로젝트를 불러오지 못했어요' : '불러오는 중…') : p.name}
        subtitle={loadingHeader ? (header.error ?? '') : isTaskDetail ? '작업 상세' : (tab.subtitle ?? subtitle)}
        action={
          tab.action ? (
            <Button icon={Plus} onClick={() => tab.actionTo && navigate(`${base}/${tab.actionTo}`)}>
              {tab.action}
            </Button>
          ) : null
        }
      />
      {!isTaskDetail && !tab.hideTabs && (
      <nav className={s.projectTabs} aria-label="프로젝트 메뉴">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to ? `${base}/${to}` : base}
            end={!to}
            className={({ isActive }) => (isActive ? `${s.projectTab} ${s.projectTabOn}` : s.projectTab)}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      )}
      <Outlet />
    </>
  )
}
