// 작업 만들기 · 작업 목록 API — 백엔드 TaskController (POST /tasks, GET /tasks, PATCH /tasks 일괄 변경, POST /tasks/{key}/checklist-items)
// · MilestoneController (GET /projects/{key}/milestones) · ProjectLabelController (GET /projects/{key}/labels) 를 쓴다.
import { useEffect } from 'react'
import { api, serverRoot } from './client'
import type { MemberRef } from './types'
import { useResource } from './useResource'
import { appendUnique, mergeNext, NOT_PAGED, pagedOf, type Paged } from './useLoadMore'
import { getDataMode } from '../lib/dataMode'
import { getProject, toMembers, toTask, type BoardTask, type TaskCardDto, type TaskListResponse } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { findProject } from '../mocks/projects'
import { tasks as mockTasks, TYPE_NAME, type TaskPriority, type TaskStatus, type TaskType } from '../mocks/tasks'
import { mockTagsOf } from './memberTags'

const MOCK_ME = '김민서'

// ───────────────────────── 작업이 바뀌었다는 알림 (보드 · 목록 새로고침) ─────────────────────────

const CHANGED = 'iturtle:tasks-changed'
const OPEN_CREATE = 'iturtle:task-create'

/** 작업을 만들거나 바꾼 뒤 부른다. 보드 · 작업 목록이 다시 불러온다 */
export const notifyTasksChanged = () => window.dispatchEvent(new Event(CHANGED))

/** 작업이 바뀌면 reload 를 부른다 */
export function useTasksChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGED, reload)
    return () => window.removeEventListener(CHANGED, reload)
  }, [reload])
}

export type TaskCreateOpen = { initialStatus?: 'TODO' | 'IN_PROGRESS' }

/** 어느 화면에서든 작업 만들기 창을 연다 (ProjectLayout 이 창을 갖고 있다) */
export const openTaskCreate = (detail: TaskCreateOpen = {}) => window.dispatchEvent(new CustomEvent<TaskCreateOpen>(OPEN_CREATE, { detail }))

export function useTaskCreateRequests(open: (d: TaskCreateOpen) => void) {
  useEffect(() => {
    const on = (e: Event) => open((e as CustomEvent<TaskCreateOpen>).detail ?? {})
    window.addEventListener(OPEN_CREATE, on)
    return () => window.removeEventListener(OPEN_CREATE, on)
  }, [open])
}

// ───────────────────────── 작업 만들기 창에 쓰는 고를 거리 ─────────────────────────

export type Option = { id: number; name: string }
/** 담당 후보: 맡은 일 태그로 찾을 수 있게 (ERP-14) */
/** photoUrl: 프로필 사진 (없으면 이름 첫 글자 동그라미), role: 프로젝트 안 역할 */
/** 서버가 준 '/api/v1/files/…' 주소를 API 서버 기준으로 (admin.ts 의 resolveUrl 과 같다) */
const fileUrl = (u: string | null | undefined) => (u ? (u.startsWith('/') ? serverRoot() + u : u) : null)

export type MemberOption = Option & { tags: string[]; photoUrl?: string | null; role?: 'MANAGER' | 'MEMBER' }
export type LabelOption = Option & { color: string }
/** 공통코드 TASK_TYPE (GET /codes/TASK_TYPE) */
export type TypeOption = { code: string; name: string; icon: string | null }
export type TaskFormOptions = {
  projectKey: string
  projectName: string
  me: Option
  members: MemberOption[]
  milestones: Option[]
  labels: LabelOption[]
  types: TypeOption[]
  canWrite: boolean
  isManager: boolean
}

type MilestoneListDto = { milestones: { milestoneId: number; name: string; status: 'OPEN' | 'CLOSED' }[] }
type LabelListDto = { labels: { labelId: number; name: string; color: string; taskCount: number }[] }

export function useTaskFormOptions(key: string | undefined, enabled = true) {
  return useResource<TaskFormOptions | null>(
    ['task-form', key, enabled],
    () => {
      const p = findProject(key)
      const members = projectDetail.members.map((m, i) => ({ id: i + 1, name: m.name, tags: mockTagsOf(m.name), role: m.role }))
      return {
        projectKey: p.projectKey,
        projectName: p.name,
        me: members.find((m) => m.name === MOCK_ME) ?? members[0],
        members,
        milestones: projectDetail.milestones.filter((m) => !m.closed).map((m) => ({ id: m.id, name: m.name })),
        labels: ['알림', '프로필', '공지', '캘린더', '보안'].map((name, i) => ({ id: i + 1, name, color: '#80AAD3' })),
        types: (Object.keys(TYPE_NAME) as TaskType[]).map((code) => ({ code, name: TYPE_NAME[code], icon: null })),
        canWrite: true,
        isManager: true,
      }
    },
    async () => {
      if (!enabled || !key) return null
      const k = encodeURIComponent(key)
      const [d, me, ms, ls, types] = await Promise.all([
        getProject(key),
        api<MemberRef>('/members/me'),
        api<MilestoneListDto>(`/projects/${k}/milestones`),
        api<LabelListDto>(`/projects/${k}/labels`),
        api<TypeOption[]>('/codes/TASK_TYPE'),
      ])
      return {
        projectKey: d.projectKey,
        projectName: d.name,
        me: { id: me.memberId, name: me.name },
        members: toMembers(d).map((m) => ({ id: m.memberId, name: m.name, tags: m.tags ?? [], photoUrl: fileUrl(m.photoUrl), role: m.role })),
        milestones: ms.milestones.filter((m) => m.status === 'OPEN').map((m) => ({ id: m.milestoneId, name: m.name })),
        labels: ls.labels.map((l) => ({ id: l.labelId, name: l.name, color: l.color })),
        types,
        canWrite: d.permissions.canWriteTasks,
        isManager: d.permissions.canManage,
      }
    },
  )
}

