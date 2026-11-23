import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ProjectLayout } from './layouts/ProjectLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminMembersPage } from './pages/admin/AdminMembersPage'
import { PresetsPage } from './pages/admin/PresetsPage'
import { SignupsPage } from './pages/admin/SignupsPage'
import { AccessAdminPage, FilesPage, OpsPage } from './pages/admin/OpsPages'
import { AuditPage } from './pages/admin/AuditPage'
import { CodesPage } from './pages/admin/CodesPage'
import { GithubPage } from './pages/admin/GithubPage'
import { HomePage } from './pages/home/HomePage'
import { NoticeDetailPage } from './pages/notices/NoticeDetailPage'
import { NoticeListPage } from './pages/notices/NoticeListPage'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { PollCreatePage } from './pages/calendar/PollCreatePage'
import { SchedulePollPage } from './pages/calendar/SchedulePollPage'
import { DeletedDocumentsPage } from './pages/library/DeletedDocumentsPage'
import { DocumentDetailPage } from './pages/library/DocumentDetailPage'
import { LibraryPage } from './pages/library/LibraryPage'
import { MembersPage } from './pages/members/MembersPage'
import { ProjectListPage } from './pages/projects/ProjectListPage'
import { ProjectFilesPage } from './pages/projects/ProjectFilesPage'
import { ProjectHomePage } from './pages/projects/ProjectHomePage'
import { BoardPage } from './pages/projects/BoardPage'
import { ThreadPage } from './pages/projects/ThreadPage'
import { TaskDetailPage } from './pages/projects/TaskDetailPage'
import { TaskListPage } from './pages/projects/TaskListPage'
import { TimelinePage } from './pages/projects/TimelinePage'
import { MinuteListPage } from './pages/projects/MinuteListPage'
import { MinuteRevisionsPage } from './pages/projects/MinuteRevisionsPage'
import { MinuteWritePage } from './pages/projects/MinuteWritePage'
import { MinutesPage } from './pages/projects/MinutesPage'
import { ProjectSettingsPage } from './pages/projects/ProjectSettingsPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { StartPage } from './pages/start/StartPage'
import { ModeGate } from './layouts/ModeGate'
import { LoginPage } from './pages/account/LoginPage'
import { PasswordChangePage } from './pages/account/PasswordChangePage'
import { SignupPage } from './pages/account/SignupPage'
import { AccessRequestPage } from './pages/account/AccessRequestPage'
import { ProfilePage } from './pages/account/ProfilePage'
import { SettingsPage, ThemeSettingsPage } from './pages/settings/SettingsPage'
import { SearchPage } from './pages/search/SearchPage'
import { MyTasksPage } from './pages/tasks/MyTasksPage'
import { NotificationsPage } from './pages/account/NotificationsPage'

const router = createBrowserRouter([
  { path: '/start', element: <StartPage /> },
  { path: '/login', element: <ModeGate><LoginPage /></ModeGate> },
  { path: '/password', element: <ModeGate><PasswordChangePage /></ModeGate> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/notices', element: <NoticeListPage /> },
      { path: '/notices/:id', element: <NoticeDetailPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/calendar/polls/new', element: <PollCreatePage /> },
      { path: '/calendar/polls/:id', element: <SchedulePollPage /> },

      { path: '/projects', element: <ProjectListPage /> },
      {
        path: '/projects/:key',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectHomePage /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'tasks', element: <TaskListPage /> },
          { path: 'tasks/:taskKey', element: <TaskDetailPage /> },
          { path: 'timeline', element: <TimelinePage key="timeline" /> },
          { path: 'milestones', element: <TimelinePage key="milestones" initialView="MILESTONE" /> },
          { path: 'threads', element: <ThreadPage /> },
          { path: 'threads/new', element: <ThreadPage /> },
          { path: 'minutes', element: <MinuteListPage /> },
          { path: 'minutes/new', element: <MinuteWritePage /> },
          { path: 'minutes/:minuteId', element: <MinutesPage /> },
          { path: 'minutes/:minuteId/revisions', element: <MinuteRevisionsPage /> },
          { path: 'files', element: <ProjectFilesPage /> },
          { path: 'settings', element: <ProjectSettingsPage /> },
        ],
      },
      { path: '/reports', element: <WeeklyReportPage /> },

      { path: '/library', element: <LibraryPage /> },
      { path: '/library/deleted', element: <DeletedDocumentsPage /> },
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
          { path: 'role-requests', element: <AccessAdminPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'codes', element: <CodesPage /> },
          { path: 'github', element: <GithubPage /> },
          { path: 'ops', element: <OpsPage /> },
          { path: 'files', element: <FilesPage /> },
        ],
      },
      { path: '/tasks', element: <MyTasksPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/access-requests', element: <AccessRequestPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/theme', element: <ThemeSettingsPage /> },
      { path: '/me', element: <ProfilePage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '*', element: <PlaceholderPage title="페이지를 찾을 수 없어요" /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
