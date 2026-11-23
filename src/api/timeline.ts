// 일정표 · 마일스톤 — docs/api/31-task.md T-1, 30-project.md P-28 ~ P-30, 20-communication.md CL-1
import { api } from './client'
import type { MemberRef } from './types'
import { invalidateAll, useResource } from './useResource'
import { addDaysYmd, kstHm, kstYmd } from './communication'
import { getProject, MOCK_ME, todayKst, toMembers, type TaskListResponse } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { findProject } from '../mocks/projects'
import type { TaskStatus } from '../mocks/tasks'
import {
  timelineEvents as mockEvents,
  timelineMilestones as mockMilestones,
  timelineTasks as mockTasks,
  type TimelineEvent,
  type TimelineMilestone,
  type TimelineTask,
} from '../mocks/timeline'

export type TimelineMember = { name: string; role: string }
export type TimelineData = {
  tasks: TimelineTask[]
  milestones: TimelineMilestone[]
  events: TimelineEvent[]
  members: TimelineMember[]
  projectKey: string
  projectName: string
  me: string
  canManage: boolean
}

type MilestoneDto = {
  milestoneId: number
  name: string
  description: string | null
  dueOn: string | null
  status: 'OPEN' | 'CLOSED'
  progress: { done: number; total: number }
  openTaskCount: number
}

const roleName = (role: string, note?: string) => (role === 'MANAGER' ? '프로젝트 관리자' : '참여자') + (note ? ` · ${note}` : '')

/** 일정표: 작업(T-1) + 마일스톤(P-28) + 프로젝트 일정(CL-1) + 참여자(P-3) */
export function useTimeline(key: string | undefined) {
  return useResource<TimelineData>(
    ['timeline', key],
    () => {
      const p = findProject(key)
      return {
        tasks: mockTasks,
        milestones: mockMilestones,
        events: mockEvents,
        members: projectDetail.members.map((m) => ({ name: m.name, role: roleName(m.role, m.note) })),
        projectKey: p.projectKey,
        projectName: p.name,
        me: MOCK_ME,
        canManage: true,
      }
    },
    async () => {
      const k = encodeURIComponent(key ?? '')
      const today = todayKst()
      const [d, me, ms, cards] = await Promise.all([
        getProject(key ?? ''),
        api<MemberRef>('/members/me'),
        api<{ milestones: MilestoneDto[] }>(`/projects/${k}/milestones`),
        fetchTasks(key ?? ''),
      ])
      // 프로젝트 일정은 앞뒤 45일 (CL-1 은 한 번에 92일까지)
      const occ = await api<{ occurrences: { eventId: number; title?: string; allDay: boolean; startsAt: string; startsOn?: string }[] }>(
        '/calendar-events',
        { query: { from: addDaysYmd(today, -45), to: addDaysYmd(today, 45), projectId: d.projectId, layers: 'SHARED' } },
      ).catch(() => ({ occurrences: [] }))

      const tasks: TimelineTask[] = cards.map((c) => ({
        taskKey: c.taskKey,
        title: c.title,
        status: c.status as TaskStatus,
        assignee: c.assignee?.name ?? null,
        milestoneId: c.milestone?.milestoneId ?? null,
        // 명세 확인 필요: 작업에 시작일이 없다. 기한 6일 전부터로 그린다 (간트 막대 길이는 참고용)
        startOn: c.dueOn ? addDaysYmd(c.dueOn, -6) : null,
        dueOn: c.dueOn,
        checklist: c.checklist.total > 0 ? c.checklist : null,
      }))
      const count = (id: number) => {
        const of = tasks.filter((t) => t.milestoneId === id)
        return {
          todo: of.filter((t) => t.status === 'TODO').length,
          doing: of.filter((t) => t.status === 'IN_PROGRESS').length,
          review: of.filter((t) => t.status === 'REVIEW').length,
        }
      }
      // 명세 확인 필요: 마일스톤에도 시작일이 없다. 앞 마일스톤 기한 다음 날부터, 없으면 기한 30일 전부터로 그린다
      const byDue = [...ms.milestones].filter((m) => m.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))
      const startOf = (m: MilestoneDto) => {
        if (!m.dueOn) return null
        const prev = byDue[byDue.indexOf(m) - 1]
        return prev?.dueOn ? addDaysYmd(prev.dueOn, 1) : addDaysYmd(m.dueOn, -30)
      }
      return {
        tasks,
        milestones: ms.milestones.map((m) => ({
          id: m.milestoneId,
          name: m.name,
          description: m.description ?? undefined,
          startOn: startOf(m),
          dueOn: m.dueOn,
          closed: m.status === 'CLOSED',
          counts: { ...count(m.milestoneId), done: m.progress.done },
        })),
        events: occ.occurrences.map((o, i) => ({
          id: `${o.eventId}-${i}`,
          date: o.startsOn ?? kstYmd(o.startsAt),
          time: o.allDay ? undefined : kstHm(o.startsAt),
          title: o.title ?? '일정',
        })),
        members: toMembers(d).map((m) => ({ name: m.name, role: roleName(m.role, m.note) })),
        projectKey: d.projectKey,
        projectName: d.name,
        me: me.name,
        canManage: d.permissions.canManage,
      }
    },
  )
}

