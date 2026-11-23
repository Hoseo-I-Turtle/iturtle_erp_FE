// 일정표 목업 (Penpot 06 · 일정표 간트 · 담당자별 · 마일스톤 · 달력)
// 작업 · 마일스톤 필드는 docs/api/31-task.md T-1, 30-project.md P-28 을 따르고, 시작일(startOn)은 화면용 값이다.
import type { TaskStatus } from './tasks'

export type TimelineTask = {
  taskKey: string
  title: string
  status: TaskStatus
  assignee: string | null
  milestoneId: number | null
  /** 'YYYY-MM-DD'. 기한이 없으면 둘 다 null */
  startOn: string | null
  dueOn: string | null
  checklist: { done: number; total: number } | null
}

export type TimelineMilestone = {
  id: number
  name: string
  description?: string
  startOn: string | null
  dueOn: string | null
  closed: boolean
  /** 상태별 작업 수 (취소 제외) */
  counts: { todo: number; doing: number; review: number; done: number }
}

export type TimelineEvent = { id: string; date: string; time?: string; title: string }

const task = (
  taskKey: string,
  title: string,
  status: TaskStatus,
  assignee: string | null,
  milestoneId: number | null,
  startOn: string | null,
  dueOn: string | null,
  checklist: TimelineTask['checklist'] = null,
): TimelineTask => ({ taskKey, title, status, assignee, milestoneId, startOn, dueOn, checklist })

export const timelineTasks: TimelineTask[] = [
  task('DEFME-41', '로그인 화면 리팩터링 PR #128', 'IN_PROGRESS', '김민서', 21, '2026-11-09', '2026-11-18', { done: 2, total: 4 }),
  task('DEFME-44', 'OIDC 로그아웃 테스트 케이스', 'REVIEW', '박지훈', 21, '2026-11-12', '2026-11-20', { done: 5, total: 5 }),
  task('DEFME-48', '익명 투표 결과 API 점검', 'TODO', '이정훈', 21, '2026-11-16', '2026-11-20'),
  task('DEFME-46', 'MinIO 업로드 서명 만료 5분', 'IN_PROGRESS', '박지훈', 21, '2026-11-17', '2026-11-25', { done: 1, total: 3 }),
  task('DEFME-45', '캘린더 반복 일정 "이후 모두"', 'TODO', '최현우', 21, '2026-11-19', '2026-11-24', { done: 0, total: 4 }),
  task('DEFME-47', '알림 종류별 받기 / 안 받기', 'TODO', null, 21, '2026-11-24', '2026-12-01'),
  task('DEFME-40', 'client_id 만으로 로그아웃 받기', 'DONE', '김민서', 20, '2026-11-03', '2026-11-12', { done: 4, total: 4 }),
  task('DEFME-50', '운영 가이드 초안', 'TODO', '한유진', 22, '2026-11-23', '2026-12-08'),
  task('DEFME-51', '배포 체크리스트 정리', 'TODO', '이정훈', 22, '2026-12-07', '2026-12-15'),
  task('DEFME-57', '알림 메일 템플릿', 'TODO', '박지훈', 22, '2026-11-18', '2026-11-27'),
  task('DEFME-55', '간트 · 일정표 화면', 'TODO', '김민서', 23, '2026-12-14', '2026-12-30'),
  task('DEFME-56', '프로젝트 설정 · 보관 · 삭제', 'TODO', '김민서', 23, '2026-12-21', '2027-01-08'),
  task('DEFME-53', '감사 로그 내보내기 CSV', 'IN_PROGRESS', '이정훈', null, null, null),
]

export const timelineMilestones: TimelineMilestone[] = [
  { id: 20, name: 'v1.1 — SSO 5단계', startOn: '2026-10-05', dueOn: '2026-11-17', closed: true, counts: { todo: 0, doing: 0, review: 0, done: 12 } },
  { id: 21, name: 'v1.2 배포 — 공지 · 캘린더', startOn: '2026-11-02', dueOn: '2026-12-01', closed: false, counts: { todo: 2, doing: 2, review: 1, done: 9 } },
  { id: 22, name: '문서화 · 운영 가이드', startOn: '2026-11-18', dueOn: '2026-12-15', closed: false, counts: { todo: 5, doing: 2, review: 0, done: 3 } },
  { id: 23, name: 'v1.3 — 프로젝트 화면', startOn: '2026-12-14', dueOn: '2027-01-15', closed: false, counts: { todo: 6, doing: 0, review: 0, done: 0 } },
  { id: 24, name: 'v2.0 — 연구실 외부 공개', startOn: '2027-01-18', dueOn: '2027-03-12', closed: false, counts: { todo: 0, doing: 0, review: 0, done: 0 } },
]

export const timelineEvents: TimelineEvent[] = [
  { id: 't1', date: '2026-11-03', time: '10:00', title: '주간 회의' },
  { id: 't2', date: '2026-11-05', time: '14:00', title: '세미나 준비' },
  { id: 't3', date: '2026-11-10', time: '10:00', title: '주간 회의' },
  { id: 't4', date: '2026-11-17', time: '10:00', title: '주간 회의' },
  { id: 't5', date: '2026-11-19', time: '16:00', title: '11월 기술 세미나' },
  { id: 't6', date: '2026-11-24', time: '10:00', title: '주간 회의' },
  { id: 't7', date: '2026-11-26', time: '14:00', title: '중간 점검 회의' },
]
