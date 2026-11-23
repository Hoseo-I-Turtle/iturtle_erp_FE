// 프로젝트 만들기 · 설정 — docs/api/30-project.md P-2 ~ P-8, P-11 ~ P-15, P-24 ~ P-27
import { api } from './client'
import { ago, dotDate, type MemberRef, type PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { getProject, MOCK_ME, type TaskListResponse } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { projectLabels as mockLabels, type ProjectLabel } from '../mocks/projectLabels'
import { findProject, projects as mockProjects, type ProjectCategory, type ProjectStatus } from '../mocks/projects'
import {
  formerMembers as mockFormer,
  memberCandidates as mockCandidates,
  projectLinks as mockLinks,
  settingsMembers as mockMembers,
  type LinkService,
  type ProjectLinkView,
  type SettingsMember,
} from '../mocks/projectSettings'
import { MEMBER_TYPE_NAME } from '../mocks/members'

const enc = encodeURIComponent
const typeText = (m: MemberRef) => (m.memberType === 'STUDENT' ? '학생 · 재실' : MEMBER_TYPE_NAME[m.memberType])

/* ================= 일반 · 보관 · 삭제 (P-3, P-4, P-5) ================= */

export type ProjectGeneral = {
  projectKey: string
  name: string
  categoryCode: ProjectCategory
  startsOn: string
  endsOn: string
  description: string
  visibility: 'LAB' | 'PRIVATE'
  status: ProjectStatus
  canManage: boolean
  canDelete: boolean
  taskCount: number
}
export type GeneralPatch = Pick<ProjectGeneral, 'name' | 'categoryCode' | 'startsOn' | 'endsOn' | 'description' | 'visibility'>

/** 목업에서 고친 설명을 기억한다 (목업 목록에는 설명 칸이 없다) */
const mockDescription = new Map<string, string>()

export function useProjectGeneral(key: string | undefined) {
  return useResource<ProjectGeneral>(
    ['project-general', key],
    () => {
      const p = findProject(key)
      return {
        projectKey: p.projectKey,
        name: p.name,
        categoryCode: p.categoryCode,
        startsOn: p.startsOn,
        endsOn: p.endsOn,
        description: mockDescription.get(p.projectKey) ?? projectDetail.description,
        visibility: p.visibility,
        status: p.status,
        canManage: true,
        canDelete: true,
        taskCount: projectDetail.taskTotal,
      }
    },
    async () => {
      const d = await getProject(key ?? '')
      return {
        projectKey: d.projectKey,
        name: d.name,
        categoryCode: d.categoryCode as ProjectCategory,
        startsOn: d.startsOn ?? '',
        endsOn: d.endsOn ?? '',
        description: d.description ?? '',
        visibility: d.visibility,
        status: (d.status === 'ON_HOLD' ? 'PREPARING' : d.status) as ProjectStatus,
        canManage: d.permissions.canManage,
        canDelete: d.permissions.canDelete,
        taskCount: d.taskCounts.total,
      }
    },
  )
}

/** 설정 고치기 (P-4) */
export async function saveProjectGeneral(key: string, patch: GeneralPatch, isLive: boolean) {
  if (isLive)
    await api(`/projects/${enc(key)}`, {
      method: 'PATCH',
      body: { ...patch, description: patch.description || null, startsOn: patch.startsOn || null, endsOn: patch.endsOn || null },
    })
  else {
    const p = findProject(key)
    Object.assign(p, { name: patch.name, categoryCode: patch.categoryCode, startsOn: patch.startsOn, endsOn: patch.endsOn, visibility: patch.visibility })
    mockDescription.set(p.projectKey, patch.description)
  }
  invalidateAll()
}

/** 보관 · 보관 풀기 (P-4 status). 풀 때는 진행 중으로 되돌린다 */
export async function setProjectArchived(key: string, archived: boolean, isLive: boolean) {
  // 명세 확인 필요: 보관을 풀 때 돌아갈 상태가 없어(T14) 진행 중으로 보낸다
  const status = archived ? 'ARCHIVED' : 'ACTIVE'
  if (isLive) await api(`/projects/${enc(key)}`, { method: 'PATCH', body: { status } })
  else findProject(key).status = status
  invalidateAll()
}

/** 프로젝트 지우기 (P-5) */
export async function deleteProject(key: string, isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}`, { method: 'DELETE' })
  else {
    const i = mockProjects.findIndex((p) => p.projectKey === key)
    if (i >= 0) mockProjects.splice(i, 1)
  }
  invalidateAll()
}

/* ================= 참여자 (P-3, P-6, P-7, P-8) ================= */

export type Candidate = { memberId: number; name: string; typeText: string }
export type ProjectMembers = { members: SettingsMember[]; former: { memberId: number; name: string; leftOn: string }[]; candidates: Candidate[]; meId: number; canManage: boolean }

export function useProjectMembers(key: string | undefined) {
  return useResource<ProjectMembers>(
    ['project-members', key],
    () => ({
      members: mockMembers,
      former: mockFormer,
      candidates: mockCandidates.filter((c) => !mockMembers.some((m) => m.memberId === c.memberId)),
      meId: mockMembers.find((m) => m.name === MOCK_ME)?.memberId ?? 0,
      canManage: true,
    }),
    async () => {
      const [d, me, all] = await Promise.all([
        getProject(key ?? ''),
        api<MemberRef>('/members/me'),
        api<{ page: PageResponse<MemberRef> }>('/members', { query: { group: 'ACTIVE', size: 100 } }),
      ])
      const current = d.members.filter((m) => m.role !== 'FORMER')
      return {
        members: current.map((m) => ({
          memberId: m.member.memberId,
          name: m.member.name,
          // 명세 확인 필요: MemberRef 에 로그인 아이디가 없고, 구성원별 서비스 권한은 P-16 에만 있다
          loginId: '',
          typeText: typeText(m.member),
          role: m.role as 'MANAGER' | 'MEMBER',
          joinedOn: dotDate(m.joinedAt),
          access: '',
        })),
        former: d.members.filter((m) => m.role === 'FORMER').map((m) => ({ memberId: m.member.memberId, name: m.member.name, leftOn: dotDate(m.leftAt) })),
        candidates: all.page.content.filter((m) => !current.some((c) => c.member.memberId === m.memberId)).map((m) => ({ memberId: m.memberId, name: m.name, typeText: typeText(m) })),
        meId: me.memberId,
        canManage: d.permissions.canManage,
      }
    },
  )
}

export async function addProjectMember(key: string, c: Candidate, role: 'MANAGER' | 'MEMBER', isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/members`, { method: 'POST', body: { memberId: c.memberId, role } })
  else {
    const today = new Date()
    mockMembers.push({ memberId: c.memberId, name: c.name, loginId: '', typeText: c.typeText, role, joinedOn: `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`, access: '기본' })
    const i = mockFormer.findIndex((f) => f.memberId === c.memberId)
    if (i >= 0) mockFormer.splice(i, 1)
  }
  invalidateAll()
}

