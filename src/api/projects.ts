// 프로젝트 · 작업 API — docs/api/30-project.md, 31-task.md, 60-common.md(댓글), 20-communication.md(CL-1)
// 백엔드 기준: win.iturtle.project.internal.controller.* (ProjectController, TaskController, MilestoneController,
// ProjectLinkController, ServiceAccessController, VaultPathRequestController) 와 dto/request · dto/response.
// 응답을 화면이 쓰는 mocks/projects.ts · projectDetail.ts · tasks.ts 의 모양으로 바꾼다.
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'
import { getApiBase } from '../lib/dataMode'
import {
  findProject,
  PROJECT_CATEGORY_NAME,
  PROJECT_STATUS_NAME,
  projects as mockProjects,
  type ProjectCategory,
  type ProjectStatus,
  type ProjectSummary,
  type ServiceCode,
} from '../mocks/projects'
import { projectDetail, type ProjectMember } from '../mocks/projectDetail'
import {
  findTask,
  PRIORITY_NAME,
  STATUS_NAME,
  taskDetailExtra,
  tasks as mockTasks,
  TYPE_NAME,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '../mocks/tasks'

/** 목업의 "나" (목업 화면들이 같은 이름을 쓴다) */
const MOCK_ME = '김민서'

// ───────────────────────── 공통 변환 ─────────────────────────

/** '2026-11-17' → '11/17' */
export const monthDay = (d: string | null | undefined) => {
  if (!d) return ''
  const [, m, day] = d.slice(0, 10).split('-')
  return `${Number(m)}/${Number(day)}`
}

/** 오늘 날짜 (KST) 'YYYY-MM-DD' */
export const todayKst = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

/** ISO 시각 → KST 'M/D HH:mm' */
const kstDateTime = (iso: string) => {
  const s = new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }) // 'YYYY-MM-DD HH:mm:ss'
  return `${monthDay(s.slice(0, 10))} ${s.slice(11, 16)}`
}

const daysUntil = (d: string) => Math.round((Date.parse(d.slice(0, 10)) - Date.parse(todayKst())) / 86400000)

/**
 * 서버 상태 → 프로젝트 머리(ProjectLayout)의 화면 상태.
 * 머리는 mocks 의 ProjectSummary 타입(ON_HOLD 없음)을 그대로 써서 ON_HOLD(보류) 를 '준비'로 보여 준다.
 * 목록 카드 · 홈은 ProjectCard 로 '보류' 를 그대로 보여 준다.
 */
const toProjectStatus = (s: string): ProjectStatus => (s === 'ON_HOLD' ? 'PREPARING' : (s as ProjectStatus))

/** 서버 ProjectStatus 전부 (PREPARING · ACTIVE · ON_HOLD · DONE · ARCHIVED) */
export type ProjectStatusLive = ProjectStatus | 'ON_HOLD'
export const PROJECT_STATUS_LABEL: Record<ProjectStatusLive, string> = { ...PROJECT_STATUS_NAME, ON_HOLD: '보류' }

/**
 * 공통코드 PROJECT_CATEGORY 기본값 (backoffice V20261118_09 · project V20261118_15 마이그레이션).
 * 공통코드 목록 API(/backoffice/common-codes)는 code-manage 권한만 부를 수 있어,
 * 서버가 준 categoryName 을 기억해 두고 처음 보는 코드는 이 표 → 코드 순으로 보여 준다.
 */
const PROJECT_CATEGORY_SEED: Record<string, string> = { ...PROJECT_CATEGORY_NAME, CLASS: '수업', LAB: '연구실 운영' }
const seenCategoryNames = new Map<string, string>()
export const projectCategoryName = (code: string) => seenCategoryNames.get(code) ?? PROJECT_CATEGORY_SEED[code] ?? code

/** 목록 카드 · 홈 머리용: 화면 타입에 없는 상태(ON_HOLD) · 카테고리(CLASS · LAB · 새 공통코드)도 담는다 */
export type ProjectCard = Omit<ProjectSummary, 'status' | 'categoryCode'> & {
  status: ProjectStatusLive
  categoryCode: string
  categoryName?: string
}

const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

// ───────────────────────── P-1 프로젝트 목록 ─────────────────────────

/** ProjectSummaryResponse */
type ProjectSummaryDto = {
  projectKey: string
  name: string
  status: ProjectStatusLive
  visibility: 'LAB' | 'PRIVATE'
  categoryCode: string
  categoryName: string | null
  summary: string | null
  startsOn: string | null
  endsOn: string | null
  myRole: 'MANAGER' | 'MEMBER' | 'NONE'
  memberCount: number
  memberPreview: MemberRef[]
  nextMilestone: { milestoneId: number; name: string; dueOn: string | null; progress: { done: number; total: number; ratio: number } } | null
}
/** ProjectListResponse — categoryCounts 는 ALL + 프로젝트가 있는 카테고리만 (공통코드 표시 순서) */
type ProjectListResponse = { categoryCounts: Record<string, number>; page: PageResponse<ProjectSummaryDto> }

const rememberCategory = (code: string, name: string | null | undefined) => {
  if (name) seenCategoryNames.set(code, name)
}

const toCard = (x: ProjectSummaryDto): ProjectCard => {
  rememberCategory(x.categoryCode, x.categoryName)
  return {
    projectKey: x.projectKey,
    name: x.name,
    status: x.status,
    visibility: x.visibility,
    categoryCode: x.categoryCode,
    categoryName: x.categoryName ?? projectCategoryName(x.categoryCode),
    summary: x.summary ?? '',
    startsOn: x.startsOn ?? '',
    endsOn: x.endsOn ?? '',
    myRole: x.myRole,
    memberPreview: x.memberPreview.map((m) => m.name),
    // 백엔드 ProjectSummaryResponse 에 연동 서비스 목록이 없어 카드의 서비스 아이콘은 실서버에서 비어 있다
    services: [],
    nextMilestone: x.nextMilestone
      ? { name: x.nextMilestone.name, dueOn: monthDay(x.nextMilestone.dueOn), ratio: x.nextMilestone.progress.ratio }
      : null,
  }
}

export type ProjectListFilter = { category: string; mine: boolean; activeOnly: boolean; archived: boolean }
export type ProjectList = { projects: ProjectCard[]; counts: Record<string, number>; categories: { code: string; name: string }[] }

