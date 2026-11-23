// 관리 · 권한 신청 / 감사 로그 / 공통코드 / GitHub 목업
export type RoleRequest = {
  id: number
  who: string
  ago: string
  target: string
  reason: string
  period: string
  project: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  note?: string
  handledBy?: string
}

export const roleRequests: RoleRequest[] = [
  { id: 1, who: '최현우', ago: '30분 전', target: 'SENS · Vault 쓰기', reason: '센서 수집기 DB 비밀번호 교체 · 승인: SENS 프로젝트 관리자', period: '1주', project: '매트 센서 데이터 수집', status: 'PENDING' },
  { id: 2, who: '한유진', ago: '어제', target: 'DEFME · Jenkins 빌드', reason: '테스트 자동화 작업 설정을 직접 고쳐야 해요', period: '2026.12.31', project: 'DEFME 백엔드', status: 'PENDING' },
  { id: 3, who: '이정훈', ago: '2일 전', target: 'LAB · Vault 읽기', reason: '', period: '', project: '', status: 'APPROVED', note: '11/30 만료 · 3일 전 알림 예정', handledBy: '김민서' },
  { id: 4, who: '오세훈', ago: '3일 전', target: 'jenkins-admin', reason: '', period: '', project: '', status: 'REJECTED', note: '관리 역할은 신청할 수 없어요', handledBy: '정재훈' },
  { id: 5, who: '박지훈', ago: '1주 전', target: 'DEFME · Vault 쓰기', reason: '', period: '', project: '', status: 'EXPIRED', note: '11/10 기한 만료 · 기본값(읽기)으로', handledBy: '시스템' },
]
export const ROLE_REQUEST_TOTALS = { APPROVED: 8, REJECTED: 1, EXPIRED: 3 }

export type AuditCategory = '권한' | '프로젝트' | '로그인' | '운영' | '콘텐츠' | '구성원'
export type AuditLog = {
  at: string
  actor: string
  category: AuditCategory
  action: string
  target: string
  change: string
  ip: string
  ok: boolean
}

export const auditLogs: AuditLog[] = [
  { at: '11/17 10:42', actor: '김민서', category: '권한', action: '역할 변경', target: '구성원 20221187 박지훈', change: '[report-write, project-create] → [report-write, project-create, penpot-member]', ip: '10.8.0.12', ok: true },
  { at: '11/17 10:40', actor: '김민서', category: '권한', action: '프리셋 반영', target: '프리셋 학생 기본', change: 'penpot-member 추가 · 적용한 구성원 7명에게 반영', ip: '10.8.0.12', ok: true },
  { at: '11/17 09:58', actor: '시스템', category: '권한', action: '기한 회수', target: '프로젝트 DEFME · 박지훈', change: 'DEFME Vault 쓰기 기한 만료 → 프로젝트 기본값(읽기)', ip: '-', ok: true },
  { at: '11/17 09:31', actor: '박지훈', category: '프로젝트', action: '서비스 권한', target: '프로젝트 DEFME', change: '한유진: Vault 읽기 → 없음 · Jenkins 빌드 → 읽기', ip: '10.8.0.27', ok: true },
  { at: '11/17 09:12', actor: '정재훈', category: '로그인', action: '로그인', target: 'jhjung', change: 'Chrome · Windows', ip: '10.8.0.5', ok: true },
  { at: '11/17 08:55', actor: '(알 수 없음)', category: '로그인', action: '로그인', target: 'hyunwoo', change: '비밀번호 5회 연속 틀림 → 5분 잠김', ip: '10.8.0.44', ok: false },
  { at: '11/16 22:10', actor: '김민서', category: '운영', action: 'secret 발급', target: '서비스 penpot', change: 'client secret 새로 발급 (값은 남기지 않음)', ip: '10.8.0.12', ok: true },
  { at: '11/16 18:03', actor: '이정훈', category: '콘텐츠', action: '자료 삭제', target: '자료 #212', change: '다른 사람의 자료를 숨김 · 30일 뒤 완전 삭제', ip: '10.8.0.31', ok: true },
  { at: '11/16 15:20', actor: '김민서', category: '구성원', action: '구성원 생성', target: '구성원 I2026002 문지호', change: '구분 인턴 · 프리셋 인턴 기본 · 임시 비밀번호 발급', ip: '10.8.0.12', ok: true },
  { at: '11/16 11:07', actor: '김민서', category: '운영', action: '공통코드 변경', target: 'FILE_POLICY / MAX_SIZE', change: 'ref1: 100 → 200 (MB)', ip: '10.8.0.12', ok: true },
]