export async function changeMemberRole(key: string, m: SettingsMember, role: 'MANAGER' | 'MEMBER', isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/members/${m.memberId}`, { method: 'PATCH', body: { role } })
  else m.role = role
  invalidateAll()
}

/** 참여자 빼기 (P-8). 그 사람이 맡은 끝나지 않은 작업은 담당자 없음으로 넘긴다 */
export async function removeProjectMember(key: string, m: SettingsMember, isLive: boolean) {
  if (isLive) {
    const open = await api<TaskListResponse>('/tasks', { query: { projectKey: key, assigneeId: m.memberId, statuses: 'TODO,IN_PROGRESS,REVIEW', size: 100 } })
    await api(`/projects/${enc(key)}/members/${m.memberId}/remove`, {
      method: 'POST',
      body: { taskReassignments: open.page.content.map((t) => ({ taskKey: t.taskKey, assigneeMemberId: null })) },
    })
  } else {
    const i = mockMembers.indexOf(m)
    if (i >= 0) mockMembers.splice(i, 1)
    mockFormer.unshift({ memberId: m.memberId, name: m.name, leftOn: '오늘' })
  }
  invalidateAll()
}

/* ================= 라벨 (P-24 ~ P-27) ================= */

export function useProjectLabels(key: string | undefined) {
  return useResource<{ labels: ProjectLabel[]; canManage: boolean }>(
    ['project-labels', key],
    () => ({ labels: mockLabels, canManage: true }),
    async () => {
      const [r, d] = await Promise.all([
        api<{ labels: { labelId: number; name: string; color: string; taskCount: number }[] }>(`/projects/${enc(key ?? '')}/labels`),
        getProject(key ?? ''),
      ])
      // 명세 확인 필요: 디자인의 라벨 "설명"은 P-24 ~ P-26 에 없다 (이름 · 색만)
      return { labels: r.labels.map((l) => ({ ...l, description: '' })), canManage: d.permissions.canManage }
    },
  )
}

export async function saveLabel(key: string, label: { labelId?: number; name: string; color: string; description: string }, isLive: boolean) {
  if (isLive) {
    const body = { name: label.name, color: label.color.toUpperCase() }
    if (label.labelId) await api(`/projects/${enc(key)}/labels/${label.labelId}`, { method: 'PATCH', body })
    else await api(`/projects/${enc(key)}/labels`, { method: 'POST', body })
  } else {
    const old = mockLabels.find((l) => l.labelId === label.labelId)
    if (old) Object.assign(old, { name: label.name, color: label.color, description: label.description })
    else mockLabels.push({ labelId: Math.max(0, ...mockLabels.map((l) => l.labelId)) + 1, name: label.name, color: label.color, description: label.description, taskCount: 0 })
  }
  invalidateAll()
}

export async function deleteLabel(key: string, labelId: number, isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/labels/${labelId}`, { method: 'DELETE' })
  else {
    const i = mockLabels.findIndex((l) => l.labelId === labelId)
    if (i >= 0) mockLabels.splice(i, 1)
  }
  invalidateAll()
}