/** 탭: 기본 카테고리 + 서버 개수에 나온 카테고리 (서버 순서를 앞에) */
const categoryTabs = (counts: Record<string, number>) =>
  [...new Set([...Object.keys(counts).filter((c) => c !== 'ALL'), ...Object.keys(PROJECT_CATEGORY_NAME)])].map((code) => ({
    code,
    name: projectCategoryName(code),
  }))

/**
 * 프로젝트 목록 화면 (P-1 GET /projects). 실서버는 조건을 서버에 넘기고, 목업은 지금처럼 화면이 거른다.
 * 화면은 늘 같은 거르기를 한 번 더 하므로 (서버가 이미 거른 값이면 그대로) 결과가 같다.
 */
export function useProjectList(f: ProjectListFilter) {
  return useResource<ProjectList>(
    // 목업은 보관 포함만 개수에 영향을 준다
    ['projects', f],
    () => {
      const base = mockProjects.filter((p) => f.archived || p.status !== 'ARCHIVED')
      const counts: Record<string, number> = { ALL: base.length }
      for (const p of base) counts[p.categoryCode] = (counts[p.categoryCode] ?? 0) + 1
      return { projects: base, counts, categories: categoryTabs(counts) }
    },
    async () => {
      const r = await api<ProjectListResponse>('/projects', {
        query: {
          categoryCode: f.category === 'ALL' ? undefined : f.category,
          mine: f.mine || undefined,
          // 쉼표로 여러 상태 (ProjectService.parseStatuses)
          status: f.activeOnly ? 'PREPARING,ACTIVE' : undefined,
          includeArchived: f.archived || undefined,
          size: 100,
        },
      })
      const projects = r.page.content.map(toCard)
      return { projects, counts: r.categoryCounts, categories: categoryTabs(r.categoryCounts) }
    },
  )
}

// ───────────────────────── P-3 프로젝트 상세 ─────────────────────────

type ProjectMemberRefDto = { member: MemberRef; role: 'MANAGER' | 'MEMBER' | 'FORMER'; joinedAt: string; leftAt: string | null }
/** ProjectDetailResponse */
type ProjectDetailDto = {
  projectId: number
  projectKey: string
  name: string
  status: ProjectStatusLive
  visibility: 'LAB' | 'PRIVATE'
  categoryCode: string
  categoryName: string | null
  description: string | null
  startsOn: string | null
  endsOn: string | null
  taskCounts: { total: number; done: number; cancelled: number }
  members: ProjectMemberRefDto[]
  myRole: 'MANAGER' | 'MEMBER' | 'FORMER' | 'NONE'
  permissions: { canManage: boolean; canWriteTasks: boolean; canComment: boolean; canArchive: boolean; canDelete: boolean }
}

const getProject = (key: string) => api<ProjectDetailDto>(`/projects/${encodeURIComponent(key)}`)

/** 이전 참여자를 뺀 참여자 (PM 먼저 — 서버 순서 그대로) */
const toMembers = (d: ProjectDetailDto): (ProjectMember & { memberId: number })[] =>
  d.members
    .filter((m) => m.role !== 'FORMER')
    .map((m) => ({
      memberId: m.member.memberId,
      name: m.member.name,
      role: m.role as 'MANAGER' | 'MEMBER',
      note: m.member.memberType === 'INTERN' ? '인턴' : undefined,
    }))

const detailToCard = (d: ProjectDetailDto): ProjectCard => {
  rememberCategory(d.categoryCode, d.categoryName)
  return {
    projectKey: d.projectKey,
    name: d.name,
    status: d.status,
    visibility: d.visibility,
    categoryCode: d.categoryCode,
    categoryName: d.categoryName ?? projectCategoryName(d.categoryCode),
    summary: '',
    startsOn: d.startsOn ?? '',
    endsOn: d.endsOn ?? '',
    myRole: d.myRole === 'FORMER' ? 'NONE' : d.myRole,
    memberPreview: toMembers(d).map((m) => m.name),
    services: [],
    nextMilestone: null,
  }
}

/**
 * 프로젝트 머리 (ProjectLayout 이 실서버에서 쓰는 훅, P-3).
 * 목업은 findProject 그대로. 머리는 화면 타입(ProjectSummary)이라 ON_HOLD 는 '준비', 새 카테고리 코드는 코드 그대로 들어간다.
 */
export function useProjectHeader(key: string | undefined) {
  return useResource<ProjectSummary>(['project', key], () => findProject(key), async () => {
    const c = detailToCard(await getProject(key ?? ''))
    return { ...c, status: toProjectStatus(c.status), categoryCode: c.categoryCode as ProjectCategory }
  })
}

// ───────────────────────── P-9 활동 기록 ─────────────────────────

/** 백엔드 ActivityType enum 전부 */
type ActivityType =
  | 'TASK_CREATED'
  | 'TASK_DELETED'
  | 'TASK_FIELD_CHANGED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_COMMENTED'
  | 'TASK_ATTACHMENT'
  | 'TASK_CHECKLIST_CHANGED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_CHANGED'
  | 'THREAD_POSTED'
  | 'THREAD_PINNED'
  | 'THREAD_EDITED'
  | 'MINUTE_CREATED'
  | 'MINUTE_ACTIONS_CONVERTED'
  | 'SETTINGS_CHANGED'

/** ActivityResponse. ref.type 은 PROJECT_THREAD · MEETING_MINUTE · MEMBER */
type ActivityDto = {
  activityId: number
  type: ActivityType
  actor: MemberRef | null
  task: { taskId: number; taskKey: string; title: string; status: string } | null
  field: string | null
  before: string | null
  after: string | null
  ref: { type: string; id: number; title: string | null } | null
  createdAt: string
}

const statusName = (s: string | null) => (s && s in STATUS_NAME ? STATUS_NAME[s as TaskStatus] : s === 'CANCELLED' ? '취소' : (s ?? ''))
const ROLE_NAME: Record<string, string> = { MANAGER: '관리자', MEMBER: '참여자', FORMER: '이전 참여자' }
const LEVEL_NAME: Record<string, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기', BUILD: '빌드' }

