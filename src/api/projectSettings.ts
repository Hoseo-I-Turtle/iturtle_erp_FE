/**
 * 프로젝트 만들기 · 프로젝트 설정 (일반 · 참여자 · 라벨 · 보관 · 삭제) — P-2 · P-4 · P-5 · P-5a~d · P-6~P-8 · P-11 · P-17 · P-24~P-27.
 * 디자인: Penpot 06 Screens · 추가 › 프로젝트 만들기 · 프로젝트 설정.
 */
import { api, ApiError } from './client'
import { useResource } from './useResource'
import { findProject, projects as mockProjects } from '../mocks/projects'
import { ME_ID, members as mockMembers } from '../mocks/members'
import { mockTagsOf } from './memberTags'
import { getProject, projectCategoryName, type ProjectDetailDto, type ProjectStatusLive } from './projects'

const enc = encodeURIComponent

export type ProjectRoleCode = 'MANAGER' | 'MEMBER' | 'FORMER'
export type Visibility = 'LAB' | 'PRIVATE'
export type CodeOption = { code: string; name: string }
export type PickMember = { memberId: number; name: string; memberType: string; status: string }

// ───────────────────────── 키 확인 (P-5a) ─────────────────────────

export type KeyCheck = { projectKey: string; available: boolean; reason: 'INVALID' | 'TAKEN' | null; movedTo: string | null }
export const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

export const checkProjectKey = (projectKey: string) =>
  api<KeyCheck>('/projects/key-availability', { query: { projectKey } })

/** 목업: 형식과 목업 프로젝트 키로만 본다 */
export const mockCheckKey = (projectKey: string): KeyCheck => {
  if (!KEY_PATTERN.test(projectKey)) return { projectKey, available: false, reason: 'INVALID', movedTo: null }
  const taken = mockProjects.some((p) => p.projectKey === projectKey) || projectKey === 'LAB'
  return { projectKey, available: !taken, reason: taken ? 'TAKEN' : null, movedTo: null }
}

/** 이름에서 키 제안: 영문 · 숫자만 대문자로, 없으면 PRJ */
export function suggestKey(name: string) {
  const ascii = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const key = /^[A-Z]/.test(ascii) ? ascii.slice(0, 10) : ''
  return key.length >= 2 ? key : ''
}

// ───────────────────────── 만들기 옵션 (종류 · 구성원) ─────────────────────────

export type CreateOptions = { categories: CodeOption[]; members: PickMember[]; meId: number }

type MembersPage = { page: { content: { memberId: number; name: string; memberType: string; status: string }[]; last?: boolean } }
type MeDto = { memberId: number; name: string }

export function useCreateOptions() {
  return useResource<CreateOptions>(
    'project-create-options',
    () => ({
      categories: ['DEV', 'SEMINAR', 'PAPER', 'CONTEST'].map((code) => ({ code, name: projectCategoryName(code) })),
      members: mockMembers.filter((m) => m.status === 'ACTIVE').map((m) => ({ memberId: m.memberId, name: m.name, memberType: m.memberType, status: m.status })),
      meId: ME_ID,
    }),
    async () => {
      const [categories, members, me] = await Promise.all([
        api<CodeOption[]>('/codes/PROJECT_CATEGORY'),
        api<MembersPage>('/members', { query: { group: 'ACTIVE', size: 100 } }),
        api<MeDto>('/members/me'),
      ])
      return { categories, members: members.page.content, meId: me.memberId }
    },
  )
}

// ───────────────────────── 만들기 (P-2 + 링크 P-11 + Jenkins 켜기 P-17) ─────────────────────────

export type LinkDraft = { service: 'GITHUB' | 'JENKINS' | 'PENPOT' | 'OTHER'; url: string; displayName: string }
export type ProjectDraft = {
  categoryCode: string
  name: string
  projectKey: string
  description: string
  startsOn: string
  endsOn: string
  visibility: Visibility
  members: { memberId: number; role: 'MANAGER' | 'MEMBER' }[]
  vault: boolean
  jenkins: boolean
  links: LinkDraft[]
}

export type CreateResult = { projectKey: string; warnings: string[] }

/**
 * 만들고 → 링크 잇기 → (작업을 이었으면) Jenkins 권한 켜기. 프로젝트가 만들어진 뒤의 실패는 경고로 돌려준다 (설정에서 다시 할 수 있다).
 */
