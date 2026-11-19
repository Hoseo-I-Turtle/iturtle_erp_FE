// 프로젝트 · 작업 API — docs/api/30-project.md, 31-task.md, 60-common.md(댓글), 20-communication.md(CL-1)
// 응답을 화면이 쓰는 mocks/projects.ts · projectDetail.ts · tasks.ts 의 모양으로 바꾼다.
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'
import { getApiBase } from '../lib/dataMode'
import {
  findProject,
  projects as mockProjects,
  type ProjectCategory,
  type ProjectStatus,
  type ProjectSummary,
  type ServiceCode,
} from '../mocks/projects'
import { projectDetail, type ProjectMember } from '../mocks/projectDetail'
import {
  findTask,
  STATUS_NAME,
  taskDetailExtra,
  tasks as mockTasks,
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

/** 서버 상태 → 화면 상태. 명세 확인 필요: ON_HOLD(보류) 는 화면 상태에 없어 '준비'로 보여 준다 */
const toProjectStatus = (s: string): ProjectStatus => (s === 'ON_HOLD' ? 'PREPARING' : (s as ProjectStatus))

const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

// ───────────────────────── P-1 프로젝트 목록 ─────────────────────────

type ProjectSummaryDto = {
  projectKey: string
  name: string
  status: string
  visibility: 'LAB' | 'PRIVATE'
  categoryCode: string
  categoryName: string
  summary: string | null
  startsOn: string | null
  endsOn: string | null
  myRole: 'MANAGER' | 'MEMBER' | 'NONE'
  memberCount: number
  memberPreview: MemberRef[]
  nextMilestone: { milestoneId: number; name: string; dueOn: string | null; progress: { done: number; total: number; ratio: number } } | null
}
type ProjectListResponse = { categoryCounts: Record<string, number>; page: PageResponse<ProjectSummaryDto> }

const toSummary = (x: ProjectSummaryDto): ProjectSummary => ({
  projectKey: x.projectKey,
  name: x.name,
  status: toProjectStatus(x.status),
  visibility: x.visibility,
  // 명세 확인 필요: 공통코드에 화면에 없는 카테고리가 생기면 이름이 비어 보인다 (categoryName 은 화면 타입에 없음)
  categoryCode: x.categoryCode as ProjectCategory,
  summary: x.summary ?? '',
  startsOn: x.startsOn ?? '',
  endsOn: x.endsOn ?? '',
  myRole: x.myRole,
  memberPreview: x.memberPreview.map((m) => m.name),
  // 명세 확인 필요: ProjectSummary 에 연동 서비스 목록이 없어 카드의 서비스 아이콘은 실서버에서 비어 있다
  services: [],
  nextMilestone: x.nextMilestone
    ? { name: x.nextMilestone.name, dueOn: monthDay(x.nextMilestone.dueOn), ratio: x.nextMilestone.progress.ratio }
    : null,
})

export type ProjectListFilter = { category: ProjectCategory | 'ALL'; mine: boolean; activeOnly: boolean; archived: boolean }
export type ProjectList = { projects: ProjectSummary[]; counts: Record<string, number> }

/**
 * 프로젝트 목록 화면. 실서버는 조건을 서버에 넘기고, 목업은 지금처럼 화면이 거른다.
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
      return { projects: base, counts }
    },
    async () => {
      const r = await api<ProjectListResponse>('/projects', {
        query: {
          categoryCode: f.category === 'ALL' ? undefined : f.category,
          mine: f.mine || undefined,
          status: f.activeOnly ? 'PREPARING,ACTIVE' : undefined,
          includeArchived: f.archived || undefined,
          size: 100,
        },
      })
      return { projects: r.page.content.map(toSummary), counts: r.categoryCounts }
    },
  )
}

// ───────────────────────── P-3 프로젝트 상세 ─────────────────────────

type ProjectMemberRefDto = { member: MemberRef; role: 'MANAGER' | 'MEMBER' | 'FORMER'; joinedAt: string; leftAt: string | null }
type ProjectDetailDto = {
  projectId: number
  projectKey: string
  name: string
  status: string
  visibility: 'LAB' | 'PRIVATE'
  categoryCode: string
  categoryName: string
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

const detailToSummary = (d: ProjectDetailDto): ProjectSummary => ({
  projectKey: d.projectKey,
  name: d.name,
  status: toProjectStatus(d.status),
  visibility: d.visibility,
  categoryCode: d.categoryCode as ProjectCategory,
  summary: '',
  startsOn: d.startsOn ?? '',
  endsOn: d.endsOn ?? '',
  myRole: d.myRole === 'FORMER' ? 'NONE' : d.myRole,
  memberPreview: toMembers(d).map((m) => m.name),
  services: [],
  nextMilestone: null,
})

/**
 * 프로젝트 머리 (ProjectLayout 이 실서버에서 쓰면 되는 훅).
 * 목업은 findProject 그대로.
 */
export function useProjectHeader(key: string | undefined) {
  return useResource<ProjectSummary>(['project', key], () => findProject(key), async () => detailToSummary(await getProject(key ?? '')))
}

// ───────────────────────── P-9 활동 기록 ─────────────────────────

type ActivityDto = {
  activityId: number
  type: string
  actor: MemberRef | null
  task: { taskKey: string; title: string; status: string } | null
  field: string | null
  before: string | null
  after: string | null
  ref: { type: string; id: number; title: string } | null
  createdAt: string
}

const statusName = (s: string | null) => (s && s in STATUS_NAME ? STATUS_NAME[s as TaskStatus] : s === 'CANCELLED' ? '취소' : (s ?? ''))
const FIELD_NAME: Record<string, string> = { due_on: '기한', assignee: '담당자', priority: '우선순위', title: '제목', milestone: '마일스톤', labels: '라벨', description: '설명' }

/**
 * 활동 문장 ("님이" 뒤에 붙는 부분). 화면이 type · field · 값으로 만든다 (P-9).
 * 명세 확인 필요: ActivityType 전체 목록이 명세에 없어, 모르는 종류는 일반 문장으로 보여 준다.
 */
function activityText(a: ActivityDto, inTask: boolean) {
  const k = a.task?.taskKey ?? ''
  const subject = inTask ? '' : `${k} 의 `
  switch (a.type) {
    case 'TASK_STATUS_CHANGED':
      return inTask ? `상태를 ${statusName(a.before)} → ${statusName(a.after)}로 바꿨어요` : `${k} 를 ${statusName(a.after)}로 옮겼어요`
    case 'TASK_CREATED':
      return inTask ? `작업을 만들었어요${a.ref ? ` (${a.ref.title})` : ''}` : `${k} 를 만들었어요`
    case 'TASK_COMMENTED':
      return inTask ? '댓글을 남겼어요' : `${k} 에 댓글을 남겼어요`
    case 'TASK_FIELD_CHANGED': {
      const f = FIELD_NAME[a.field ?? ''] ?? a.field ?? '항목'
      return `${subject}${f}을 바꿨어요${a.before || a.after ? ` (${a.before ?? '없음'} → ${a.after ?? '없음'})` : ''}`
    }
    case 'TASK_ATTACHMENT':
      return `${subject}첨부를 바꿨어요`
    case 'MINUTE_ACTIONS_CONVERTED':
      return `회의록 "${a.ref?.title ?? ''}"에서 작업 ${a.after ?? ''}개를 만들었어요`
    case 'THREAD_POSTED':
      return `스레드에 "${a.ref?.title ?? ''}" 를 올렸어요`
    case 'MEMBER_ADDED':
      return `참여자를 더했어요${a.after ? ` (${a.after})` : ''}`
    case 'SETTINGS_CHANGED':
      return '프로젝트 설정을 바꿨어요'
    default:
      return k ? `${k} 를 고쳤어요` : '프로젝트를 고쳤어요'
  }
}

type ActivityLine = { who: string; text: string; ago: string }
const toActivity = (a: ActivityDto, inTask: boolean): ActivityLine => ({
  who: a.actor?.name ?? '시스템',
  text: activityText(a, inTask),
  ago: ago(a.createdAt),
})

// ───────────────────────── 프로젝트 홈 ─────────────────────────

type MilestoneDto = {
  milestoneId: number
  name: string
  dueOn: string | null
  status: 'OPEN' | 'CLOSED'
  overdue: boolean
  progress: { done: number; total: number; ratio: number }
}
type LinkDto = {
  linkId: number
  service: ServiceCode | 'OTHER'
  url: string
  displayName: string
  description: string | null
  externalRef: string | null
  myAccess: { granted: boolean; level: string | null }
}
type LinkStatusDto = {
  linkId: number
  status: 'OK' | 'UNAVAILABLE' | 'NOT_SUPPORTED'
  jenkins: { lastBuild: { number: number; result: string; startedAt: string; durationMs: number } | null } | null
  penpot: { fileCount: number; files: { name: string; modifiedAt: string }[] } | null
  github: { weekCommitCount: number; openPullRequestCount: number } | null
}
type Level = { override: string | null; effective: string; source?: string | null; expiresAt?: string | null }
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
type TaskCardDto = {
  taskId: number
  taskKey: string
  projectKey: string
  title: string
  typeCode: string
  typeName: string
  status: string
  priority: string
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
type TaskListResponse = { page: PageResponse<TaskCardDto>; deletedTaskKeys?: string[]; serverTime: string }
type OccurrenceDto = { eventId: number; title?: string; allDay: boolean; startsAt: string; startsOn?: string; color: string | null }

const LEVEL_NAME: Record<string, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기', BUILD: '빌드' }
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
  project: ProjectSummary
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
    const sec = Math.round(b.durationMs / 1000)
    status = {
      ok: b.result === 'SUCCESS',
      text: `#${b.number} ${BUILD_RESULT[b.result] ?? b.result} · ${ago(b.startedAt)} · ${Math.floor(sec / 60)}분 ${sec % 60}초`,
    }
  } else if (st?.penpot) {
    const f = st.penpot.files[0]
    status = { ok: null, text: f ? `${ago(f.modifiedAt)} 수정 · ${f.name}` : `파일 ${st.penpot.fileCount}개` }
  } else if (st?.github) {
    status = { ok: null, text: `이번 주 커밋 ${st.github.weekCommitCount} · 열린 PR ${st.github.openPullRequestCount}` }
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
        project: detailToSummary(d),
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

export type BoardTask = Task & { taskId?: number; version?: number }

function toTask(x: TaskCardDto): BoardTask {
  const left = x.dueOn ? daysUntil(x.dueOn) : null
  const done = x.status === 'DONE' || x.status === 'CANCELLED'
  return {
    taskId: x.taskId,
    version: x.version,
    taskKey: x.taskKey,
    title: x.title,
    // 명세 확인 필요: TASK_TYPE 공통코드가 화면의 세 가지(작업 · 버그 · 조사) 밖이면 '작업'으로 보여 준다
    type: TASK_TYPES.includes(x.typeCode as TaskType) ? (x.typeCode as TaskType) : 'TASK',
    // 명세 확인 필요: CANCELLED 는 화면 상태에 없다 (보드 기본 조회에서는 빠짐)
    status: x.status as TaskStatus,
    priority: x.priority as TaskPriority,
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

/** T-7 상태 옮기기 */
export const transitionTask = (taskKey: string, body: { toStatus: TaskStatus; version: number; reason?: string; boardPosition?: BoardPosition }) =>
  api<{ task: TaskCardDto; reasonCommentId: number | null }>(`/tasks/${encodeURIComponent(taskKey)}/transition`, { method: 'POST', body }).then((r) => ({
    task: toTask(r.task),
    reasonCommentId: r.reasonCommentId,
  }))

/** T-4 같은 열 안에서 순서 바꾸기 (version 생략) */
export const moveTaskInColumn = (taskKey: string, boardPosition: BoardPosition) =>
  api<unknown>(`/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: { boardPosition } })

// ───────────────────────── 작업 상세 ─────────────────────────

type FileRefDto = { publicId: string; name: string; size: number; contentType: string }
type ChecklistItemDto = { itemId: number; content: string; done: boolean; displayOrder: number }
type TaskDetailDto = TaskCardDto & {
  description: string | null
  creator: MemberRef
  checklistItems: ChecklistItemDto[]
  attachments: FileRefDto[]
  watchers: { count: number; watching: boolean; members: MemberRef[] }
  source: { type: string; id: number; label: string; url: string } | null
  convertedTasks: { taskKey: string; title: string; status: string }[]
  allowedTransitions: { toStatus: string; reasonRequired: boolean }[]
  permissions: { canEdit: boolean; canDelete: boolean }
}
type CommentDto = {
  commentId: number
  author: MemberRef
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
  author: c.author.name,
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
        // 명세 확인 필요: 화면의 PR · Jenkins 빌드 연결은 명세에 없다 (README S1). 원본 · 바꾼 작업만 보여 준다
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

/** 저장: 바뀐 서비스는 P-17, 바뀐 구성원은 P-18. 마지막 응답(P-16 모양)을 돌려준다 */
export async function saveServiceAccess(key: string, view: ServiceAccessView, before: AccessState, after: AccessState) {
  let last: ServiceAccessDto | null = null
  for (const svc of ['VAULT', 'JENKINS'] as const) {
    const on = svc === 'VAULT' ? 'vaultOn' : 'jenkinsOn'
    const lv = svc === 'VAULT' ? 'vault' : 'jenkins'
    const body: { enabled?: boolean; managerLevel?: string; memberLevel?: string } = {}
    if (before[on] !== after[on]) body.enabled = after[on]
    if (before.roles.MANAGER[lv] !== after.roles.MANAGER[lv]) body.managerLevel = after.roles.MANAGER[lv]
    if (before.roles.MEMBER[lv] !== after.roles.MEMBER[lv]) body.memberLevel = after.roles.MEMBER[lv]
    if (Object.keys(body).length) last = await api<ServiceAccessDto>(`${accessPath(key)}/${svc}`, { method: 'PATCH', body })
  }
  const items = view.members.flatMap((m) => {
    const a = before.members[m.name]
    const b = after.members[m.name]
    if (!a || !b || m.memberId === undefined) return []
    const item: { memberId: number; vault?: string; jenkins?: string } = { memberId: m.memberId }
    if (a.vault !== b.vault) item.vault = b.vault
    if (a.jenkins !== b.jenkins) item.jenkins = b.jenkins
    return item.vault || item.jenkins ? [item] : []
  })
  if (items.length) last = await api<ServiceAccessDto>(`${accessPath(key)}/members`, { method: 'PUT', body: { items } })
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