/** TASK_FIELD_CHANGED 의 field (TaskService.update · ProjectActivityService.recordReassigned) */
const TASK_FIELD_NAME: Record<string, string> = {
  title: '제목',
  description: '설명',
  type: '유형',
  priority: '우선순위',
  assignee: '담당자',
  requester: '요청자',
  due_on: '기한',
  milestone: '마일스톤',
  labels: '라벨',
}
/** SETTINGS_CHANGED 의 field (ProjectService · ProjectLabelFacade · ProjectLinkFacade · MilestoneService · ServiceAccessService) */
const SETTING_FIELD_NAME: Record<string, string> = {
  name: '이름',
  category: '카테고리',
  description: '설명',
  visibility: '공개 범위',
  period: '기간',
  status: '상태',
  label: '라벨',
  link: '연동 서비스',
  link_name: '연동 서비스 이름',
  milestone: '마일스톤',
  milestone_status: '마일스톤 상태',
  milestone_due: '마일스톤 기한',
  vault_enabled: 'Vault 사용',
  vault_manager_level: 'Vault 관리자 권한',
  vault_member_level: 'Vault 참여자 권한',
  jenkins_enabled: 'Jenkins 사용',
  jenkins_manager_level: 'Jenkins 관리자 권한',
  jenkins_member_level: 'Jenkins 참여자 권한',
}

/**
 * 바뀐 값 표시. 서버는 빈 값을 null 또는 문자열 "null" 로 남긴다 (String.valueOf).
 * 설명 · 라벨 · 작업의 마일스톤은 값 대신 ID 나 빈 값이 남아 값을 보여 주지 않는다 (undefined).
 */
function changedValue(field: string, v: string | null): string | undefined {
  if (field === 'description' || field === 'labels' || (field === 'milestone' && v !== null && /^\d+$/.test(v))) return undefined
  if (v === null || v === 'null' || v === '') return '없음'
  if (field === 'priority') return PRIORITY_NAME[v as TaskPriority] ?? v
  if (field === 'type') return TYPE_NAME[v as TaskType] ?? v
  if (field === 'due_on' || field === 'milestone_due') return monthDay(v)
  if (field === 'status' || field === 'milestone_status') return PROJECT_STATUS_LABEL[v as ProjectStatusLive] ?? (v === 'OPEN' ? '열림' : v === 'CLOSED' ? '닫힘' : v)
  if (field === 'visibility') return v === 'PRIVATE' ? '비공개' : v === 'LAB' ? '연구실 공개' : v
  if (field === 'category') return projectCategoryName(v)
  if (field.endsWith('_level')) return LEVEL_NAME[v] ?? v
  if (field.endsWith('_enabled')) return v === 'true' ? '켬' : '끔'
  return v
}

function changeText(names: Record<string, string>, a: ActivityDto) {
  const field = a.field ?? ''
  const name = names[field] ?? (field || '항목')
  const before = changedValue(field, a.before)
  const after = changedValue(field, a.after)
  return `${name}을 바꿨어요${before !== undefined && after !== undefined ? ` (${before} → ${after})` : ''}`
}

/** 활동 문장 ("님이" 뒤에 붙는 부분). 화면이 type · field · 값으로 만든다 (P-9) */
function activityText(a: ActivityDto, inTask: boolean) {
  const k = a.task?.taskKey ?? ''
  const subject = inTask ? '' : `${k} 의 `
  const refTitle = a.ref?.title ?? ''
  switch (a.type) {
    case 'TASK_STATUS_CHANGED':
      return inTask ? `상태를 ${statusName(a.before)} → ${statusName(a.after)}로 바꿨어요` : `${k} 를 ${statusName(a.after)}로 옮겼어요`
    case 'TASK_CREATED':
      return inTask ? '작업을 만들었어요' : `${k} 를 만들었어요`
    case 'TASK_DELETED':
      // after 에 지운 작업 키가 남는다
      return `${a.after ?? k} 를 지웠어요`
    case 'TASK_COMMENTED':
      return inTask ? '댓글을 남겼어요' : `${k} 에 댓글을 남겼어요`
    case 'TASK_FIELD_CHANGED':
      return `${subject}${changeText(TASK_FIELD_NAME, a)}`
    case 'TASK_ATTACHMENT':
      return `${subject}첨부를 바꿨어요${a.after ? ` (${a.after}개)` : ''}`
    case 'TASK_CHECKLIST_CHANGED':
      return `${subject}체크리스트를 바꿨어요`
    case 'MINUTE_CREATED':
      return `회의록 "${refTitle}" 을 썼어요`
    case 'MINUTE_ACTIONS_CONVERTED':
      return `회의록 "${refTitle}"에서 작업 ${a.after ?? ''}개를 만들었어요`
    case 'THREAD_POSTED':
      return refTitle ? `스레드에 "${refTitle}" 를 올렸어요` : '스레드에 글을 올렸어요'
    case 'THREAD_PINNED':
      return `스레드 글 "${refTitle}" 를 고정했어요`
    case 'THREAD_EDITED':
      return `스레드 글 "${refTitle}" 를 고쳤어요`
    case 'MEMBER_ADDED':
      // ref = 그 구성원, after = 역할
      return `${refTitle || '구성원'} 님을 ${ROLE_NAME[a.after ?? ''] ?? '참여자'}로 더했어요`
    case 'MEMBER_ROLE_CHANGED':
      return `${refTitle || '구성원'} 님의 역할을 ${ROLE_NAME[a.before ?? ''] ?? a.before ?? ''} → ${ROLE_NAME[a.after ?? ''] ?? a.after ?? ''}로 바꿨어요`
    case 'MEMBER_REMOVED':
      return `${refTitle || '구성원'} 님을 참여자에서 뺐어요`
    case 'SETTINGS_CHANGED':
      return `프로젝트 ${changeText(SETTING_FIELD_NAME, a)}`
    default:
      return k ? `${k} 를 고쳤어요` : '프로젝트를 고쳤어요'
  }
}

type ActivityLine = { who: string; text: string; ago: string }
const toActivity = (a: ActivityDto, inTask: boolean): ActivityLine => ({
  // actor 가 없으면 시스템 처리 (졸업 · 퇴실 정리 등)
  who: a.actor?.name ?? '시스템',
  text: activityText(a, inTask),
  ago: ago(a.createdAt),
})

// ───────────────────────── 프로젝트 홈 ─────────────────────────

