// 구성원 목업 — 필드 이름은 docs/api/10-member.md 를 따른다
export type MemberType = 'PROFESSOR' | 'STUDENT' | 'INTERN'
export type MemberStatus = 'ACTIVE' | 'GRADUATED' | 'DISABLED'

export const MEMBER_TYPE_NAME: Record<MemberType, string> = {
  PROFESSOR: '교수',
  STUDENT: '학생',
  INTERN: '인턴',
}

export type Member = {
  memberId: number
  memberNo: string
  name: string
  memberType: MemberType
  status: MemberStatus
  intro: string
  email: string | null
  phone: string | null
  phonePublic: boolean
  joinedAt: string // YYYY.MM.DD
  graduatedAt?: string
  githubLogin: string | null
  roles: string[]
  projects: { name: string; role: string; category: string }[]
}

const m = (
  memberId: number,
  name: string,
  memberType: MemberType,
  intro: string,
  joinedAt: string,
  extra: Partial<Member> = {},
): Member => ({
  memberId,
  memberNo: `2023${String(1200 + memberId)}`,
  name,
  memberType,
  status: 'ACTIVE',
  intro,
  email: `${name}@iturtle.local`,
  phone: null,
  phonePublic: false,
  joinedAt,
  githubLogin: null,
  roles: ['member'],
  projects: [],
  ...extra,
})

export const ME_ID = 2

export const members: Member[] = [
  m(1, '정재훈', 'PROFESSOR', '소프트웨어공학 · 연구실 책임', '2019.03.01', {
    roles: ['lab-admin', 'member-manage', 'role-manage', 'contact-view'],
    phone: '010-1234-0001',
    phonePublic: true,
  }),
  m(2, '김민서', 'STUDENT', '백엔드 · SSO 담당', '2025.03.02', {
    memberNo: '20231234',
    email: 'minseo@example.com',
    githubLogin: 'minseo-k',
    roles: ['member', 'project-create'],
    projects: [
      { name: 'DEFME 백엔드', role: '프로젝트 관리자', category: '개발' },
      { name: '11월 기술 세미나', role: '참여자', category: '세미나' },
    ],
  }),
  m(3, '박지훈', 'STUDENT', '인프라 · 배포 자동화', '2024.09.01', { githubLogin: 'jihoon-p', roles: ['member', 'infra-admin'] }),
  m(4, '이정훈', 'STUDENT', '코드 리뷰 · 테스트', '2024.03.04', { githubLogin: 'jh-lee' }),
  m(5, '최현우', 'STUDENT', '데이터 수집 · 분석', '2025.03.02'),
  m(6, '오세훈', 'STUDENT', '프론트엔드 · 디자인', '2025.09.01'),
  m(7, '윤서연', 'STUDENT', '논문 · 관련 연구', '2025.09.01'),
  m(8, '강다은', 'STUDENT', 'ML 실험', '2026.03.02'),
  m(9, '한유진', 'INTERN', '여름 인턴 · 테스트 자동화', '2026.07.01'),
  m(10, '문지호', 'INTERN', '디자인 시스템 정리', '2026.09.01'),
  m(21, '서지우', 'STUDENT', '석사 졸업 · 네이버', '2021.03.02', { status: 'GRADUATED', graduatedAt: '2025.02.20' }),
  m(22, '임도윤', 'STUDENT', '박사 졸업 · KAIST 박사후연구원', '2019.09.01', { status: 'GRADUATED', graduatedAt: '2024.08.20' }),
  m(23, '배수아', 'STUDENT', '석사 졸업 · 카카오', '2022.03.02', { status: 'GRADUATED', graduatedAt: '2024.02.20' }),
]

/** 디자인 시안 숫자 (재실 10 · 졸업생 24) 를 맞추기 위한 전체 졸업생 수 */
export const GRADUATE_TOTAL = 24
