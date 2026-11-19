// 작업 만들기 · 작업 목록 API — 백엔드 TaskController (POST /tasks, GET /tasks, PATCH /tasks 일괄 변경, POST /tasks/{key}/checklist-items)
// · MilestoneController (GET /projects/{key}/milestones) · ProjectLabelController (GET /projects/{key}/labels) 를 쓴다.
import { useEffect } from 'react'
import { api } from './client'
import type { MemberRef } from './types'
import { useResource } from './useResource'
import { getDataMode } from '../lib/dataMode'
import { getProject, toMembers, toTask, transitionTask, type BoardTask, type TaskCardDto, type TaskListResponse } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { findProject } from '../mocks/projects'
import { tasks as mockTasks, type TaskPriority, type TaskStatus, type TaskType } from '../mocks/tasks'

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
export type LabelOption = Option & { color: string }
export type TaskFormOptions = {
  projectKey: string
  projectName: string
  me: Option
  members: Option[]
  milestones: Option[]
  labels: LabelOption[]
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
      const members = projectDetail.members.map((m, i) => ({ id: i + 1, name: m.name }))
      return {
        projectKey: p.projectKey,
        projectName: p.name,
        me: members.find((m) => m.name === MOCK_ME) ?? members[0],
        members,
        milestones: projectDetail.milestones.filter((m) => !m.closed).map((m) => ({ id: m.id, name: m.name })),
        labels: ['알림', '프로필', '공지', '캘린더', '보안'].map((name, i) => ({ id: i + 1, name, color: '#80AAD3' })),
        canWrite: true,
        isManager: true,
      }
    },
    async () => {
      if (!enabled || !key) return null
      const k = encodeURIComponent(key)
      const [d, me, ms, ls] = await Promise.all([
        getProject(key),
        api<MemberRef>('/members/me'),
        api<MilestoneListDto>(`/projects/${k}/milestones`),
        api<LabelListDto>(`/projects/${k}/labels`),
      ])
      return {
        projectKey: d.projectKey,
        projectName: d.name,
        me: { id: me.memberId, name: me.name },
        members: toMembers(d).map((m) => ({ id: m.memberId, name: m.name })),
        milestones: ms.milestones.filter((m) => m.status === 'OPEN').map((m) => ({ id: m.milestoneId, name: m.name })),
        labels: ls.labels.map((l) => ({ id: l.labelId, name: l.name, color: l.color })),
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
  typeCode: TaskType
  priority: TaskPriority
  assigneeMemberId: number | null
  dueOn: string | null
  milestoneId: number | null
  labelIds: number[]
  checklist: string[]
  initialStatus: 'TODO' | 'IN_PROGRESS'
}

export type CreateResult = { taskKey: string; warnings: string[] }

/**
 * POST /tasks 로 만들고, 체크리스트 항목을 하나씩 더하고, 처음 상태가 진행 중이면 상태를 옮긴다.
 * 만들기 요청에는 체크리스트 · 처음 상태가 없어서 이어서 부른다. 뒤 단계가 실패해도 작업은 만들어진 것이라 경고로 알린다.
 */
export async function createTask(draft: TaskDraft): Promise<CreateResult> {
  if (getDataMode() !== 'live') {
    const no = Math.max(...mockTasks.map((t) => Number(t.taskKey.split('-')[1]) || 0)) + 1
    return { taskKey: `${draft.projectKey}-${no}`, warnings: [] }
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
      dueOn: draft.dueOn,
      labelIds: draft.labelIds,
      milestoneId: draft.milestoneId,
    },
  })
  const warnings: string[] = []
  const items = draft.checklist.map((c) => c.trim()).filter(Boolean)
  let failedItems = 0
  for (const content of items) {
    try {
      await api(`/tasks/${encodeURIComponent(created.taskKey)}/checklist-items`, { method: 'POST', body: { content } })
    } catch {
      failedItems++
    }
  }
  if (failedItems) warnings.push(`체크리스트 ${failedItems}개를 넣지 못했어요. 작업 상세에서 다시 넣어 주세요.`)
  if (draft.initialStatus === 'IN_PROGRESS' && draft.assigneeMemberId) {
    try {
      await transitionTask(created.taskKey, { toStatus: 'IN_PROGRESS', version: created.version })
    } catch {
      warnings.push('진행 중으로 옮기지 못해 할 일로 만들었어요. 담당자나 프로젝트 관리자가 옮길 수 있어요.')
    }
  }
  return { taskKey: created.taskKey, warnings }
}

// ───────────────────────── 작업 목록 ─────────────────────────

export type TaskSort = 'dueOn' | 'priority' | 'updatedAt,desc' | 'taskNo,desc'
export type TaskListFilter = {
  statuses: TaskStatus[]
  assigneeId: number | null
  labelId: number | null
  milestoneId: number | null
  priorities: TaskPriority[]
  typeCodes: TaskType[]
  keyword: string
  sort: TaskSort
  showDone: boolean
  /** 목업에서 거를 때 쓰는 이름 (목업 작업에는 id 가 없다) */
  names?: { assignee?: string; label?: string; milestone?: string }
}

export type TaskRow = BoardTask & { dueIso: string | null }
export type TaskListData = { rows: TaskRow[]; doneHidden: number; total: number }

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
      return { rows: rows.map((r) => ({ ...r, dueIso: null })), doneHidden, total: rows.length }
    },
    async () => {
      const statuses = f.statuses.length ? f.statuses : OPEN_STATUSES
      const query = {
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
        size: 100,
      }
      const [list, done] = await Promise.all([
        api<TaskListResponse>('/tasks', { query }),
        f.showDone
          ? Promise.resolve(null)
          : api<TaskListResponse>('/tasks', { query: { projectKey: key ?? '', statuses: 'DONE', doneWithinDays: 365, size: 1 } }),
      ])
      return {
        rows: list.page.content.map((x) => ({ ...toTask(x), dueIso: x.dueOn })),
        doneHidden: done?.page.totalElements ?? 0,
        total: list.page.totalElements,
      }
    },
  )
}

/** PATCH /tasks — 고른 작업의 담당자 · 마일스톤 · 우선순위를 한 번에 바꾼다 (상태는 일괄 변경이 없다) */
export async function bulkUpdateTasks(
  taskKeys: string[],
  change: { assigneeMemberId?: number | null; milestoneId?: number | null; priority?: TaskPriority },
) {
  if (getDataMode() !== 'live') return
  await api('/tasks', { method: 'PATCH', body: { taskKeys, ...change } })
}