/** MilestoneResponse */
type MilestoneDto = {
  milestoneId: number
  name: string
  dueOn: string | null
  status: 'OPEN' | 'CLOSED'
  overdue: boolean
  progress: { done: number; total: number; ratio: number }
}
/** ProjectLinkResponse (LinkedService: PENPOT · VAULT · JENKINS · GITHUB · OTHER) */
type LinkDto = {
  linkId: number
  service: ServiceCode | 'OTHER'
  url: string
  displayName: string
  description: string | null
  externalRef: string | null
  myAccess: { granted: boolean; level: string | null }
}
/** LinkStatusResponse — 젠킨스 빌드 값은 모두 비어 있을 수 있다 (진행 중 빌드는 result 가 없음) */
type LinkStatusDto = {
  linkId: number
  status: 'OK' | 'UNAVAILABLE' | 'NOT_SUPPORTED'
  jenkins: {
    lastBuild: { number: number | null; result: string | null; startedAt: string | null; durationMs: number | null; url: string | null } | null
    branch: string | null
  } | null
  penpot: { fileCount: number; files: { name: string; modifiedAt: string | null }[] } | null
  github: { weekCommitCount: number; openPullRequestCount: number | null } | null
}
type Level = { override: string | null; effective: string; source?: string | null; expiresAt?: string | null }
/** ServiceAccessResponse (P-16 · P-17 · P-18 모두 이 모양) */
type ServiceAccessDto = {
  services: {
    service: 'VAULT' | 'JENKINS'
    enabled: boolean
    managerLevel: string
    memberLevel: string
    resources: { resourceId: number; ref: string; origin: 'DEFAULT' | 'APPROVED' | 'LINKED'; linkId: number | null }[]
    pendingVaultPathRequests?: { requestId: number; vaultPath: string; requestedAt: string }[]
    provisionStatus: 'PENDING' | 'DONE' | 'FAILED'
    provisionError?: string | null
  }[]
  members: { member: MemberRef; projectRole: 'MANAGER' | 'MEMBER'; vault: Level; jenkins: Level }[]
  notice: string
}
/** TaskCardResponse. taskKey 는 '{projectKey}-{번호}' */
type TaskCardDto = {
  taskId: number
  taskKey: string
  projectKey: string
  title: string
  typeCode: string
  typeName: string | null
  typeIcon: string | null
  status: TaskStatus | 'CANCELLED'
  priority: TaskPriority
  assignee: MemberRef | null
  requester: MemberRef
  dueOn: string | null
  overdue: boolean
  labels: { labelId: number; name: string; color: string }[]
  milestone: { milestoneId: number; name: string } | null
  checklist: { done: number; total: number }
  commentCount: number
  boardRank: string
  completedAt: string | null
  updatedAt: string
  version: number
}
type TaskListResponse = { page: PageResponse<TaskCardDto>; deletedTaskKeys: string[] | null; serverTime: string }
/** calendar OccurrenceResponse — 바쁨만 보이는 일정은 title 이 빠진다 */
type OccurrenceDto = { eventId: number; title?: string; busyOnly: boolean; allDay: boolean; startsAt: string; startsOn?: string; color: string | null }

const SERVICE_NAME: Record<ServiceCode, string> = { GITHUB: 'GitHub', JENKINS: 'Jenkins', VAULT: 'Vault', PENPOT: 'Penpot' }
const BUILD_RESULT: Record<string, string> = { SUCCESS: '성공', FAILURE: '실패', UNSTABLE: '불안정', ABORTED: '중단', IN_PROGRESS: '진행 중' }

export type HomeService = {
  code: ServiceCode
  name: string
  target: string
  status: { ok: boolean | null; text: string }
  myPerm: string | null
  url?: string
}
export type ProjectHome = {
  project: ProjectCard
  description: string
  period: string
  taskTotal: number
  taskDone: number
  members: ProjectMember[]
  milestones: { id: number; name: string; done: number; total: number; due: string; closed: boolean; soon: boolean }[]
  activity: ActivityLine[]
  services: HomeService[]
  permissions: { who: string; vault: string; jenkins: string }[]
  upcoming: { title: string; when: string; color: string }[]
}

