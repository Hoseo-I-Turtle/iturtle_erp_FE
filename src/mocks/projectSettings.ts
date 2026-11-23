// 프로젝트 설정 목업 (Penpot 06 · 프로젝트 설정 · 참여자 / 연동 서비스 / 권한 신청) — docs/api/30-project.md, 10-member.md 7장
export type SettingsMember = {
  memberId: number
  name: string
  /** 로그인 아이디. 실서버 응답에는 없어 빈 문자열 */
  loginId: string
  typeText: string
  role: 'MANAGER' | 'MEMBER'
  joinedOn: string
  /** 서비스 권한: '기본' 또는 개별로 준 수준 */
  access: string
}

export const settingsMembers: SettingsMember[] = [
  { memberId: 1, name: '김민서', loginId: 'jam759', typeText: '학생 · 재실', role: 'MANAGER', joinedOn: '2026.09.01', access: '기본' },
  { memberId: 2, name: '박지훈', loginId: 'jihoon', typeText: '학생 · 재실', role: 'MANAGER', joinedOn: '2026.09.01', access: '기본' },
  { memberId: 3, name: '최현우', loginId: 'hyunwoo', typeText: '학생 · 재실', role: 'MEMBER', joinedOn: '2026.09.14', access: '기본' },
  { memberId: 4, name: '이정훈', loginId: 'jhlee', typeText: '학생 · 재실', role: 'MEMBER', joinedOn: '2026.10.02', access: 'Vault 쓰기 (개별)' },
  { memberId: 5, name: '한유진', loginId: 'yujin', typeText: '인턴', role: 'MEMBER', joinedOn: '2026.11.03', access: 'Jenkins 읽기 (개별)' },
]

export const formerMembers = [
  { memberId: 21, name: '오세훈', leftOn: '2026.10.20' },
  { memberId: 22, name: '윤서연', leftOn: '2026.09.30' },
]

/** 참여자로 더할 수 있는 재실 구성원 */
export const memberCandidates = [
  { memberId: 21, name: '오세훈', typeText: '학생 · 재실' },
  { memberId: 22, name: '윤서연', typeText: '학생 · 재실' },
  { memberId: 23, name: '강다은', typeText: '학생 · 재실' },
  { memberId: 24, name: '정교수', typeText: '교수' },
]

export type LinkService = 'GITHUB' | 'JENKINS' | 'VAULT' | 'PENPOT' | 'OTHER'
export type ProjectLinkView = {
  linkId: number
  service: LinkService
  displayName: string
  url: string
  /** 서버가 주소에서 꺼낸 대상 (저장소 · 작업 · 경로) */
  externalRef: string
  description: string
  status: 'OK' | 'UNAVAILABLE' | 'NOT_SUPPORTED'
  statusText: string
  /** GitHub 연결만: 줄 수에서 뺄 파일 (gitignore 형식) */
  locExcludePatterns?: string
}

export const projectLinks: ProjectLinkView[] = [
  { linkId: 9, service: 'GITHUB', displayName: 'defme_BE', url: 'https://github.com/Hoseo-I-Turtle/defme_BE', externalRef: 'Hoseo-I-Turtle/defme_BE · main', description: '', status: 'OK', statusText: '이번 주 커밋 23 · 열린 PR 2', locExcludePatterns: 'package-lock.json\npnpm-lock.yaml\n*.min.js\nbuild/\ndist/\n**/generated/**' },
  { linkId: 7, service: 'JENKINS', displayName: 'defme_BE 배포', url: 'https://lab.iturtle.win/jenkins/job/Hoseo-I-Turtle/job/defme_BE/', externalRef: 'Hoseo-I-Turtle/defme_BE', description: '', status: 'OK', statusText: '빌드 #142 성공 · main · 4분 12초 · 3분 전' },
  { linkId: 8, service: 'VAULT', displayName: '비밀값', url: 'https://vault.iturtle.win/ui/vault/secrets/secret/kv/projects%2Fdefme%2F', externalRef: 'secret/projects/defme/', description: '비밀값은 Vault 에서만 보여요', status: 'NOT_SUPPORTED', statusText: '경로와 바로 가기만 보여요' },
  { linkId: 10, service: 'PENPOT', displayName: 'DEFME 화면', url: 'https://penpot.iturtle.win/#/workspace', externalRef: '파일 3개', description: '', status: 'UNAVAILABLE', statusText: '바로 가기는 그대로 열려요' },
  { linkId: 11, service: 'OTHER', displayName: 'Swagger', url: 'https://lab.iturtle.win/defme/swagger-ui', externalRef: 'https://lab.iturtle.win/defme/swagger-ui', description: '', status: 'NOT_SUPPORTED', statusText: '' },
]

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type AccessRequestView = {
  requestId: number
  requester: string
  ago: string
  /** 'Vault' · 'Jenkins' · 연구실 역할 이름 */
  target: string
  /** 프로젝트 이름 (연구실 역할 신청이면 null) */
  project: string | null
  currentLevel: string | null
  level: string | null
  reason: string
  /** '2026.12.31' · '1주' · '' */
  expires: string
  /** 'YYYY-MM-DD' 또는 '' (승인 때 기한 고치기용) */
  expiresOn: string
  status: RequestStatus
  /** 처리한 사람 · 결과 설명 */
  reviewer: string
  note: string
  canReview: boolean
  approverLabel: string
}

export const projectRequests: AccessRequestView[] = [
  { requestId: 41, requester: '한유진', ago: '30분 전', target: 'Jenkins', project: 'DEFME 백엔드', currentLevel: '읽기', level: '빌드', reason: '테스트 자동화 작업 설정을 직접 고쳐야 해요', expires: '2026.12.31', expiresOn: '2026-12-31', status: 'PENDING', reviewer: '', note: '', canReview: true, approverLabel: 'DEFME 프로젝트 관리자' },
  { requestId: 40, requester: '최현우', ago: '어제', target: 'Vault', project: 'DEFME 백엔드', currentLevel: '읽기', level: '쓰기', reason: 'DB 비밀번호 교체 작업 (DEFME-52)', expires: '1주', expiresOn: '', status: 'PENDING', reviewer: '', note: '', canReview: true, approverLabel: 'DEFME 프로젝트 관리자' },
  { requestId: 38, requester: '박지훈', ago: '11/16', target: 'Vault', project: 'DEFME 백엔드', currentLevel: '읽기', level: '쓰기', reason: 'OIDC 클라이언트 시크릿 교체', expires: '2026.11.30', expiresOn: '2026-11-30', status: 'APPROVED', reviewer: '김민서', note: '11/30 만료 · 3일 전 알림 예정', canReview: false, approverLabel: 'DEFME 프로젝트 관리자' },
  { requestId: 36, requester: '이정훈', ago: '11/12', target: 'Jenkins', project: 'DEFME 백엔드', currentLevel: '읽기', level: '빌드', reason: '직접 배포해 보려고요', expires: '', expiresOn: '', status: 'REJECTED', reviewer: '김민서', note: '배포는 담당자만 해요. 필요하면 김민서에게 요청해 주세요', canReview: false, approverLabel: 'DEFME 프로젝트 관리자' },
  { requestId: 31, requester: '오세훈', ago: '10/27', target: 'Vault', project: 'DEFME 백엔드', currentLevel: '읽기', level: '쓰기', reason: '환경 변수 정리', expires: '2026.11.10', expiresOn: '2026-11-10', status: 'EXPIRED', reviewer: '시스템', note: '11/10 기한 만료 · 기본값(읽기)으로', canReview: false, approverLabel: 'DEFME 프로젝트 관리자' },
]