/* ================= 연동 서비스 (P-11 ~ P-15) ================= */

type LinkDto = {
  linkId: number
  service: LinkService
  url: string
  displayName: string
  description: string | null
  externalRef: string | null
  github: { defaultBranch: string; locExcludePatterns: string } | null
}
type LinkStatusDto = {
  linkId: number
  status: 'OK' | 'UNAVAILABLE' | 'NOT_SUPPORTED'
  jenkins: { branch: string | null; lastBuild: { number: number; result: string; startedAt: string; durationMs: number } | null } | null
  penpot: { fileCount: number } | null
  github: { weekCommitCount: number; openPullRequestCount: number } | null
}
const BUILD: Record<string, string> = { SUCCESS: '성공', FAILURE: '실패', UNSTABLE: '불안정', ABORTED: '중단', IN_PROGRESS: '진행 중' }

function statusText(st: LinkStatusDto | undefined) {
  if (!st || st.status === 'NOT_SUPPORTED') return ''
  if (st.status === 'UNAVAILABLE') return '바로 가기는 그대로 열려요'
  if (st.jenkins?.lastBuild) {
    const b = st.jenkins.lastBuild
    const sec = Math.round(b.durationMs / 1000)
    return `빌드 #${b.number} ${BUILD[b.result] ?? b.result} · ${st.jenkins.branch ?? ''} · ${Math.floor(sec / 60)}분 ${sec % 60}초 · ${ago(b.startedAt)}`
  }
  if (st.github) return `이번 주 커밋 ${st.github.weekCommitCount} · 열린 PR ${st.github.openPullRequestCount}`
  if (st.penpot) return `파일 ${st.penpot.fileCount}개`
  return ''
}

export function useProjectLinks(key: string | undefined) {
  return useResource<{ links: ProjectLinkView[]; canManage: boolean }>(
    ['project-links', key],
    () => ({ links: mockLinks, canManage: true }),
    async () => {
      const k = enc(key ?? '')
      const [r, st, d] = await Promise.all([
        api<{ links: LinkDto[] }>(`/projects/${k}/links`),
        api<{ statuses: LinkStatusDto[] }>(`/projects/${k}/links/status`).catch(() => ({ statuses: [] as LinkStatusDto[] })),
        getProject(key ?? ''),
      ])
      return {
        links: r.links.map((l) => {
          const s = st.statuses.find((x) => x.linkId === l.linkId)
          return {
            linkId: l.linkId,
            service: l.service,
            displayName: l.displayName,
            url: l.url,
            externalRef: [l.externalRef ?? l.url, l.github?.defaultBranch].filter(Boolean).join(' · '),
            description: l.description ?? '',
            status: s?.status ?? 'NOT_SUPPORTED',
            statusText: statusText(s),
            locExcludePatterns: l.github?.locExcludePatterns,
          }
        }),
        canManage: d.permissions.canManage,
      }
    },
  )
}

export type LinkDraft = { service: LinkService; url: string; displayName: string; description: string }