export type CodeGroup = { code: string; name: string; isNew?: boolean }
export const codeGroups: CodeGroup[] = [
  { code: 'AUTH_LOGIN_POLICY', name: '로그인 잠금 정책' },
  { code: 'SSO_APP', name: '연동 서비스 목록' },
  { code: 'PROJECT_CATEGORY', name: '프로젝트 카테고리', isNew: true },
  { code: 'TASK_TYPE', name: '작업 유형', isNew: true },
  { code: 'DOCUMENT_CATEGORY', name: '자료실 카테고리', isNew: true },
  { code: 'CALENDAR_EVENT_TYPE', name: '일정 종류', isNew: true },
  { code: 'FILE_POLICY', name: '파일 크기 · 확장자', isNew: true },
  { code: 'WEEKLY_REPORT_POLICY', name: '주간 보고 마감', isNew: true },
  { code: 'GITHUB_LOC_EXCLUDE', name: '줄 수 제외 기본값', isNew: true },
  { code: 'ROLE_CONFLICT', name: '같이 가질 수 없는 역할', isNew: true },
]

export type CodeRow = { code: string; name: string; ref1: string; ref2: string[]; ref4: string; enabled: boolean }
export const codeRows: Record<string, { desc: string; columns: [string, string, string, string]; rows: CodeRow[] }> = {
  SSO_APP: {
    desc: '상세 코드 = OIDC client_id · @project = 그 서비스의 프로젝트 권한이 하나라도 있으면 로그인 허용',
    columns: ['주소 (ref1)', '접근 역할 (ref2)', 'redirect URI (ref4)', '사용'],
    rows: [
      { code: 'vault', name: 'Vault', ref1: 'https://vault.iturtle.win', ref2: ['@project', 'vault-admin'], ref4: '.../ui/vault/auth/oidc/oidc/callback, localhost:8250/oidc/callback', enabled: true },
      { code: 'jenkins', name: 'Jenkins', ref1: 'https://lab.iturtle.win/jenkins/', ref2: ['@project', 'jenkins-admin'], ref4: '.../jenkins/securityRealm/finishLogin', enabled: true },
      { code: 'penpot', name: 'Penpot', ref1: 'https://penpot.iturtle.win', ref2: ['penpot-member'], ref4: '.../api/auth/oidc/callback', enabled: true },
    ],
  },
  ROLE_CONFLICT: {
    desc: '같이 가질 수 없는 역할 쌍 (설명 = 이유). 역할 주기 · 프리셋 · 권한 신청 승인 · 구성원 추가에서 막고, 이미 가진 사람은 경고만',
    columns: ['역할 A (ref1)', '역할 B (ref2)', '이유', '사용'],
    rows: [
      { code: 'REPORT_WRITE_REVIEW', name: '주간 보고 쓰기 ↔ 확인', ref1: 'report-write', ref2: ['report-review'], ref4: '보고를 쓰는 사람이 확인하는 사람이 되면 제출 현황 · 확인이 꼬인다', enabled: true },
    ],
  },
  AUTH_LOGIN_POLICY: {
    desc: '로그인 실패 잠금 기준',
    columns: ['값 (ref1)', '단위 (ref2)', '설명 (ref4)', '사용'],
    rows: [
      { code: 'MAX_FAIL', name: '최대 실패 횟수', ref1: '5', ref2: ['회'], ref4: '연속으로 틀리면 잠김', enabled: true },
      { code: 'LOCK_MINUTES', name: '잠금 시간', ref1: '5', ref2: ['분'], ref4: '잠긴 뒤 자동으로 풀리는 시간', enabled: true },
    ],
  },
}

export const githubStats = { linked: 9, active: 10, orgMembers: 11, cleanup: 2, lastWebhook: '3분 전' }
export const githubMembers = [
  { name: '김민서', login: '@minseo-k', team: 'students', state: 'MEMBER' as const },
  { name: '박지훈', login: '@jihoon-p', team: 'students', state: 'MEMBER' as const },
  { name: '최현우', login: '@hwchoi', team: 'students', state: 'INVITED' as const },
  { name: '정재훈', login: '@jhjung-se', team: 'professors', state: 'MEMBER' as const },
  { name: '한유진', login: '@yujin-dev', team: 'interns', state: 'MEMBER' as const },
  { name: '문지호', login: null, team: '-', state: 'NONE' as const },
]
export const githubCleanup = [
  { login: '@old-member', reason: '조직에는 있는데 ERP 에 연결된 구성원이 없어요', kind: 'orphan' as const },
  { login: '@prev-intern', reason: '졸업 처리 뒤 조직 제거 실패 (권한 부족)', kind: 'failed' as const },
]
export const webhooks = [
  { at: '10:41', event: 'push', detail: 'defme_BE · feature/oidc-logout · 커밋 2', ok: true },
  { at: '10:12', event: 'push', detail: 'sensor-collector · main · 커밋 1', ok: true },
  { at: '09:55', event: 'push', detail: '서명 불일치 · 401 로 거절', ok: false },
  { at: '어제', event: 'installation_repositories', detail: 'kcc-paper 저장소 추가', ok: true },
]
