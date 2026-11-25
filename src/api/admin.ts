// 관리 화면 · 내 프로필 API
// - docs/api/10-member.md (구성원 관리 · 프리셋 · 가입 신청 · 권한 신청 · 졸업 처리 · 내 정보)
// - docs/api/30-project.md P-9a (인수인계 확인), 50-infra.md (감사 로그 · GitHub)
// - docs/api/20-communication.md NT-4 · 5 (알림 설정), 40-document-file.md F-1 · 2 (사진 올리기)
// 응답을 화면이 쓰는 mocks/admin.ts · adminOps.ts 의 모양으로 바꾼다.
import { api, ApiError, serverRoot } from './client'
import { ago, dotDate, fetchEveryPage, type MemberRef, type PageResponse } from './types'
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
  type RoleRequest,
} from '../mocks/adminOps'

/* ---------- 공통 ---------- */

export const isLive = () => getDataMode() === 'live'

/**
 * 관리 탭별로 백엔드가 요구하는 역할 (@PreAuthorize). 하나라도 있으면 그 탭을 쓸 수 있다.
 * - members: 목록은 누구나 보지만 관리 칸 · 계정 조치는 member-manage, 역할 저장 · 프리셋 적용은 role-manage
 * - role-requests: 연구실 역할 신청은 role-manage, 프로젝트 신청은 그 프로젝트 관리자 (REVIEW 범위가 없으면 403)
 * - codes: 공통코드는 code-manage, SSO_APP 의 client secret 발급은 sso-admin
 * 메뉴를 숨기는 곳(관리 탭 · 사이드바)이 1-1 의 roles 와 맞춰 쓴다.
 */
export const ADMIN_TAB_AUTHORITIES: Record<string, string[]> = {
  members: ['member-manage', 'role-manage'],
  presets: ['role-manage'],
  signups: ['member-manage'],
  'role-requests': ['role-manage'],
  audit: ['audit-read'],
  codes: ['code-manage'],
  github: ['github-manage'],
  cloudflare: ['member-manage'],
}
/** 내 역할(1-1 roles)로 볼 수 있는 관리 탭인지. 프로젝트 관리자의 권한 신청 검토는 역할로 알 수 없어 따로 본다 */
export const canSeeAdminTab = (tab: string, myRoles: readonly string[]) =>
  (ADMIN_TAB_AUTHORITIES[tab] ?? []).some((r) => myRoles.includes(r))

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

