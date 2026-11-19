// 캘린더 목업 데이터
export type EventKind = 'meeting' | 'seminar' | 'deadline' | 'event' | 'conference' | 'off'
/** 어떤 "보기" 레이어에 속하는지 */
export type EventLayer = 'public' | 'personal' | 'member' | 'task'

export type CalEvent = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  time?: string // 없으면 하루 종일
  kind: EventKind
  layer: EventLayer
  place?: string
  attendees?: number
  /** 내가 참석자인 공용 일정 */
  mine?: boolean
  note?: string
}

export const KIND_META: Record<EventKind, { label: string; color: string }> = {
  meeting: { label: '회의', color: '#3f6593' },
  seminar: { label: '세미나', color: '#34c27a' },
  deadline: { label: '마감', color: '#e5484d' },
  event: { label: '행사', color: '#b26a00' },
  conference: { label: '학회', color: '#5b86b6' },
  off: { label: '휴무', color: '#9aa8b6' },
}

export const LAYER_META: Record<EventLayer, { label: string; desc: string; color: string; short: string }> = {
  public: { label: '공용 일정', desc: '연구실 전체 일정', color: '#3f6593', short: '공용' },
  personal: { label: '내 개인 일정', desc: '나만 보임', color: '#80aad3', short: '개인' },
  member: { label: '구성원 일정', desc: '구성원이 공유한 일정 (제목 · 바쁨)', color: '#9aa8b6', short: '구성원' },
  task: { label: '작업 기한 · 마일스톤', desc: '내 담당 작업과 프로젝트', color: '#5b86b6', short: '작업' },
}

const weekly = ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'].map((date, i) => ({
  id: `wk${i}`,
  date,
  title: '주간 회의',
  time: '14:00',
  kind: 'meeting' as const,
  layer: 'public' as const,
  place: '세미나실',
  attendees: 11,
  mine: true,
}))

export const events: CalEvent[] = [
  ...weekly,
  { id: 'e1', date: '2026-11-05', title: '기술 세미나', time: '10:00', kind: 'seminar', layer: 'public', place: '세미나실', attendees: 11, mine: true },
  { id: 'e2', date: '2026-11-12', title: 'v2 코드 프리즈', kind: 'deadline', layer: 'public' },
  { id: 'e3', date: '2026-11-17', title: '병원', time: '18:30', kind: 'off', layer: 'personal' },
  { id: 'e4', date: '2026-11-18', title: '박지훈: 바쁨', kind: 'off', layer: 'member' },
  { id: 'e5', date: '2026-11-19', title: '코드 리뷰 세미나', time: '10:00', kind: 'seminar', layer: 'public', place: '세미나실', attendees: 9, mine: true },
  { id: 'e6', date: '2026-11-19', title: '치과', time: '15:00', kind: 'off', layer: 'personal', note: '바쁨으로 공유' },
  { id: 'e7', date: '2026-11-19', title: 'DEFME-44 기한', kind: 'deadline', layer: 'task', note: '작업 · OIDC 로그아웃 테스트' },
  { id: 'e8', date: '2026-11-21', title: 'KCC 초록 마감', kind: 'deadline', layer: 'public' },
  { id: 'e9', date: '2026-11-27', title: '서버 점검', kind: 'event', layer: 'public' },
  { id: 'e10', date: '2026-11-28', title: 'PAPER-3 기한', kind: 'deadline', layer: 'task', note: '작업 · 초고 완성' },
  { id: 'e11', date: '2026-12-01', title: '마일스톤 v1.2 배포', kind: 'deadline', layer: 'task', note: '마일스톤 · DEFME 백엔드' },
]
