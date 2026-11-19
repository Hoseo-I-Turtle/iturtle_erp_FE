// 알림 목업 — docs/api/20-communication.md 알림 부분
export type NotiType = 'MENTION' | 'TASK' | 'NOTICE' | 'CALENDAR' | 'ACCESS' | 'REPORT' | 'VOTE' | 'ASSIGN'
export type NotiFilter = 'ALL' | 'UNREAD' | 'MENTION' | 'TASK' | 'NOTICE_CAL' | 'ACCESS'

export type Notification = {
  id: number
  type: NotiType
  title: string
  short: string
  detail: string
  ago: string
  day: '오늘' | '어제'
  read: boolean
  grouped?: number
  to: string
}

export const notifications: Notification[] = [
  { id: 1, type: 'MENTION', title: '박지훈 님이 DEFME-44 에서 나를 멘션했어요', short: 'DEFME-44 에서 멘션', detail: '"미등록 돌아갈 주소일 때 응답 코드만 한 번 더 확인할게요."', ago: '20분 전', day: '오늘', read: false, to: '/projects/DEFME/tasks/DEFME-44' },
  { id: 2, type: 'TASK', title: 'DEFME-44 가 검토로 옮겨졌어요', short: 'DEFME-44 검토로 이동', detail: '구독한 작업 · 외 변경 2건을 묶었어요', ago: '1시간 전', day: '오늘', read: false, grouped: 3, to: '/projects/DEFME/tasks/DEFME-44' },
  { id: 3, type: 'NOTICE', title: '새 필독 공지: 11월 기술 세미나: 코드 리뷰 문화 도입', short: '새 필독 공지', detail: '이정훈 · 확인하기를 눌러 주세요', ago: '1시간 전', day: '오늘', read: false, to: '/notices/1' },
  { id: 4, type: 'CALENDAR', title: 'DEFME 중간 점검 회의 시간 정하기 응답을 기다려요', short: '모임 날짜 응답 대기', detail: '박지훈 · 마감 11/19(수) 18:00', ago: '2시간 전', day: '오늘', read: false, to: '/calendar/polls/1' },
  { id: 5, type: 'ACCESS', title: '권한 신청이 승인됐어요: DEFME · Vault 쓰기', short: '권한 신청 승인', detail: '프로젝트 관리자 박지훈 승인 · 11/30 까지 · 다음 로그인부터 반영', ago: '3시간 전', day: '오늘', read: false, to: '/me' },
  { id: 6, type: 'REPORT', title: '정재훈 교수님이 주간 보고에 코멘트를 남겼어요', short: '주간 보고 코멘트', detail: '11월 2주차', ago: '어제 18:20', day: '어제', read: true, to: '/reports' },
  { id: 7, type: 'VOTE', title: '12월 연구실 회식 날짜 투표가 열렸어요', short: '투표 열림', detail: '정교수 · 마감 11/20(목)', ago: '어제 09:12', day: '어제', read: true, to: '/notices/2' },
  { id: 8, type: 'ASSIGN', title: '11/17 주간 회의에서 할 일이 배정됐어요', short: '할 일 배정', detail: '공지 투표 UI 시안 정리 · 기한 11/20', ago: '어제 15:02', day: '어제', read: true, to: '/projects/DEFME/minutes' },
]

export const FILTER_MATCH: Record<NotiFilter, (n: Notification) => boolean> = {
  ALL: () => true,
  UNREAD: (n) => !n.read,
  MENTION: (n) => n.type === 'MENTION',
  TASK: (n) => n.type === 'TASK' || n.type === 'ASSIGN',
  NOTICE_CAL: (n) => ['NOTICE', 'CALENDAR', 'VOTE'].includes(n.type),
  ACCESS: (n) => n.type === 'ACCESS',
}