// ───────────────────────── 작업 만들기 ─────────────────────────

export type TaskDraft = {
  projectKey: string
  title: string
  description: string
  typeCode: string
  priority: TaskPriority
  assigneeMemberId: number | null
  startOn: string | null
  dueOn: string | null
  milestoneId: number | null
  labelIds: number[]
  checklist: string[]
  initialStatus: 'TODO' | 'IN_PROGRESS'
}

/** POST /tasks — 처음 상태 · 체크리스트 · 시작일까지 한 번에 만든다 (P103 담당자 없음 · P105 권한 · P121 체크리스트 50개 · P128 기간) */
export async function createTask(draft: TaskDraft): Promise<{ taskKey: string }> {
  if (getDataMode() !== 'live') {
    const no = Math.max(...mockTasks.map((t) => Number(t.taskKey.split('-')[1]) || 0)) + 1
    return { taskKey: `${draft.projectKey}-${no}` }
  }
  const created = await api<TaskCardDto>('/tasks', {
    method: 'POST',
    body: {
      projectKey: draft.projectKey,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      typeCode: draft.typeCode,
      priority: draft.priority,
      assigneeMemberId: draft.assigneeMemberId,
      startOn: draft.startOn,
      dueOn: draft.dueOn,
      labelIds: draft.labelIds,
      milestoneId: draft.milestoneId,
      initialStatus: draft.initialStatus,
      checklist: draft.checklist.map((c) => c.trim()).filter(Boolean),
    },
  })
  return { taskKey: created.taskKey }
}

// ───────────────────────── 작업 목록 ─────────────────────────

export type TaskSort = 'dueOn' | 'priority' | 'updatedAt,desc' | 'taskNo,desc'
export type TaskListFilter = {
  statuses: TaskStatus[]
  assigneeId: number | null
  labelId: number | null
  milestoneId: number | null
  priorities: TaskPriority[]
  typeCodes: string[]
  keyword: string
  sort: TaskSort
  showDone: boolean
  /** 목업에서 거를 때 쓰는 이름 (목업 작업에는 id 가 없다) */
  names?: { assignee?: string; label?: string; milestone?: string }
}

export type TaskRow = BoardTask
export type TaskListData = { rows: TaskRow[]; doneHidden: number; total: number } & Paged

/** 작업 목록 한 페이지 크기 (정책 ERP-P32 의 기본값) */
const TASK_PAGE_SIZE = 20

/** 작업 목록 조건 → GET /tasks 쿼리 (첫 페이지와 다음 페이지가 같은 조건을 쓴다) */
const taskListQuery = (key: string | undefined, f: TaskListFilter, page: number) => {
  const statuses = f.statuses.length ? f.statuses : OPEN_STATUSES
  return {
    projectKey: key ?? '',
    statuses: (f.showDone ? [...statuses, 'DONE'] : statuses).join(','),
    assigneeId: f.assigneeId ?? undefined,
    labelIds: f.labelId ?? undefined,
    milestoneId: f.milestoneId ?? undefined,
    priorities: f.priorities.length ? f.priorities.join(',') : undefined,
    typeCodes: f.typeCodes.length ? f.typeCodes.join(',') : undefined,
    // 서버는 검색어 2자 이상만 받는다
    keyword: f.keyword.trim().length >= 2 ? f.keyword.trim() : undefined,
    doneWithinDays: f.showDone ? 365 : undefined,
    sort: f.sort === 'dueOn' ? undefined : f.sort,
    page,
    size: TASK_PAGE_SIZE,
  }
}

/** 작업 목록의 다음 페이지 (useLoadMore 에 넘긴다) */
export const fetchMoreTasks = (key: string | undefined, f: TaskListFilter, d: TaskListData) =>
  api<TaskListResponse>('/tasks', { query: taskListQuery(key, f, d.page + 1) }).then((list) =>
    mergeNext(d, (cur) => ({
      ...cur,
      rows: appendUnique(cur.rows, list.page.content.map(toTask), (t) => t.taskKey),
      total: list.page.totalElements,
      ...pagedOf(list.page),
    })),
  )

