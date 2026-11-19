// 관리 화면 · 내 프로필 API
// - docs/api/10-member.md (구성원 관리 · 프리셋 · 가입 신청 · 권한 신청 · 졸업 처리 · 내 정보)
// - docs/api/30-project.md P-9a (인수인계 확인), 50-infra.md (감사 로그 · GitHub)
// - docs/api/20-communication.md NT-4 · 5 (알림 설정), 40-document-file.md F-1 · 2 (사진 올리기)
// 응답을 화면이 쓰는 mocks/admin.ts · adminOps.ts 의 모양으로 바꾼다.
import { api, ApiError, serverRoot } from './client'
import { ago, dotDate, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'
import { getApiBase, getDataMode } from '../lib/dataMode'
import { MEMBER_TYPE_NAME, ME_ID, members as mockMembers, type MemberType } from '../mocks/members'
import {
  adminMembers,
  openTasksOf,
  presets as mockPresets,
  ROLES,
  signupRequests,
  type AdminMember,
  type Preset,
  type Role,
  type RoleGroup,
  type SignupRequest,
} from '../mocks/admin'
import {
  auditLogs,
  codeGroups,
  codeRows,
  githubCleanup,
  githubMembers,
  githubStats,
  ROLE_REQUEST_TOTALS,
  roleRequests,
  webhooks,
  type AuditCategory,
  type AuditLog,
  type CodeGroup,
  type CodeRow,
  type RoleRequest,
} from '../mocks/adminOps'

/* ---------- 공통 ---------- */

export const isLive = () => getDataMode() === 'live'

/** 실패 메시지: 서버가 준 문구가 있으면 그대로 */
export const errorText = (e: unknown, fallback = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') =>
  e instanceof ApiError ? e.message : fallback

type TypeLabel = AdminMember['memberType']
const TYPE_LABEL = MEMBER_TYPE_NAME as Record<MemberType, TypeLabel>
const TYPE_CODE: Record<TypeLabel, MemberType> = { 교수: 'PROFESSOR', 학생: 'STUDENT', 인턴: 'INTERN' }
export const typeCode = (label: TypeLabel) => TYPE_CODE[label]

const LEVEL_NAME: Record<string, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기', BUILD: '빌드' }
const SERVICE_NAME: Record<string, string> = { VAULT: 'Vault', JENKINS: 'Jenkins' }

// 서버 시각(UTC) → 연구실 시각(Asia/Seoul) 조각
const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})
function kst(d: Date) {
  const p: Record<string, string> = {}
  for (const x of KST.formatToParts(d)) p[x.type] = x.value
  return p
}
/** '11/17 10:42' */
const kstShort = (iso: string) => {
  const p = kst(new Date(iso))
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`
}
/** '11/17(월) 08:40' */
const kstWithDay = (iso: string) => {
  const p = kst(new Date(iso))
  return `${p.month}/${p.day}(${p.weekday}) ${p.hour}:${p.minute}`
}
const kstTime = (iso: string) => {
  const p = kst(new Date(iso))
  return `${p.hour}:${p.minute}`
}
/** 오늘 (KST) '2026-11-19' */
export const todayKst = () => {
  const p = kst(new Date())
  return `${p.year}-${p.month}-${p.day}`
}
const isTodayKst = (iso: string) => kst(new Date(iso)).day === kst(new Date()).day && Date.now() - new Date(iso).getTime() < 86400000
/** 'YYYY-MM-DD' 에서 n 일 뺀 날짜 */
const minusDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10)
/** '2026-11-24' → '11/24' */
const md = (day: string) => day.slice(5).replace('-', '/')

/** 서버가 준 '/api/v1/files/…' 주소를 API 서버 기준으로 */
export const resolveUrl = (u: string | null | undefined) => (u ? (u.startsWith('/') ? serverRoot() + u : u) : null)

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = name
  el.click()
  URL.revokeObjectURL(url)
}

/* ---------- 역할 · 프리셋 (10-member 4-1, 5-1) ---------- */

type RoleRef = { code: string; name: string; category: RoleGroup }
type RoleDto = RoleRef & { description: string | null; requestable: boolean }
type MemberRole = RoleRef & { source: 'DIRECT' | 'PRESET' | 'REQUEST'; presetId: number | null; expiresAt: string | null }

const fetchRoles = async (): Promise<Role[]> =>
  (await api<RoleDto[]>('/members/roles')).map((r) => ({ code: r.code, desc: r.description ?? r.name, group: r.category }))

type PresetDto = {
  presetId: number
  name: string
  description: string | null
  defaultMemberType: MemberType | null
  enabled: boolean
  roles: RoleRef[]
  appliedMemberCount: number
}
/** 목업 Preset + 적용한 구성원 수 (실서버는 이름 목록 대신 숫자만 준다) */
export type PresetView = Preset & { appliedCount: number }

const toPreset = (p: PresetDto): PresetView => ({
  id: String(p.presetId),
  name: p.name,
  desc: p.description ?? '',
  defaultFor: p.defaultMemberType ? TYPE_LABEL[p.defaultMemberType] : null,
  roles: p.roles.map((r) => r.code),
  applied: [],
  active: p.enabled,
  appliedCount: p.appliedMemberCount,
})
const mockPresetViews = (): PresetView[] => mockPresets.map((p) => ({ ...p, appliedCount: p.applied.length }))
const fetchPresets = async (includeDisabled: boolean) =>
  (await api<PresetDto[]>('/role-presets', { query: { includeDisabled } })).map(toPreset)

/* ---------- 관리 · 구성원 (10-member 2-1, 2-2, 3-3~3-6) ---------- */

type MemberListItem = MemberRef & {
  studentNumber: string
  loginId: string
  joinedOn: string
  leftOn: string | null
  enabled?: boolean
  locked?: boolean
  failedLoginCount?: number
  lastLoginAt?: string | null
  roleCount?: number
  appliedPresets?: { presetId: number; name: string }[]
}
type MembersResponse = {
  counts: { active: number; alumni: number; disabled?: number; locked?: number }
  page: PageResponse<MemberListItem>
}
type MemberDetailDto = MemberListItem & {
  lockedUntil?: string | null
  passwordChangeRequired?: boolean
  roles?: MemberRole[]
  presetApplications?: { preset: { presetId: number; name: string }; appliedAt: string; appliedBy: string }[]
}
type GithubAccountDto = {
  memberId: number
  githubUserId: number
  githubLogin: string
  linkedAt: string
  orgStatus?: 'NONE' | 'INVITED' | 'MEMBER' | 'REMOVE_PENDING' | 'REMOVE_FAILED' | 'REMOVED'
  orgTeam?: string | null
  orgError?: string | null
} | null

const accountState = (x: { enabled?: boolean; locked?: boolean }): AdminMember['state'] =>
  x.enabled === false ? 'DISABLED' : x.locked ? 'LOCKED' : 'ACTIVE'

/** 목업 AdminMember + 역할 수 (목록 응답에는 역할 코드 없이 숫자만 온다) */
export type AdminRow = AdminMember & { roleCount: number }

const toAdminRow = (x: MemberListItem): AdminRow => ({
  memberId: x.memberId,
  name: x.name,
  loginId: x.loginId,
  memberNo: x.studentNumber,
  memberType: TYPE_LABEL[x.memberType],
  state: accountState(x),
  graduated: x.status !== 'ACTIVE',
  presets: (x.appliedPresets ?? []).map((p) => p.name),
  roles: [],
  roleCount: x.roleCount ?? 0,
  lastLogin: x.lastLoginAt ? ago(x.lastLoginAt) : '기록 없음',
  failCount: x.failedLoginCount ?? 0,
})

export type AdminMembersData = { members: AdminRow[]; graduatedTotal: number; roles: Role[] }

/** 관리 · 구성원: 재실 + 졸업생 전체와 역할 목록. 필터 · 검색은 화면이 거른다 */
export function useAdminMembers() {
  return useResource<AdminMembersData>(
    'admin-members',
    () => ({ members: adminMembers.map((m) => ({ ...m, roleCount: m.roles.length })), graduatedTotal: 24, roles: ROLES }),
    async () => {
      // 한 번에 최대 100명 (README 1.3). 연구실 규모라 재실 + 졸업생을 한 번에 받는다
      const [res, roles] = await Promise.all([
        api<MembersResponse>('/members', { query: { group: 'ALL', size: 100 } }),
        fetchRoles(),
      ])
      return { members: res.page.content.map(toAdminRow), graduatedTotal: res.counts.alumni, roles }
    },
  )
}

export type AdminDetail = Pick<AdminMember, 'roles' | 'presets' | 'state' | 'failCount' | 'tempPassword' | 'github'> & {
  presetIds: number[]
}

/** 고른 구성원의 역할 · 프리셋 · GitHub (목업이면 목록 값 그대로) */
export function useAdminMemberDetail(row: AdminRow | undefined) {
  return useResource<AdminDetail>(
    ['admin-member', row?.memberId],
    () => ({
      roles: row?.roles ?? [],
      presets: row?.presets ?? [],
      presetIds: [],
      state: row?.state ?? 'ACTIVE',
      failCount: row?.failCount ?? 0,
      tempPassword: row?.tempPassword,
      github: row?.github,
    }),
    async () => {
      if (!row) return { roles: [], presets: [], presetIds: [], state: 'ACTIVE', failCount: 0 }
      const [d, gh] = await Promise.all([
        api<MemberDetailDto>(`/members/${row.memberId}`),
        api<GithubAccountDto>(`/github/accounts/${row.memberId}`).catch(() => null),
      ])
      const applied = d.presetApplications?.map((p) => p.preset) ?? d.appliedPresets ?? []
      return {
        roles: (d.roles ?? []).map((r) => r.code),
        presets: applied.map((p) => p.name),
        presetIds: applied.map((p) => p.presetId),
        state: accountState(d),
        failCount: d.failedLoginCount ?? 0,
        tempPassword: d.passwordChangeRequired,
        github: gh?.githubLogin,
      }
    },
  )
}

/** 3-4 역할 저장 → 저장 뒤 역할 코드 */
export const saveMemberRoles = (memberId: number, roleCodes: string[]) =>
  api<{ roles: MemberRole[] }>(`/members/${memberId}/roles`, { method: 'PUT', body: { roleCodes } }).then((r) => r.roles.map((x) => x.code))

/**
 * 3-5 프리셋 추가 적용 — 화면의 "프리셋 적용" 은 이미 적용한 프리셋을 다시 적용해 빠진 역할을 채운다.
 * 명세 확인 필요: 화면에 새 프리셋을 고르는 칸이 없어 적용 기록에 있는 프리셋을 차례로 다시 보낸다.
 */
export async function reapplyPresets(memberId: number, presetIds: number[]) {
  let roles: string[] | null = null
  for (const presetId of presetIds) {
    const r = await api<{ addedRoleCodes: string[]; roles: MemberRole[] }>(`/members/${memberId}/preset-applications`, {
      method: 'POST',
      body: { presetId },
    })
    roles = r.roles.map((x) => x.code)
  }
  return roles
}

/** 3-3 구성원 정보 바꾸기 (구분) */
export const patchMember = (memberId: number, body: { memberType?: MemberType }) =>
  api<MemberDetailDto>(`/members/${memberId}`, { method: 'PATCH', body })

/** 3-6 계정 조치 */
export const accountAction = (memberId: number, action: 'disable' | 'enable' | 'unlock') =>
  api<null>(`/members/${memberId}/${action}`, { method: 'POST' })

/** 3-6 임시 비밀번호 재발급 → 한 번만 보이는 값 */
export const resetPassword = (memberId: number) =>
  api<{ memberId: number; loginId: string; temporaryPassword: string }>(`/members/${memberId}/reset-password`, { method: 'POST' }).then(
    (r) => r.temporaryPassword,
  )

/* ---------- 졸업 · 퇴실 처리 (10-member 6-1, 6-2 / 30-project P-9a) ---------- */

type HandoverDto = {
  projects: {
    project: { projectKey: string; name: string }
    projectRole: 'MANAGER' | 'MEMBER'
    lastManager: boolean
    serviceAccess: { vault: string | null; jenkins: string | null } | null
    openTasks: { taskKey: string; title: string; status: string }[]
    candidates: MemberRef[]
  }[]
}
export type Option = { value: string; label: string }
export type HandoverView = {
  /** 회수할 역할 · 프로젝트 서비스 권한 */
  revoke: string[]
  projects: { key: string; label: string; lastManager: boolean; candidates: Option[] }[]
  tasks: { key: string; title: string; candidates: Option[]; initial: string }[]
  github: string | null
}

/** 졸업 처리 확인 화면. 목업은 담당자 값으로 이름을, 실서버는 구성원 ID 를 쓴다 */
export function useHandover(member: AdminRow, others: string[]) {
  return useResource<HandoverView>(
    ['handover', member.memberId],
    () => ({
      revoke: [...member.roles.filter((r) => r === 'penpot-member'), 'DEFME · Vault 쓰기', 'DEFME · Jenkins 빌드'],
      projects: [
        { key: 'DEFME', label: 'DEFME 백엔드 · 프로젝트 관리자', lastManager: false, candidates: [] },
        { key: 'SEMINAR', label: '11월 기술 세미나 · 참여자', lastManager: false, candidates: [] },
      ],
      tasks: openTasksOf(member.name).map((t, i) => ({
        key: t.key,
        title: t.title,
        candidates: others.map((n) => ({ value: n, label: n })),
        initial: i < 2 ? '김민서' : '',
      })),
      github: member.github ?? null,
    }),
    async () => {
      const [h, d, gh] = await Promise.all([
        api<HandoverDto>('/projects/handover', { query: { memberId: member.memberId } }),
        api<MemberDetailDto>(`/members/${member.memberId}`),
        api<GithubAccountDto>(`/github/accounts/${member.memberId}`).catch(() => null),
      ])
      const level = (key: string, svc: string, v: string | null | undefined) =>
        v && v !== 'NONE' ? [`${key} · ${svc} ${LEVEL_NAME[v] ?? v}`] : []
      const opts = (cs: MemberRef[]) => cs.map((c) => ({ value: String(c.memberId), label: c.name }))
      return {
        revoke: [
          ...(d.roles ?? []).filter((r) => r.category === 'SERVICE').map((r) => r.code),
          ...h.projects.flatMap((p) => [
            ...level(p.project.projectKey, 'Vault', p.serviceAccess?.vault),
            ...level(p.project.projectKey, 'Jenkins', p.serviceAccess?.jenkins),
          ]),
        ],
        projects: h.projects.map((p) => ({
          key: p.project.projectKey,
          label: `${p.project.name} · ${p.projectRole === 'MANAGER' ? '프로젝트 관리자' : '참여자'}`,
          lastManager: p.lastManager,
          candidates: opts(p.candidates),
        })),
        tasks: h.projects.flatMap((p) =>
          p.openTasks.map((t) => ({ key: t.taskKey, title: t.title, candidates: opts(p.candidates), initial: '' })),
        ),
        github: gh?.githubLogin ?? null,
      }
    },
  )
}

export type DepartureBody = {
  kind: 'GRADUATED' | 'LEFT'
  departedOn: string
  taskReassignments: { taskKey: string; assigneeMemberId: number | null }[]
  projectManagerHandovers: { projectKey: string; newManagerMemberId: number }[]
}
/** 6-2 졸업 · 퇴실 처리 → 회수한 역할 */
export const departMember = (memberId: number, body: DepartureBody) =>
  api<{ departureId: number; revokedRoleCodes: string[] }>(`/members/${memberId}/departures`, { method: 'POST', body }).then(
    (r) => r.revokedRoleCodes,
  )

/* ---------- 관리 · 권한 프리셋 (10-member 5-1~5-3) ---------- */

export type PresetsData = { presets: PresetView[]; roles: Role[] }

export function usePresetsAdmin() {
  return useResource<PresetsData>(
    'admin-presets',
    () => ({ presets: mockPresetViews(), roles: ROLES }),
    async () => {
      const [presets, roles] = await Promise.all([fetchPresets(true), fetchRoles()])
      return { presets, roles }
    },
  )
}

export type PresetMember = { memberId: number; name: string; roles: string[] }

/** 반영 미리보기: 이 프리셋을 적용한 재실 구성원과 그 역할 (5-3 설명대로 GET /members?presetId=) */
export function usePresetMembers(preset: PresetView) {
  return useResource<PresetMember[]>(
    ['preset-members', preset.id],
    () =>
      preset.applied.map((n) => {
        const m = adminMembers.find((x) => x.name === n)
        return { memberId: m?.memberId ?? -1, name: n, roles: m?.roles ?? [] }
      }),
    async () => {
      if (!/^\d+$/.test(preset.id)) return []
      const res = await api<MembersResponse>('/members', { query: { presetId: Number(preset.id), group: 'ACTIVE', size: 100 } })
      // 명세 확인 필요: 목록(2-1)에 역할 코드가 없어(roleCount 만) 구성원 상세(2-2)를 한 명씩 부른다
      const details = await Promise.all(res.page.content.map((m) => api<MemberDetailDto>(`/members/${m.memberId}`)))
      return details.map((d) => ({ memberId: d.memberId, name: d.name, roles: (d.roles ?? []).map((r) => r.code) }))
    },
  )
}

export type PresetBody = {
  name?: string
  description?: string | null
  defaultMemberType?: MemberType | null
  roleCodes?: string[]
  enabled?: boolean
  propagateToMemberIds?: number[]
}
/** 화면의 바뀐 칸만 본문으로 */
export function presetBody(draft: Preset, saved: Preset | null): PresetBody {
  const b: PresetBody = {}
  if (!saved || draft.name !== saved.name) b.name = draft.name
  if (!saved || draft.desc !== saved.desc) b.description = draft.desc || null
  if (!saved || draft.defaultFor !== saved.defaultFor) b.defaultMemberType = draft.defaultFor ? TYPE_CODE[draft.defaultFor as TypeLabel] : null
  if (!saved || JSON.stringify(draft.roles) !== JSON.stringify(saved.roles)) b.roleCodes = draft.roles
  if (saved && draft.active !== saved.active) b.enabled = draft.active
  return b
}
/** 5-2 프리셋 만들기 */
export const createPreset = (body: PresetBody) => api<PresetDto>('/role-presets', { method: 'POST', body }).then(toPreset)
/** 5-3 프리셋 바꾸기 · 사용 안 함 · 반영 */
export const updatePreset = (presetId: string, body: PresetBody) =>
  api<{ preset: PresetDto; propagated?: { memberId: number; addedRoleCodes: string[] }[] }>(`/role-presets/${presetId}`, {
    method: 'PATCH',
    body,
  }).then((r) => toPreset(r.preset))

/* ---------- 관리 · 가입 신청 (10-member 3-2, 8-2, 8-3) ---------- */

type SignupStatus = SignupRequest['status']
type SignupDto = {
  applicationId: number
  name: string
  studentNumber: string | null
  desiredLoginId: string
  email: string | null
  phone: string
  reason: string
  memberType: MemberType
  privacyAgreedAt: string
  desiredLoginIdTaken: boolean
  studentNumberTaken: boolean
  status: SignupStatus
  rejectReason: string | null
  createdAt: string
}
type SignupsResponse = { counts: Record<SignupStatus, number>; page: PageResponse<SignupDto> }

const toSignup = (x: SignupDto): SignupRequest => ({
  id: x.applicationId,
  name: x.name,
  type: TYPE_LABEL[x.memberType] ?? '인턴',
  wantedId: x.desiredLoginId,
  ago: ago(x.createdAt),
  appliedAt: kstWithDay(x.createdAt),
  studentNo: x.studentNumber,
  email: x.email,
  phone: x.phone,
  reason: x.reason,
  status: x.status,
  idTaken: x.desiredLoginIdTaken,
})

export type PresetOption = { id: string; name: string; roles: string[] }
export type SignupsData = {
  requests: SignupRequest[]
  /** 받아 온 목록에 없는 건수 (탭 숫자에 더한다) */
  extra: Record<SignupStatus, number>
  presets: PresetOption[]
}
const SIGNUP_STATUSES: SignupStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

export function useSignups() {
  return useResource<SignupsData>(
    'admin-signups',
    () => ({
      requests: signupRequests,
      extra: { PENDING: 0, APPROVED: 11, REJECTED: 1 }, // 목업에 없는 지난 기록 수
      presets: mockPresets,
    }),
    async () => {
      const [lists, presets] = await Promise.all([
        Promise.all(SIGNUP_STATUSES.map((status) => api<SignupsResponse>('/signup-applications', { query: { status, size: 100 } }))),
        fetchPresets(false),
      ])
      const counts = lists[0].counts
      const requests = lists.flatMap((l) => l.page.content.map(toSignup))
      const extra = Object.fromEntries(
        SIGNUP_STATUSES.map((s) => [s, Math.max(0, (counts[s] ?? 0) - requests.filter((r) => r.status === s).length)]),
      ) as Record<SignupStatus, number>
      return { requests, extra, presets }
    },
  )
}

export type IdCheck = { valid: boolean; available: boolean } | null

/** 3-2 로그인 ID 확인 (목업은 null → 화면이 목업 규칙으로 판단) */
export function useLoginIdCheck(loginId: string) {
  return useResource<IdCheck>(
    ['login-id-check', loginId],
    () => null,
    async () => {
      if (!loginId) return null
      const r = await api<{ loginId: { value: string; valid: boolean; available: boolean } | null }>('/members/identifier-check', {
        query: { loginId },
      })
      return r.loginId ? { valid: r.loginId.valid, available: r.loginId.available } : null
    },
  )
}

export type SignupReviewBody =
  | { decision: 'REJECT'; reason: string }
  | { decision: 'APPROVE'; loginId: string; studentNumber: string | null; joinedOn: string; presetIds: number[]; roleCodes: string[] }

/** 8-3 승인 · 거절 → 승인이면 임시 비밀번호 */
export const reviewSignup = (applicationId: number, body: SignupReviewBody) =>
  api<{ application: SignupDto; account: { memberId: number; loginId: string; temporaryPassword: string } | null }>(
    `/signup-applications/${applicationId}/review`,
    { method: 'POST', body },
  ).then((r) => ({ request: toSignup(r.application), temporaryPassword: r.account?.temporaryPassword ?? null }))

/* ---------- 관리 · 권한 신청 (10-member 7-3, 7-5) ---------- */

type AccessStatus = RoleRequest['status'] | 'CANCELLED'
type AccessRequestDto = {
  requestId: number
  requester: MemberRef
  targetKind: 'PROJECT_SERVICE' | 'LAB_ROLE'
  project: { projectKey: string; name: string } | null
  service: string | null
  level: string | null
  currentLevel: string | null
  role: RoleRef | null
  reason: string
  expiresOn: string | null
  status: AccessStatus
  approverLabel: string
  canReview: boolean
  reviewer: MemberRef | null
  reviewedAt: string | null
  rejectReason: string | null
  createdAt: string
}

/** 목업 RoleRequest + 승인할 수 있는지 · 승인할 사람 · 신청한 기한 */
export type ReviewRequest = RoleRequest & { canReview: boolean; approverLabel: string; expiresOn: string | null }

const toRoleRequest = (x: AccessRequestDto): ReviewRequest => {
  const status = x.status as RoleRequest['status']
  const target =
    x.targetKind === 'PROJECT_SERVICE'
      ? `${x.project?.projectKey ?? ''} · ${SERVICE_NAME[x.service ?? ''] ?? x.service} ${LEVEL_NAME[x.level ?? ''] ?? x.level}`
      : (x.role?.code ?? '')
  const note =
    status === 'APPROVED'
      ? x.expiresOn
        ? `${md(x.expiresOn)} 만료`
        : '기한 없음'
      : status === 'REJECTED'
        ? (x.rejectReason ?? '')
        : status === 'EXPIRED'
          ? `${x.expiresOn ? md(x.expiresOn) + ' ' : ''}기한 만료`
          : undefined
  return {
    id: x.requestId,
    who: x.requester.name,
    ago: ago(x.createdAt),
    target,
    reason: x.reason,
    period: x.expiresOn ? dotDate(x.expiresOn) : '기한 없음',
    project: x.project?.name ?? '',
    status,
    note,
    handledBy: x.reviewer?.name ?? (status === 'EXPIRED' ? '시스템' : undefined),
    canReview: x.canReview,
    approverLabel: x.approverLabel,
    expiresOn: x.expiresOn,
  }
}

export type RoleRequestsData = { requests: ReviewRequest[]; extra: Record<RoleRequest['status'], number> }
const REQUEST_STATUSES: RoleRequest['status'][] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']

export function useRoleRequests() {
  return useResource<RoleRequestsData>(
    'admin-role-requests',
    () => ({
      requests: roleRequests.map((r) => ({ ...r, canReview: true, approverLabel: '', expiresOn: null })),
      // 목업에 없는 지난 처리 건수만큼 더해 시안 숫자(승인 8 · 거절 1 · 만료 3)를 맞춘다
      extra: Object.fromEntries(
        REQUEST_STATUSES.map((t) => [t, t === 'PENDING' ? 0 : ROLE_REQUEST_TOTALS[t] - roleRequests.filter((r) => r.status === t).length]),
      ) as Record<RoleRequest['status'], number>,
    }),
    async () => {
      const res = await api<{ counts: Record<AccessStatus, number>; page: PageResponse<AccessRequestDto> }>('/auth/access-requests', {
        query: { scope: 'REVIEW', size: 100 },
      })
      // 취소한 신청은 이 화면에 탭이 없어 뺀다
      const requests = res.page.content.filter((x) => x.status !== 'CANCELLED').map(toRoleRequest)
      const extra = Object.fromEntries(
        REQUEST_STATUSES.map((t) => [t, Math.max(0, (res.counts[t] ?? 0) - requests.filter((r) => r.status === t).length)]),
      ) as Record<RoleRequest['status'], number>
      return { requests, extra }
    },
  )
}

/** 7-5 승인 · 거절 → 바뀐 신청 */
export const reviewAccessRequest = (
  requestId: number,
  body: { decision: 'APPROVE'; expiresOn: string | null } | { decision: 'REJECT'; reason: string },
) => api<AccessRequestDto>(`/auth/access-requests/${requestId}/review`, { method: 'POST', body }).then(toRoleRequest)

/* ---------- 관리 · 감사 로그 (50-infra AU-1, AU-2) ---------- */

export type AuditFilter = {
  period: string
  actor: string
  /** 실서버: 고른 행위자의 로그인 ID (actorLoginId 로 찾음) */
  actorLoginId?: string
  cat: string
  target: string
  /** 1부터 */
  page: number
}
export type AuditRow = AuditLog & { loginId: string | null }
export type AuditData = { logs: AuditRow[]; totalPages: number }

const PERIOD_DAYS: Record<string, number> = { 오늘: 0, '최근 7일': 6, '최근 30일': 29, '최근 1년': 364 }
const CAT_CODE: Record<AuditCategory, string> = {
  권한: 'ROLE',
  프로젝트: 'PROJECT',
  로그인: 'LOGIN',
  운영: 'OPERATION',
  콘텐츠: 'CONTENT',
  구성원: 'MEMBER',
}
// 화면에 없는 분류(가입 · 외부)는 가까운 색으로 보여 준다
const CAT_LABEL: Record<string, AuditCategory> = {
  ROLE: '권한',
  PROJECT: '프로젝트',
  LOGIN: '로그인',
  OPERATION: '운영',
  CONTENT: '콘텐츠',
  MEMBER: '구성원',
  SIGNUP: '구성원',
  EXTERNAL: '운영',
}
// 명세 확인 필요: AuditTargetType 이름이 명세에 MEMBER · PROJECT 만 나온다. 나머지는 짐작한 이름
const TARGET_CODE: Record<string, string> = {
  구성원: 'MEMBER',
  프로젝트: 'PROJECT',
  프리셋: 'ROLE_PRESET',
  서비스: 'SSO_CLIENT',
  자료: 'DOCUMENT',
}
const ACTION_LABEL: Record<string, string> = {
  ROLE_CHANGED: '역할 변경',
  PRESET_APPLIED: '프리셋 반영',
  PRESET_CREATED: '프리셋 생성',
  PRESET_UPDATED: '프리셋 변경',
  MEMBER_CREATED: '구성원 생성',
  MEMBER_UPDATED: '구성원 변경',
  MEMBER_DISABLED: '비활성화',
  MEMBER_ENABLED: '다시 활성화',
  MEMBER_UNLOCKED: '잠금 해제',
  MEMBER_DEPARTED: '졸업 · 퇴실',
  MEMBER_REINSTATED: '재실로 되돌림',
  TEMP_PASSWORD_ISSUED: '임시 비밀번호',
  LOGIN_SUCCESS: '로그인',
  LOGIN_FAILED: '로그인',
  AUDIT_EXPORTED: '감사 로그 내려받기',
  GITHUB_LINKED: 'GitHub 연결',
  GITHUB_UNLINKED: 'GitHub 해제',
  ACCESS_REQUEST_APPROVED: '권한 신청 승인',
  ACCESS_REQUEST_REJECTED: '권한 신청 거절',
  SIGNUP_APPROVED: '가입 승인',
  SIGNUP_REJECTED: '가입 거절',
}

type AuditDto = {
  auditLogId: number
  occurredAt: string
  actor: { memberId: number; loginId: string; name: string } | null
  category: string
  action: string
  target: { type: string; id: string; label: string | null }
  changes: Record<string, unknown> | null
  summary: string | null
  result: 'SUCCESS' | 'FAILURE'
  failureReason: string | null
  clientIp: string | null
  userAgent: string | null
}

const show = (v: unknown) => (Array.isArray(v) ? `[${v.join(', ')}]` : v == null ? '없음' : typeof v === 'object' ? JSON.stringify(v) : String(v))
/** { roles: { before, after } } → '[a, b] → [a, b, c]' */
function describeChanges(c: Record<string, unknown> | null) {
  if (!c) return ''
  const entries = Object.entries(c)
  return entries
    .map(([k, v]) => {
      const head = entries.length > 1 ? `${k}: ` : ''
      if (v && typeof v === 'object' && 'before' in v && 'after' in v) {
        const ba = v as { before: unknown; after: unknown }
        return `${head}${show(ba.before)} → ${show(ba.after)}`
      }
      return `${head}${show(v)}`
    })
    .join(' · ')
}
/** User-Agent 원문 → 'Chrome · Windows' */
function shortUa(ua: string | null) {
  if (!ua) return ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '기타'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타'
  return `${browser} · ${os}`
}

const toAudit = (x: AuditDto): AuditRow => ({
  at: kstShort(x.occurredAt),
  actor: x.actor?.name ?? (x.category === 'LOGIN' && x.result === 'FAILURE' ? '(알 수 없음)' : '시스템'),
  loginId: x.actor?.loginId ?? null,
  category: CAT_LABEL[x.category] ?? '운영',
  action: ACTION_LABEL[x.action] ?? x.action,
  target: x.target.label ?? `${x.target.type} ${x.target.id}`,
  change: x.summary ?? (describeChanges(x.changes) || (x.category === 'LOGIN' ? shortUa(x.userAgent) : '')),
  ip: x.clientIp ?? '-',
  ok: x.result === 'SUCCESS',
})

/** 화면 거르기 값 → AU-1 쿼리 (page 는 따로) */
function auditQuery(f: AuditFilter) {
  const to = todayKst()
  return {
    from: minusDays(to, PERIOD_DAYS[f.period] ?? 6),
    to,
    actorLoginId: f.actorLoginId || undefined,
    category: f.cat ? CAT_CODE[f.cat as AuditCategory] : undefined,
    targetType: f.target ? TARGET_CODE[f.target] : undefined,
  }
}

export function useAuditLogs(f: AuditFilter) {
  return useResource<AuditData>(
    ['audit-logs', f],
    () => ({
      logs: auditLogs
        .filter((l) => (!f.actor || l.actor === f.actor) && (!f.cat || l.category === f.cat) && (!f.target || l.target.includes(f.target)))
        .map((l) => ({ ...l, loginId: null })),
      totalPages: 24,
    }),
    async () => {
      const res = await api<PageResponse<AuditDto>>('/audit-logs', { query: { ...auditQuery(f), page: f.page - 1, size: 20 } })
      return { logs: res.content.map(toAudit), totalPages: Math.max(1, res.totalPages) }
    },
  )
}

/** AU-2 같은 조건으로 서버가 만든 CSV 내려받기 */
export async function downloadAuditCsv(f: AuditFilter) {
  const q = auditQuery(f)
  const qs = new URLSearchParams(
    Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  )
  const res = await fetch(`${getApiBase().replace(/\/$/, '')}/audit-logs/export?${qs}`, {
    credentials: 'include',
    headers: { Accept: 'text/csv' },
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null
    throw new ApiError(res.status, j?.error?.code ?? `HTTP${res.status}`, j?.error?.message ?? '내려받지 못했어요.')
  }
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `audit-logs-${q.from}-${q.to}.csv`
  saveBlob(await res.blob(), name)
}

/* ---------- 관리 · 공통코드 (기존 backoffice · sso, 10-member 9-2) ---------- */

// 명세 확인 필요: 기존 공통코드 API 의 경로 · 응답 모양이 명세에 없다.
// 10-member 는 "경로는 모두 /api/v1 아래" 이고 같은 모듈의 9-1 이 /api/v1/backoffice/job-runs 라서 /api/v1 아래로 본다.
// 서버 루트(/backoffice/…)라면 아래 값을 true 로 바꾼다.
const CODES_AT_ROOT = false
const CODES = '/backoffice/common-codes'

type CodeGroupDto = { codeId: string; codeName: string; description?: string | null }
// 명세 확인 필요: 상세 코드 필드 이름(detailCode · detailName · ref1~4 · enabled)은 짐작
type CodeDetailDto = {
  detailCode: string
  detailName: string
  ref1: string | null
  ref2: string | null
  ref3?: string | null
  ref4: string | null
  sortOrder?: number
  enabled: boolean
}
export type CodeGroupView = CodeGroup & { desc?: string }
export type CodeRowView = CodeRow & { raw?: CodeDetailDto }
export type CodeTable = { desc: string; columns: [string, string, string, string]; rows: CodeRowView[] } | null

export function useCodeGroups() {
  return useResource<CodeGroupView[]>(
    'code-groups',
    () => codeGroups,
    async () =>
      (await api<CodeGroupDto[]>(CODES, { root: CODES_AT_ROOT })).map((g) => ({ code: g.codeId, name: g.codeName, desc: g.description ?? '' })),
  )
}

export function useCodeTable(group: CodeGroupView | undefined) {
  return useResource<CodeTable>(
    ['code-table', group?.code],
    () => (group ? (codeRows[group.code] ?? null) : null),
    async () => {
      if (!group) return null
      const rows = await api<CodeDetailDto[]>(`${CODES}/${encodeURIComponent(group.code)}/details`, { root: CODES_AT_ROOT })
      return {
        desc: group.desc ?? '',
        columns: ['ref1', 'ref2', 'ref4', '사용'],
        rows: rows.map((r) => ({
          code: r.detailCode,
          name: r.detailName,
          ref1: r.ref1 ?? '',
          ref2: (r.ref2 ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          ref4: r.ref4 ?? '',
          enabled: r.enabled,
          raw: r,
        })),
      }
    },
  )
}

/** 상세 코드 사용 켜기 · 끄기 — 명세 확인 필요: 기존 PUT 의 경로 · 본문을 짐작 */
export const saveCodeEnabled = (groupCode: string, raw: CodeDetailDto, enabled: boolean) =>
  api(`${CODES}/${encodeURIComponent(groupCode)}/details/${encodeURIComponent(raw.detailCode)}`, {
    method: 'PUT',
    body: { ...raw, enabled },
    root: CODES_AT_ROOT,
  })

export const evictCodeCache = () => api<null>(`${CODES}/cache/evict`, { method: 'POST', root: CODES_AT_ROOT })

/** client secret 새로 발급 → 한 번만 보이는 값. 명세 확인 필요: 응답 필드 이름 */
export const issueClientSecret = (clientId: string) =>
  api<{ clientId?: string; clientSecret?: string; secret?: string }>(`/sso/clients/${encodeURIComponent(clientId)}/secret`, {
    method: 'POST',
  }).then((r) => r.clientSecret ?? r.secret ?? '')

/* ---------- 관리 · GitHub (50-infra G-4, G-6~G-8) ---------- */

export type GithubMemberRow = { memberId: number; name: string; login: string | null; team: string; state: 'MEMBER' | 'INVITED' | 'NONE' }
export type CleanupItem = { login: string; reason: string; kind: 'orphan' | 'failed'; githubLogin: string; memberId?: number }
export type WebhookRow = { at: string; event: string; detail: string; ok: boolean }
export type GithubAdminData = {
  stats: { linked: number; active: number; orgMembers: number | null; lastWebhook: string }
  members: GithubMemberRow[]
  cleanup: CleanupItem[]
  webhooks: WebhookRow[]
  /** 마지막 다시 훑기 시각 */
  rescan: string
  /** 마지막 수신이 24시간보다 오래됨 */
  stale: boolean
  /** GitHub 조직 목록을 못 읽음 */
  orgUnavailable: boolean
}

type GithubAdminDto = {
  summary: { activeCount: number; linkedActiveCount: number; orgMemberCount: number | null; needsCleanupCount: number }
  orgOnly: { status: 'OK' | 'UNAVAILABLE'; accounts: { githubLogin: string; githubUserId: number }[] }
  members: PageResponse<{ member: MemberRef; account: GithubAccountDto }>
}
type DeliveriesDto = {
  lastReceivedAt: string | null
  stale: boolean
  lastRescan: { startedAt: string; status: string } | null
  deliveries: PageResponse<{
    deliveryId: string
    event: string
    repositoryFullName: string | null
    status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'REJECTED_SIGNATURE'
    error: string | null
    receivedAt: string
    processedAt: string | null
    summary: string | null
  }>
}

export function useGithubAdmin() {
  return useResource<GithubAdminData>(
    'admin-github',
    () => ({
      stats: { linked: githubStats.linked, active: githubStats.active, orgMembers: githubStats.orgMembers, lastWebhook: githubStats.lastWebhook },
      members: githubMembers.map((m, i) => ({ ...m, memberId: -(i + 1) })),
      cleanup: githubCleanup.map((c) => ({ ...c, githubLogin: c.login.replace(/^@/, '') })),
      webhooks,
      rescan: '05:00',
      stale: false,
      orgUnavailable: false,
    }),
    async () => {
      const [g, d] = await Promise.all([
        api<GithubAdminDto>('/github/accounts', { query: { memberStatus: 'ALL', size: 100 } }),
        api<DeliveriesDto>('/github/webhook-deliveries', { query: { size: 5 } }),
      ])
      const rows = g.members.content
      return {
        stats: {
          linked: g.summary.linkedActiveCount,
          active: g.summary.activeCount,
          orgMembers: g.summary.orgMemberCount,
          lastWebhook: d.lastReceivedAt ? ago(d.lastReceivedAt) : '없음',
        },
        members: rows
          .filter((x) => x.member.status === 'ACTIVE')
          .map(({ member, account }) => ({
            memberId: member.memberId,
            name: member.name,
            login: account ? `@${account.githubLogin}` : null,
            team: account?.orgTeam ?? '-',
            // 연결했지만 아직 조직에 없으면(초대 전 · 대기) "초대 보냄" 으로 보여 준다
            state: !account ? 'NONE' : account.orgStatus === 'MEMBER' ? 'MEMBER' : 'INVITED',
          })),
        cleanup: [
          ...g.orgOnly.accounts.map((a) => ({
            login: `@${a.githubLogin}`,
            githubLogin: a.githubLogin,
            reason: '조직에는 있는데 ERP 에 연결된 구성원이 없어요',
            kind: 'orphan' as const,
          })),
          ...rows
            .filter((x) => x.account?.orgStatus === 'REMOVE_FAILED')
            .map(({ member, account }) => ({
              login: `@${account!.githubLogin}`,
              githubLogin: account!.githubLogin,
              memberId: member.memberId,
              reason: `${member.name} · 조직 제거 실패${account!.orgError ? ` (${account!.orgError})` : ''}`,
              kind: 'failed' as const,
            })),
        ],
        webhooks: d.deliveries.content.map((w) => ({
          at: isTodayKst(w.receivedAt) ? kstTime(w.receivedAt) : ago(w.receivedAt),
          event: w.event,
          detail: w.summary ?? w.error ?? w.repositoryFullName ?? w.status,
          ok: w.status === 'PROCESSED' || w.status === 'RECEIVED',
        })),
        rescan: d.lastRescan ? kstShort(d.lastRescan.startedAt) : '기록 없음',
        stale: d.stale,
        orgUnavailable: g.orgOnly.status === 'UNAVAILABLE',
      }
    },
  )
}

/** G-7 연결 요청 알림 */
export const sendLinkReminder = (memberId: number) =>
  api<{ sentMemberIds: number[]; skippedMemberIds: number[] }>('/github/link-reminders', { method: 'POST', body: { memberIds: [memberId] } })

/** G-6 조직에서 빼기 (조직에만 있는 계정은 githubLogin, 제거 실패 다시 시도는 memberId) */
export const removeFromOrg = (c: CleanupItem) =>
  api<{ jobId: number; status: string }>('/github/org-sync', {
    method: 'POST',
    body: c.kind === 'failed' && c.memberId !== undefined ? { action: 'REMOVE', memberId: c.memberId } : { action: 'REMOVE', githubLogin: c.githubLogin },
  })

/* ---------- 내 프로필 (10-member 1-1~1-4, 7-1 / 50-infra G-1 · G-3 · G-5 / 20-communication NT-4 · 5) ---------- */

export type ProfileForm = { email: string; phone: string; phonePublic: boolean; intro: string }
export type NotiPref = { key: string; label: string; locked: boolean; enabled: boolean }
export type ProfileData = {
  memberId: number
  name: string
  memberNo: string
  loginId: string
  typeLabel: string
  joinedAt: string
  photoUrl: string | null
  form: ProfileForm
  labRoles: string[]
  projectPerms: { name: string; vault: string; jenkins: string }[]
  github: { login: string; orgLabel: string } | null
  prefs: NotiPref[]
}

type MeDto = {
  memberId: number
  studentNumber: string
  loginId: string
  name: string
  roles: string[]
  memberType: MemberType
  status: string
  joinedOn: string
  email: string | null
  phone: string | null
  phonePublic: boolean
  intro: string | null
  photoUrl: string | null
}
type LevelDto = { enabled: boolean; level: string; source: string; expiresAt: string | null }
type ServiceAccessDto = {
  labRoles: (RoleRef & { expiresAt: string | null })[]
  projects: { project: { projectKey: string; name: string }; projectRole: string; vault: LevelDto; jenkins: LevelDto }[]
}
type NotiSettingsDto = { groups: { group: string; label: string; enabled: boolean; mandatory: boolean }[] }

const MOCK_PREFS: NotiPref[] = [
  { key: 'mustNotice', label: '필독 공지', locked: true, enabled: true },
  { key: 'access', label: '권한 변경 · 신청 결과', locked: true, enabled: true },
  { key: 'assign', label: '작업 배정 · @멘션', locked: false, enabled: true },
  { key: 'watch', label: '구독한 작업 변경', locked: false, enabled: true },
  { key: 'poll', label: '모임 날짜 · 투표 마감', locked: false, enabled: true },
  { key: 'noticeComment', label: '공지 댓글', locked: false, enabled: false },
]
const toForm = (m: MeDto): ProfileForm => ({ email: m.email ?? '', phone: m.phone ?? '', phonePublic: m.phonePublic, intro: m.intro ?? '' })
const toPrefs = (n: NotiSettingsDto): NotiPref[] => n.groups.map((g) => ({ key: g.group, label: g.label, locked: g.mandatory, enabled: g.enabled }))
const orgLabel = (a: NonNullable<GithubAccountDto>) =>
  a.orgStatus === 'MEMBER'
    ? `Hoseo-I-Turtle 조직${a.orgTeam ? ` · ${a.orgTeam} 팀` : ''}`
    : a.orgStatus === 'INVITED'
      ? 'Hoseo-I-Turtle 조직 초대 · 메일에서 수락해 주세요'
      : 'Hoseo-I-Turtle 조직 초대 준비 중'
const levelText = (svc: string, l: LevelDto) => (l.enabled ? `${svc} ${LEVEL_NAME[l.level] ?? l.level}` : `${svc} 안 씀`)

export function useMyProfile() {
  return useResource<ProfileData>(
    'my-profile',
    () => {
      const me = mockMembers.find((m) => m.memberId === ME_ID)!
      return {
        memberId: me.memberId,
        name: me.name,
        memberNo: me.memberNo,
        loginId: 'minseo',
        typeLabel: MEMBER_TYPE_NAME[me.memberType],
        joinedAt: me.joinedAt,
        photoUrl: null,
        form: { email: me.email ?? '', phone: '010-9876-5432', phonePublic: false, intro: me.intro },
        labRoles: ['penpot-member'],
        projectPerms: [
          { name: 'DEFME 백엔드', vault: 'Vault 쓰기', jenkins: 'Jenkins 빌드' },
          { name: '매트 센서 데이터 수집', vault: 'Vault 읽기', jenkins: 'Jenkins 빌드' },
        ],
        github: me.githubLogin ? { login: me.githubLogin, orgLabel: 'Hoseo-I-Turtle 조직 · students 팀' } : null,
        prefs: MOCK_PREFS,
      }
    },
    async () => {
      const me = await api<MeDto>('/members/me')
      const [access, gh, noti] = await Promise.all([
        api<ServiceAccessDto>('/auth/service-access/me'),
        api<GithubAccountDto>(`/github/accounts/${me.memberId}`),
        api<NotiSettingsDto>('/notifications/settings'),
      ])
      return {
        memberId: me.memberId,
        name: me.name,
        memberNo: me.studentNumber,
        loginId: me.loginId,
        typeLabel: MEMBER_TYPE_NAME[me.memberType] ?? me.memberType,
        joinedAt: dotDate(me.joinedOn),
        photoUrl: resolveUrl(me.photoUrl),
        form: toForm(me),
        labRoles: access.labRoles.map((r) => r.code),
        projectPerms: access.projects.map((p) => ({
          name: p.project.name,
          vault: levelText('Vault', p.vault),
          jenkins: levelText('Jenkins', p.jenkins),
        })),
        github: gh ? { login: gh.githubLogin, orgLabel: orgLabel(gh) } : null,
        prefs: toPrefs(noti),
      }
    },
  )
}

/** 1-2 내 연락 정보 · 소개 — 바뀐 칸만 보내고 빈 값은 null(지움) */
export function saveMyProfile(form: ProfileForm, saved: ProfileForm) {
  const body: Record<string, string | boolean | null> = {}
  const text = (k: 'email' | 'phone' | 'intro') => {
    if (form[k] !== saved[k]) body[k] = form[k].trim() || null
  }
  text('email')
  text('phone')
  text('intro')
  if (form.phonePublic !== saved.phonePublic) body.phonePublic = form.phonePublic
  return api<MeDto>('/members/me', { method: 'PATCH', body }).then(toForm)
}

/** 사진 가운데를 정사각형으로 자를 영역 (원본 px) */
async function centerSquare(file: File) {
  const bmp = await createImageBitmap(file)
  const size = Math.min(bmp.width, bmp.height)
  const crop = { x: Math.floor((bmp.width - size) / 2), y: Math.floor((bmp.height - size) / 2), size }
  bmp.close()
  return crop
}

/**
 * 1-3 프로필 사진 바꾸기: F-1 올리기 시작 → Garage 로 PUT → F-2 완료 → 사진으로 지정.
 * 명세 확인 필요: 자르기 화면이 없어 가운데 정사각형으로 자른다.
 */
export async function uploadProfilePhoto(memberId: number, file: File) {
  const crop = await centerSquare(file)
  const up = await api<{
    publicId: string
    mode: 'SINGLE' | 'MULTIPART'
    single: { url: string; method: string; headers: Record<string, string> } | null
  }>('/files/uploads', {
    method: 'POST',
    body: { filename: file.name, size: file.size, contentType: file.type, purpose: 'PROFILE_PHOTO' },
  })
  // 5MB 이하라 늘 SINGLE (16MB 넘으면 MULTIPART)
  if (!up.single) throw new ApiError(400, 'UPLOAD_MODE', '사진을 올리지 못했어요.')
  const put = await fetch(up.single.url, { method: up.single.method || 'PUT', headers: up.single.headers, body: file })
  if (!put.ok) throw new ApiError(put.status, 'UPLOAD_PUT', '사진을 저장소에 올리지 못했어요.')
  await api(`/files/uploads/${up.publicId}/complete`, { method: 'POST', body: {} })
  const r = await api<{ photoUrl: string; thumbnailUrl: string }>(`/members/${memberId}/photo`, {
    method: 'PUT',
    body: { fileId: up.publicId, crop },
  })
  return resolveUrl(r.photoUrl)
}

/** 1-4 프로필 사진 지우기 */
export const deleteProfilePhoto = (memberId: number) => api<null>(`/members/${memberId}/photo`, { method: 'DELETE' })

/** G-1 연결 시작 주소 — XHR 이 아니라 페이지 이동 */
export const githubLinkStartUrl = () => `${getApiBase().replace(/\/$/, '')}/github/link/start`

/** G-5 연결 해제 */
export const unlinkGithub = (memberId: number) => api<null>(`/github/accounts/${memberId}`, { method: 'DELETE' })

/** G-2 가 돌려보낸 결과 (/profile?github=linked | error&code=) */
export function githubLinkResult(search: string) {
  const q = new URLSearchParams(search)
  const r = q.get('github')
  if (r === 'linked') return { ok: true, message: 'GitHub 계정을 연결했어요.' }
  if (r !== 'error') return null
  const msg: Record<string, string> = {
    G001: '이미 GitHub 계정을 연결했어요.',
    G002: '다른 구성원에게 연결된 GitHub 계정이에요.',
    G003: '연결 요청이 만료됐거나 취소됐어요. 다시 시도해 주세요.',
    G004: 'GitHub 에서 계정을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  }
  return { ok: false, message: msg[q.get('code') ?? ''] ?? 'GitHub 연결에 실패했어요.' }
}

/** NT-5 알림 설정 저장 (바꾼 묶음만) */
export const saveNotiPref = (group: string, enabled: boolean) =>
  api<NotiSettingsDto>('/notifications/settings', { method: 'PUT', body: { groups: [{ group, enabled }] } }).then(toPrefs)
