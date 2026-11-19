// 작업 목업 — 필드 이름은 docs/api/31-task.md 를 따른다
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type TaskType = 'TASK' | 'BUG' | 'RESEARCH'

export const STATUS_NAME: Record<TaskStatus, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  REVIEW: '검토',
  DONE: '완료',
}
export const PRIORITY_NAME: Record<TaskPriority, string> = {
  LOW: '낮음',
  NORMAL: '보통',
  HIGH: '높음',
  URGENT: '긴급',
}
export const TYPE_NAME: Record<TaskType, string> = { TASK: '작업', BUG: '버그', RESEARCH: '조사' }

export type Task = {
  taskKey: string
  title: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  labels: string[]
  milestone: string | null
  dueOn: string | null // 'M/D'
  dueState?: 'overdue' | 'soon'
  checklist: { done: number; total: number } | null
  commentCount: number
  assignee: string | null
  requester: string
}

const t = (x: Partial<Task> & Pick<Task, 'taskKey' | 'title' | 'status'>): Task => ({
  type: 'TASK',
  priority: 'NORMAL',
  labels: [],
  milestone: 'v1.2 배포 — 공지 · 캘린더',
  dueOn: null,
  checklist: null,
  commentCount: 0,
  assignee: null,
  requester: '김민서',
  ...x,
})

export const tasks: Task[] = [
  t({ taskKey: 'DEFME-47', title: '알림 종류별 받기 / 안 받기 설정', status: 'TODO', labels: ['알림'], dueOn: '12/1' }),
  t({ taskKey: 'DEFME-45', title: '캘린더 반복 일정 "이후 모든 일정" 수정', status: 'TODO', priority: 'HIGH', labels: ['캘린더'], dueOn: '11/24', checklist: { done: 0, total: 4 }, commentCount: 1, assignee: '최현우' }),
  t({ taskKey: 'DEFME-48', title: '익명 투표 결과 API 에 투표자 ID 노출 여부 점검', status: 'TODO', type: 'RESEARCH', priority: 'URGENT', labels: ['보안', '공지'], dueOn: '11/20', dueState: 'soon', commentCount: 2, assignee: '이정훈' }),
  t({ taskKey: 'DEFME-50', title: '공지 첨부파일 미리보기', status: 'TODO', priority: 'LOW', labels: ['공지', '파일'], milestone: '문서화 · 운영 가이드', assignee: '한유진' }),
  t({ taskKey: 'DEFME-51', title: '운영 가이드 초안', status: 'TODO', labels: ['문서'], milestone: '문서화 · 운영 가이드', dueOn: '12/10', assignee: '박지훈' }),
  t({ taskKey: 'DEFME-52', title: '구성원 졸업 처리 시 Vault 토큰 회수', status: 'TODO', priority: 'HIGH', labels: ['vault'], assignee: '김민서' }),
  t({ taskKey: 'DEFME-41', title: '로그인 화면 리팩터링 PR #128 반영', status: 'IN_PROGRESS', priority: 'HIGH', labels: ['auth'], dueOn: '어제', dueState: 'overdue', checklist: { done: 3, total: 5 }, commentCount: 4, assignee: '김민서', requester: '박지훈' }),
  t({ taskKey: 'DEFME-46', title: 'MinIO 업로드 서명 주소 만료 5분', status: 'IN_PROGRESS', labels: ['파일'], dueOn: '11/25', checklist: { done: 1, total: 3 }, assignee: '박지훈' }),
  t({ taskKey: 'DEFME-49', title: 'Jenkins 상태 카드 캐시 5분 적용', status: 'IN_PROGRESS', priority: 'LOW', labels: ['연동'], assignee: '한유진' }),
  t({ taskKey: 'DEFME-53', title: '감사 로그 내보내기 CSV', status: 'IN_PROGRESS', labels: ['관리'], assignee: '이정훈' }),
  t({ taskKey: 'DEFME-44', title: 'OIDC 로그아웃 테스트 케이스 추가', status: 'REVIEW', labels: ['sso', '테스트'], dueOn: '11/18', dueState: 'soon', checklist: { done: 5, total: 5 }, commentCount: 3, assignee: '박지훈', requester: '김민서' }),
  t({ taskKey: 'DEFME-43', title: 'Penpot 2.x 콜백 경로 마이그레이션', status: 'REVIEW', type: 'BUG', priority: 'HIGH', labels: ['sso'], commentCount: 1, assignee: '김민서' }),
  t({ taskKey: 'DEFME-40', title: 'client_id 만으로 로그아웃 받기', status: 'DONE', priority: 'HIGH', labels: ['sso'], milestone: 'v1.1 — SSO 5단계', checklist: { done: 4, total: 4 }, commentCount: 6, assignee: '김민서' }),
  t({ taskKey: 'DEFME-39', title: '서비스 로그아웃 → 포털 로그인 화면', status: 'DONE', labels: ['sso'], milestone: 'v1.1 — SSO 5단계', commentCount: 2, assignee: '박지훈' }),
  t({ taskKey: 'DEFME-38', title: 'Vault 역할 세 단계로 나누기', status: 'DONE', labels: ['vault'], milestone: 'v1.1 — SSO 5단계', assignee: '박지훈' }),
]

export const findTask = (key?: string) => tasks.find((x) => x.taskKey === key) ?? tasks.find((x) => x.taskKey === 'DEFME-44')!

/** 작업 상세 목업 (어느 작업이든 같은 상세 내용을 붙여 보여 준다) */
export const taskDetailExtra = {
  description:
    'Penpot 2.x 는 id_token_hint 없이 client_id · logout_hint 만 보내므로, 이 경우의 로그아웃 6가지를 테스트로 고정한다.\n기존 ID 토큰 로그아웃 동작은 그대로여야 한다.',
  checklist: [
    { text: 'ID 토큰으로 로그아웃', done: true },
    { text: 'client_id 로 로그아웃', done: true },
    { text: '이미 로그아웃된 상태', done: true },
    { text: '미등록 서비스', done: true },
    { text: '미등록 돌아갈 주소', done: true },
  ],
  attachments: [{ name: 'logout-cases.png', size: '240KB' }],
  comments: [
    { author: '김민서', ago: '1시간 전', body: '@박지훈 6가지 다 통과했어요. 리뷰 부탁드려요!' },
    { author: '박지훈', ago: '20분 전', body: '미등록 돌아갈 주소일 때 응답 코드만 한 번 더 확인할게요.' },
  ],
  activity: [
    { who: '박지훈', text: '상태를 진행 중 → 검토로 바꿨어요', ago: '1시간 전' },
    { who: '김민서', text: '체크리스트 5개를 모두 완료했어요', ago: '2시간 전' },
    { who: '김민서', text: '상태를 할 일 → 진행 중으로 바꿨어요', ago: '11/11' },
    { who: '박지훈', text: '작업을 만들었어요 (회의록 11/10 주간 회의)', ago: '11/10' },
  ],
  subscribers: ['김민서', '박지훈', '이정훈', '정재훈'],
  links: [
    { kind: 'minutes', title: '11/10 주간 회의', meta: '회의록에서 만든 작업' },
    { kind: 'pr', title: 'PR #131 test/oidc-logout', meta: 'GitHub · 열림' },
    { kind: 'build', title: 'Jenkins #141', meta: '성공 · 어제' },
  ] as const,
}