const OPEN_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW']

/** 'M/D' 기한(목업) 정렬용 */
const mockDueKey = (d: string | null) => {
  if (!d || !/^\d+\/\d+$/.test(d)) return d ? -1 : Number.MAX_SAFE_INTEGER
  const [m, day] = d.split('/').map(Number)
  return m * 100 + day
}
const PRIORITY_ORDER: TaskPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']

export function useTaskList(key: string | undefined, f: TaskListFilter) {
  return useResource<TaskListData>(
    ['tasks', key, { ...f, names: undefined }, f.names],
    () => {
      const statuses = f.showDone ? [...f.statuses, 'DONE' as TaskStatus] : f.statuses
      const kw = f.keyword.trim().toLowerCase()
      let rows = mockTasks.filter(
        (t) =>
          (!statuses.length || statuses.includes(t.status)) &&
          (!f.priorities.length || f.priorities.includes(t.priority)) &&
          (!f.typeCodes.length || f.typeCodes.includes(t.type)) &&
          (!kw || t.title.toLowerCase().includes(kw) || t.taskKey.toLowerCase().includes(kw)) &&
          (!f.names?.assignee || t.assignee === f.names.assignee) &&
          (!f.names?.label || t.labels.includes(f.names.label)) &&
          (!f.names?.milestone || t.milestone === f.names.milestone),
      )
      if (f.sort === 'priority') rows = [...rows].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
      else if (f.sort === 'taskNo,desc') rows = [...rows].sort((a, b) => b.taskKey.localeCompare(a.taskKey, undefined, { numeric: true }))
      else if (f.sort === 'dueOn') rows = [...rows].sort((a, b) => mockDueKey(a.dueOn) - mockDueKey(b.dueOn))
      const doneHidden = f.showDone ? 0 : mockTasks.filter((t) => t.status === 'DONE').length
      return { rows, doneHidden, total: rows.length, ...NOT_PAGED }
    },
    async () => {
      // 첫 페이지만. 다음 페이지는 fetchMoreTasks 가 이어 붙인다
      const [list, done] = await Promise.all([
        api<TaskListResponse>('/tasks', { query: taskListQuery(key, f, 0) }),
        f.showDone
          ? Promise.resolve(null)
          : api<TaskListResponse>('/tasks', { query: { projectKey: key ?? '', statuses: 'DONE', doneWithinDays: 365, size: 1 } }),
      ])
      return {
        rows: list.page.content.map(toTask),
        doneHidden: done?.page.totalElements ?? 0,
        total: list.page.totalElements,
        ...pagedOf(list.page),
      }
    },
  )
}

export type BulkChange = {
  assigneeMemberId?: number | null
  milestoneId?: number | null
  priority?: TaskPriority
  status?: TaskStatus | 'CANCELLED'
  reason?: string
  labelIdsToAdd?: number[]
  labelIdsToRemove?: number[]
}
export type BulkFailure = { taskKey: string; code: string; message: string }

/**
 * PATCH /tasks — 고른 작업을 한 번에 바꾼다. 상태는 작업마다 이동 규칙을 따져서 못 옮긴 작업은 failures 로 온다 (나머지는 반영).
 */
export async function bulkUpdateTasks(taskKeys: string[], change: BulkChange): Promise<BulkFailure[]> {
  if (getDataMode() !== 'live') return []
  const r = await api<{ tasks: TaskCardDto[]; failures: BulkFailure[] | null }>('/tasks', { method: 'PATCH', body: { taskKeys, ...change } })
  return r.failures ?? []
}

// ───────────────────────── 작업 번호 찾기 (T-13) ─────────────────────────

/** TaskLookupItemResponse — 볼 수 있는 작업만 온다 */
export type TaskLookupItem = { taskId: number; taskKey: string; title: string; status: TaskStatus | 'CANCELLED'; projectKey: string }

/** 작업 번호 모양 (DEFME-12). 프로젝트 키 규칙은 projectSettings KEY_PATTERN 과 같다 */
export const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-\d+$/

/** 작업 번호 여러 개를 찾는다 (GET /tasks/lookup). 없거나 볼 수 없는 번호는 빠진다. 목업이면 목업 작업에서 */
export async function lookupTasks(keys: string[]): Promise<TaskLookupItem[]> {
  if (getDataMode() !== 'live') {
    return mockTasks
      .filter((t) => keys.includes(t.taskKey))
      .map((t, i) => ({ taskId: i + 1, taskKey: t.taskKey, title: t.title, status: t.status, projectKey: t.taskKey.replace(/-\d+$/, '') }))
  }
  const r = await api<{ tasks: TaskLookupItem[] }>('/tasks/lookup', { query: { keys: keys.join(',') } })
  return r.tasks
}
