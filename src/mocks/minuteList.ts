// 회의록 목록 목업 (Penpot 06 · 회의록 목록) — docs/api/32-minute-report.md MM-1
export type MinuteListItem = {
  minuteId: number
  title: string
  /** 'YYYY-MM-DD' */
  date: string
  /** '14:00–15:00' */
  time: string
  place: string | null
  /** 참석자 이름. 목록 API 가 이름을 주지 않으면 빈 배열 + attendeeCount */
  attendees: string[]
  attendeeCount: number
  /** 할 일: 끝낸 수(모르면 null) / 전체, 작업으로 만든 수 */
  actionDone: number | null
  actionCount: number
  convertedTaskCount: number
  author: string
  edited: string
  isNew?: boolean
}

export const minuteList: MinuteListItem[] = [
  { minuteId: 17, title: '11/19 주간 회의', date: '2026-11-19', time: '14:00–15:00', place: '본관 412호', attendees: ['김민서', '박지훈', '최현우', '이정훈', '한유진'], attendeeCount: 5, actionDone: 1, actionCount: 4, convertedTaskCount: 3, author: '김민서', edited: '방금 전', isNew: true },
  { minuteId: 16, title: '11/12 주간 회의 — SSO 5단계 회고', date: '2026-11-12', time: '14:00–15:10', place: '온라인', attendees: ['김민서', '박지훈', '이정훈'], attendeeCount: 3, actionDone: 5, actionCount: 5, convertedTaskCount: 4, author: '박지훈', edited: '11/12' },
  { minuteId: 15, title: '11월 기술 세미나 준비', date: '2026-11-07', time: '16:00–17:00', place: '본관 412호', attendees: ['김민서', '최현우'], attendeeCount: 2, actionDone: 2, actionCount: 3, convertedTaskCount: 1, author: '최현우', edited: '11/08' },
  { minuteId: 14, title: '11/5 주간 회의', date: '2026-11-05', time: '14:00–14:50', place: '본관 412호', attendees: ['김민서', '박지훈', '최현우', '이정훈'], attendeeCount: 4, actionDone: 2, actionCount: 2, convertedTaskCount: 2, author: '김민서', edited: '11/05' },
  { minuteId: 13, title: '10/29 주간 회의 — 배포 체크리스트', date: '2026-10-29', time: '14:00–15:00', place: '온라인', attendees: ['박지훈', '이정훈', '한유진'], attendeeCount: 3, actionDone: 6, actionCount: 6, convertedTaskCount: 5, author: '이정훈', edited: '10/30' },
  { minuteId: 12, title: '10/22 주간 회의', date: '2026-10-22', time: '14:00–15:00', place: '본관 412호', attendees: ['김민서', '박지훈', '최현우', '이정훈', '한유진'], attendeeCount: 5, actionDone: 3, actionCount: 3, convertedTaskCount: 2, author: '김민서', edited: '10/22' },
  { minuteId: 11, title: 'Vault 경로 정리 회의', date: '2026-10-15', time: '10:00–11:00', place: '본관 412호', attendees: ['박지훈', '김민서'], attendeeCount: 2, actionDone: 4, actionCount: 4, convertedTaskCount: 4, author: '박지훈', edited: '10/16' },
  { minuteId: 10, title: '10/8 주간 회의', date: '2026-10-08', time: '14:00–15:00', place: '본관 412호', attendees: ['김민서', '박지훈', '최현우'], attendeeCount: 3, actionDone: 1, actionCount: 1, convertedTaskCount: 0, author: '최현우', edited: '10/08' },
]

/** 옆 칸 "나에게 온 할 일" */
export type MyMinuteAction = { id: string; text: string; minuteTitle: string; dueOn: string; late: boolean; taskKey?: string; done: boolean }
export const myMinuteActions: MyMinuteAction[] = [
  { id: 'a1', text: '로그아웃 테스트 케이스 정리', minuteTitle: '11/19 주간 회의', dueOn: '11/21', late: false, done: false },
  { id: 'a2', text: '세미나 발표 자료 초안', minuteTitle: '11월 기술 세미나 준비', dueOn: '11/18', late: true, done: false },
  { id: 'a3', text: 'Vault 토큰 갱신 문서', minuteTitle: '11/12 주간 회의', dueOn: '11/26', late: false, taskKey: 'DEFME-52', done: false },
]
