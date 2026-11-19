// 주간 보고 목업 — docs/api/32-minute-report.md
export type ReportWeek = { label: string; range: string; deadline: string }

export const weeks: ReportWeek[] = [
  { label: '11월 2주차', range: '11/03 – 11/09', deadline: '11/10(월) 10:00' },
  { label: '11월 3주차', range: '11/10 – 11/16', deadline: '11/17(월) 10:00' },
]

export const myReport = {
  done: 'OIDC 로그아웃 6가지 테스트 작성 · 로그인 화면 리팩터링 리뷰 반영 · 세미나 발표 자료 초안',
  next: 'v1.2 공지 투표 화면 시안 · MinIO 업로드 API 설계 · 세미나 발표',
  issues: 'Testcontainers 가 Windows 에서 느림 — 설정 공유 부탁드려요',
  tasks: [
    { key: 'DEFME-40', title: 'client_id 로그아웃', status: '완료' },
    { key: 'DEFME-39', title: '포털 로그인 화면', status: '완료' },
    { key: 'SEM-5', title: '발표 목차', status: '완료' },
    { key: 'DEFME-44', title: '로그아웃 테스트', status: '검토' },
    { key: 'DEFME-41', title: '로그인 리팩터링', status: '진행 중' },
  ],
}

export const lastWeekReport = {
  done: 'SSO 5단계 마무리 · Penpot 콜백 경로 조사',
  next: 'OIDC 로그아웃 테스트 · 로그인 화면 리팩터링',
  issues: '',
}

export const github = {
  fetchedAgo: '3분 전',
  rows: [
    { repo: 'Hoseo-I-Turtle/defme_BE', branch: 'feature/oidc-logout', commits: 6, add: 320, del: 40 },
    { repo: 'Hoseo-I-Turtle/defme_BE', branch: 'test/logout-cases', commits: 3, add: 120, del: 30 },
    { repo: 'Hoseo-I-Turtle/defme_BE', branch: 'main', commits: 2, add: 18, del: 4 },
  ],
}

export type Submission = { name: string; state: 'SUBMITTED' | 'LATE' | 'MISSING'; summary?: string }
export const submissions: Submission[] = [
  { name: '김민서', state: 'SUBMITTED', summary: 'OIDC 로그아웃 테스트 · 로그인 리팩터링' },
  { name: '박지훈', state: 'SUBMITTED', summary: 'Penpot 이관 · Jenkins 파이프라인' },
  { name: '최현우', state: 'SUBMITTED', summary: '센서 수집기 안정화' },
  { name: '이정훈', state: 'SUBMITTED', summary: '코드 리뷰 세미나 준비' },
  { name: '강다은', state: 'SUBMITTED', summary: 'ML 실험 환경 구성' },
  { name: '문지호', state: 'SUBMITTED', summary: '디자인 시스템 컴포넌트 정리' },
  { name: '오세훈', state: 'LATE', summary: '프론트 공지 화면' },
  { name: '한유진', state: 'MISSING' },
  { name: '윤서연', state: 'MISSING' },
]

export const lastWeekComment = {
  author: '정재훈',
  confirmed: true,
  body: 'SSO 5단계 마무리 수고했어요. 로그아웃 테스트는 케이스 표로 문서에도 남겨 주세요.',
}
