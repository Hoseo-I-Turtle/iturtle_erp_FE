// 통합 검색 · 내 작업 — docs/api/60-common.md 2장 (검색 API 는 없고 각 목록 API 를 keyword 로 함께 부른다), 31-task.md T-1
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'
import { kstYmd, type NoticeListDto } from './communication'
import { type DocumentListResponse } from './content'
import { MOCK_ME, toTask, type BoardTask, type TaskListResponse } from './projects'
import { CATEGORY_NAME, documents as mockDocuments } from '../mocks/documents'
import { members as mockMembers, MEMBER_TYPE_NAME } from '../mocks/members'
import { minuteList as mockMinutes } from '../mocks/minuteList'
import { noticeList as mockNotices } from '../mocks/noticeList'
import { projects as mockProjects, PROJECT_CATEGORY_NAME } from '../mocks/projects'
import { STATUS_NAME, taskDetailExtra, tasks as mockTasks, type TaskStatus } from '../mocks/tasks'
import { threadPosts as mockThreads } from '../mocks/threads'

export type SearchKind = 'task' | 'comment' | 'minute' | 'thread' | 'notice' | 'document' | 'project' | 'member'
export type SearchHit = { id: string; title: string; meta: string; to: string; badge?: string; status?: TaskStatus; tag?: string; avatar?: string }
export type SearchGroup = { kind: SearchKind; total: number; hits: SearchHit[] }
export type SearchFilter = { q: string; projectKey: string; months: number }

const SIZE = 5
const md = (iso: string) => {
  const d = kstYmd(iso)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
}
const has = (q: string, ...texts: (string | null | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(q))
const group = (kind: SearchKind, all: SearchHit[]): SearchGroup => ({ kind, total: all.length, hits: all.slice(0, SIZE) })

function mockSearch(f: SearchFilter): SearchGroup[] {
  const q = f.q.trim().toLowerCase()
  if (q.length < 2) return []
  const key = 'DEFME'
  const inProject = !f.projectKey || f.projectKey === key
  return [
    group(
      'task',
      inProject
        ? mockTasks
            .filter((t) => has(q, t.title, t.taskKey))
            .map((t) => ({ id: t.taskKey, title: t.title, meta: `DEFME 백엔드 · 담당 ${t.assignee ?? '없음'}${t.dueOn ? ` · 기한 ${t.dueOn}` : ''}`, to: `/projects/${key}/tasks/${t.taskKey}`, badge: t.taskKey, status: t.status }))
        : [],
    ),
    group(
      'comment',
      inProject ? taskDetailExtra.comments.filter((c) => has(q, c.body)).map((c, i) => ({ id: `c${i}`, title: c.body, meta: `DEFME-44 의 댓글 · ${c.author} · ${c.ago}`, to: `/projects/${key}/tasks/DEFME-44`, avatar: c.author })) : [],
    ),
    group(
      'minute',
      inProject ? mockMinutes.filter((m) => has(q, m.title, m.place, ...m.attendees)).map((m) => ({ id: String(m.minuteId), title: m.title, meta: `DEFME 백엔드 · ${m.date.slice(5).replace('-', '/')} · 참석 ${m.attendeeCount}명`, to: `/projects/${key}/minutes/${m.minuteId}` })) : [],
    ),
    group(
      'thread',
      inProject ? mockThreads.filter((t) => has(q, t.title, t.body)).map((t) => ({ id: String(t.postId), title: t.title ?? t.body.split('\n')[0].slice(0, 80), meta: `DEFME 백엔드 · ${t.author} · ${t.ago} · 답글 ${t.replyCount}`, to: `/projects/${key}/threads` })) : [],
    ),
    group(
      'notice',
      f.projectKey ? [] : mockNotices.filter((n) => has(q, n.title, n.author)).map((n) => ({ id: n.id, title: n.title, meta: `${n.author} · ${n.date}`, to: `/notices/${n.id}`, tag: n.mustRead ? '필독' : undefined })),
    ),
    group(
      'document',
      mockDocuments
        .filter((d) => (!f.projectKey || d.project?.projectKey === f.projectKey) && has(q, d.title, ...d.tags))
        .map((d) => ({ id: String(d.documentId), title: d.title, meta: `${CATEGORY_NAME[d.categoryCode]} · ${d.author} · ${d.ago}`, to: `/library/${d.documentId}`, tag: d.fileTypes[0]?.toUpperCase() })),
    ),
    group(
      'project',
      mockProjects.filter((p) => has(q, p.name, p.projectKey, p.summary)).map((p) => ({ id: p.projectKey, title: p.name, meta: `${PROJECT_CATEGORY_NAME[p.categoryCode]} · ${p.summary}`, to: `/projects/${p.projectKey}`, badge: p.projectKey })),
    ),
    group(
      'member',
      f.projectKey ? [] : mockMembers.filter((m) => has(q, m.name)).map((m) => ({ id: String(m.memberId), title: m.name, meta: `${MEMBER_TYPE_NAME[m.memberType]} · ${m.intro}`, to: '/members', avatar: m.name })),
    ),
  ]
}

type Paged<T> = PageResponse<T>
/** 한 종류가 실패해도 나머지는 보여 준다 */
const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback)
const emptyPage = <T,>(): Paged<T> => ({ content: [], page: 0, size: SIZE, totalElements: 0, totalPages: 0, hasNext: false })

