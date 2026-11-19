// 프로젝트 목업 — 필드 이름은 docs/api/30-project.md 의 ProjectSummary 를 따른다
export type ProjectStatus = 'PREPARING' | 'ACTIVE' | 'DONE' | 'ARCHIVED'
export type ProjectCategory = 'DEV' | 'SEMINAR' | 'PAPER' | 'CONTEST'
export type ServiceCode = 'GITHUB' | 'JENKINS' | 'VAULT' | 'PENPOT'

export const PROJECT_CATEGORY_NAME: Record<ProjectCategory, string> = {
  DEV: '개발',
  SEMINAR: '세미나',
  PAPER: '논문',
  CONTEST: '공모전',
}
export const PROJECT_STATUS_NAME: Record<ProjectStatus, string> = {
  PREPARING: '준비',
  ACTIVE: '진행',
  DONE: '완료',
  ARCHIVED: '보관',
}
export const MY_ROLE_NAME = { MANAGER: '내가 관리자', MEMBER: '참여자', NONE: '참여 안 함' } as const

export type ProjectSummary = {
  projectKey: string
  name: string
  status: ProjectStatus
  visibility: 'LAB' | 'PRIVATE'
  categoryCode: ProjectCategory
  summary: string
  startsOn: string
  endsOn: string
  myRole: keyof typeof MY_ROLE_NAME
  memberPreview: string[]
  services: ServiceCode[]
  nextMilestone: { name: string; dueOn: string; ratio: number } | null
}

const P = (x: ProjectSummary) => x

export const projects: ProjectSummary[] = [
  P({ projectKey: 'DEFME', name: 'DEFME 백엔드', status: 'ACTIVE', visibility: 'LAB', categoryCode: 'DEV', summary: '연구실 ERP 와 SSO. Spring Boot 모듈러 모놀리스', startsOn: '2026-09-01', endsOn: '2027-02-28', myRole: 'MANAGER', memberPreview: ['김민서', '박지훈', '최현우'], services: ['GITHUB', 'JENKINS', 'VAULT', 'PENPOT'], nextMilestone: { name: 'v1.2 배포', dueOn: '12/1', ratio: 0.64 } }),
  P({ projectKey: 'SEM', name: '11월 기술 세미나', status: 'ACTIVE', visibility: 'LAB', categoryCode: 'SEMINAR', summary: '코드 리뷰 문화 도입 · 발표와 실습', startsOn: '2026-11-01', endsOn: '2026-11-30', myRole: 'MEMBER', memberPreview: ['이정훈', '김민서'], services: ['PENPOT'], nextMilestone: { name: '발표 준비', dueOn: '11/19', ratio: 0.4 } }),
  P({ projectKey: 'PAPER', name: 'KCC 2027 투고', status: 'ACTIVE', visibility: 'PRIVATE', categoryCode: 'PAPER', summary: 'SSO 기반 연구실 운영 플랫폼 사례 연구', startsOn: '2026-10-01', endsOn: '2027-04-30', myRole: 'MEMBER', memberPreview: ['정재훈', '김민서', '윤서연'], services: ['GITHUB'], nextMilestone: { name: '초고 완성', dueOn: '11/28', ratio: 0.25 } }),
  P({ projectKey: 'SENS', name: '매트 센서 데이터 수집', status: 'ACTIVE', visibility: 'LAB', categoryCode: 'DEV', summary: '센서 수집 파이프라인과 대시보드', startsOn: '2026-07-01', endsOn: '2027-01-31', myRole: 'NONE', memberPreview: ['최현우', '강다은'], services: ['GITHUB', 'JENKINS', 'VAULT'], nextMilestone: { name: '수집기 안정화', dueOn: '12/12', ratio: 0.72 } }),
  P({ projectKey: 'CAP', name: '캡스톤 디자인 경진대회', status: 'PREPARING', visibility: 'LAB', categoryCode: 'CONTEST', summary: '교내 캡스톤 경진대회 출품', startsOn: '2026-12-01', endsOn: '2027-03-31', myRole: 'NONE', memberPreview: ['오세훈', '한유진'], services: ['PENPOT'], nextMilestone: { name: '기획서 제출', dueOn: '12/20', ratio: 0.1 } }),
  P({ projectKey: 'SEM-D', name: '12월 논문 읽기 모임', status: 'PREPARING', visibility: 'LAB', categoryCode: 'SEMINAR', summary: '매주 금요일 논문 1편 발표', startsOn: '2026-12-01', endsOn: '2026-12-31', myRole: 'NONE', memberPreview: ['윤서연'], services: [], nextMilestone: { name: '목록 확정', dueOn: '12/5', ratio: 0 } }),
  P({ projectKey: 'ERP', name: '연구실 비품 관리', status: 'DONE', visibility: 'LAB', categoryCode: 'DEV', summary: '비품 대여 · 반납 기록', startsOn: '2026-03-01', endsOn: '2026-08-31', myRole: 'MEMBER', memberPreview: ['박지훈', '김민서'], services: ['GITHUB'], nextMilestone: null }),
  P({ projectKey: 'ICSE', name: 'ICSE 2026 투고', status: 'DONE', visibility: 'LAB', categoryCode: 'PAPER', summary: '코드 리뷰 자동화 실증 연구', startsOn: '2025-06-01', endsOn: '2025-09-30', myRole: 'NONE', memberPreview: ['이정훈', '정재훈'], services: [], nextMilestone: null }),
  P({ projectKey: 'OLD', name: '2025 연구실 홈페이지', status: 'ARCHIVED', visibility: 'LAB', categoryCode: 'DEV', summary: '이전 홈페이지 (보관)', startsOn: '2025-01-01', endsOn: '2025-06-30', myRole: 'NONE', memberPreview: ['오세훈'], services: ['GITHUB'], nextMilestone: null }),
]

export const findProject = (key?: string) => projects.find((p) => p.projectKey === key) ?? projects[0]