async function fetchTasks(projectKey: string) {
  const out: TaskListResponse['page']['content'] = []
  for (let page = 0; page < 20; page++) {
    const r = await api<TaskListResponse>('/tasks', { query: { projectKey, doneWithinDays: 60, size: 100, page } })
    out.push(...r.page.content)
    if (!r.page.hasNext) break
  }
  return out
}

/* ---------- 마일스톤 만들기 (P-29) · 닫기 (P-30) ---------- */

export type MilestoneDraft = { name: string; description: string; startOn: string; dueOn: string; taskKeys: string[] }

/** 마일스톤을 만들고(P-29) 고른 작업을 묶는다(T-5) */
export async function createMilestone(projectKey: string, d: MilestoneDraft) {
  const made = await api<MilestoneDto>(`/projects/${encodeURIComponent(projectKey)}/milestones`, {
    method: 'POST',
    // 명세 확인 필요: 디자인의 "시작일"은 P-29 에 없어 보내지 않는다
    body: { name: d.name, description: d.description || undefined, dueOn: d.dueOn || undefined },
  })
  if (d.taskKeys.length) await api('/tasks', { method: 'PATCH', body: { taskKeys: d.taskKeys, milestoneId: made.milestoneId } })
  invalidateAll()
  return made.milestoneId
}

export function addMockMilestone(d: MilestoneDraft) {
  const id = Math.max(...mockMilestones.map((m) => m.id)) + 1
  mockMilestones.push({
    id,
    name: d.name,
    description: d.description || undefined,
    startOn: d.startOn || (d.dueOn ? addDaysYmd(d.dueOn, -30) : null),
    dueOn: d.dueOn || null,
    closed: false,
    counts: { todo: d.taskKeys.length, doing: 0, review: 0, done: 0 },
  })
  mockTasks.forEach((t) => {
    if (d.taskKeys.includes(t.taskKey)) t.milestoneId = id
  })
  projectDetail.milestones.push({ id, name: d.name, done: 0, total: d.taskKeys.length, due: d.dueOn ? `${Number(d.dueOn.slice(5, 7))}/${Number(d.dueOn.slice(8, 10))}` : '', closed: false, soon: false })
  invalidateAll()
  return id
}

/** 닫기 · 다시 열기 (P-30). 닫을 때 남은 작업은 마일스톤 없음으로 둔다 */
export async function setMilestoneClosed(projectKey: string, m: TimelineMilestone, closed: boolean, live: boolean) {
  if (live) {
    const open = m.counts.todo + m.counts.doing + m.counts.review
    await api(`/projects/${encodeURIComponent(projectKey)}/milestones/${m.id}`, {
      method: 'PATCH',
      body: { status: closed ? 'CLOSED' : 'OPEN', openTasks: closed && open > 0 ? { action: 'CLEAR' } : undefined },
    })
  } else m.closed = closed
  invalidateAll()
}
