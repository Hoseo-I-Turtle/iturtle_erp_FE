// 회의록 목록 · 나에게 온 할 일 목업 — Penpot `Screen · 회의록 목록`
export type MinuteRow = {
  minuteId: number
  title: string
  month: number
  day: number
  weekday: string
  /** '14:00–15:00' */
  time: string
  /** 장소 또는 '온라인' */
  place: string
  /** 참석한 사람 (앞에서 몇 명) */
  attendees: string[]
  attendeeCount: number
  actionTotal: number
  actionDone: number
  /** 작업으로 만든 할 일 수 */
  converted: number
  author: string
  /** '수정 방금 전' */
  edited: string
  /** 내 임시 저장 */
  draft: boolean
  /** 게시한 지 하루 안 */
  isNew: boolean
}

export type MyMinuteAction = {
  actionId: number
  minuteId: number
  content: string
  minuteTitle: string
  /** '~11/21' */
  due: string
  overdue: boolean
  /** 연구실 회의 할 일 (체크로 관리) */
  lab: boolean
  projectKey: string | null
  /** 작업으로 만들었으면 그 작업 키 */
  taskKey: string | null
}

export const minuteRows: MinuteRow[] = [
  {
    minuteId: 17, title: '11/19 주간 회의', month: 11, day: 19, weekday: '목', time: '14:00–15:00', place: '본관 412호',
    attendees: ['김민서', '박지훈', '최현우', '이정훈', '한유진'], attendeeCount: 5, actionTotal: 4, actionDone: 1, converted: 3,
    author: '김민서', edited: '수정 방금 전', draft: false, isNew: true,
  },
  {
    minuteId: 16, title: '11/12 주간 회의 — SSO 5단계 회고', month: 11, day: 12, weekday: '목', time: '14:00–15:10', place: '온라인',
    attendees: ['김민서', '박지훈', '이정훈'], attendeeCount: 3, actionTotal: 5, actionDone: 5, converted: 4,
    author: '박지훈', edited: '수정 11/12', draft: false, isNew: false,
  },
  {
    minuteId: 15, title: '11월 기술 세미나 준비', month: 11, day: 7, weekday: '토', time: '16:00–17:00', place: '본관 412호',
    attendees: ['김민서', '최현우'], attendeeCount: 2, actionTotal: 3, actionDone: 2, converted: 1,
    author: '최현우', edited: '수정 11/08', draft: false, isNew: false,
  },
  {
    minuteId: 14, title: '11/5 주간 회의', month: 11, day: 5, weekday: '목', time: '14:00–14:50', place: '본관 412호',
    attendees: ['김민서', '박지훈', '최현우', '이정훈'], attendeeCount: 4, actionTotal: 2, actionDone: 2, converted: 2,
    author: '김민서', edited: '수정 11/05', draft: false, isNew: false,
  },
  {
    minuteId: 13, title: '10/29 주간 회의 — 배포 체크리스트', month: 10, day: 29, weekday: '목', time: '14:00–15:00', place: '온라인',
    attendees: ['박지훈', '이정훈', '한유진'], attendeeCount: 3, actionTotal: 6, actionDone: 6, converted: 5,
    author: '이정훈', edited: '수정 10/30', draft: false, isNew: false,
  },
  {
    minuteId: 12, title: '10/22 주간 회의', month: 10, day: 22, weekday: '목', time: '14:00–15:00', place: '본관 412호',
    attendees: ['김민서', '박지훈'], attendeeCount: 2, actionTotal: 2, actionDone: 2, converted: 0,
    author: '박지훈', edited: '수정 10/22', draft: false, isNew: false,
  },
  {
    minuteId: 11, title: '10/15 주간 회의', month: 10, day: 15, weekday: '목', time: '14:00–15:00', place: '본관 412호',
    attendees: ['김민서', '최현우', '이정훈'], attendeeCount: 3, actionTotal: 3, actionDone: 3, converted: 1,
    author: '김민서', edited: '수정 10/15', draft: false, isNew: false,
  },
  {
    minuteId: 10, title: '10/8 주간 회의', month: 10, day: 8, weekday: '목', time: '14:00–15:00', place: '온라인',
    attendees: ['김민서', '박지훈', '한유진'], attendeeCount: 3, actionTotal: 1, actionDone: 1, converted: 1,
    author: '한유진', edited: '수정 10/08', draft: false, isNew: false,
  },
]

export const myMinuteActions: MyMinuteAction[] = [
  { actionId: 3, minuteId: 17, content: '로그아웃 테스트 케이스 정리', minuteTitle: '11/19 주간 회의', due: '~11/21', overdue: false, lab: false, projectKey: 'DEFME', taskKey: null },
  { actionId: 7, minuteId: 15, content: '세미나 발표 자료 초안', minuteTitle: '11월 기술 세미나 준비', due: '~11/18', overdue: true, lab: true, projectKey: null, taskKey: null },
  { actionId: 9, minuteId: 16, content: 'Vault 토큰 갱신 문서', minuteTitle: '11/12 주간 회의', due: '~11/26', overdue: false, lab: false, projectKey: 'DEFME', taskKey: 'DEFME-52' },
]