export async function createProject(d: ProjectDraft): Promise<CreateResult> {
  const created = await api<ProjectDetailDto>('/projects', {
    method: 'POST',
    body: {
      projectKey: d.projectKey,
      name: d.name.trim(),
      categoryCode: d.categoryCode,
      description: d.description.trim() || null,
      visibility: d.visibility,
      startsOn: d.startsOn || null,
      endsOn: d.endsOn || null,
      members: d.members,
      services: d.vault ? [{ service: 'VAULT' }] : [],
    },
  })
  const key = created.projectKey
  const warnings: string[] = []
  let jenkinsLinked = false
  for (const l of d.links) {
    try {
      await api(`/projects/${enc(key)}/links`, { method: 'POST', body: { service: l.service, url: l.url.trim(), displayName: l.displayName.trim() } })
      if (l.service === 'JENKINS') jenkinsLinked = true
    } catch (e) {
      warnings.push(`${l.displayName} 연결: ${e instanceof ApiError ? e.message : '실패했어요'}`)
    }
  }
  if (d.jenkins && jenkinsLinked) {
    try {
      await api(`/projects/${enc(key)}/service-access/JENKINS`, { method: 'PATCH', body: { enabled: true } })
    } catch (e) {
      warnings.push(`Jenkins 권한: ${e instanceof ApiError ? e.message : '켜지 못했어요'}`)
    }
  }
  return { projectKey: key, warnings }
}

// ───────────────────────── 설정 (P-3 · P-24) ─────────────────────────

export type SettingsMember = {
  memberId: number
  name: string
  memberType: string
  role: ProjectRoleCode
  joinedAt: string
  leftAt: string | null
  /** 맡은 일 태그 (ERP-14) */
  tags: string[]
}
export type SettingsLabel = { labelId: number; name: string; color: string; description: string | null; taskCount: number }
export type ProjectSettings = {
  projectKey: string
  name: string
  description: string
  categoryCode: string
  status: ProjectStatusLive
  visibility: Visibility
  startsOn: string
  endsOn: string
  members: SettingsMember[]
  labels: SettingsLabel[]
  taskTotal: number
  canManage: boolean
  canDelete: boolean
  servicesOn: boolean
}

type LabelsDto = { labels: SettingsLabel[] }
type ServiceAccessDto = { services: { service: string; enabled: boolean }[] }

const MOCK_LABELS: SettingsLabel[] = [
  { labelId: 1, name: '보안', color: '#E5484D', description: '인증 · 권한 · 비밀값', taskCount: 6 },
  { labelId: 2, name: '알림', color: '#3F6593', description: null, taskCount: 4 },
  { labelId: 3, name: '프로필', color: '#34C27A', description: '내 프로필 화면', taskCount: 2 },
]

export function useProjectSettings(key: string | undefined) {
  return useResource<ProjectSettings>(
    ['project-settings', key],
    () => {
      const p = findProject(key)
      const members: SettingsMember[] = [
        ...mockMembers.slice(0, 5).map((m, i): SettingsMember => ({
          memberId: m.memberId,
          name: m.name,
          memberType: m.memberType,
          role: i < 2 ? 'MANAGER' : 'MEMBER',
          joinedAt: '2026-09-01',
          leftAt: null,
          tags: mockTagsOf(m.name),
        })),
        ...mockMembers.slice(5, 6).map((m): SettingsMember => ({
          memberId: m.memberId,
          name: m.name,
          memberType: m.memberType,
          role: 'FORMER',
          joinedAt: '2026-09-01',
          leftAt: '2026-10-31',
          tags: mockTagsOf(m.name),
        })),
      ]
      return {
        projectKey: p.projectKey,
        name: p.name,
        description: p.summary,
        categoryCode: p.categoryCode,
        status: p.status,
        visibility: p.visibility,
        startsOn: p.startsOn,
        endsOn: p.endsOn,
        members,
        labels: MOCK_LABELS,
        taskTotal: 46,
        canManage: true,
        canDelete: true,
        servicesOn: p.services.includes('VAULT') || p.services.includes('JENKINS'),
      }
    },
    async () => {
      const k = enc(key ?? '')
      const [d, labels, access] = await Promise.all([
        getProject(key ?? ''),
        api<LabelsDto>(`/projects/${k}/labels`),
        api<ServiceAccessDto>(`/projects/${k}/service-access`).catch(() => ({ services: [] })),
      ])
      return {
        projectKey: d.projectKey,
        name: d.name,
        description: d.description ?? '',
        categoryCode: d.categoryCode,
        status: d.status,
        visibility: d.visibility,
        startsOn: d.startsOn ?? '',
        endsOn: d.endsOn ?? '',
        members: d.members.map((m) => ({
          memberId: m.member.memberId,
          name: m.member.name,
          memberType: m.member.memberType,
          role: m.role,
          joinedAt: m.joinedAt?.slice(0, 10) ?? '',
          leftAt: m.leftAt?.slice(0, 10) ?? null,
          tags: m.tags ?? [],
        })),
        labels: labels.labels,
        taskTotal: d.taskCounts.total,
        canManage: d.permissions.canManage,
        canDelete: d.permissions.canDelete,
        servicesOn: access.services.some((s) => s.enabled),
      }
    },
  )
}

