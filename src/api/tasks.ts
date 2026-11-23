// 작업 목록 · 만들기 · 내 작업 — docs/api/31-task.md T-1, T-2, T-5, T-7, T-8
import { api } from './client'
import type { MemberRef } from './types'
import { invalidateAll, useResource } from './useResource'
import { getProject, MOCK_ME, monthDay, toMembers, toTask, type BoardTask, type TaskListResponse } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { projectLabels as mockLabels } from '../mocks/projectLabels'
import { findProject } from '../mocks/projects'
import { tasks as mockTasks, type Task, type TaskPriority, type TaskStatus, type TaskType } from '../mocks/tasks'

export type ListTask = BoardTask
export type Option = { id: number; name: string }
export type TaskListData = {
  /** 취소를 뺀 모든 작업 (완료 포함). 거르기는 화면이 한다 */
  tasks: ListTask[]
  members: Option[]
  labels: (Option & { color: string })[]
  milestones: (Option & { closed: boolean })[]
  projectKey: string
  projectName: string
  me: string
  meId: number
  canWrite: boolean
}

const mockMembers = (): Option[] => projectDetail.members.map((m, i) => ({ id: i + 1, name: m.name }))

/** 작업 목록 (T-1) + 만들기 · 거르기에 쓰는 참여자 · 라벨 · 마일스톤 (P-3, P-24, P-28) */
export function useTaskList(key: string | undefined) {
  return useResource<TaskListData>(
    ['task-list', key],
    () => {
      const p = findProject(key)
      return {
        tasks: mockTasks,
        members: mockMembers(),
        labels: mockLabels.map((l) => ({ id: l.labelId, name: l.name, color: l.color })),
        milestones: projectDetail.milestones.map((m) => ({ id: m.id, name: m.name, closed: m.closed })),
        projectKey: p.projectKey,
        projectName: p.name,
        me: MOCK_ME,
        meId: 1,
        canWrite: true,
      }
    },
    async () => {
      const k = encodeURIComponent(key ?? '')
      const [d, me, labels, milestones, cards] = await Promise.all([
        getProject(key ?? ''),
        api<MemberRef>('/members/me'),
        api<{ labels: { labelId: number; name: string; color: string }[] }>(`/projects/${k}/labels`),
        api<{ milestones: { milestoneId: number; name: string; status: string }[] }>(`/projects/${k}/milestones`),
        fetchAllTasks({ projectKey: key ?? '', sort: 'taskNo,desc' }),
      ])
      return {
        tasks: cards.map(toTask),
        members: toMembers(d).map((m) => ({ id: m.memberId, name: m.name })),
        labels: labels.labels.map((l) => ({ id: l.labelId, name: l.name, color: l.color })),
        milestones: milestones.milestones.map((m) => ({ id: m.milestoneId, name: m.name, closed: m.status === 'CLOSED' })),
        projectKey: d.projectKey,
        projectName: d.name,
        me: me.name,
        meId: me.memberId,
        canWrite: d.permissions.canWriteTasks,
      }
    },
  )
}

/** size=100 으로 끝까지 (T-1). 완료도 모두 받는다 */
async function fetchAllTasks(query: Record<string, string | number | boolean | undefined>) {
  const out: TaskListResponse['page']['content'] = []
  for (let page = 0; page < 20; page++) {
    const r = await api<TaskListResponse>('/tasks', { query: { ...query, size: 100, page } })
    out.push(...r.page.content)
    if (!r.page.hasNext) break
  }
  return out
}

/* ---------- 만들기 (T-2) ---------- */

export type TaskDraft = {
  title: string
  description: string
  type: TaskType
  priority: TaskPriority
  assigneeId: number | null
  /** 'YYYY-MM-DD' */
  dueOn: string
  milestoneId: number | null
  labelIds: number[]
  status: 'TODO' | 'IN_PROGRESS'
  checklist: string[]
}

/** 실서버: 작업을 만들고(T-2) 체크리스트(T-8) · 처음 상태(T-7)를 이어서 넣는다. 만든 작업 번호를 돌려준다 */
export async function createTask(projectKey: string, d: TaskDraft) {
  const made = await api<{ taskKey: string; version: number }>('/tasks', {
    method: 'POST',
    body: {
      projectKey,
      title: d.title,
      description: d.description || undefined,
      typeCode: d.type,
      priority: d.priority,
      assigneeMemberId: d.assigneeId ?? undefined,
      dueOn: d.dueOn || undefined,
      labelIds: d.labelIds,
      milestoneId: d.milestoneId ?? undefined,
    },
  })
  // 명세 확인 필요: T-2 본문에 체크리스트 · 처음 상태가 없어 만든 뒤 따로 부른다
  for (const content of d.checklist) await api(`/tasks/${made.taskKey}/checklist-items`, { method: 'POST', body: { content } })
  if (d.status === 'IN_PROGRESS')
    await api(`/tasks/${made.taskKey}/transition`, { method: 'POST', body: { toStatus: 'IN_PROGRESS', version: made.version } })
  invalidateAll()
  return made.taskKey
}

/** 목업: 작업 목록 · 보드에 바로 보이게 목업 배열에 더한다 */
export function addMockTask(data: TaskListData, d: TaskDraft) {
  const no = Math.max(...mockTasks.map((t) => Number(t.taskKey.split('-')[1]) || 0)) + 1
  const taskKey = `${data.projectKey}-${no}`
  const task: Task = {
    taskKey,
    title: d.title,
    type: d.type,
    status: d.status,
    priority: d.priority,
    labels: data.labels.filter((l) => d.labelIds.includes(l.id)).map((l) => l.name),
    milestone: data.milestones.find((m) => m.id === d.milestoneId)?.name ?? null,
    dueOn: d.dueOn ? monthDay(d.dueOn) : null,
    checklist: d.checklist.length ? { done: 0, total: d.checklist.length } : null,
    commentCount: 0,
    assignee: data.members.find((m) => m.id === d.assigneeId)?.name ?? null,
    requester: data.me,
  }
  mockTasks.unshift(task)
  invalidateAll()
  return taskKey
}

/* ---------- 일괄 변경 (T-5) ---------- */

/** 여러 작업의 담당자를 한 번에 (T-5). 상태는 작업마다 T-7 로 옮긴다 */
export async function bulkAssign(tasks: ListTask[], assigneeMemberId: number | null) {
  await api('/tasks', {
    method: 'PATCH',
    body: { taskKeys: tasks.map((t) => t.taskKey), assigneeMemberId },
  })
  invalidateAll()
}
export async function bulkTransition(tasks: ListTask[], toStatus: TaskStatus) {
  for (const t of tasks) await api(`/tasks/${t.taskKey}/transition`, { method: 'POST', body: { toStatus, version: t.version } })
  invalidateAll()
}
