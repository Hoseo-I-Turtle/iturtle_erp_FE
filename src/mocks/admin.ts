// 관리 화면 목업 — docs/api/10-member.md, 50-infra.md, 60-common.md
export type RoleGroup = 'FEATURE' | 'SERVICE' | 'ADMIN'
export type Role = { code: string; desc: string; group: RoleGroup }

export const ROLES: Role[] = [
  { code: 'notice-write', desc: '공지 쓰기 · 투표 만들기', group: 'FEATURE' },
  { code: 'calendar-manage', desc: '공용 일정 관리', group: 'FEATURE' },
  { code: 'content-manage', desc: '자료 · 게시글 정리', group: 'FEATURE' },
  { code: 'project-create', desc: '프로젝트 만들기', group: 'FEATURE' },
  { code: 'project-view-public', desc: '참여하지 않은 연구실 공개 프로젝트 보기', group: 'FEATURE' },
  { code: 'report-write', desc: '주간 보고 쓰기', group: 'FEATURE' },
  { code: 'project-observe', desc: '모든 프로젝트 읽기', group: 'FEATURE' },
  { code: 'report-review', desc: '주간 보고 확인 · 코멘트', group: 'FEATURE' },
  { code: 'contact-view', desc: '비공개 연락처 보기', group: 'FEATURE' },
  { code: 'penpot-member', desc: 'Penpot 로그인', group: 'SERVICE' },
  { code: 'vault-admin', desc: 'Vault 정책 관리 · 전체 (관리 수준)', group: 'SERVICE' },
  { code: 'jenkins-admin', desc: 'Jenkins 전체 관리 (관리 수준)', group: 'SERVICE' },
  { code: 'member-manage', desc: '구성원 관리', group: 'ADMIN' },
  { code: 'role-manage', desc: '역할 · 프리셋 관리', group: 'ADMIN' },
  { code: 'audit-read', desc: '감사 로그 보기', group: 'ADMIN' },
  { code: 'code-manage', desc: '공통코드 관리', group: 'ADMIN' },
  { code: 'sso-admin', desc: 'SSO · 외부 서비스 설정', group: 'ADMIN' },
]

export type Preset = { id: string; name: string; desc: string; defaultFor: string | null; roles: string[]; applied: string[]; active: boolean }

export const presets: Preset[] = [
  { id: 'prof', name: '교수 기본', desc: '지도교수 기본 권한', defaultFor: '교수', roles: ['notice-write', 'calendar-manage', 'content-manage', 'project-create', 'project-view-public', 'project-observe', 'report-review', 'contact-view'], applied: ['정재훈'], active: true },
  { id: 'student', name: '학생 기본', desc: '학부연구생 · 대학원생 기본 권한', defaultFor: '학생', roles: ['project-create', 'project-view-public', 'report-write', 'penpot-member'], applied: ['김민서', '박지훈', '이정훈', '최현우', '오세훈', '윤서연', '강다은'], active: true },
  { id: 'intern', name: '인턴 기본', desc: '방학 인턴 기본 권한', defaultFor: '인턴', roles: ['report-write', 'penpot-member'], applied: ['한유진', '문지호'], active: true },
  { id: 'lead', name: '랩장', desc: '연구실 운영을 돕는 학생', defaultFor: null, roles: ['notice-write', 'calendar-manage', 'content-manage'], applied: ['박지훈'], active: true },
  { id: 'admin', name: '관리자', desc: '시스템 관리자', defaultFor: null, roles: ['member-manage', 'role-manage', 'audit-read', 'code-manage', 'sso-admin', 'vault-admin', 'jenkins-admin', 'notice-write', 'calendar-manage', 'content-manage'], applied: ['김민서'], active: true },
]

/** 프리셋에 새 역할을 더할 때 아직 그 역할이 없는 사람 (미리보기용) */
export const missingPenpot = ['강다은', '윤서연']

export type AccountState = 'ACTIVE' | 'LOCKED' | 'DISABLED'
export type AdminMember = {
  memberId: number
  name: string
  loginId: string
  memberNo: string
  memberType: '교수' | '학생' | '인턴'
  state: AccountState
  graduated: boolean
  presets: string[]
  roles: string[]
  lastLogin: string
  tempPassword?: boolean
  github?: string
  failCount: number
}

const presetRoles = (names: string[]) => [...new Set(names.flatMap((n) => presets.find((p) => p.name === n)?.roles ?? []))]