/** 백엔드 MemberStatus (휴학 ON_LEAVE 포함. types.ts 의 MemberRef 에는 아직 없다) */
type MemberStatus = 'ACTIVE' | 'ON_LEAVE' | 'GRADUATED' | 'LEFT'
type MemberListItem = Omit<MemberRef, 'status'> & {
  status: MemberStatus
  studentNumber: string
  loginId: string
  email?: string | null
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
  // disabled · locked 는 member-manage 일 때만 온다
  counts: { active: number; onLeave: number; alumni: number; disabled?: number; locked?: number }
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

/** 목업 AdminMember + 역할 수 (목록 응답에는 역할 코드 없이 숫자만 온다) + 휴학 */
export type AdminRow = AdminMember & {
  roleCount: number
  onLeave?: boolean
  /** Cloudflare 가입 이메일 (ERP-35 · 37) */
  email?: string | null
  /** Cloudflare 가입 이메일이 없음 (ERP-35) */
  noEmail?: boolean
}

const toAdminRow = (x: MemberListItem): AdminRow => ({
  memberId: x.memberId,
  name: x.name,
  loginId: x.loginId,
  memberNo: x.studentNumber,
  memberType: TYPE_LABEL[x.memberType],
  state: accountState(x),
  // 졸업생 탭 = 백엔드 group=ALUMNI (GRADUATED · LEFT). 휴학(ON_LEAVE)은 재실 탭에 두고 따로 표시한다
  graduated: x.status === 'GRADUATED' || x.status === 'LEFT',
  onLeave: x.status === 'ON_LEAVE',
  email: x.email ?? null,
  noEmail: !x.email,
  presets: (x.appliedPresets ?? []).map((p) => p.name),
  roles: [],
  roleCount: x.roleCount ?? 0,
  lastLogin: x.lastLoginAt ? ago(x.lastLoginAt) : '기록 없음',
  failCount: x.failedLoginCount ?? 0,
})

export type PresetOption = { id: string; name: string; roles: string[] }
export type AdminMembersData = { members: AdminRow[]; graduatedTotal: number; roles: Role[]; presets: PresetOption[] }

/** 관리 · 구성원: 재실 + 졸업생 전체와 역할 · 프리셋 목록. 필터 · 검색은 화면이 거른다 */
export function useAdminMembers() {
  return useResource<AdminMembersData>(
    'admin-members',
    () => ({ members: adminMembers.map((m) => ({ ...m, roleCount: m.roles.length })), graduatedTotal: 24, roles: ROLES, presets: mockPresets }),
    async () => {
      // 한 번에 최대 100명 (README 1.3). 관리 표는 전체를 놓고 거르므로 페이지를 끝까지 돌며 재실 + 졸업생을 모두 받는다
      const [{ first: res, content: rows }, roles, presets] = await Promise.all([
        fetchEveryPage((page) => api<MembersResponse>('/members', { query: { group: 'ALL', page, size: 100 } }), (r) => r.page),
        fetchRoles(),
        // 5-1 은 role-manage · member-manage 만. 권한이 없으면 프리셋 고르기 칸만 비운다
        fetchPresets(false).catch((): PresetView[] => []),
      ])
      return { members: rows.map(toAdminRow), graduatedTotal: res.counts.alumni, roles, presets }
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
      // presetApplications 는 적용 기록이라 같은 프리셋이 여러 번 나올 수 있다
      const history = d.presetApplications?.map((p) => p.preset) ?? d.appliedPresets ?? []
      const applied = history.filter((p, i) => history.findIndex((x) => x.presetId === p.presetId) === i)
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
 * 3-5 프리셋 적용 (role-manage). 역할을 프리셋의 역할로 덮어쓴다 — 프리셋에 없는 역할은 빠진다 (ERP-51).
 * 같은 프리셋을 다시 적용해도 된다 (빠진 역할 채우기). → 더한 역할 · 저장 뒤 역할 코드
 */
export const applyPreset = (memberId: number, presetId: number) =>
  api<{ addedRoleCodes?: string[]; roles: MemberRole[] }>(`/members/${memberId}/preset-applications`, {
    method: 'POST',
    body: { presetId },
  }).then((r) => ({ added: r.addedRoleCodes ?? [], roles: r.roles.map((x) => x.code) }))

/** 3-3 구성원 정보 바꾸기 (구분). 권한은 그대로 (applyDefaultPreset 을 보내지 않는다) */
export const patchMember = (memberId: number, body: { memberType?: MemberType; email?: string }) =>
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
  /** 백엔드 DepartureKind. 휴학(MILITARY_LEAVE · LEAVE_OF_ABSENCE)은 지금 화면에 없다 */
  kind: 'GRADUATED' | 'LEFT' | 'MILITARY_LEAVE' | 'LEAVE_OF_ABSENCE'
  departedOn: string
  /** 휴학일 때만 (복학 예정일, 선택) */
  expectedReturnOn?: string | null
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
      const { content: presetMembers } = await fetchEveryPage(
        (page) => api<MembersResponse>('/members', { query: { presetId: Number(preset.id), group: 'ACTIVE', page, size: 100 } }),
        (r) => r.page,
      )
      // 백엔드 2-1 목록(MemberSummaryResponse)에는 역할 코드 없이 roleCount 만 있어 구성원 상세(2-2)를 한 명씩 부른다.
      // presetId 거르기는 role-manage 만 쓸 수 있다
      const details = await Promise.all(presetMembers.map((m) => api<MemberDetailDto>(`/members/${m.memberId}`)))
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
        // 상태 탭마다 페이지를 끝까지 돌며 모두 받는다
        Promise.all(
          SIGNUP_STATUSES.map((status) =>
            fetchEveryPage((page) => api<SignupsResponse>('/signup-applications', { query: { status, page, size: 100 } }), (r) => r.page),
          ),
        ),
        fetchPresets(false),
      ])
      const counts = lists[0].first.counts
      const requests = lists.flatMap((l) => l.content.map(toSignup))
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

/** 목업 RoleRequest + 승인할 수 있는지 · 승인할 사람 · 신청한 기한 · 내 신청인지 (자기 승인 금지 A013) */
export type ReviewRequest = RoleRequest & { canReview: boolean; approverLabel: string; expiresOn: string | null; own: boolean }

const toRoleRequest = (x: AccessRequestDto, meId?: number): ReviewRequest => {
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
    own: meId !== undefined && x.requester.memberId === meId,
  }
}

export type RoleRequestsData = { requests: ReviewRequest[]; extra: Record<RoleRequest['status'], number> }
const REQUEST_STATUSES: RoleRequest['status'][] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']

export function useRoleRequests() {
  return useResource<RoleRequestsData>(
    'admin-role-requests',
    () => ({
      requests: roleRequests.map((r) => ({ ...r, canReview: true, approverLabel: '', expiresOn: null, own: false })),
      // 목업에 없는 지난 처리 건수만큼 더해 시안 숫자(승인 8 · 거절 1 · 만료 3)를 맞춘다
      extra: Object.fromEntries(
        REQUEST_STATUSES.map((t) => [t, t === 'PENDING' ? 0 : ROLE_REQUEST_TOTALS[t] - roleRequests.filter((r) => r.status === t).length]),
      ) as Record<RoleRequest['status'], number>,
    }),
    async () => {
      const [{ first: res, content: all }, me] = await Promise.all([
        fetchEveryPage(
          (page) =>
            api<{ counts: Record<AccessStatus, number>; page: PageResponse<AccessRequestDto> }>('/auth/access-requests', {
              query: { scope: 'REVIEW', page, size: 100 },
            }),
          (r) => r.page,
        ),
        api<{ memberId: number }>('/members/me'),
      ])
      // 취소한 신청은 이 화면에 탭이 없어 뺀다
      const requests = all.filter((x) => x.status !== 'CANCELLED').map((x) => toRoleRequest(x, me.memberId))
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
) => api<AccessRequestDto>(`/auth/access-requests/${requestId}/review`, { method: 'POST', body }).then((x) => toRoleRequest(x))

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
/** 목업 분류 + 백엔드에만 있는 분류 (SIGNUP · EXTERNAL) */
export type AuditCategoryView = AuditCategory | '가입' | '외부' | '회계'
export type AuditRow = Omit<AuditLog, 'category'> & { category: AuditCategoryView; loginId: string | null }
export type AuditData = { logs: AuditRow[]; totalPages: number }

const PERIOD_DAYS: Record<string, number> = { 오늘: 0, '최근 7일': 6, '최근 30일': 29, '최근 1년': 364 }
// 백엔드 AuditCategory (audit/api/event/AuditCategory.java)
const CAT_CODE: Record<AuditCategoryView, string> = {
  구성원: 'MEMBER',
  권한: 'ROLE',
  가입: 'SIGNUP',
  운영: 'OPERATION',
  프로젝트: 'PROJECT',
  콘텐츠: 'CONTENT',
  외부: 'EXTERNAL',
  회계: 'LEDGER',
  로그인: 'LOGIN',
}
/** 실서버 거르기의 분류 선택지 */
export const AUDIT_CATEGORIES = Object.keys(CAT_CODE) as AuditCategoryView[]
const CAT_LABEL = Object.fromEntries(Object.entries(CAT_CODE).map(([label, code]) => [code, label])) as Record<string, AuditCategoryView>

// 백엔드 AuditTargetType (audit/api/event/AuditTargetType.java) 중 화면에서 거르는 것
const TARGET_CODE: Record<string, string> = {
  구성원: 'MEMBER',
  역할: 'ROLE',
  프리셋: 'ROLE_PRESET',
  '가입 신청': 'SIGNUP_APPLICATION',
  '권한 신청': 'ACCESS_REQUEST',
  공통코드: 'COMMON_CODE',
  서비스: 'SSO_APP',
  프로젝트: 'PROJECT',
  작업: 'TASK',
  공지: 'NOTICE',
  자료: 'DOCUMENT',
  댓글: 'COMMENT',
  일정: 'CALENDAR_EVENT',
  회의록: 'MEETING_MINUTE',
  GitHub: 'GITHUB_ACCOUNT',
  파일: 'FILE',
  '감사 로그': 'AUDIT_LOG',
}
/** 대상 거르기 선택지 */
export const AUDIT_TARGETS = Object.keys(TARGET_CODE)

// 백엔드 AuditAction (audit/api/event/AuditAction.java)
const ACTION_LABEL: Record<string, string> = {
  MEMBER_CREATED: '구성원 생성',
  MEMBER_UPDATED: '구성원 변경',
  MEMBER_DISABLED: '비활성화',
  MEMBER_ENABLED: '다시 활성화',
  MEMBER_UNLOCKED: '잠금 해제',
  TEMPORARY_PASSWORD_ISSUED: '임시 비밀번호',
  MEMBER_DEPARTED: '졸업 · 퇴실',
  MEMBER_REINSTATED: '재실로 되돌림',
  ROLE_CHANGED: '역할 변경',
  ROLE_UPDATED: '역할 설정 변경',
  PRESET_CREATED: '프리셋 생성',
  PRESET_UPDATED: '프리셋 변경',
  PRESET_APPLIED: '프리셋 반영',
  ACCESS_REQUESTED: '권한 신청',
  ACCESS_REQUEST_APPROVED: '권한 신청 승인',
  ACCESS_REQUEST_REJECTED: '권한 신청 거절',
  ACCESS_REQUEST_CANCELLED: '권한 신청 취소',
  ACCESS_EXPIRED: '권한 기한 만료',
  SIGNUP_RECEIVED: '가입 신청',
  SIGNUP_APPROVED: '가입 승인',
  SIGNUP_REJECTED: '가입 거절',
  COMMON_CODE_CHANGED: '공통코드 변경',
  CACHE_EVICTED: '캐시 비우기',
  CLIENT_SECRET_ISSUED: 'client secret 발급',
  AUDIT_EXPORTED: '감사 로그 내려받기',
  PROJECT_CREATED: '프로젝트 생성',
  PROJECT_UPDATED: '프로젝트 변경',
  PROJECT_ARCHIVED: '프로젝트 보관',
  PROJECT_UNARCHIVED: '프로젝트 보관 해제',
  PROJECT_DELETED: '프로젝트 삭제',
  PROJECT_MEMBER_CHANGED: '참여자 변경',
  PROJECT_LINK_ADDED: '연동 추가',
  PROJECT_LINK_CHANGED: '연동 변경',
  PROJECT_LINK_REMOVED: '연동 삭제',
  PROJECT_SERVICE_LEVEL_CHANGED: '서비스 권한 변경',
  PROVISION_RESULT: '서비스 반영 결과',
  PROVISION_DRIFT: '서비스 권한 어긋남',
  VAULT_PATH_REVIEWED: 'Vault 경로 검토',
  CONTENT_UPDATED: '콘텐츠 수정',
  CONTENT_DELETED: '콘텐츠 삭제',
  CONTENT_RESTORED: '콘텐츠 복구',
  GITHUB_LINKED: 'GitHub 연결',
  GITHUB_UNLINKED: 'GitHub 해제',
  GITHUB_ORG_SYNCED: 'GitHub 조직 동기화',
  GITHUB_ORG_INVITED: 'GitHub 조직 초대',
  GITHUB_ORG_REMOVED: 'GitHub 조직에서 뺌',
  CLOUDFLARE_ACCESS_ADDED: 'Cloudflare 정책에 넣음',
  CLOUDFLARE_ACCESS_REMOVED: 'Cloudflare 정책에서 뺌',
  LEDGER_BOOK_CREATED: '장부 만듦',
  LEDGER_BOOK_UPDATED: '장부 고침',
  LEDGER_HOLDER_CHANGED: '계좌 주인 넘김',
  LEDGER_ENTRY_CREATED: '거래 적음',
  LEDGER_ENTRY_UPDATED: '거래 고침',
  LEDGER_ENTRY_DELETED: '거래 지움',
  LEDGER_REIMBURSED: '먼저 낸 돈 돌려줌',
  SSH_GRANTED: 'SSH 허용',
  SSH_REVOKED: 'SSH 허용 뺌',
  LOGIN_SUCCEEDED: '로그인',
  LOGIN_FAILED: '로그인',
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
    category: f.cat ? CAT_CODE[f.cat as AuditCategoryView] : undefined,
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

/* ---------- 관리 · 공통코드 (backoffice, 10-member 9-2) · SSO secret ---------- */
// BackofficeController: /api/v1/backoffice/common-codes/** 는 모두 code-manage.
// SsoController: /api/v1/sso/clients · /clients/{clientId}/secret 는 sso-admin.
const CODES = '/backoffice/common-codes'

type CodeGroupDto = {
  codeId: string
  description: string
  /** ref1~ref5 칸의 의미 (쓰지 않는 칸은 null) → 열 제목 */
  refDescriptions: (string | null)[] | null
  enabled: boolean
  rowAddable: boolean
}
type CodeDetailDto = {
  codeId: string
  detailCodeId: string
  description: string
  /** ref1~ref5 (비어 있으면 null) */
  refs: (string | null)[] | null
  displayOrder: number
  enabled: boolean
  updatedAt: string | null
  updatedBy: string | null
}
type SsoClientDto = { clientId: string; name: string; redirectUris: string[]; secretIssuedAt: string | null }

export type CodeGroupView = CodeGroup & { refDescriptions: (string | null)[]; rowAddable: boolean }
/** 표의 ref 열 하나. index = refs 의 자리 (0 = ref1), list = 쉼표로 나눠 칩으로 보여 줌 */
export type CodeColumn = { index: number; label: string; list: boolean }
export type CodeRowView = {
  code: string
  name: string
  /** ref1~ref5 (빈 칸은 '') */
  refs: string[]
  enabled: boolean
  displayOrder: number
  /** SSO_APP: 마지막 secret 발급 시각 (null = 아직 발급 안 함 → OIDC 로그인 안 받음, undefined = 모름) */
  secretIssuedAt?: string | null
}
export type CodeTable = {
  desc: string
  columns: CodeColumn[]
  rows: CodeRowView[]
  /** SSO_APP 에서 secret 발급 버튼을 보일지 (sso-admin 이 아니면 /sso/clients 가 403) */
  canIssueSecret: boolean
} | null

const REF_COUNT = 5
const padRefs = (refs: (string | null)[] | null | undefined) => Array.from({ length: REF_COUNT }, (_, i) => refs?.[i] ?? '')
/** 열 제목에 '쉼표' 가 있으면 여러 값 칸 (예: SSO_APP ref2 접근 허용 역할, ref4 redirect URI) */
const toColumns = (descs: (string | null)[]): CodeColumn[] =>
  descs.flatMap((d, index) => (d ? [{ index, label: `${d} (ref${index + 1})`, list: d.includes('쉼표') }] : []))
const toCodeRow = (r: CodeDetailDto): CodeRowView => ({
  code: r.detailCodeId,
  name: r.description,
  refs: padRefs(r.refs),
  enabled: r.enabled,
  displayOrder: r.displayOrder,
})
/** 여러 값 칸을 칩 목록으로 */
export const splitRef = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// 목업: mocks/adminOps 의 codeRows (ref1 · ref2(목록) · ref4) 를 ref 자리 모양으로 바꾼다
const MOCK_REF_INDEX = [0, 1, 3]
function mockCodeTable(code: string): CodeTable {
  const t = codeRows[code]
  if (!t) return null
  return {
    desc: t.desc,
    columns: MOCK_REF_INDEX.map((index, i) => ({ index, label: t.columns[i], list: index === 1 })),
    rows: t.rows.map((r, i) => ({
      code: r.code,
      name: r.name,
      refs: padRefs([r.ref1, r.ref2.join(','), null, r.ref4]),
      enabled: r.enabled,
      displayOrder: i + 1,
    })),
    canIssueSecret: true,
  }
}

export function useCodeGroups() {
  return useResource<CodeGroupView[]>(
    'code-groups',
    () => codeGroups.map((g) => ({ ...g, refDescriptions: [], rowAddable: true })),
    async () =>
      (await api<CodeGroupDto[]>(CODES)).map((g) => ({
        code: g.codeId,
        name: g.description,
        refDescriptions: g.refDescriptions ?? [],
        rowAddable: g.rowAddable,
      })),
  )
}

export function useCodeTable(group: CodeGroupView | undefined) {
  return useResource<CodeTable>(
    ['code-table', group?.code],
    () => (group ? mockCodeTable(group.code) : null),
    async () => {
      if (!group) return null
      const [rows, clients] = await Promise.all([
        api<CodeDetailDto[]>(`${CODES}/${encodeURIComponent(group.code)}/details`),
        group.code === 'SSO_APP'
          ? api<SsoClientDto[]>('/sso/clients').catch((e: unknown) => (e instanceof ApiError && e.status === 403 ? ('FORBIDDEN' as const) : null))
          : Promise.resolve(null),
      ])
      const issued = Array.isArray(clients) ? new Map(clients.map((c) => [c.clientId, c.secretIssuedAt])) : null
      return {
        desc: group.rowAddable ? '' : '정해진 코드만 쓰는 그룹이라 행을 더할 수 없어요.',
        columns: toColumns(group.refDescriptions),
        rows: rows.map((r) => ({ ...toCodeRow(r), secretIssuedAt: issued ? (issued.get(r.detailCodeId) ?? null) : undefined })),
        canIssueSecret: clients !== 'FORBIDDEN',
      }
    },
  )
}

/** 상세 코드 사용 켜기 · 끄기 (POST …/enable · …/disable) */
export const setCodeEnabled = (groupCode: string, detailCode: string, enabled: boolean) =>
  api<null>(`${CODES}/${encodeURIComponent(groupCode)}/details/${encodeURIComponent(detailCode)}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST',
  })

export type CodeDetailBody = { detailCodeId: string; description: string; refs: string[]; displayOrder: number }
/** 상세 코드 추가 (rowAddable 인 그룹만). refs 는 ref1~ref5 순서, 빈 칸은 서버가 null 로 저장 */
export const createCodeDetail = (groupCode: string, body: CodeDetailBody) =>
  api<CodeDetailDto>(`${CODES}/${encodeURIComponent(groupCode)}/details`, { method: 'POST', body }).then(toCodeRow)

export const evictCodeCache = () => api<null>(`${CODES}/cache/evict`, { method: 'POST' })

/** client secret 새로 발급 (sso-admin) → 한 번만 보이는 원문 */
export const issueClientSecret = (clientId: string) =>
  api<{ clientId: string; clientSecret: string; issuedAt: string }>(`/sso/clients/${encodeURIComponent(clientId)}/secret`, {
    method: 'POST',
  }).then((r) => ({ secret: r.clientSecret, issuedAt: r.issuedAt }))

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
      const [{ first: g, content: accounts }, d] = await Promise.all([
        fetchEveryPage((page) => api<GithubAdminDto>('/github/accounts', { query: { memberStatus: 'ALL', page, size: 100 } }), (r) => r.members),
        api<DeliveriesDto>('/github/webhook-deliveries', { query: { size: 5 } }),
      ])
      const rows = accounts
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
  { key: 'noticeComment', label: '댓글 (공지 · 보고 · 정책)', locked: false, enabled: false },
  { key: 'ledger', label: '회계 장부', locked: false, enabled: true },
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
 * 백엔드는 crop(원본 기준 정사각형 x · y · size) 을 받는다. 화면에 자르기 도구가 아직 없어 가운데 정사각형을 보낸다.
 * 프로필 사진은 최대 5MB (FILE_POLICY MAX_PROFILE_PHOTO_MB) 라 늘 SINGLE 로 온다.
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

/* ---------- 관리 · 구성원 추가 (3-1, 3-2) ---------- */

type IdStatus = { value: string; valid: boolean; available: boolean } | null
export type IdentifierCheck = { loginId: IdStatus; studentNumber: IdStatus; suggestedInternNumber: string | null }

/** 3-2 로그인 ID · 구성원 번호 확인 (둘 다 선택). 목업은 형식만 본다 */
export async function checkIdentifiers(q: { loginId?: string; studentNumber?: string }): Promise<IdentifierCheck> {
  if (!isLive()) {
    const id = q.loginId ? { value: q.loginId, valid: /^[a-z][a-z0-9._-]{3,29}$/.test(q.loginId), available: q.loginId !== 'minseo' } : null
    const no = q.studentNumber ? { value: q.studentNumber, valid: /^[A-Z0-9]{1,20}$/.test(q.studentNumber), available: true } : null
    return { loginId: id, studentNumber: no, suggestedInternNumber: 'I2026001' }
  }
  return api<IdentifierCheck>('/members/identifier-check', { query: { loginId: q.loginId || undefined, studentNumber: q.studentNumber || undefined } })
}

export type NewMember = {
  studentNumber: string
  loginId: string
  name: string
  memberType: 'PROFESSOR' | 'STUDENT' | 'INTERN'
  joinedOn: string
  email: string | null
  phone: string | null
  presetIds: number[]
  roleCodes: string[]
  /** true 면 처음 비밀번호 대신 초대 메일 (24시간 링크) — 이메일 필수, 메일 설정이 꺼져 있으면 M039 */
  sendInvitation?: boolean
}

export type CreatedMember = { memberId: number; loginId: string; temporaryPassword: string | null; invitationSent: boolean }

/** 3-1 구성원 만들기 → 처음 비밀번호 (이 응답에서만 보인다). 초대 메일로 만들면 비밀번호 없이 invitationSent */
export async function createMember(m: NewMember): Promise<CreatedMember> {
  if (!isLive()) {
    return m.sendInvitation
      ? { memberId: 0, loginId: m.loginId, temporaryPassword: null, invitationSent: true }
      : { memberId: 0, loginId: m.loginId, temporaryPassword: 'Mock-Temp-2026!', invitationSent: false }
  }
  const r = await api<{ memberId: number; loginId: string; temporaryPassword: string | null; invitationSent?: boolean }>('/members', {
    method: 'POST',
    body: m,
  })
  return { ...r, invitationSent: Boolean(r.invitationSent) }
}

/* ---------- 초대 메일 (3-9 ~ 3-11) ---------- */

export type InvitationPolicy = { mailEnabled: boolean; ttlHours: number }
export type InvitationStatus = 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'EXPIRED' | 'COMPLETED'
export type InvitationView = {
  status: InvitationStatus
  email: string | null
  requestedAt: string | null
  sentAt: string | null
  expiresAt: string | null
  usedAt: string | null
  failureReason: string | null
}

/** 3-9 초대 메일을 보낼 수 있는지 (목업은 켜져 있는 것으로) */
export function useInvitationPolicy() {
  return useResource<InvitationPolicy>(
    'invitation-policy',
    () => ({ mailEnabled: true, ttlHours: 24 }),
    () => api<InvitationPolicy>('/members/invitation-policy'),
  )
}

const MOCK_INVITATION: InvitationView = {
  status: 'NONE', email: null, requestedAt: null, sentAt: null, expiresAt: null, usedAt: null, failureReason: null,
}

/** 3-10 구성원의 가장 최근 초대 */
export async function fetchInvitation(memberId: number): Promise<InvitationView> {
  if (!isLive()) return MOCK_INVITATION
  return api<InvitationView>(`/members/${memberId}/invitation`)
}

/** 3-11 초대 메일 다시 보내기 (새 링크, 옛 링크는 끝남) → PENDING */
export async function resendInvitation(memberId: number): Promise<InvitationView> {
  if (!isLive()) return { ...MOCK_INVITATION, status: 'SENT', sentAt: new Date().toISOString() }
  return api<InvitationView>(`/members/${memberId}/invitation`, { method: 'POST' })
}

/** 구성원 목록이 다시 불러오게 알린다 (구성원 추가 모달 → 관리 · 구성원) */
const MEMBERS_CHANGED = 'iturtle:members-changed'
export const notifyMembersChanged = () => window.dispatchEvent(new Event(MEMBERS_CHANGED))
export function onMembersChanged(reload: () => void) {
  window.addEventListener(MEMBERS_CHANGED, reload)
  return () => window.removeEventListener(MEMBERS_CHANGED, reload)
}

/** 구성원 추가에 쓰는 프리셋 (켜진 것만, 구분별 기본 프리셋 포함) */
export function useAddMemberPresets() {
  return useResource<PresetView[]>('add-member-presets', () => mockPresetViews().filter((p) => p.active), () => fetchPresets(false))
}

/* ---------- 관리 · 같이 가질 수 없는 역할 (3-12, MEM-5-12) ---------- */

export type RoleConflictRule = { ruleCode: string; roleA: string; roleB: string; reason: string }
export type RoleConflicts = { rules: RoleConflictRule[]; members: { memberId: number; name: string; conflicts: RoleConflictRule[] }[] }

/** 목업 규칙 = 운영 기본값 (공통코드 ROLE_CONFLICT) */
const MOCK_CONFLICT_RULES: RoleConflictRule[] = [
  {
    ruleCode: 'REPORT_WRITE_REVIEW',
    roleA: 'report-write',
    roleB: 'report-review',
    reason: '주간 보고를 쓰는 사람(제출 대상)이 확인하는 사람이 되면 제출 현황 · 확인 흐름이 꼬인다',
  },
]

/** 규칙과 이미 두 역할을 모두 가진 구성원 (자동으로 빼지 않는다 — 경고용) */
export function useRoleConflicts() {
  return useResource<RoleConflicts>(
    'admin-role-conflicts',
    () => ({ rules: MOCK_CONFLICT_RULES, members: [] }),
    async () => {
      const res = await api<{
        rules: RoleConflictRule[]
        members: { member: MemberRef; loginId: string; conflicts: RoleConflictRule[] }[]
      }>('/members/role-conflicts')
      return {
        rules: res.rules,
        members: res.members.map((m) => ({ memberId: m.member.memberId, name: m.member.name, conflicts: m.conflicts })),
      }
    },
  )
}

/** 이 역할 목록이 어기는 규칙 */
export const violatedRules = (roles: string[], rules: RoleConflictRule[]) =>
  rules.filter((rule) => roles.includes(rule.roleA) && roles.includes(rule.roleB))