// ───────────────────────── 일반 · 보관 (P-4) · 키 (P-5b) ─────────────────────────

export type GeneralPatch = {
  name?: string
  categoryCode?: string
  description?: string | null
  visibility?: Visibility
  startsOn?: string | null
  endsOn?: string | null
  status?: ProjectStatusLive
}
export const updateProject = (key: string, patch: GeneralPatch) =>
  api<ProjectDetailDto>(`/projects/${enc(key)}`, { method: 'PATCH', body: patch })

export const changeProjectKey = (key: string, projectKey: string) =>
  api<ProjectDetailDto>(`/projects/${enc(key)}/key`, { method: 'POST', body: { projectKey } })

// ───────────────────────── 참여자 (P-6 · P-7 · P-8) ─────────────────────────

export const addProjectMember = (key: string, memberId: number, role: 'MANAGER' | 'MEMBER') =>
  api(`/projects/${enc(key)}/members`, { method: 'POST', body: { memberId, role } })

export const changeMemberRole = (key: string, memberId: number, role: 'MANAGER' | 'MEMBER') =>
  api(`/projects/${enc(key)}/members/${memberId}`, { method: 'PATCH', body: { role } })

// ───────────────────────── 라벨 (P-25 ~ P-27) ─────────────────────────

export type LabelInput = { name: string; color: string; description: string }
export const createLabel = (key: string, l: LabelInput) =>
  api<SettingsLabel>(`/projects/${enc(key)}/labels`, { method: 'POST', body: { name: l.name.trim(), color: l.color, description: l.description.trim() || null } })
export const updateLabel = (key: string, labelId: number, l: LabelInput) =>
  api<SettingsLabel>(`/projects/${enc(key)}/labels/${labelId}`, { method: 'PATCH', body: { name: l.name.trim(), color: l.color, description: l.description.trim() } })
export const deleteLabel = (key: string, labelId: number) => api(`/projects/${enc(key)}/labels/${labelId}`, { method: 'DELETE' })

// ───────────────────────── 삭제 · 되돌리기 (P-5 · P-5c · P-5d) ─────────────────────────

export type ServiceResources = 'KEEP' | 'REMOVE'
export const deleteProject = (key: string, serviceResources: ServiceResources) =>
  api(`/projects/${enc(key)}`, { method: 'DELETE', query: { serviceResources } })

export type DeletedProject = { projectKey: string; name: string; deletedAt: string; deletedBy: string | null; restorableUntil: string }

export function useDeletedProjects(enabled: boolean) {
  return useResource<DeletedProject[]>(
    ['projects-deleted', enabled],
    () => (enabled ? [{ projectKey: 'OLD', name: '예전 비품 관리', deletedAt: '2026-11-10T03:00:00Z', deletedBy: 'admin', restorableUntil: '2026-12-10T03:00:00Z' }] : []),
    async () => (enabled ? api<DeletedProject[]>('/projects/deleted') : []),
  )
}
export const restoreProject = (key: string) => api<ProjectDetailDto>(`/projects/${enc(key)}/restore`, { method: 'POST' })

/** 서버 오류 → 사용자 문구 */
export const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)
