// 마일스톤 탭 (P-28 목록 · P-29 만들기). 디자인: 06 Screens · 추가 › Screen · 마일스톤 만들기
import { useEffect } from 'react'
import { getDataMode } from '../lib/dataMode'
import { projectDetail } from '../mocks/projectDetail'
import { tasks as mockTasks } from '../mocks/tasks'
import { api } from './client'
import { getProject, type TaskListResponse } from './projects'
import { useResource } from './useResource'

// ───────────────────────── 창 열기 · 바뀜 알림 ─────────────────────────

const OPEN = 'iturtle:milestone-create'
const CHANGED = 'iturtle:milestones-changed'

export const openMilestoneCreate = () => window.dispatchEvent(new Event(OPEN))

export function useMilestoneCreateRequests(open: () => void) {
  useEffect(() => {
    window.addEventListener(OPEN, open)
    return () => window.removeEventListener(OPEN, open)
  }, [open])
}

export const notifyMilestonesChanged = () => window.dispatchEvent(new Event(CHANGED))

export function useMilestonesChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGED, reload)
    return () => window.removeEventListener(CHANGED, reload)
  }, [reload])
}

// ───────────────────────── 목록 ─────────────────────────

export type MilestoneRow = {
  id: number
  name: string
  description: string
  startOn: string | null
  dueOn: string | null
  closed: boolean
  overdue: boolean
  done: number
  total: number
  openTasks: number
}
export type MilestoneList = { rows: MilestoneRow[]; canManage: boolean }

type MilestoneDto = {
  milestoneId: number
  name: string
  description: string | null
  startOn: string | null
  dueOn: string | null
  status: 'OPEN' | 'CLOSED'
  overdue: boolean
  progress: { done: number; total: number; ratio: number }
  openTaskCount: number
}

const mockDue = (md: string) => `2026-${md.split('/').map((x) => x.padStart(2, '0')).join('-')}`

export function useMilestones(key: string | undefined) {
  return useResource<MilestoneList>(
    ['milestones', key],
    () => ({
      rows: projectDetail.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        description: '',
        startOn: null,
        dueOn: mockDue(m.due),
        closed: m.closed,
        overdue: false,
        done: m.done,
        total: m.total,
        openTasks: m.total - m.done,
      })),
      canManage: true,
    }),
    async () => {
      const k = encodeURIComponent(key ?? '')
      const [d, list] = await Promise.all([getProject(key ?? ''), api<{ milestones: MilestoneDto[] }>(`/projects/${k}/milestones`)])
      return {
        rows: list.milestones.map((m) => ({
          id: m.milestoneId,
          name: m.name,
          description: m.description ?? '',
          startOn: m.startOn,
          dueOn: m.dueOn,
          closed: m.status === 'CLOSED',
          overdue: m.overdue,
          done: m.progress.done,
          total: m.progress.total,
          openTasks: m.openTaskCount,
        })),
        canManage: d.permissions.canManage,
      }
    },
  )
}

// ───────────────────────── 만들기 ─────────────────────────

export type TaskPick = { taskKey: string; title: string; milestone: string | null }

/** 묶을 작업 후보: 끝나지 않은 작업 (기한 순) */
export function useTaskPicks(key: string | undefined) {
  return useResource<TaskPick[]>(
    ['milestone-task-picks', key],
    () =>
      mockTasks
        .filter((t) => t.status !== 'DONE')
        .map((t) => ({ taskKey: t.taskKey, title: t.title, milestone: t.milestone ?? null })),
    async () => {
      const r = await api<TaskListResponse>('/tasks', {
        query: { projectKey: key, statuses: 'TODO,IN_PROGRESS,REVIEW', sort: 'dueOn', size: 100 },
      })
      return r.page.content.map((t) => ({ taskKey: t.taskKey, title: t.title, milestone: t.milestone?.name ?? null }))
    },
  )
}

export type MilestoneForm = { name: string; description: string; startOn: string | null; dueOn: string | null; taskKeys: string[] }

/** POST /projects/{key}/milestones — taskKeys 로 만들면서 작업을 묶는다 (P100 없는 작업 · P170 취소한 작업 · P042 기간) */
export async function createMilestone(key: string, f: MilestoneForm) {
  if (getDataMode() !== 'live') return
  await api(`/projects/${encodeURIComponent(key)}/milestones`, {
    method: 'POST',
    body: {
      name: f.name.trim(),
      description: f.description.trim() || null,
      startOn: f.startOn,
      dueOn: f.dueOn,
      taskKeys: f.taskKeys,
    },
  })
}
