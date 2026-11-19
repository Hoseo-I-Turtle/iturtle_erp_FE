// 프로젝트 일정표 (간트 · 담당자별 · 마일스톤) — P-3 프로젝트 상세 + 마일스톤 목록 + T-1 작업 목록을 한 화면 모양으로 묶는다.
// 백엔드 기준: ProjectController GET /projects/{key}, MilestoneController GET /projects/{key}/milestones,
// TaskController GET /tasks · PATCH /tasks/{taskKey}.
// 작업 시작일(startOn)은 백엔드에 아직 없을 수 있다. 응답에 startOn 키가 있으면 쓰고, 없으면 기한 하루짜리로 그린다.
// 저장한 보기는 GET · POST · DELETE /projects/{key}/views. 서버에 없으면(404) 이 브라우저에만 남긴다 (나만).
import { api, ApiError } from './client'
import type { MemberRef, PageResponse } from './types'
import { useResource } from './useResource'
import { getDataMode } from '../lib/dataMode'

// ───────────────────────── 날짜 (하루 = 정수) ─────────────────────────

const DAY = 86400000

/** 'YYYY-MM-DD' → 1970-01-01 부터 센 날 수 */
export const dayNum = (d: string) => Math.round(Date.parse(d.slice(0, 10) + 'T00:00:00Z') / DAY)
/** 날 수 → 'YYYY-MM-DD' */
export const dayStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
/** 날 수 → 'M/D' */
export const dayMd = (n: number) => {
  const d = new Date(n * DAY)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
/** 날 수 → 'M/D (요일)' */
export const dayMdw = (n: number) => `${dayMd(n)} (${WEEKDAY[new Date(n * DAY).getUTCDay()]})`
/** 오늘 (KST) 의 날 수 */
export const todayNum = () => dayNum(new Date(Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))

// ───────────────────────── 화면 모양 ─────────────────────────

export type SchedStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export const SCHED_STATUS_NAME: Record<SchedStatus, string> = { TODO: '할 일', IN_PROGRESS: '진행 중', REVIEW: '검토', DONE: '완료' }

export type SchedTask = {
  taskKey: string
  version: number
  title: string
  status: SchedStatus
  assigneeId: number | null
  assignee: string | null
  milestoneId: number | null
  /** 시작 (날 수). 시작일이 없으면 기한과 같고 startGuessed */
  start: number | null
  /** 기한 (날 수). 없으면 null → '기한 없음' */
  due: number | null
  startGuessed: boolean
  overdue: boolean
  checklist: { done: number; total: number } | null
}

export type SchedMilestone = {
  id: number
  name: string
  start: number | null
  due: number | null
  closed: boolean
  overdue: boolean
  done: number
  total: number
}

export type SchedMember = { memberId: number; name: string; role: 'MANAGER' | 'MEMBER'; note?: string }

export type ScheduleData = {
  projectKey: string
  projectStart: number | null
  projectEnd: number | null
  members: SchedMember[]
  milestones: SchedMilestone[]
  tasks: SchedTask[]
  /** 작업을 고칠 수 있는지 (기간 끌기 · 담당자 바꾸기) */
  canEdit: boolean
  /** 서버가 작업 시작일(startOn)을 주고받는지 — 아니면 시작 쪽 끌기를 막는다 */
  supportsStart: boolean
}

// ───────────────────────── 서버 응답 ─────────────────────────

type ProjectDto = {
  projectKey: string
  startsOn: string | null
  endsOn: string | null
  members: { member: MemberRef; role: 'MANAGER' | 'MEMBER' | 'FORMER' }[]
  permissions: { canManage: boolean; canWriteTasks: boolean }
}
type MilestoneDto = {
  milestoneId: number
  name: string
  dueOn: string | null
  startOn?: string | null
  status: 'OPEN' | 'CLOSED'
  overdue: boolean
  progress: { done: number; total: number; ratio: number }
}
type TaskCardDto = {
  taskKey: string
  title: string
  status: SchedStatus | 'CANCELLED'
  assignee: MemberRef | null
  dueOn: string | null
  startOn?: string | null
  overdue: boolean
  milestone: { milestoneId: number; name: string } | null
  checklist: { done: number; total: number }
  version: number
}

const toTask = (x: TaskCardDto): SchedTask => {
  const due = x.dueOn ? dayNum(x.dueOn) : null
  const start = x.startOn ? dayNum(x.startOn) : due
  return {
    taskKey: x.taskKey,
    version: x.version,
    title: x.title,
    status: x.status === 'CANCELLED' ? 'DONE' : x.status,
    assigneeId: x.assignee?.memberId ?? null,
    assignee: x.assignee?.name ?? null,
    milestoneId: x.milestone?.milestoneId ?? null,
    start: start !== null && due !== null ? Math.min(start, due) : start,
    due,
    startGuessed: !x.startOn,
    overdue: x.overdue,
    checklist: x.checklist.total > 0 ? x.checklist : null,
  }
}

/** 마일스톤 시작: startOn → 없으면 바로 앞 마일스톤 기한 다음 날 → 프로젝트 시작일 → 그 마일스톤 작업 중 가장 이른 날 */
function withMilestoneStarts(list: MilestoneDto[], projectStart: number | null, tasks: SchedTask[]): SchedMilestone[] {
  const sorted = [...list].sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'))
  let prevDue: number | null = null
  return sorted.map((m) => {
    const due = m.dueOn ? dayNum(m.dueOn) : null
    const own = tasks.filter((t) => t.milestoneId === m.milestoneId && t.start !== null).map((t) => t.start as number)
    let start = m.startOn ? dayNum(m.startOn) : prevDue !== null ? prevDue + 1 : projectStart
    if (start === null && own.length) start = Math.min(...own)
    if (start !== null && due !== null && start > due) start = own.length ? Math.min(due, ...own) : due
    if (due !== null) prevDue = due
    return {
      id: m.milestoneId,
      name: m.name,
      start,
      due,
      closed: m.status === 'CLOSED',
      overdue: m.overdue,
      done: m.progress.done,
      total: m.progress.total,
    }
  })
}

async function fetchTasks(projectKey: string) {
  const out: TaskCardDto[] = []
  for (let page = 0; page < 10; page++) {
    const r = await api<{ page: PageResponse<TaskCardDto> }>('/tasks', {
      query: { projectKey, statuses: 'TODO,IN_PROGRESS,REVIEW,DONE', doneWithinDays: 180, size: 100, page },
    })
    out.push(...r.page.content)
    if (!r.page.hasNext) break
  }
  return out
}

async function fetchSchedule(key: string): Promise<ScheduleData> {
  const k = encodeURIComponent(key)
  const [p, ms, cards] = await Promise.all([
    api<ProjectDto>(`/projects/${k}`),
    api<{ milestones: MilestoneDto[] }>(`/projects/${k}/milestones`),
    fetchTasks(key),
  ])
  const tasks = cards.map(toTask)
  const projectStart = p.startsOn ? dayNum(p.startsOn) : null
  return {
    projectKey: p.projectKey,
    projectStart,
    projectEnd: p.endsOn ? dayNum(p.endsOn) : null,
    members: p.members
      .filter((m) => m.role !== 'FORMER')
      .map((m) => ({
        memberId: m.member.memberId,
        name: m.member.name,
        role: m.role as 'MANAGER' | 'MEMBER',
        note: m.member.memberType === 'INTERN' ? '인턴' : undefined,
      })),
    milestones: withMilestoneStarts(ms.milestones, projectStart, tasks),
    tasks,
    canEdit: p.permissions.canWriteTasks || p.permissions.canManage,
    supportsStart: cards.some((c) => 'startOn' in c),
  }
}

// ───────────────────────── 목업 (오늘 기준으로 날짜를 만든다) ─────────────────────────

function mockSchedule(key: string | undefined): ScheduleData {
  const T = todayNum()
  const members: SchedMember[] = [
    { memberId: 1, name: '김민서', role: 'MANAGER' },
    { memberId: 2, name: '박지훈', role: 'MANAGER' },
    { memberId: 3, name: '이정훈', role: 'MEMBER' },
    { memberId: 4, name: '최현우', role: 'MEMBER' },
    { memberId: 5, name: '한유진', role: 'MEMBER', note: '인턴' },
  ]
  const who = (id: number | null) => (id === null ? null : (members.find((m) => m.memberId === id)?.name ?? null))
  const t = (taskKey: string, title: string, status: SchedStatus, assigneeId: number | null, milestoneId: number | null, s: number | null, e: number | null, checklist: [number, number] | null = null): SchedTask => ({
    taskKey,
    version: 1,
    title,
    status,
    assigneeId,
    assignee: who(assigneeId),
    milestoneId,
    start: s === null ? null : T + s,
    due: e === null ? null : T + e,
    startGuessed: false,
    overdue: e !== null && T + e < T && status !== 'DONE',
    checklist: checklist ? { done: checklist[0], total: checklist[1] } : null,
  })
  const tasks = [
    t('DEFME-41', '로그인 화면 리팩터링 PR #128', 'IN_PROGRESS', 1, 12, -10, -1, [2, 4]),
    t('DEFME-44', 'OIDC 로그아웃 테스트 케이스', 'REVIEW', 2, 12, -7, 1),
    t('DEFME-48', '익명 투표 결과 API 점검', 'TODO', 3, 12, -3, 1),
    t('DEFME-46', 'MinIO 업로드 서명 만료 5분', 'IN_PROGRESS', 2, 12, -2, 6),
    t('DEFME-45', '캘린더 반복 일정 "이후 모두"', 'TODO', 4, 12, 0, 5),
    t('DEFME-47', '알림 종류별 받기 / 안 받기', 'TODO', null, 12, 5, 12),
    t('DEFME-57', '공지 읽음 집계 캐시', 'TODO', 2, 12, -1, 8),
    t('DEFME-50', '운영 가이드 초안', 'TODO', 5, 13, 4, 19),
    t('DEFME-51', '배포 체크리스트 정리', 'TODO', 3, 13, 18, 26),
    t('DEFME-38', 'SSO 동의 화면 문구', 'DONE', 1, 11, -17, -6),
    t('DEFME-55', '간트 · 일정표 화면', 'TODO', 1, 14, 25, 41),
    t('DEFME-56', '프로젝트 설정 · 보관 · 삭제', 'TODO', 1, 14, 32, 50),
    t('DEFME-53', '감사 로그 내보내기 CSV', 'IN_PROGRESS', 3, null, -9, 9),
    t('DEFME-58', '자료실 미리보기 썸네일', 'TODO', 4, null, null, null),
  ]
  const milestones: SchedMilestone[] = [
    { id: 11, name: 'v1.1 — SSO 5단계', start: T - 48, due: T - 2, closed: true, overdue: false, done: 12, total: 12 },
    { id: 12, name: 'v1.2 배포 — 공지 · 캘린더', start: T - 17, due: T + 12, closed: false, overdue: false, done: 9, total: 14 },
    { id: 13, name: '문서화 · 운영 가이드', start: T - 3, due: T + 26, closed: false, overdue: false, done: 3, total: 10 },
    { id: 14, name: 'v1.3 — 프로젝트 화면', start: T + 25, due: T + 57, closed: false, overdue: false, done: 0, total: 6 },
  ]
  return {
    projectKey: key ?? 'DEFME',
    projectStart: T - 79,
    projectEnd: T + 101,
    members,
    milestones,
    tasks,
    canEdit: true,
    supportsStart: true,
  }
}

/** 일정표 데이터 */
export function useSchedule(key: string | undefined) {
  return useResource<ScheduleData>(['schedule', key], () => mockSchedule(key), () => fetchSchedule(key ?? ''))
}

// ───────────────────────── 고치기 ─────────────────────────

type TaskDetailDto = { version: number }

/** 작업 기간 바꾸기 (PATCH /tasks/{key}). 시작일은 서버가 받을 때만 보낸다. 새 version 을 돌려준다 */
export async function saveTaskDates(taskKey: string, version: number, dates: { start: number | null; due: number | null }, withStart: boolean) {
  const body: Record<string, unknown> = { version, dueOn: dates.due === null ? null : dayStr(dates.due) }
  if (withStart) body.startOn = dates.start === null ? null : dayStr(dates.start)
  const r = await api<TaskDetailDto>(`/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body })
  return r.version
}

/** 담당자 바꾸기 (null = 담당 없음) */
export async function saveTaskAssignee(taskKey: string, version: number, assigneeId: number | null) {
  const r = await api<TaskDetailDto>(`/tasks/${encodeURIComponent(taskKey)}`, { method: 'PATCH', body: { version, assigneeMemberId: assigneeId } })
  return r.version
}

// ───────────────────────── 저장한 보기 ─────────────────────────

export type ViewType = 'GANTT' | 'MEMBER' | 'MILESTONE' | 'CALENDAR'
export type ViewScale = 'WEEK' | 'MONTH' | 'QUARTER'
export type ViewFilters = { milestoneId?: number | null; assigneeId?: number | null; hideDone?: boolean }
export type ScheduleView = {
  /** 서버 보기면 숫자, 이 브라우저에만 있으면 'local-…' */
  viewId: number | string
  name: string
  scope: 'PRIVATE' | 'PROJECT'
  viewType: ViewType
  scale: ViewScale
  filters: ViewFilters
  /** 서버에 없어 이 브라우저에만 저장됨 */
  local?: boolean
}
export type NewScheduleView = Omit<ScheduleView, 'viewId' | 'local'>

const localKey = (projectKey: string) => `iturtle.scheduleViews.${projectKey}`
function readLocal(projectKey: string): ScheduleView[] {
  try {
    const raw = localStorage.getItem(localKey(projectKey))
    return raw ? (JSON.parse(raw) as ScheduleView[]).map((v) => ({ ...v, local: true })) : []
  } catch {
    return []
  }
}
function writeLocal(projectKey: string, views: ScheduleView[]) {
  try {
    localStorage.setItem(localKey(projectKey), JSON.stringify(views))
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 창 등)는 이번 화면에서만 기억한다
  }
}
const notFound = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405)

type ViewDto = { viewId: number; name: string; scope: 'PRIVATE' | 'PROJECT'; viewType: ViewType; scale: ViewScale; filters: ViewFilters | null }
const fromDto = (v: ViewDto): ScheduleView => ({ ...v, filters: v.filters ?? {} })

/** 서버 보기 + 이 브라우저에만 있는 보기. 서버가 보기 API 를 아직 안 주면(404) 브라우저 것만 */
export async function listViews(projectKey: string): Promise<{ views: ScheduleView[]; serverSupported: boolean }> {
  const local = readLocal(projectKey)
  if (getDataMode() !== 'live') return { views: local, serverSupported: false }
  try {
    const r = await api<ViewDto[] | { views: ViewDto[] }>(`/projects/${encodeURIComponent(projectKey)}/views`)
    const list = Array.isArray(r) ? r : (r.views ?? [])
    return { views: [...list.map(fromDto), ...local], serverSupported: true }
  } catch (e) {
    if (notFound(e)) return { views: local, serverSupported: false }
    throw e
  }
}

export async function createView(projectKey: string, view: NewScheduleView, serverSupported: boolean): Promise<ScheduleView> {
  if (serverSupported && getDataMode() === 'live') {
    try {
      return fromDto(await api<ViewDto>(`/projects/${encodeURIComponent(projectKey)}/views`, { method: 'POST', body: view }))
    } catch (e) {
      if (!notFound(e)) throw e
    }
  }
  // 브라우저에만 남기는 보기는 '나만' 으로 둔다 (다른 사람에게 보일 수 없다)
  const saved: ScheduleView = { ...view, scope: 'PRIVATE', viewId: `local-${Date.now()}`, local: true }
  writeLocal(projectKey, [...readLocal(projectKey), saved])
  return saved
}

export async function deleteView(projectKey: string, view: ScheduleView) {
  if (view.local) {
    writeLocal(projectKey, readLocal(projectKey).filter((v) => v.viewId !== view.viewId))
    return
  }
  await api<void>(`/projects/${encodeURIComponent(projectKey)}/views/${view.viewId}`, { method: 'DELETE' })
}