export const adminMembers: AdminMember[] = [
  { memberId: 1, name: '정재훈', loginId: 'jhjung', memberNo: 'P2019001', memberType: '교수', state: 'ACTIVE', graduated: false, presets: ['교수 기본'], roles: presetRoles(['교수 기본']), lastLogin: '오늘 09:12', failCount: 0 },
  { memberId: 2, name: '김민서', loginId: 'minseo', memberNo: '20231234', memberType: '학생', state: 'ACTIVE', graduated: false, presets: ['관리자', '학생 기본'], roles: presetRoles(['관리자', '학생 기본']), lastLogin: '방금', github: 'minseo-k', failCount: 0 },
  { memberId: 3, name: '박지훈', loginId: 'jihoon.park', memberNo: '20221187', memberType: '학생', state: 'ACTIVE', graduated: false, presets: ['학생 기본', '랩장'], roles: [...presetRoles(['학생 기본', '랩장'])], lastLogin: '10분 전', github: 'jihoon-p', failCount: 0 },
  { memberId: 4, name: '이정훈', loginId: 'jhlee', memberNo: '20211042', memberType: '학생', state: 'ACTIVE', graduated: false, presets: ['학생 기본'], roles: presetRoles(['학생 기본']), lastLogin: '어제', failCount: 0 },
  { memberId: 5, name: '최현우', loginId: 'hyunwoo', memberNo: '20231301', memberType: '학생', state: 'LOCKED', graduated: false, presets: ['학생 기본'], roles: presetRoles(['학생 기본']), lastLogin: '3일 전', failCount: 5 },
  { memberId: 6, name: '오세훈', loginId: 'sehoon', memberNo: '20251077', memberType: '학생', state: 'ACTIVE', graduated: false, presets: ['학생 기본'], roles: presetRoles(['학생 기본']), lastLogin: '오늘', tempPassword: true, failCount: 0 },
  { memberId: 9, name: '한유진', loginId: 'yujin.han', memberNo: 'I2026001', memberType: '인턴', state: 'ACTIVE', graduated: false, presets: ['인턴 기본'], roles: presetRoles(['인턴 기본']), lastLogin: '2시간 전', failCount: 0 },
  { memberId: 10, name: '문지호', loginId: 'jiho.moon', memberNo: 'I2026002', memberType: '인턴', state: 'ACTIVE', graduated: false, presets: ['인턴 기본'], roles: presetRoles(['인턴 기본']), lastLogin: '어제', failCount: 0 },
  { memberId: 11, name: '윤서연', loginId: 'seoyeon', memberNo: '20251090', memberType: '학생', state: 'DISABLED', graduated: false, presets: ['학생 기본'], roles: ['project-create', 'report-write'], lastLogin: '2주 전', failCount: 0 },
]

/** 졸업 처리 모달용: 담당 작업 */
export const openTasksOf = (name: string) =>
  name === '박지훈'
    ? [
        { key: 'DEFME-46', title: 'MinIO 업로드 서명 주소 만료 5분' },
        { key: 'DEFME-44', title: 'OIDC 로그아웃 테스트 케이스 추가' },
        { key: 'DEFME-52', title: 'Jenkins 역할 전략 전환' },
      ]
    : [{ key: 'DEFME-53', title: '감사 로그 내보내기 CSV' }]

export type SignupRequest = {
  id: number
  name: string
  type: '교수' | '학생' | '인턴'
  wantedId: string
  ago: string
  appliedAt: string
  studentNo: string | null
  email: string | null
  phone: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  idTaken?: boolean
}

export const signupRequests: SignupRequest[] = [
  { id: 1, name: '강하늘', type: '인턴', wantedId: 'haneul', ago: '2시간 전', appliedAt: '11/17(월) 08:40', studentNo: '20261055', email: null, phone: '010-1234-5678', reason: '정재훈 교수님 연구실에서 겨울 인턴으로 참여하고 싶습니다. 테스트 자동화에 관심이 있습니다.', status: 'PENDING' },
  { id: 2, name: '서지우', type: '인턴', wantedId: 'jiwoo.seo', ago: '어제', appliedAt: '11/16(일) 21:10', studentNo: null, email: 'jiwoo@example.com', phone: '010-2222-3333', reason: '데이터 분석 프로젝트에 참여하고 싶어요.', status: 'PENDING' },
  { id: 3, name: '노준혁', type: '인턴', wantedId: 'junhyuk', ago: '3일 전', appliedAt: '11/14(금) 13:02', studentNo: '20241188', email: null, phone: '010-4444-5555', reason: '백엔드 개발 경험을 쌓고 싶습니다.', status: 'PENDING', idTaken: true },
  { id: 4, name: '배수아', type: '학생', wantedId: 'sua', ago: '2주 전', appliedAt: '11/03(월) 10:00', studentNo: '20251122', email: null, phone: '010-0000-1111', reason: '석사 과정 입학 예정입니다.', status: 'APPROVED' },
  { id: 5, name: '익명', type: '인턴', wantedId: 'test', ago: '3주 전', appliedAt: '10/28(화) 02:13', studentNo: null, email: null, phone: '010-9999-9999', reason: 'test', status: 'REJECTED' },
]
