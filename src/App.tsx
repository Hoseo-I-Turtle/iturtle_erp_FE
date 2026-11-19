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
import { NoticeListPage } from './pages/notices/NoticeListPage'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { SchedulePollPage } from './pages/calendar/SchedulePollPage'
import { LibraryPage } from './pages/library/LibraryPage'
import { DocumentDetailPage } from './pages/library/detail/DocumentDetailPage'
import { ProjectFilesPage } from './pages/projects/files/ProjectFilesPage'
import { MembersPage } from './pages/members/MembersPage'
import { ProjectListPage } from './pages/projects/ProjectListPage'
import { ProjectHomePage } from './pages/projects/ProjectHomePage'
import { BoardPage } from './pages/projects/BoardPage'
import { ThreadPage } from './pages/projects/ThreadPage'
import { TaskDetailPage } from './pages/projects/TaskDetailPage'
import { MinutesPage } from './pages/projects/MinutesPage'
import { MinuteListPage } from './pages/projects/MinuteListPage'
import { MinuteWritePage } from './pages/projects/MinuteWritePage'
import { ProjectSettingsPage } from './pages/projects/ProjectSettingsPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { TaskListPage } from './pages/projects/TaskListPage'
import { SchedulePage } from './pages/projects/SchedulePage'
import { MilestonesPage } from './pages/projects/MilestonesPage'
import { StartPage } from './pages/start/StartPage'
import { ModeGate } from './layouts/ModeGate'
import { LoginPage } from './pages/account/LoginPage'
import { LogoutPage } from './pages/account/LogoutPage'
import { PasswordChangePage } from './pages/account/PasswordChangePage'
import { AccountSetupPage } from './pages/account/AccountSetupPage'
import { SignupPage } from './pages/account/SignupPage'
import { ProfilePage } from './pages/account/ProfilePage'
import { NotificationsPage } from './pages/account/NotificationsPage'
import { IS_PROD } from './lib/dataMode'
import { applyLoginReturn } from './lib/loginReturn'

// 방금 로그인해서 / 에 왔으면, 로그인 화면으로 보내지기 전에 보던 주소로 바꾼 뒤 라우터를 만든다
applyLoginReturn()

/*
 * 백엔드가 브라우저를 보내는 화면 주소 (바꾸면 백엔드와 같이 바꿔야 한다)
 * - /login, /login?error, /login?logout, /login?expired  (AuthSecurityConfig, LoginFailureHandler, SsoLogoutSuccessHandler)
 * - /account/password  임시 비밀번호로 로그인했을 때 (PasswordChangeRequiredFilter.PASSWORD_PAGE)
 * - /account/setup#token=…  초대 메일 링크 (InvitationMailService, 로그인 없이)
 * - /, /?denied=<client_id>  로그인 성공 기본 주소, SSO 접근 역할이 없을 때 (LoginSuccessHandler, SsoAppAccessFilter)
 * - /profile?github=linked | error&code=G00x  GitHub 연결 결과 (GithubProperties.profileUrl 기본값)
 */
const router = createBrowserRouter([
  // 목업 / 실서버 고르기는 개발 서버에만 있다
  { path: '/start', element: IS_PROD ? <Navigate to="/" replace /> : <StartPage /> },
  { path: '/login', element: <ModeGate><LoginPage /></ModeGate> },
  { path: '/logout', element: <ModeGate><LogoutPage /></ModeGate> },
  { path: '/account/password', element: <ModeGate><PasswordChangePage /></ModeGate> },
  { path: '/account/setup', element: <ModeGate><AccountSetupPage /></ModeGate> },
  { path: '/password', element: <Navigate to="/account/password" replace /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      // 공지 목록 화면은 디자인에 아직 없어 최신 공지 상세로 보낸다
      // 공지 목록 화면은 아직 디자인 전 (docs/missing-screens.md) — 목업 공지로 보내지 않는다
      { path: '/notices', element: <NoticeListPage /> },
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
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'tasks', element: <TaskListPage /> },
          { path: 'tasks/:taskKey', element: <TaskDetailPage /> },
          { path: 'milestones', element: <MilestonesPage /> },
          { path: 'threads', element: <ThreadPage /> },
          { path: 'threads/new', element: <ThreadPage /> },
          { path: 'minutes', element: <MinuteListPage /> },
          { path: 'minutes/new', element: <MinuteWritePage /> },
          { path: 'minutes/:minuteId', element: <MinutesPage /> },
          { path: 'minutes/:minuteId/edit', element: <MinuteWritePage /> },
          { path: 'files', element: <ProjectFilesPage /> },
          { path: 'settings', element: <ProjectSettingsPage /> },
        ],
      },
      { path: '/reports', element: <WeeklyReportPage /> },

      { path: '/library', element: <LibraryPage /> },
      { path: '/library/:id', element: <DocumentDetailPage /> },
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
      { path: '/profile', element: <ProfilePage /> },
      // 예전 주소
      { path: '/me', element: <Navigate to="/profile" replace /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '*', element: <PlaceholderPage title="페이지를 찾을 수 없어요" /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
