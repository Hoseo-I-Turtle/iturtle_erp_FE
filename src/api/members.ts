// 구성원 API — docs/api/10-member.md 2-1, 2-2 / 50-infra.md G-3 / 30-project.md P-? (projects?memberId=)
// 응답을 화면이 쓰는 mocks/members.ts 의 Member 모양으로 바꾼다.
import { api } from './client'
import { dotDate, type MemberRef, type PageResponse } from './types'
import { GRADUATE_TOTAL, ME_ID, members as mockMembers, type Member } from '../mocks/members'
import { useResource } from './useResource'

type MemberListItem = MemberRef & {
  studentNumber: string
  loginId: string
  intro: string | null
  joinedOn: string
  leftOn: string | null
  email: string | null
  phone?: string
  phoneHidden?: boolean
}
type MembersResponse = { counts: { active: number; alumni: number }; page: PageResponse<MemberListItem> }

type GithubAccount = { githubLogin: string } | null
type ProjectOfMember = { name: string; categoryName: string; myRole?: string; memberRole?: string }

const toMember = (x: MemberListItem): Member => ({
  memberId: x.memberId,
  memberNo: x.studentNumber,
  name: x.name,
  memberType: x.memberType,
  status: x.status === 'ACTIVE' ? 'ACTIVE' : 'GRADUATED',
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

export type MemberDirectory = { members: Member[]; activeCount: number; alumniCount: number; meId: number }

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
      const [active, alumni, me] = await Promise.all([
        api<MembersResponse>('/members', { query: { group: 'ACTIVE', size: 100 } }),
        api<MembersResponse>('/members', { query: { group: 'ALUMNI', size: 100 } }),
        api<{ memberId: number }>('/members/me'),
      ])
      return {
        members: [...active.page.content, ...alumni.page.content].map(toMember),
        activeCount: active.counts.active,
        alumniCount: active.counts.alumni,
        meId: me.memberId,
      }
    },
  )
}

/** 구성원 카드 오른쪽: 참여 프로젝트 · GitHub (목업이면 목업 구성원의 값을 그대로) */
export function useMemberExtras(member: Member | undefined) {
  return useResource<Pick<Member, 'projects' | 'githubLogin'>>(
    ['member-extras', member?.memberId],
    () => ({ projects: member?.projects ?? [], githubLogin: member?.githubLogin ?? null }),
    async () => {
      if (!member) return { projects: [], githubLogin: null }
      const [projects, github] = await Promise.all([
        api<PageResponse<ProjectOfMember>>('/projects', { query: { memberId: member.memberId, size: 50 } }),
        api<GithubAccount>(`/github/accounts/${member.memberId}`),
      ])
      return {
        projects: projects.content.map((p) => ({
          name: p.name,
          role: (p.memberRole ?? p.myRole) === 'MANAGER' ? '프로젝트 관리자' : '참여자',
          category: p.categoryName,
        })),
        githubLogin: github?.githubLogin ?? null,
      }
    },
  )
}