function linkToService(l: LinkDto & { service: ServiceCode }, st: LinkStatusDto | undefined): HomeService {
  let status: HomeService['status'] = { ok: null, text: '' }
  if (st?.status === 'UNAVAILABLE') status = { ok: false, text: '상태를 가져오지 못했어요' }
  else if (l.service === 'VAULT') status = { ok: null, text: l.description ?? '비밀값은 Vault 에서만 보여요' }
  else if (st?.jenkins?.lastBuild) {
    const b = st.jenkins.lastBuild
    const sec = b.durationMs === null ? null : Math.round(b.durationMs / 1000)
    const result = b.result ?? 'IN_PROGRESS'
    status = {
      ok: b.result === null ? null : b.result === 'SUCCESS',
      text: [
        `${b.number !== null ? `#${b.number} ` : ''}${BUILD_RESULT[result] ?? result}`,
        b.startedAt ? ago(b.startedAt) : null,
        sec !== null && b.result !== null ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  } else if (st?.penpot) {
    const f = st.penpot.files[0]
    status = { ok: null, text: f ? `${f.modifiedAt ? `${ago(f.modifiedAt)} 수정 · ` : ''}${f.name}` : `파일 ${st.penpot.fileCount}개` }
  } else if (st?.github) {
    // 열린 PR 수는 GitHub 앱이 없으면 비어 온다
    const pr = st.github.openPullRequestCount
    status = { ok: null, text: `이번 주 커밋 ${st.github.weekCommitCount}${pr !== null ? ` · 열린 PR ${pr}` : ''}` }
  }
  const leveled = l.service === 'VAULT' || l.service === 'JENKINS'
  return {
    code: l.service,
    name: SERVICE_NAME[l.service],
    target: l.service === 'PENPOT' && st?.penpot ? `${l.displayName} · 파일 ${st.penpot.fileCount}개` : (l.externalRef ?? l.displayName),
    status,
    myPerm: !leveled ? null : l.myAccess.granted ? `내 권한 · ${LEVEL_NAME[l.myAccess.level ?? ''] ?? l.myAccess.level ?? '있음'}` : '내 권한 · 없음',
    url: l.url,
  }
}

function accessSummary(sa: ServiceAccessDto): ProjectHome['permissions'] {
  const vault = sa.services.find((x) => x.service === 'VAULT')
  const jenkins = sa.services.find((x) => x.service === 'JENKINS')
  const lv = (svc: typeof vault, level: string | undefined, label: string) =>
    `${label} ${svc?.enabled && level ? LEVEL_NAME[level] : '없음'}`
  const rows = [
    { who: '프로젝트 관리자 (기본)', vault: lv(vault, vault?.managerLevel, 'Vault'), jenkins: lv(jenkins, jenkins?.managerLevel, 'Jenkins') },
    { who: '참여자 (기본)', vault: lv(vault, vault?.memberLevel, 'Vault'), jenkins: lv(jenkins, jenkins?.memberLevel, 'Jenkins') },
  ]
  for (const m of sa.members) {
    if (m.vault.override === null && m.jenkins.override === null) continue
    rows.push({ who: `${m.member.name} (개별)`, vault: lv(vault, m.vault.effective, 'Vault'), jenkins: lv(jenkins, m.jenkins.effective, 'Jenkins') })
  }
  return rows
}

/** 프로젝트 홈: P-3, P-28, P-9, P-11 + P-15, P-16, 다가오는 일정(P-10 · T-1 · CL-1) */
export function useProjectHome(key: string | undefined) {
  return useResource<ProjectHome>(
    ['project-home', key],
    () => ({ ...projectDetail, project: findProject(key), services: [...projectDetail.services], upcoming: [...projectDetail.upcoming] }),
    async () => {
      const k = encodeURIComponent(key ?? '')
      const from = todayKst()
      const to = todayKst(30)
      const [d, ms, acts, links, statuses, access, dueMs, dueTasks] = await Promise.all([
        getProject(key ?? ''),
        api<{ milestones: MilestoneDto[] }>(`/projects/${k}/milestones`),
        api<PageResponse<ActivityDto>>(`/projects/${k}/activities`, { query: { size: 5 } }),
        api<{ links: LinkDto[] }>(`/projects/${k}/links`),
        // 상태는 늘 200 이지만, 혹시 실패해도 카드 틀은 그린다
        api<{ statuses: LinkStatusDto[] }>(`/projects/${k}/links/status`).catch(() => ({ statuses: [] as LinkStatusDto[] })),
        api<ServiceAccessDto>(`/projects/${k}/service-access`),
        api<{ items: { milestoneId: number; name: string; dueOn: string; overdue: boolean }[] }>('/milestones', {
          query: { projectKey: key, dueFrom: from, dueTo: to },
        }).catch(() => ({ items: [] })),
        api<TaskListResponse>('/tasks', {
          query: { projectKey: key, dueFrom: from, dueTo: to, statuses: 'TODO,IN_PROGRESS,REVIEW', sort: 'dueOn', size: 20 },
        }).catch(() => null),
      ])
      // 프로젝트 숫자 ID 가 있어야 공용 일정을 거를 수 있다
      const events = await api<{ occurrences: OccurrenceDto[] }>('/calendar-events', {
        query: { from, to, layers: 'SHARED', projectId: d.projectId },
      }).catch(() => ({ occurrences: [] as OccurrenceDto[] }))

      const upcoming = [
        ...(dueTasks?.page.content ?? []).map((t) => ({ at: t.dueOn ?? '', title: `${t.taskKey} ${t.title}`, when: monthDay(t.dueOn), color: 'var(--status-warning-text)' })),
        ...events.occurrences.map((e) => ({
          at: e.startsOn ?? e.startsAt,
          title: e.title ?? '일정',
          when: e.allDay ? monthDay(e.startsOn ?? e.startsAt) : kstDateTime(e.startsAt),
          color: 'var(--brand-400)',
        })),
        ...dueMs.items.map((m) => ({ at: m.dueOn, title: `마일스톤 ${m.name}`, when: monthDay(m.dueOn), color: 'var(--status-negative)' })),
      ]
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, 6)
        .map(({ title, when, color }) => ({ title, when, color }))

      const stById = new Map(statuses.statuses.map((x) => [x.linkId, x]))
      return {
        project: detailToCard(d),
        description: d.description ?? '',
        period: d.startsOn || d.endsOn ? `${(d.startsOn ?? '').replace(/-/g, '.')} – ${(d.endsOn ?? '').replace(/-/g, '.')}` : '기간 없음',
        taskTotal: d.taskCounts.total,
        taskDone: d.taskCounts.done,
        members: toMembers(d),
        milestones: ms.milestones.slice(0, 3).map((m) => ({
          id: m.milestoneId,
          name: m.name,
          done: m.progress.done,
          total: m.progress.total,
          due: m.dueOn ? monthDay(m.dueOn) : '기한 없음',
          closed: m.status === 'CLOSED',
          soon: m.status === 'OPEN' && (m.overdue || (!!m.dueOn && daysUntil(m.dueOn) <= 14)),
        })),
        activity: acts.content.map((a) => toActivity(a, false)),
        services: links.links
          .filter((l): l is LinkDto & { service: ServiceCode } => l.service !== 'OTHER')
          .map((l) => linkToService(l, stById.get(l.linkId))),
        permissions: accessSummary(access),
        upcoming,
      }
    },
  )
}

// ───────────────────────── 작업 (T-1, T-3) ─────────────────────────

const TASK_TYPES: TaskType[] = ['TASK', 'BUG', 'RESEARCH']

/**
 * 화면 작업 + 서버 값. typeName 은 공통코드 TASK_TYPE 의 이름 (관리자가 새 종류를 더하면 화면 TaskType 밖일 수 있다).
 * CANCELLED 는 화면 TaskStatus 에 없다. 보드(T-1, statuses 생략 = TODO · IN_PROGRESS · REVIEW · DONE)에는 안 나오고 작업 상세에서만 나온다.
 */
export type BoardTask = Task & { taskId?: number; version?: number; typeName?: string; cancelled?: boolean }

function toTask(x: TaskCardDto): BoardTask {
  const left = x.dueOn ? daysUntil(x.dueOn) : null
  const done = x.status === 'DONE' || x.status === 'CANCELLED'
  return {
    taskId: x.taskId,
    version: x.version,
    taskKey: x.taskKey,
    title: x.title,
    // 화면 거르기는 세 가지(작업 · 버그 · 조사)로만 한다. 그 밖의 공통코드는 '작업' 칸에 넣고 이름은 typeName 으로 보여 준다
    type: TASK_TYPES.includes(x.typeCode as TaskType) ? (x.typeCode as TaskType) : 'TASK',
    typeName: x.typeName ?? TYPE_NAME[x.typeCode as TaskType] ?? x.typeCode,
    // 취소된 작업은 화면 상태가 없어 '할 일' 자리에 두고 cancelled 로 표시한다 (상세의 상태 칩은 '취소')
    status: x.status === 'CANCELLED' ? 'TODO' : x.status,
    cancelled: x.status === 'CANCELLED' || undefined,
    priority: x.priority,
    labels: x.labels.map((l) => l.name),
    milestone: x.milestone?.name ?? null,
    dueOn: x.dueOn ? monthDay(x.dueOn) : null,
    dueState: x.overdue ? 'overdue' : !done && left !== null && left <= 2 ? 'soon' : undefined,
    checklist: x.checklist.total > 0 ? x.checklist : null,
    commentCount: x.commentCount,
    assignee: x.assignee?.name ?? null,
    requester: x.requester.name,
  }
}

export type BoardData = { tasks: BoardTask[]; memberNames: string[]; me: string; isManager: boolean; projectKey: string }

/** 칸반 보드: T-1 (보드 순서 · 완료는 14일) + P-3 (참여자 · 내 권한) */
export function useBoard(key: string | undefined) {
  return useResource<BoardData>(
    ['board', key],
    () => ({
      tasks: mockTasks,
      memberNames: projectDetail.members.map((m) => m.name),
      me: MOCK_ME,
      isManager: projectDetail.members.some((m) => m.name === MOCK_ME && m.role === 'MANAGER'),
      projectKey: findProject(key).projectKey,
    }),
    async () => {
      const [d, me, cards] = await Promise.all([getProject(key ?? ''), api<MemberRef>('/members/me'), fetchBoardTasks(key ?? '')])
      return {
        tasks: cards.map(toTask),
        memberNames: toMembers(d).map((m) => m.name),
        me: me.name,
        // PM 급 = PM 또는 project-manage (canManage 가 둘 다 참)
        isManager: d.permissions.canManage,
        projectKey: d.projectKey,
      }
    },
  )
}

/** 보드는 size=100 으로 hasNext 가 false 가 될 때까지 (T-1) */
async function fetchBoardTasks(projectKey: string) {
  const out: TaskCardDto[] = []
  for (let page = 0; page < 20; page++) {
    const r = await api<TaskListResponse>('/tasks', { query: { projectKey, doneWithinDays: 14, sort: 'board', size: 100, page } })
    out.push(...r.page.content)
    if (!r.page.hasNext) break
  }
  return out
}

export type BoardPosition = { afterTaskKey: string | null; beforeTaskKey: string | null }

/**
 * 상태 이동 규칙 (TaskService.TRANSITIONS 와 같은 표).
 * byRequester: 요청자 · PM 급만 (아니면 담당자 · PM 급만). reason: 사유가 필요한 이동 (반려 P107 · 취소 · 다시 열기 P106)
 */
export const TASK_TRANSITIONS: { from: TaskStatus | 'CANCELLED'; to: TaskStatus | 'CANCELLED'; byRequester: boolean; reason: boolean }[] = [
  { from: 'TODO', to: 'IN_PROGRESS', byRequester: false, reason: false },
  { from: 'TODO', to: 'CANCELLED', byRequester: true, reason: true },
  { from: 'IN_PROGRESS', to: 'TODO', byRequester: false, reason: false },
  { from: 'IN_PROGRESS', to: 'REVIEW', byRequester: false, reason: false },
  { from: 'IN_PROGRESS', to: 'CANCELLED', byRequester: true, reason: true },
  { from: 'REVIEW', to: 'DONE', byRequester: true, reason: false },
  { from: 'REVIEW', to: 'IN_PROGRESS', byRequester: true, reason: true },
  { from: 'DONE', to: 'IN_PROGRESS', byRequester: true, reason: true },
  { from: 'CANCELLED', to: 'TODO', byRequester: true, reason: false },
]
export const transitionRule = (from: TaskStatus | 'CANCELLED', to: TaskStatus | 'CANCELLED') =>
  TASK_TRANSITIONS.find((r) => r.from === from && r.to === to)

/** T-7 상태 옮기기 (version 은 카드의 동시 수정 값, 틀리면 P101) */
export const transitionTask = (taskKey: string, body: { toStatus: TaskStatus; version: number; reason?: string; boardPosition?: BoardPosition }) =>
  api<{ task: TaskCardDto; reasonCommentId: number | null }>(`/tasks/${encodeURIComponent(taskKey)}/transition`, { method: 'POST', body }).then((r) => ({
    task: toTask(r.task),
    reasonCommentId: r.reasonCommentId,
  }))

/** T-4 같은 열 안에서 순서 바꾸기 (version 생략) */
export const moveTaskInColumn = (taskKey: string, boardPosition: BoardPosition) =>
  api<unknown>(`/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: { boardPosition } })

// ───────────────────────── 작업 상세 ─────────────────────────

/** AttachmentResponse */
type FileRefDto = { publicId: string; name: string; size: number; contentType: string }
type ChecklistItemDto = {
  itemId: number
  content: string
  done: boolean
  assignee: MemberRef | null
  displayOrder: number
  convertedTask: { taskId: number; taskKey: string; title: string; status: string } | null
}
/** TaskDetailResponse = TaskCardResponse 필드 + 상세 필드 */
type TaskDetailDto = TaskCardDto & {
  description: string | null
  creator: MemberRef | null
  createdAt: string
  checklistItems: ChecklistItemDto[]
  attachments: FileRefDto[]
  watchers: { count: number; watching: boolean; members: MemberRef[] }
  /** TaskSource: MEETING_ACTION · THREAD · CHECKLIST */
  source: { type: 'MEETING_ACTION' | 'THREAD' | 'CHECKLIST'; id: number; label: string; url: string | null } | null
  convertedTasks: { taskId: number; taskKey: string; title: string; status: string }[]
  allowedTransitions: { toStatus: TaskStatus | 'CANCELLED'; reasonRequired: boolean }[]
  permissions: { canEdit: boolean; canDelete: boolean }
}
/** comment 모듈 CommentResponse (NON_NULL 이라 비어 있는 필드는 빠져 온다) */
type CommentDto = {
  commentId: number
  parentId?: number
  author: { memberId: number; name: string | null }
  body: string | null
  deleted: boolean
  kind: 'NORMAL' | 'REJECT_REASON' | 'STATUS_REASON'
  createdAt: string
  replies?: CommentDto[]
}

export type TaskComment = { commentId?: number; author: string; ago: string; body: string }
export type TaskLink = { kind: 'minutes' | 'pr' | 'build' | 'thread' | 'task'; title: string; meta: string; to?: string }
export type TaskDetailData = {
  task: BoardTask
  projectName: string
  description: string
  checklist: { itemId?: number; text: string; done: boolean }[]
  attachments: { name: string; size: string; href: string }[]
  comments: TaskComment[]
  activity: ActivityLine[]
  subscribers: string[]
  watchCount: number
  watching: boolean
  links: TaskLink[]
  me: string
  isManager: boolean
}

const toComment = (c: CommentDto): TaskComment => ({
  commentId: c.commentId,
  author: c.author.name ?? '알 수 없음',
  ago: ago(c.createdAt),
  body: c.deleted || c.body === null ? '_삭제된 댓글입니다_' : c.kind === 'REJECT_REASON' ? `반려: ${c.body}` : c.kind === 'STATUS_REASON' ? `사유: ${c.body}` : c.body,
})

function sourceLink(s: NonNullable<TaskDetailDto['source']>): TaskLink {
  if (s.type === 'MEETING_ACTION') return { kind: 'minutes', title: s.label, meta: '회의록에서 만든 작업' }
  if (s.type === 'THREAD') return { kind: 'thread', title: s.label, meta: '스레드 글에서 만든 작업' }
  return { kind: 'task', title: s.label, meta: '체크리스트에서 만든 작업' }
}

/** 작업 상세: T-3 + P-3(이름 · 권한) + P-9(?taskKey) + CM-1(TASK) */
export function useTaskDetail(projectKey: string | undefined, taskKey: string | undefined) {
  return useResource<TaskDetailData>(
    ['task', projectKey, taskKey],
    () => {
      const extra = taskDetailExtra
      return {
        task: findTask(taskKey),
        projectName: findProject(projectKey).name,
        description: extra.description,
        checklist: extra.checklist,
        attachments: extra.attachments.map((a) => ({ ...a, href: '#' })),
        comments: extra.comments,
        activity: extra.activity,
        subscribers: extra.subscribers,
        watchCount: extra.subscribers.length,
        watching: true,
        links: [...extra.links],
        me: MOCK_ME,
        isManager: projectDetail.members.some((m) => m.name === MOCK_ME && m.role === 'MANAGER'),
      }
    },
    async () => {
      const k = encodeURIComponent(taskKey ?? '')
      const [t, p, me, acts] = await Promise.all([
        api<TaskDetailDto>(`/tasks/${k}`),
        getProject(projectKey ?? ''),
        api<MemberRef>('/members/me'),
        api<PageResponse<ActivityDto>>(`/projects/${encodeURIComponent(projectKey ?? '')}/activities`, { query: { taskKey, size: 20 } }),
      ])
      // 댓글 대상 ID 는 작업의 숫자 ID (taskId) 라 상세를 받은 뒤 부른다
      const comments = await api<PageResponse<CommentDto>>('/comments', { query: { targetType: 'TASK', targetId: t.taskId, size: 100 } })
      const base = getApiBase().replace(/\/$/, '')
      return {
        task: toTask(t),
        projectName: p.name,
        description: t.description ?? '',
        checklist: t.checklistItems.map((c) => ({ itemId: c.itemId, text: c.content, done: c.done })),
        attachments: t.attachments.map((a) => ({ name: a.name, size: fileSize(a.size), href: `${base}/files/${a.publicId}/download` })),
        comments: comments.content.flatMap((c) => [c, ...(c.replies ?? [])]).map(toComment),
        activity: acts.content.map((a) => toActivity(a, true)),
        subscribers: t.watchers.members.map((m) => m.name),
        watchCount: t.watchers.count,
        watching: t.watchers.watching,
        // 백엔드 TaskDetailResponse 에 PR · Jenkins 빌드 연결 필드가 없어 원본(source) · 바꾼 작업(convertedTasks)만 보여 준다
        links: [
          ...(t.source ? [sourceLink(t.source)] : []),
          ...t.convertedTasks.map((c): TaskLink => ({ kind: 'task', title: `${c.taskKey} ${c.title}`, meta: `체크리스트에서 만든 작업 · ${statusName(c.status)}`, to: `/projects/${projectKey}/tasks/${c.taskKey}` })),
        ],
        me: me.name,
        isManager: p.permissions.canManage,
      }
    },
  )
}

/** T-9 체크 */
export const setChecklistDone = (taskKey: string, itemId: number, done: boolean) =>
  api<unknown>(`/tasks/${encodeURIComponent(taskKey)}/checklist-items/${itemId}`, { method: 'PATCH', body: { done } })

/** T-11 · T-12 구독 */
export const setWatching = (taskKey: string, on: boolean) =>
  api<{ watching: boolean; count: number }>(`/tasks/${encodeURIComponent(taskKey)}/watch`, { method: on ? 'PUT' : 'DELETE' })

/** CM-2 작업 댓글 쓰기 */
export const postTaskComment = (taskId: number, body: string) =>
  api<CommentDto>('/comments', { method: 'POST', body: { targetType: 'TASK', targetId: taskId, body } }).then(toComment)

// ───────────────────────── 서비스 권한 설정 (P-16 ~ P-19, P-21) ─────────────────────────

export type VaultLevel = 'NONE' | 'READ' | 'WRITE'
export type JenkinsLevel = 'NONE' | 'READ' | 'BUILD'
export type AccessOverride = { vault: VaultLevel | 'DEFAULT'; jenkins: JenkinsLevel | 'DEFAULT' }
export type AccessState = {
  vaultOn: boolean
  jenkinsOn: boolean
  roles: { MANAGER: { vault: VaultLevel; jenkins: JenkinsLevel }; MEMBER: { vault: VaultLevel; jenkins: JenkinsLevel } }
  members: Record<string, AccessOverride>
}
export type ProvisionStatus = 'PENDING' | 'DONE' | 'FAILED'
export type ServiceAccessView = {
  state: AccessState
  members: (ProjectMember & { memberId?: number })[]
  vault: { paths: string[]; pending: string[]; status: ProvisionStatus; error: string | null }
  jenkins: { jobs: string[]; status: ProvisionStatus; error: string | null }
  notice: string
}

const MOCK_ACCESS: ServiceAccessView = {
  state: {
    vaultOn: true,
    jenkinsOn: true,
    roles: { MANAGER: { vault: 'WRITE', jenkins: 'BUILD' }, MEMBER: { vault: 'READ', jenkins: 'BUILD' } },
    members: {
      김민서: { vault: 'DEFAULT', jenkins: 'DEFAULT' },
      박지훈: { vault: 'DEFAULT', jenkins: 'DEFAULT' },
      최현우: { vault: 'WRITE', jenkins: 'DEFAULT' },
      이정훈: { vault: 'DEFAULT', jenkins: 'DEFAULT' },
      한유진: { vault: 'NONE', jenkins: 'READ' },
    },
  },
  members: projectDetail.members,
  vault: { paths: ['secret/projects/defme/'], pending: ['secret/defme/'], status: 'DONE', error: null },
  jenkins: { jobs: ['^Hoseo-I-Turtle/defme_BE(/.*)?$'], status: 'FAILED', error: 'Jenkins 가 응답하지 않았어요' },
  notice: '바꾼 권한은 다음 로그인부터 반영돼요. 뺀 권한은 이미 로그인한 세션이 끝나야 적용돼요 (Vault 토큰 최대 8시간, Jenkins 세션).',
}

export function toAccessView(sa: ServiceAccessDto): ServiceAccessView {
  const v = sa.services.find((x) => x.service === 'VAULT')
  const j = sa.services.find((x) => x.service === 'JENKINS')
  const members: Record<string, AccessOverride> = {}
  for (const m of sa.members)
    members[m.member.name] = {
      vault: (m.vault.override ?? 'DEFAULT') as AccessOverride['vault'],
      jenkins: (m.jenkins.override ?? 'DEFAULT') as AccessOverride['jenkins'],
    }
  return {
    state: {
      vaultOn: v?.enabled ?? false,
      jenkinsOn: j?.enabled ?? false,
      roles: {
        MANAGER: { vault: (v?.managerLevel ?? 'WRITE') as VaultLevel, jenkins: (j?.managerLevel ?? 'BUILD') as JenkinsLevel },
        MEMBER: { vault: (v?.memberLevel ?? 'READ') as VaultLevel, jenkins: (j?.memberLevel ?? 'BUILD') as JenkinsLevel },
      },
      members,
    },
    members: sa.members.map((m) => ({
      memberId: m.member.memberId,
      name: m.member.name,
      role: m.projectRole,
      note: m.member.memberType === 'INTERN' ? '인턴' : undefined,
    })),
    vault: {
      paths: (v?.resources ?? []).map((r) => r.ref),
      pending: (v?.pendingVaultPathRequests ?? []).map((r) => r.vaultPath),
      status: v?.provisionStatus ?? 'DONE',
      error: v?.provisionError ?? null,
    },
    jenkins: { jobs: (j?.resources ?? []).map((r) => r.ref), status: j?.provisionStatus ?? 'DONE', error: j?.provisionError ?? null },
    notice: sa.notice,
  }
}

const accessPath = (key: string) => `/projects/${encodeURIComponent(key)}/service-access`

/** 프로젝트 설정 · 서비스 권한 (P-16) */
export function useServiceAccess(key: string | undefined) {
  return useResource<ServiceAccessView>(['service-access', key], () => MOCK_ACCESS, async () => toAccessView(await api<ServiceAccessDto>(accessPath(key ?? ''))))
}

/**
 * 서비스 권한 저장이 중간에 실패했을 때. 백엔드는 서비스 설정(P-17 PATCH /service-access/{service})과
 * 구성원 수준(P-18 PUT /service-access/members)을 한 번에 저장하는 API 가 없어, 앞의 것만 저장될 수 있다.
 * saved 는 실패 전까지 서버가 저장한 마지막 상태 (없으면 null).
 */
export class AccessSaveError extends Error {
  saved: ServiceAccessView | null
  reason: unknown
  constructor(cause: unknown, saved: ServiceAccessView | null) {
    super(cause instanceof Error ? cause.message : '저장하지 못했어요.')
    this.reason = cause
    this.saved = saved
  }
}

/** 저장: 바뀐 서비스는 P-17, 바뀐 구성원은 P-18. 마지막 응답(P-16 모양)을 돌려준다 */
export async function saveServiceAccess(key: string, view: ServiceAccessView, before: AccessState, after: AccessState) {
  let last: ServiceAccessDto | null = null
  try {
    for (const svc of ['VAULT', 'JENKINS'] as const) {
      const on = svc === 'VAULT' ? 'vaultOn' : 'jenkinsOn'
      const lv = svc === 'VAULT' ? 'vault' : 'jenkins'
      // ServiceSettingRequest: 바뀐 값만 (ServiceLevel NONE · READ · WRITE(Vault) · BUILD(Jenkins))
      const body: { enabled?: boolean; managerLevel?: string; memberLevel?: string } = {}
      if (before[on] !== after[on]) body.enabled = after[on]
      if (before.roles.MANAGER[lv] !== after.roles.MANAGER[lv]) body.managerLevel = after.roles.MANAGER[lv]
      if (before.roles.MEMBER[lv] !== after.roles.MEMBER[lv]) body.memberLevel = after.roles.MEMBER[lv]
      if (Object.keys(body).length) last = await api<ServiceAccessDto>(`${accessPath(key)}/${svc}`, { method: 'PATCH', body })
    }
    // MemberLevelsRequest.items: 바뀐 서비스만 (DEFAULT = 역할 기본값으로 되돌리기). 한 번에 100명까지
    const items = view.members.flatMap((m) => {
      const a = before.members[m.name]
      const b = after.members[m.name]
      if (!a || !b || m.memberId === undefined) return []
      const item: { memberId: number; vault?: string; jenkins?: string } = { memberId: m.memberId }
      if (a.vault !== b.vault) item.vault = b.vault
      if (a.jenkins !== b.jenkins) item.jenkins = b.jenkins
      return item.vault || item.jenkins ? [item] : []
    })
    for (let i = 0; i < items.length; i += 100) {
      last = await api<ServiceAccessDto>(`${accessPath(key)}/members`, { method: 'PUT', body: { items: items.slice(i, i + 100) } })
    }
  } catch (e) {
    throw new AccessSaveError(e, last ? toAccessView(last) : null)
  }
  return last ? toAccessView(last) : null
}

/** P-19 다시 시도 → P-16 을 몇 번 다시 불러 결과를 본다 */
export async function retryProvision(key: string, service: 'VAULT' | 'JENKINS') {
  await api<{ jobId: number; status: string }>(`${accessPath(key)}/${service}/sync`, { method: 'POST' })
  let view: ServiceAccessView | null = null
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => window.setTimeout(r, 3000))
    view = toAccessView(await api<ServiceAccessDto>(accessPath(key)))
    const st = service === 'VAULT' ? view.vault.status : view.jenkins.status
    if (st !== 'PENDING') break
  }
  return view
}

/** P-21 기존 Vault 경로 묶기 신청 */
export const requestVaultPath = (key: string, vaultPath: string) =>
  api<{ requestId: number; vaultPath: string; status: string }>(`/projects/${encodeURIComponent(key)}/vault-path-requests`, {
    method: 'POST',
    body: { vaultPath },
  })