/** 통합 검색 (CMN-2): 종류마다 size=5 로 함께 부른다 */
export function useSearch(f: SearchFilter) {
  return useResource<SearchGroup[]>(
    ['search', f],
    () => mockSearch(f),
    async () => {
      const keyword = f.q.trim()
      if (keyword.length < 2) return []
      const from = f.months ? new Date(Date.now() - f.months * 31 * 86400000).toISOString().slice(0, 10) : undefined
      const base = { keyword, size: SIZE }
      const [tasks, comments, minutes, threads, notices, docs, projects, members] = await Promise.all([
        safe(api<TaskListResponse>('/tasks', { query: { ...base, projectKey: f.projectKey || undefined, statuses: 'TODO,IN_PROGRESS,REVIEW,DONE' } }), null),
        safe(api<Paged<{ commentId: number; author: MemberRef; body: string | null; createdAt: string; target?: { taskKey?: string; projectKey?: string } }>>('/comments', { query: { ...base, targetType: 'TASK' } }), emptyPage()),
        safe(api<Paged<{ minuteId: number; title: string; startsAt: string; project: { projectKey: string; name: string } | null; attendeeCount: number }>>('/meeting-minutes', { query: { ...base, projectKey: f.projectKey || undefined, from } }), emptyPage()),
        safe(api<Paged<{ threadId: number; title: string | null; body: string; author: MemberRef; createdAt: string; project: { projectKey: string; name: string } }>>('/projects/threads', { query: { ...base, projectKey: f.projectKey || undefined } }), emptyPage()),
        f.projectKey ? null : safe(api<NoticeListDto>('/notices', { query: base }), null),
        safe(api<DocumentListResponse>('/documents', { query: { ...base, projectKey: f.projectKey || undefined } }), null),
        safe(api<{ page: Paged<{ projectKey: string; name: string; categoryName: string; summary: string | null }> }>('/projects', { query: base }), null),
        f.projectKey ? null : safe(api<{ page: Paged<MemberRef> }>('/members', { query: base }), null),
      ])
      const noticeAll = notices ? [...notices.pinned, ...notices.page.content] : []
      const docAll = docs ? [...docs.pinned, ...docs.page.content] : []
      // 명세 확인 필요: 댓글 검색 응답에 어느 작업의 댓글인지(작업 번호)가 있는지 명세에 없다
      return [
        { kind: 'task', total: tasks?.page.totalElements ?? 0, hits: (tasks?.page.content ?? []).map((c) => ({ id: c.taskKey, title: c.title, meta: `${c.projectKey} · 담당 ${c.assignee?.name ?? '없음'}${c.dueOn ? ` · 기한 ${md(c.dueOn)}` : ''}`, to: `/projects/${c.projectKey}/tasks/${c.taskKey}`, badge: c.taskKey, status: c.status as TaskStatus })) },
        { kind: 'comment', total: comments.totalElements, hits: comments.content.map((c) => ({ id: String(c.commentId), title: c.body ?? '', meta: `${c.target?.taskKey ? `${c.target.taskKey} 의 댓글 · ` : ''}${c.author.name} · ${ago(c.createdAt)}`, to: c.target?.taskKey && c.target.projectKey ? `/projects/${c.target.projectKey}/tasks/${c.target.taskKey}` : '#', avatar: c.author.name })) },
        { kind: 'minute', total: minutes.totalElements, hits: minutes.content.map((m) => ({ id: String(m.minuteId), title: m.title, meta: `${m.project?.name ?? '연구실 회의'} · ${md(m.startsAt)} · 참석 ${m.attendeeCount}명`, to: m.project ? `/projects/${m.project.projectKey}/minutes/${m.minuteId}` : '#' })) },
        { kind: 'thread', total: threads.totalElements, hits: threads.content.map((t) => ({ id: String(t.threadId), title: t.title ?? t.body.split('\n')[0].slice(0, 80), meta: `${t.project.name} · ${t.author.name} · ${ago(t.createdAt)}`, to: `/projects/${t.project.projectKey}/threads` })) },
        { kind: 'notice', total: notices ? notices.page.totalElements + notices.pinned.length : 0, hits: noticeAll.slice(0, SIZE).map((n) => ({ id: String(n.noticeId), title: n.title, meta: `${n.author.name} · ${md(n.createdAt)}`, to: `/notices/${n.noticeId}`, tag: n.mustRead ? '필독' : undefined })) },
        { kind: 'document', total: docs ? docs.page.totalElements + docs.pinned.length : 0, hits: docAll.slice(0, SIZE).map((d) => ({ id: String(d.documentId), title: d.title, meta: `${d.categoryName} · ${d.author.name} · ${ago(d.createdAt)}`, to: `/library/${d.documentId}`, tag: d.fileTypes[0]?.toUpperCase() })) },
        { kind: 'project', total: projects?.page.totalElements ?? 0, hits: (projects?.page.content ?? []).map((p) => ({ id: p.projectKey, title: p.name, meta: [p.categoryName, p.summary].filter(Boolean).join(' · '), to: `/projects/${p.projectKey}`, badge: p.projectKey })) },
        { kind: 'member', total: members?.page.totalElements ?? 0, hits: (members?.page.content ?? []).map((m) => ({ id: String(m.memberId), title: m.name, meta: MEMBER_TYPE_NAME[m.memberType], to: '/members', avatar: m.name })) },
      ] satisfies SearchGroup[]
    },
  )
}

