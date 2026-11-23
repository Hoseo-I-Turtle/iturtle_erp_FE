// 홈 화면 목업 데이터 — 백엔드 API가 생기면 이 파일을 fetch 호출로 교체한다.
import type { ChipTone } from '../components/ui'

export type MustCheckKind = 'notice' | 'vote' | 'schedule-poll' | 'report'
export type MustCheck = {
  id: string
  kind: MustCheckKind
  label: string
  title: string
  meta: string
  action: string
  to: string
}

export type Task = {
  key: string
  title: string
  project: string
  due?: { label: string; tone: ChipTone }
  status: { label: string; tone: ChipTone }
}

export type ProjectSummary = {
  id: string
  category: string
  code: string
  name: string
  milestone: string
  progress: number
  members: string[]
  activity: string
}

export type EventScope = '공용' | '개인'
export type WeekEvent = {
  id: string
  title: string
  meta: string
  scope: EventScope
  color: string
}

export type NoticeSummary = { id: string; title: string; meta: string; pinned?: boolean }

export type Service = { name: string; desc: string; icon: 'penpot' | 'jenkins' | 'vault' | 'github'; enabled: boolean; url?: string }

export const mustCheck: MustCheck[] = [
  {
    id: 'n1',
    kind: 'notice',
    label: '필독 공지',
    title: '11월 기술 세미나: 코드 리뷰 문화 도입',
    meta: '이정훈 · 1시간 전 · 8명 확인 / 3명 미확인',
    action: '확인하기',
    to: '/notices/1',
  },
  {
    id: 'v1',
    kind: 'vote',
    label: '투표',
    title: '12월 연구실 회식 날짜',
    meta: '공지에 포함된 투표 · 마감 11/20(목) 18:00 · D-3',
    action: '투표하기',
    to: '/notices/2',
  },
  {
    id: 'p1',
    kind: 'schedule-poll',
    label: '모임 날짜',
    title: 'DEFME 중간 점검 회의 시간 정하기',
    meta: '박지훈 · 응답 5/8명 · 마감 11/19(수)',
    action: '응답하기',
    to: '/calendar/polls/1',
  },
  {
    id: 'r1',
    kind: 'report',
    label: '주간 보고',
    title: '11월 2주차 주간 보고를 아직 내지 않았어요',
    meta: '마감 11/17(월) 10:00 · 오늘',
    action: '작성하기',
    to: '/reports',
  },
]

export const myTasks: Task[] = [
  {
    key: 'DEFME-41',
    title: '로그인 화면 리팩터링 PR #128 반영',
    project: 'DEFME 백엔드 · 개발',
    due: { label: '어제', tone: 'danger' },
    status: { label: '진행 중', tone: 'brand' },
  },
  {
    key: 'DEFME-44',
    title: 'OIDC 로그아웃 테스트 케이스 추가',
    project: 'DEFME 백엔드 · 개발',
    due: { label: '11/18', tone: 'warning' },
    status: { label: '검토', tone: 'warning' },
  },
  {
    key: 'SEM-7',
    title: '코드 리뷰 문화 세미나 발표 자료',
    project: '11월 기술 세미나 · 세미나',
    due: { label: '11/19', tone: 'warning' },
    status: { label: '할 일', tone: 'tint' },
  },
]

export const myProjects: ProjectSummary[] = [
  {
    id: 'defme',
    category: '개발',
    code: 'DEFME',
    name: 'DEFME 백엔드',
    milestone: 'v1.2 배포',
    progress: 64,
    members: ['김민서', '박지훈', '최유진'],
    activity: '방금 · 작업 2개 완료',
  },
  {
    id: 'sem',
    category: '세미나',
    code: 'SEM',
    name: '11월 기술 세미나',
    milestone: '발표 준비',
    progress: 40,
    members: ['이정훈', '김민서'],
    activity: '1시간 전 · 회의록',
  },
  {
    id: 'paper',
    category: '논문',
    code: 'PAPER',
    name: 'KCC 2027 투고',
    milestone: '초고 완성',
    progress: 25,
    members: ['정교수', '김민서'],
    activity: '어제 · 자료 1개',
  },
]

export const weekEvents: WeekEvent[] = [
  { id: 'e1', title: '연구실 주간 회의', meta: '오늘 14:00 · 세미나실', scope: '공용', color: 'var(--accent-2)' },
  { id: 'e2', title: '코드 리뷰 세미나', meta: '11/19(수) 10:00 · 세미나실', scope: '공용', color: 'var(--status-positive)' },
  { id: 'e3', title: '치과 예약', meta: '11/19(수) 15:00 · 바쁨으로 공유', scope: '개인', color: 'var(--accent-line)' },
  { id: 'e4', title: 'KCC 초록 마감', meta: '11/21(금) · 하루 종일', scope: '공용', color: 'var(--status-negative)' },
]

export const recentNotices: NoticeSummary[] = [
  { id: '1', title: '11월 기술 세미나: 코드 리뷰 문화 도입', meta: '필독 · 이정훈 · 1시간 전', pinned: true },
  { id: '2', title: '12월 연구실 회식 날짜 투표', meta: '투표 진행 중 · 정교수 · 어제' },
  { id: '3', title: '서버 점검 안내 (11/27)', meta: '박지훈 · 3일 전' },
]

export const services: Service[] = [
  { name: 'Penpot', desc: '디자인', icon: 'penpot', enabled: true },
  { name: 'Jenkins', desc: '빌드 · 배포', icon: 'jenkins', enabled: true },
  { name: 'Vault', desc: '권한 없음', icon: 'vault', enabled: false },
  { name: 'GitHub', desc: '연결됨', icon: 'github', enabled: true },
]
