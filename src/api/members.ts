// 구성원 API — docs/api/10-member.md 1-1 · 2-1 / 30-project.md P-1 (?memberId=) / 50-infra.md G-3 / sso GET /sso/apps
// 응답을 화면이 쓰는 mocks/members.ts 의 Member 모양으로 바꾼다.
import { api } from './client'
import { dotDate, fetchAllPages, MAX_PAGE_SIZE, type MemberStatusCode, type MemberTypeCode, type PageResponse } from './types'
import { GRADUATE_TOTAL, ME_ID, members as mockMembers, type Member } from '../mocks/members'
import { useResource } from './useResource'

/** MemberSummaryResponse (2-1). phone 은 공개했거나 contact-view · 본인일 때만, 아니면 빠지고 phoneHidden: true */
type MemberListItem = {
  memberId: number
  name: string
  memberType: MemberTypeCode
  status: MemberStatusCode
  photoUrl: string | null
  studentNumber: string
  loginId: string
  intro: string | null
  joinedOn: string
  leftOn: string | null
  email: string | null
  phone?: string | null
  phoneHidden?: boolean
}
/** MemberListResponse (2-1). disabled · locked 는 member-manage 만 */
type MembersResponse = {
  counts: { active: number; onLeave: number; alumni: number; disabled?: number; locked?: number }
  page: PageResponse<MemberListItem>
}

/** MeResponse (1-1) */
export type MeDto = {
  memberId: number
  studentNumber: string
  loginId: string
  name: string
  roles: string[]
  passwordChangeRequired: boolean
  memberType: MemberTypeCode
  status: MemberStatusCode
  joinedOn: string
  email: string | null
  phone: string | null
  phonePublic: boolean
  intro: string | null
  photoUrl: string | null
}

/** GithubAccountResponse (G-3). 연결하지 않았으면 data 가 null */
type GithubAccount = { memberId: number; githubLogin: string } | null
/** ProjectListResponse (P-1) — 목록은 page 안에 있다. myRole 은 "보는 사람"의 역할 (MANAGER · MEMBER · NONE) */
type ProjectList = {
  categoryCounts: Record<string, number>
  page: PageResponse<{ projectKey: string; name: string; categoryName: string; myRole: string }>
}

const toMember = (x: MemberListItem): Member => ({
  memberId: x.memberId,
  memberNo: x.studentNumber,
  name: x.name,
  memberType: x.memberType,
  // 화면의 Member 는 재실 · 졸업만 나눈다. 휴학(ON_LEAVE)은 재실 쪽에 둔다
  status: x.status === 'GRADUATED' || x.status === 'LEFT' ? 'GRADUATED' : 'ACTIVE',
  intro: x.intro ?? '',
  email: x.email,
  phone: x.phone ?? null,
  phonePublic: !x.phoneHidden,
  joinedAt: dotDate(x.joinedOn),
  graduatedAt: x.leftOn ? dotDate(x.leftOn) : undefined,
  githubLogin: null,
  roles: [],
  projects: [],
})

/** 내 정보 (1-1) */
export const fetchMe = () => api<MeDto>('/members/me')

/** 같은 페이지 안에서는 내 정보를 한 번만 부른다 (실패하면 다음에 다시) */
let meOnce: Promise<MeDto> | null = null
const fetchMeOnce = () => {
  if (!meOnce) meOnce = fetchMe().catch((e) => {
    meOnce = null
    throw e
  })
  return meOnce
}

export type MemberDirectory = { members: Member[]; activeCount: number; alumniCount: number; meId: number }

const listGroup = (group: 'ACTIVE' | 'ALUMNI') => async () => {
  let counts: MembersResponse['counts'] | undefined
  const items = await fetchAllPages(async (page) => {
    const res = await api<MembersResponse>('/members', { query: { group, page, size: MAX_PAGE_SIZE } })
    counts = res.counts
    return res.page
  })
  return { items, counts: counts! }
}

/** 구성원 화면: 재실 + 졸업생 목록과 탭 숫자 */
export function useMemberDirectory() {
  return useResource<MemberDirectory>(
    'members',
    () => ({
      members: mockMembers,
      activeCount: mockMembers.filter((m) => m.status === 'ACTIVE').length,
      alumniCount: GRADUATE_TOTAL,
      meId: ME_ID,
    }),
    async () => {
      // 휴학(ON_LEAVE)만 따로 받는 group 은 백엔드 검증(MemberListRequest 의 @Pattern: ACTIVE|ALUMNI|ALL)이 막아 받지 않는다
      const [active, alumni, me] = await Promise.all([listGroup('ACTIVE')(), listGroup('ALUMNI')(), fetchMeOnce()])
      return {
        members: [...active.items, ...alumni.items].map(toMember),
        activeCount: active.counts.active,
        alumniCount: active.counts.alumni,
        meId: me.memberId,
      }
    },
  )
}

const PROJECT_ROLE_NAME: Record<string, string> = { MANAGER: '프로젝트 관리자', MEMBER: '참여자' }

/** 구성원 카드 오른쪽: 참여 프로젝트 · GitHub (목업이면 목업 구성원의 값을 그대로) */
export function useMemberExtras(member: Member | undefined) {
  return useResource<Pick<Member, 'projects' | 'githubLogin'>>(
    ['member-extras', member?.memberId],
    () => ({ projects: member?.projects ?? [], githubLogin: member?.githubLogin ?? null }),
    async () => {
      if (!member) return { projects: [], githubLogin: null }
      const [projects, github, me] = await Promise.all([
        api<ProjectList>('/projects', { query: { memberId: member.memberId, size: 50 } }),
        api<GithubAccount>(`/github/accounts/${member.memberId}`),
        fetchMeOnce(),
      ])
      const isMe = me.memberId === member.memberId
      return {
        projects: projects.page.content.map((p) => ({
          name: p.name,
          // P-1 의 myRole 은 보는 사람의 역할이라 본인 카드에서만 정확하다.
          // 다른 구성원의 프로젝트 역할은 백엔드 응답에 없어(ProjectSummaryResponse) "참여" 로만 보여 준다
          role: isMe ? (PROJECT_ROLE_NAME[p.myRole] ?? '참여') : '참여',
          category: p.categoryName,
        })),
        githubLogin: github?.githubLogin ?? null,
      }
    },
  )
}

/**
 * 로그인한 나 (사이드바 · 관리 메뉴). 목업이면 목업의 나.
 * roles 가 null 이면 목업이라 역할을 따지지 않는다 (관리 메뉴를 모두 보여 준다).
 */
export type MeBrief = { name: string; memberType: MemberTypeCode; status: MemberStatusCode; loginId: string; roles: string[] | null }
export function useMe() {
  return useResource<MeBrief | null>(
    'me',
    () => {
      const m = mockMembers.find((x) => x.memberId === ME_ID)
      return m ? { name: m.name, memberType: m.memberType, status: 'ACTIVE', loginId: 'minseo', roles: null } : null
    },
    async () => {
      const me = await fetchMeOnce()
      return { name: me.name, memberType: me.memberType, status: me.status, loginId: me.loginId, roles: me.roles ?? [] }
    },
  )
}

/** SSO 연동 서비스 이름 (GET /sso/apps?all=true 의 code → name). 모르는 client_id(예: MCP 클라이언트)는 그대로 */
export async function fetchSsoAppName(clientId: string) {
  const apps = await api<{ code: string; name: string }[]>('/sso/apps', { query: { all: true } })
  return apps.find((a) => a.code === clientId)?.name ?? clientId
}