/** 작업 번호(DEFME-44)를 치면 그 작업으로 바로 간다 (CMN-2-06, T-13) */
export async function lookupTask(key: string, isLive: boolean): Promise<string | null> {
  const k = key.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9]{1,9}-\d+$/.test(k)) return null
  if (!isLive) return mockTasks.some((t) => t.taskKey === k) ? `/projects/${k.split('-')[0]}/tasks/${k}` : null
  const found = await api<{ tasks: { taskKey: string; projectKey?: string }[] }>('/tasks/lookup', { query: { keys: k } }).catch(() => ({ tasks: [] }))
  return found.tasks.length ? `/projects/${found.tasks[0].projectKey ?? k.split('-')[0]}/tasks/${k}` : null
}

/* ---------- 내 작업 (T-1 mine · awaitingMyReview · requesterId) ---------- */

export type MyTask = BoardTask & { projectKey: string }
export type MyTasks = { mine: MyTask[]; review: MyTask[]; requested: MyTask[]; me: string }

export function useMyTasks() {
  const withKey = (t: BoardTask): MyTask => ({ ...t, projectKey: t.taskKey.split('-')[0] })
  return useResource<MyTasks>(
    'my-tasks',
    () => ({
      mine: mockTasks.filter((t) => t.assignee === MOCK_ME && t.status !== 'DONE').map(withKey),
      review: mockTasks.filter((t) => t.status === 'REVIEW' && t.requester === MOCK_ME).map(withKey),
      requested: mockTasks.filter((t) => t.requester === MOCK_ME && t.assignee !== MOCK_ME && t.status !== 'DONE').map(withKey),
      me: MOCK_ME,
    }),
    async () => {
      const me = await api<MemberRef>('/members/me')
      const list = (query: Record<string, string | number | boolean>) => api<TaskListResponse>('/tasks', { query: { ...query, sort: 'dueOn', size: 100 } }).then((r) => r.page.content.map((c) => ({ ...toTask(c), projectKey: c.projectKey })))
      const [mine, review, requested] = await Promise.all([list({ mine: true, statuses: 'TODO,IN_PROGRESS,REVIEW' }), list({ awaitingMyReview: true }), list({ requesterId: me.memberId, statuses: 'TODO,IN_PROGRESS,REVIEW' })])
      return { mine, review, requested: requested.filter((t) => t.assignee !== me.name), me: me.name }
    },
  )
}

export { STATUS_NAME }
