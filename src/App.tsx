import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ProjectLayout } from './layouts/ProjectLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminMembersPage } from './pages/admin/AdminMembersPage'
import { PresetsPage } from './pages/admin/PresetsPage'
import { SignupsPage } from './pages/admin/SignupsPage'
import { RoleRequestsPage } from './pages/admin/RoleRequestsPage'
import { AuditPage } from './pages/admin/AuditPage'
import { CodesPage } from './pages/admin/CodesPage'
import { GithubPage } from './pages/admin/GithubPage'
import { HomePage } from './pages/home/HomePage'
import { NoticeDetailPage } from './pages/notices/NoticeDetailPage'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { SchedulePollPage } from './pages/calendar/SchedulePollPage'
import { LibraryPage } from './pages/library/LibraryPage'
import { MembersPage } from './pages/members/MembersPage'
import { ProjectListPage } from './pages/projects/ProjectListPage'
import { ProjectHomePage } from './pages/projects/ProjectHomePage'
import { BoardPage } from './pages/projects/BoardPage'
import { ThreadPage } from './pages/projects/ThreadPage'
import { TaskDetailPage } from './pages/projects/TaskDetailPage'
import { MinutesPage } from './pages/projects/MinutesPage'
import { ProjectSettingsPage } from './pages/projects/ProjectSettingsPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { StartPage } from './pages/start/StartPage'
import { LoginPage } from './pages/account/LoginPage'
import { PasswordChangePage } from './pages/account/PasswordChangePage'
import { SignupPage } from './pages/account/SignupPage'
import { ProfilePage } from './pages/account/ProfilePage'
import { NotificationsPage } from './pages/account/NotificationsPage'

const router = createBrowserRouter([
  { path: '/start', element: <StartPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/password', element: <PasswordChangePage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      // 공지 목록 화면은 디자인에 아직 없어 최신 공지 상세로 보낸다
      { path: '/notices', element: <Navigate to="/notices/2" replace /> },
      { path: '/notices/:id', element: <NoticeDetailPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/calendar/polls/:id', element: <SchedulePollPage /> },

      { path: '/projects', element: <ProjectListPage /> },
      {
        path: '/projects/:key',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectHomePage /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'tasks', element: <PlaceholderPage title="작업 목록" bare /> },
          { path: 'tasks/:taskKey', element: <TaskDetailPage /> },
          { path: 'milestones', element: <PlaceholderPage title="마일스톤" bare /> },
          { path: 'threads', element: <ThreadPage /> },
          { path: 'threads/new', element: <ThreadPage /> },
          { path: 'minutes', element: <MinutesPage /> },
          { path: 'files', element: <PlaceholderPage title="자료" bare /> },
          { path: 'settings', element: <ProjectSettingsPage /> },
        ],
      },
      { path: '/reports', element: <WeeklyReportPage /> },

      { path: '/library', element: <LibraryPage /> },
      { path: '/library/:id', element: <PlaceholderPage title="자료 상세" /> },
      { path: '/members', element: <MembersPage /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="members" replace /> },
          { path: 'members', element: <AdminMembersPage /> },
          { path: 'presets', element: <PresetsPage /> },
          { path: 'signups', element: <SignupsPage /> },
          { path: 'role-requests', element: <RoleRequestsPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'codes', element: <CodesPage /> },
          { path: 'github', element: <GithubPage /> },
        ],
      },
      { path: '/me', element: <ProfilePage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '*', element: <PlaceholderPage title="페이지를 찾을 수 없어요" /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