export async function createLink(key: string, d: LinkDraft, isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/links`, { method: 'POST', body: { ...d, description: d.description || undefined } })
  else
    mockLinks.push({
      linkId: Math.max(0, ...mockLinks.map((l) => l.linkId)) + 1,
      service: d.service,
      displayName: d.displayName,
      url: d.url,
      externalRef: d.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '') || d.url,
      description: d.description,
      status: 'NOT_SUPPORTED',
      statusText: '',
      locExcludePatterns: d.service === 'GITHUB' ? 'package-lock.json\npnpm-lock.yaml\nyarn.lock\n*.min.js\nbuild/\ndist/' : undefined,
    })
  invalidateAll()
}

export async function updateLink(key: string, l: ProjectLinkView, patch: Partial<Pick<ProjectLinkView, 'displayName' | 'description' | 'url' | 'locExcludePatterns'>>, isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/links/${l.linkId}`, { method: 'PATCH', body: patch })
  else Object.assign(l, patch)
  invalidateAll()
}

export async function deleteLink(key: string, linkId: number, isLive: boolean) {
  if (isLive) await api(`/projects/${enc(key)}/links/${linkId}`, { method: 'DELETE' })
  else {
    const i = mockLinks.findIndex((l) => l.linkId === linkId)
    if (i >= 0) mockLinks.splice(i, 1)
  }
  invalidateAll()
}

/* ================= 프로젝트 만들기 (P-2 + P-12 + P-17) ================= */

export type ProjectDraft = {
  categoryCode: ProjectCategory
  name: string
  projectKey: string
  startsOn: string
  endsOn: string
  description: string
  visibility: 'LAB' | 'PRIVATE'
  members: { memberId: number; name: string; role: 'MANAGER' | 'MEMBER' }[]
  /** 연동 서비스: 주소를 적은 것만 연결한다 */
  githubUrl: string
  jenkinsUrl: string
  penpotUrl: string
  vault: boolean
}

/** 프로젝트를 만들고(P-2) 연동 서비스를 연결한다(P-12, P-17). 연결이 실패해도 프로젝트는 남으므로 실패한 서비스 이름을 돌려준다 */
export async function createProject(d: ProjectDraft, isLive: boolean): Promise<string[]> {
  const failed: string[] = []
  if (isLive) {
    await api('/projects', {
      method: 'POST',
      body: {
        projectKey: d.projectKey,
        name: d.name,
        categoryCode: d.categoryCode,
        description: d.description || undefined,
        visibility: d.visibility,
        startsOn: d.startsOn || undefined,
        endsOn: d.endsOn || undefined,
        members: d.members.map((m) => ({ memberId: m.memberId, role: m.role })),
      },
    })
    const k = enc(d.projectKey)
    const link = (service: LinkService, url: string, label: string) =>
      url.trim() ? api(`/projects/${k}/links`, { method: 'POST', body: { service, url: url.trim(), displayName: d.name.slice(0, 50) } }).catch(() => void failed.push(label)) : Promise.resolve()
    await link('GITHUB', d.githubUrl, 'GitHub')
    await link('JENKINS', d.jenkinsUrl, 'Jenkins')
    await link('PENPOT', d.penpotUrl, 'Penpot')
    // 명세 확인 필요: P-17 본문의 켜기 필드 이름 (enabled 로 보낸다)
    if (d.vault) await api(`/projects/${k}/service-access/VAULT`, { method: 'PATCH', body: { enabled: true } }).catch(() => void failed.push('Vault'))
  } else {
    mockProjects.unshift({
      projectKey: d.projectKey,
      name: d.name,
      status: 'PREPARING',
      visibility: d.visibility,
      categoryCode: d.categoryCode,
      summary: d.description.split('\n')[0].slice(0, 60),
      startsOn: d.startsOn,
      endsOn: d.endsOn,
      myRole: 'MANAGER',
      memberPreview: [MOCK_ME, ...d.members.map((m) => m.name)].slice(0, 3),
      services: [d.githubUrl && 'GITHUB', d.jenkinsUrl && 'JENKINS', d.vault && 'VAULT', d.penpotUrl && 'PENPOT'].filter(Boolean) as ('GITHUB' | 'JENKINS' | 'VAULT' | 'PENPOT')[],
      nextMilestone: null,
    })
  }
  invalidateAll()
  return failed
}

/** 이미 쓰는 키인지 (목업은 목록에서, 실서버는 만들 때 409 로 알려 준다) */
export const mockKeyTaken = (key: string) => mockProjects.some((p) => p.projectKey === key)
