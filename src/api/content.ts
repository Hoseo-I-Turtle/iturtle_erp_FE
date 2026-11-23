// 스레드 · 회의록 · 주간 보고 · 자료실 API
// - 스레드: docs/api/31-task.md H-1 ~ H-5, 답글은 60-common.md 댓글 (targetType=PROJECT_THREAD)
// - 회의록 · 주간 보고: docs/api/32-minute-report.md MM-1 ~ MM-8, WR-1 ~ WR-7
// - 자료실 · 파일: docs/api/40-document-file.md D-1, D-8, F-1, F-2
// 응답을 화면이 쓰는 mocks/* 의 모양으로 바꾼다.
import { api, ApiError } from './client'
import { ago, type MemberRef, type PageResponse, type TaskRef } from './types'
import { useResource } from './useResource'
import { getApiBase, getDataMode } from '../lib/dataMode'
import { STATUS_NAME, type TaskStatus } from '../mocks/tasks'
import { THREAD_TOTAL, threadPosts, type ThreadPost } from '../mocks/threads'
import { minuteHistory, minutes as mockMinutes, otherMinutes, type Minute, type MinuteTodo } from '../mocks/minutes'
import { github, lastWeekComment, lastWeekReport, myReport, submissions, weeks, type ReportWeek, type Submission } from '../mocks/reports'
import {
  categoryCounts as mockCategoryCounts,
  documents as mockDocuments,
  pinnedDocs as mockPinnedDocs,
  popularTags as mockPopularTags,
  type DocumentCategory,
  type DocumentSummary,
} from '../mocks/documents'

/* ---------- 공통 ---------- */

export type FileRef = { publicId: string; name: string; size: number; contentType: string; extension?: string }

/** 저장 실패 때 화면에 보여 줄 짧은 문구 */
export const errorText = (e: unknown, fallback = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') =>
  e instanceof ApiError ? e.message : fallback

const isLive = () => getDataMode() === 'live'

/** 파일 내려받기 주소 (F-4). 세션 쿠키로 권한을 확인하고 서명 주소로 보내 준다 */
export const fileUrl = (publicId: string) => `${getApiBase().replace(/\/$/, '')}/files/${publicId}/download`

const humanSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`

const taskStatusName = (st: string) => STATUS_NAME[st as TaskStatus] ?? (st === 'CANCELLED' ? '취소' : st)

const KST_MS = 9 * 60 * 60 * 1000
const WEEKDAY = '일월화수목금토'
const pad = (n: number) => String(n).padStart(2, '0')
/** ISO 시각을 KST 로 옮긴 Date (UTC getter 로 읽는다) */
const kst = (iso: string) => new Date(new Date(iso).getTime() + KST_MS)
const md = (d: Date) => `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`
const hm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
/** '2026-11-21' → '11/21' */
const mdOf = (date: string | null | undefined) => (date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : '')

/* ---------- 댓글 (60-common.md CM-1, CM-2) ---------- */

type CommentTarget = 'PROJECT_THREAD' | 'WEEKLY_REPORT'
type Comment = {
  commentId: number
  parentId: number | null
  author: MemberRef
  body: string | null
  deleted: boolean
  attachments: FileRef[]
  editedAt: string | null
  createdAt: string
  replies: Comment[]
}

function listComments(targetType: CommentTarget, targetId: number) {
  return api<PageResponse<Comment>>('/comments', { query: { targetType, targetId, size: 100 } })
}

function postComment(targetType: CommentTarget, targetId: number, body: string, parentId?: number) {
  return api<Comment>('/comments', {
    method: 'POST',
    body: { targetType, targetId, parentId: parentId ?? null, body, attachmentFileIds: [] },
  })
}

/* ---------- 파일 올리기 (40-document-file.md F-1, F-2) ---------- */

type UploadStart = {
  publicId: string
  mode: 'SINGLE' | 'MULTIPART'
  single: { url: string; method: 'PUT'; headers: Record<string, string> } | null
  multipart: { partSize: number; parts: { partNumber: number; url: string }[] } | null
}

/**
 * 파일을 Garage 로 직접 올리고 FileRef 를 돌려준다. 글의 attachmentFileIds 에 publicId 를 넣으면 붙는다.
 * TODO: 스레드 글쓰기 · 답글에 파일 고르는 칸이 아직 없어 화면에서는 부르지 않는다.
 */
export async function uploadFile(file: File, purpose: 'ATTACHMENT' | 'INLINE_IMAGE' = 'ATTACHMENT') {
  const start = await api<UploadStart>('/files/uploads', {
    method: 'POST',
    body: { filename: file.name, size: file.size, contentType: file.type || 'application/octet-stream', purpose },
  })
  let parts: { partNumber: number; etag: string }[] | undefined
  if (start.mode === 'SINGLE' && start.single) {
    const res = await fetch(start.single.url, { method: 'PUT', headers: start.single.headers, body: file })
    if (!res.ok) throw new ApiError(res.status, 'UPLOAD', '파일을 올리지 못했어요.')
  } else if (start.multipart) {
    const { partSize } = start.multipart
    parts = []
    for (const p of start.multipart.parts) {
      const chunk = file.slice((p.partNumber - 1) * partSize, p.partNumber * partSize)
      const res = await fetch(p.url, { method: 'PUT', body: chunk })
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD', '파일을 올리지 못했어요.')
      parts.push({ partNumber: p.partNumber, etag: res.headers.get('ETag') ?? '' })
    }
  }
  return api<FileRef>(`/files/uploads/${start.publicId}/complete`, { method: 'POST', body: parts ? { parts } : {} })
}

/* ======================================================================
 * 프로젝트 스레드 (31-task.md H-1 ~ H-5)
 * ==================================================================== */

type ThreadItem = {
  threadId: number
  title: string | null
  body: string
  author: MemberRef
  createdAt: string
  editedAt: string | null
  editedBy: MemberRef | null
  pin: { pinnedAt: string; pinnedBy: MemberRef; order: number } | null
  replyCount: number
  lastActivityAt: string
  attachments: FileRef[]
  convertedTask: TaskRef | null
  permissions: { canEdit: boolean; canDelete: boolean; canPin: boolean }
}
type ThreadListResponse = {
  pinned: ThreadItem[]
  pinnedLimit: number
  page: PageResponse<ThreadItem>
  totalCount: number
  serverTime: string
}

/** 첨부에 내려받기 주소를 더한 모양 (목업에는 주소가 없다) */
export type ThreadAttachment = ThreadPost['attachments'][number] & { url?: string }
export type ThreadPostView = Omit<ThreadPost, 'attachments'> & { attachments: ThreadAttachment[] }
export type ThreadReply = ThreadPost['replies'][number]
export type ThreadBoard = { posts: ThreadPostView[]; total: number; pinnedLimit: number; meName: string }

const MOCK_ME_NAME = '김민서'

const toThreadPost = (t: ThreadItem): ThreadPostView => ({
  postId: t.threadId,
  title: t.title,
  author: t.author.name,
  createdAt: ago(t.createdAt),
  ago: ago(t.lastActivityAt),
  editedBy: t.editedBy?.name,
  editedAt: t.editedAt ? ago(t.editedAt) : undefined,
  body: t.body,
  pinnedOrder: t.pin?.order ?? null,
  pinnedBy: t.pin?.pinnedBy.name,
  replyCount: t.replyCount,
  attachments: t.attachments.map((f) => ({
    name: f.name,
    size: humanSize(f.size),
    kind: f.contentType.startsWith('image/') ? 'image' : 'pdf',
    url: fileUrl(f.publicId),
  })),
  replies: [],
})

/** 스레드 화면: 고정 글 + 최근 답글 순 글 목록 */
export function useThreadBoard(projectKey: string) {
  return useResource<ThreadBoard>(
    ['threads', projectKey],
    () => ({ posts: threadPosts, total: THREAD_TOTAL, pinnedLimit: 10, meName: MOCK_ME_NAME }),
    async () => {
      // TODO: 1분마다 since=serverTime 으로 바뀐 글만 받아 합치기 (README 1.6), 다음 페이지 불러오기
      const [list, me] = await Promise.all([
        api<ThreadListResponse>(`/projects/${projectKey}/threads`, { query: { size: 50 } }),
        api<{ name: string }>('/members/me'),
      ])
      return {
        posts: [...list.pinned, ...list.page.content].map(toThreadPost),
        total: list.totalCount,
        pinnedLimit: list.pinnedLimit,
        meName: me.name,
      }
    },
  )
}

/** 고른 글의 답글 (CM-1, 원 댓글과 그 답글을 한 줄로 펼친다) */
export function useThreadReplies(threadId: number | undefined, mockReplies: ThreadReply[]) {
  return useResource<ThreadReply[]>(
    ['thread-replies', threadId],
    () => mockReplies,
    async () => {
      if (threadId === undefined) return []
      const page = await listComments('PROJECT_THREAD', threadId)
      return page.content.flatMap((c) => [c, ...c.replies]).map(toReply)
    },
  )
}

const toReply = (c: Comment): ThreadReply => ({
  author: c.author.name,
  ago: ago(c.createdAt),
  body: c.deleted || c.body === null ? '_삭제된 댓글입니다_' : c.body,
})

/** H-2 글쓰기 */
export async function createThread(projectKey: string, title: string, body: string) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads`, {
    method: 'POST',
    body: { title: title || null, body, attachmentFileIds: [] },
  })
  return toThreadPost(t)
}

/** H-4 상단 고정 · 해제. 제목 없는 글을 고정할 때는 title 을 함께 보낸다 */
export async function pinThread(projectKey: string, threadId: number, pinned: boolean, title?: string) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads/${threadId}`, {
    method: 'PATCH',
    body: title === undefined ? { pinned } : { pinned, title },
  })
  return toThreadPost(t)
}

/** H-4 글 고치기 (제목 · 본문). 고친 글을 돌려준다 */
export async function editThread(projectKey: string, threadId: number, title: string, body: string) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads/${threadId}`, {
    method: 'PATCH',
    body: { title: title || null, body },
  })
  return toThreadPost(t)
}

/** H-6 글 지우기 (답글 · 첨부도 함께 숨김) */
export const deleteThread = (projectKey: string, threadId: number) =>
  api<null>(`/projects/${projectKey}/threads/${threadId}`, { method: 'DELETE' })

/** H-5 고정 글 순서 한 번에 저장 */
export async function savePinnedOrder(projectKey: string, threadIds: number[]) {
  const res = await api<{ pinned: ThreadItem[] }>(`/projects/${projectKey}/threads/pinned-order`, {
    method: 'PUT',
    body: { threadIds },
  })
  return res.pinned.map(toThreadPost)
}

/** 스레드 답글 쓰기 (CM-2, 원 댓글로 붙인다) */
export async function replyToThread(threadId: number, body: string) {
  return toReply(await postComment('PROJECT_THREAD', threadId, body))
}

/* ======================================================================
 * 회의록 (32-minute-report.md MM-1, MM-3, MM-4, MM-6, MM-8)
 * ==================================================================== */

type MinuteAction = {
  actionId: number
  content: string
  assignee: MemberRef | null
  dueOn: string | null
  done: boolean
  task: TaskRef | null
  displayOrder: number
}
type MinuteDetail = {
  minuteId: number
  project: { projectKey: string; name: string } | null
  title: string
  startsAt: string
  endsAt: string
  location: string | null
  onlineUrl: string | null
  templateCode: string | null
  calendarEvent: { eventId: number; title: string } | null
  author: MemberRef
  attendees: { member: MemberRef; attended: boolean }[]
  agenda: string | null
  discussion: string | null
  decisions: string | null
  actions: MinuteAction[]
  attachments: FileRef[]
  version: number
  lastEditor: MemberRef
  updatedAt: string
}
type MinuteSummary = {
  minuteId: number
  title: string
  project: { projectKey: string; name: string } | null
  actionCount: number
  convertedTaskCount: number
}
type MinuteRevision = { version: number; editor: MemberRef; summary: string | null; createdAt: string }

export type MinuteSection = 'agenda' | 'discussion' | 'decisions'
export type MinuteHistoryRow = { who: string; ago: string; what: string }
export type MinuteConflict = { who: string; ago: string }
export type MinuteLink = { id: number; title: string; meta: string }
export type MinuteList = { latest: { id: number; title: string } | null; others: MinuteLink[] }
export type MinuteView = {
  minute: Minute
  history: MinuteHistoryRow[]
  /** 목업은 처음부터 충돌 안내를 보여 준다. 실서버는 409 를 받았을 때만 */
  initialConflict: MinuteConflict | null
  /** 저장(PUT) 때 그대로 돌려보낼 서버 원본 */
  raw: MinuteDetail | null
}

/** Markdown 목록 → 한 줄씩 (화면은 줄 단위로 보여 주고 고친다) */
const mdLines = (v: string | null) =>
  (v ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim())
    .filter(Boolean)
const linesMd = (lines: string[]) => lines.map((l) => `- ${l}`).join('\n')

function minuteWhen(startsAt: string, endsAt: string) {
  const s = kst(startsAt)
  const e = kst(endsAt)
  return `${md(s)}(${WEEKDAY[s.getUTCDay()]}) ${hm(s)} – ${hm(e)}`
}

const toMinute = (d: MinuteDetail): Minute => ({
  minuteId: d.minuteId,
  title: d.title,
  when: minuteWhen(d.startsAt, d.endsAt),
  place: d.location ?? d.onlineUrl ?? '—',
  event: d.calendarEvent ? `공용 일정 · ${d.calendarEvent.title}` : '연결한 일정 없음',
  // 명세 확인 필요: 양식 표시 이름(templateName)이 응답에 없어 코드를 그대로 보여 준다
  template: d.templateCode ? `양식 · ${d.templateCode}` : '양식 없음',
  attendees: d.attendees.filter((a) => a.attended).map((a) => a.member.name),
  absent: d.attendees.filter((a) => !a.attended).map((a) => a.member.name),
  agenda: mdLines(d.agenda),
  discussion: mdLines(d.discussion),
  decisions: mdLines(d.decisions),
  todos: [...d.actions].sort((a, b) => a.displayOrder - b.displayOrder).map(toTodo),
  version: d.version,
})

const toTodo = (a: MinuteAction): MinuteTodo => ({
  id: a.actionId,
  text: a.content,
  assignee: a.assignee?.name ?? '담당 없음',
  dueOn: mdOf(a.dueOn),
  task: a.task ? { taskKey: a.task.taskKey, status: taskStatusName(a.task.status) } : undefined,
})

const toHistory = (r: MinuteRevision): MinuteHistoryRow => ({ who: r.editor.name, ago: ago(r.createdAt), what: r.summary ?? `버전 ${r.version}` })

/** 이 프로젝트의 회의록 목록 (MM-1). 맨 위가 최근 회의록 */
export function useMinuteList(projectKey: string) {
  return useResource<MinuteList>(
    ['minutes', projectKey],
    () => ({ latest: { id: mockMinutes[0].minuteId, title: mockMinutes[0].title }, others: otherMinutes }),
    async () => {
      // 명세 확인 필요: README 2장은 회의록 목록을 "화면 없음" 으로 두었지만, 이 화면의 "다른 회의록" 칸이 MM-1 을 쓴다
      const page = await api<PageResponse<MinuteSummary>>('/meeting-minutes', { query: { projectKey, size: 10 } })
      const [first, ...rest] = page.content
      return {
        latest: first ? { id: first.minuteId, title: first.title } : null,
        others: rest.map((m) => ({
          id: m.minuteId,
          title: m.title,
          meta: `${m.project?.name ?? '연구실 회의'} · 할 일 ${m.actionCount}${m.convertedTaskCount ? ` → 작업 ${m.convertedTaskCount}` : ''}`,
        })),
      }
    },
  )
}

// 목업에서 다른 회의록을 보고 돌아와도 고친 내용이 남도록 기억해 둔다
const mockMinuteStore = new Map<number, Minute>()
export function keepMockMinute(m: Minute) {
  if (!isLive()) mockMinuteStore.set(m.minuteId, m)
}

async function fetchMinute(minuteId: number): Promise<MinuteView> {
  const [detail, revisions] = await Promise.all([
    api<MinuteDetail>(`/meeting-minutes/${minuteId}`),
    api<PageResponse<MinuteRevision>>(`/meeting-minutes/${minuteId}/revisions`, { query: { size: 10 } }),
  ])
  return { minute: toMinute(detail), history: revisions.content.map(toHistory), initialConflict: null, raw: detail }
}

/** 회의록 하나 + 수정 이력 (MM-3, MM-6) */
export function useMinute(minuteId: number) {
  return useResource<MinuteView>(
    ['minute', minuteId],
    () => ({
      minute: mockMinuteStore.get(minuteId) ?? mockMinutes.find((m) => m.minuteId === minuteId) ?? mockMinutes[0],
      history: minuteHistory,
      initialConflict: { who: '박지훈', ago: '2분 전' },
      raw: null,
    }),
    () => fetchMinute(minuteId),
  )
}

export type SaveMinuteResult = { ok: true; view: MinuteView } | { ok: false; conflict: MinuteConflict; latest: MinuteView }

/**
 * MM-4 회의록 저장 (통째로, 버전 확인).
 * 409 P201 이면 최신 내용을 다시 불러 누가 언제 저장했는지 돌려준다.
 */
export async function saveMinute(view: MinuteView, edited: Record<MinuteSection, string[]>): Promise<SaveMinuteResult> {
  const raw = view.raw
  if (!raw) throw new Error('회의록 원본이 없어요.')
  // 고치지 않은 칸은 서버 원문(Markdown)을 그대로 보내 서식을 잃지 않게 한다
  const section = (k: MinuteSection) =>
    edited[k].join('\n') === view.minute[k].join('\n') ? raw[k] : linesMd(edited[k])
  try {
    const saved = await api<MinuteDetail>(`/meeting-minutes/${raw.minuteId}`, {
      method: 'PUT',
      body: {
        version: view.minute.version,
        title: raw.title,
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        location: raw.location,
        onlineUrl: raw.onlineUrl,
        templateCode: raw.templateCode,
        calendarEventId: raw.calendarEvent?.eventId ?? null,
        attendees: raw.attendees.map((a) => ({ memberId: a.member.memberId, attended: a.attended })),
        agenda: section('agenda'),
        discussion: section('discussion'),
        decisions: section('decisions'),
        actions: raw.actions.map((a) => ({
          actionId: a.actionId,
          content: a.content,
          assigneeMemberId: a.assignee?.memberId ?? null,
          dueOn: a.dueOn,
          done: a.done,
        })),
        attachmentFileIds: raw.attachments.map((f) => f.publicId),
      },
    })
    const revisions = await api<PageResponse<MinuteRevision>>(`/meeting-minutes/${raw.minuteId}/revisions`, { query: { size: 10 } }).catch(
      () => null,
    )
    return {
      ok: true,
      view: { minute: toMinute(saved), history: revisions ? revisions.content.map(toHistory) : view.history, initialConflict: null, raw: saved },
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'P201') {
      const latest = await fetchMinute(raw.minuteId)
      return { ok: false, conflict: { who: latest.raw!.lastEditor.name, ago: ago(latest.raw!.updatedAt) }, latest }
    }
    throw e
  }
}

/** MM-8 할 일 여러 개를 작업으로. 바뀐 할 일을 돌려준다 */
export async function convertMinuteActions(minuteId: number, actionIds: number[]) {
  const res = await api<{ actions: MinuteAction[] }>(`/meeting-minutes/${minuteId}/actions/convert-to-tasks`, {
    method: 'POST',
    body: { actionIds },
  })
  return res.actions.map(toTodo)
}

/* ======================================================================
 * 주간 보고 (32-minute-report.md WR-1 ~ WR-7)
 * ==================================================================== */

export type ReportFields = { done: string; next: string; issues: string }
export type ReportTaskChip = { key: string; title: string; status: string }
export type WeekRef = ReportWeek & { weekStartOn: string }
export type MyWeekReport = {
  reportId: number | null
  meId: number | null
  fields: ReportFields
  tasks: ReportTaskChip[]
  /** 작업 연동에서 뺀 작업 (WR-3 의 tasks[].excluded) */
  excludedKeys: string[]
  submitted: boolean
  editable: boolean
  dueText: string
}
export type LastWeek = {
  /** "지난 주 복사" 때 지금 칸에 덮어쓸 값 */
  copy: Partial<ReportFields>
  comment: { author: string; confirmed: boolean; body: string } | null
}
export type GithubActivity = {
  fetchedAgo: string
  rows: { repo: string; branch: string; commits: number; add: number; del: number }[]
  totals: { c: number; add: number; del: number }
  mergeCount: number
}

type ReportTask = { task: TaskRef; projectKey: string; kind: 'DONE' | 'IN_PROGRESS'; excluded: boolean; note: string | null }
type ReportDetail = {
  reportId: number | null
  member: MemberRef
  weekStartOn: string
  dueAt: string
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'
  late: boolean
  doneText: string | null
  planText: string | null
  issueText: string | null
  tasks: ReportTask[]
  editable?: boolean
}
type ReportSummary = {
  reportId: number
  member: MemberRef
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'
  late: boolean
  doneSummary: string
}
type ReportListResponse = {
  missingMembers: MemberRef[] | null
  page: PageResponse<ReportSummary>
}
type GithubActivityResponse = {
  lastFetchedAt: string | null
  rows: {
    member: MemberRef | null
    repository: { repositoryId: number; fullName: string; projectKey: string } | null
    hidden: boolean
    commitCount: number
    additions: number
    deletions: number
    branches: { branch: string; commitCount: number; additions: number; deletions: number }[]
  }[]
  totals: { commitCount: number; mergeCommitCount: number; additions: number; deletions: number }
}

const DAY_MS = 24 * 60 * 60 * 1000
const isoDay = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** KST 기준 이번 주 월요일 (UTC 자정 Date) */
function thisMonday() {
  const now = new Date(Date.now() + KST_MS)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(today - ((now.getUTCDay() + 6) % 7) * DAY_MS)
}

function weekOf(monday: Date): WeekRef {
  const first = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1))
  const nth = Math.ceil((monday.getUTCDate() + ((first.getUTCDay() + 6) % 7)) / 7)
  const sunday = new Date(monday.getTime() + 6 * DAY_MS)
  const due = new Date(monday.getTime() + 7 * DAY_MS)
  return {
    weekStartOn: isoDay(monday),
    label: `${monday.getUTCMonth() + 1}월 ${nth}주차`,
    range: `${md(monday)} – ${md(sunday)}`,
    // 명세 확인 필요: 마감은 공통코드 WEEKLY_REPORT_POLICY 를 따른다. 목록 머리에서는 기본값(다음 월요일 10:00)으로 보여 준다
    deadline: `${md(due)}(월) 10:00`,
  }
}

/** 고를 수 있는 주 (오래된 주 → 이번 주). 실서버는 이번 주를 포함해 8주 */
export function reportWeeks(): WeekRef[] {
  if (!isLive()) return weeks.map((w) => ({ ...w, weekStartOn: `2026-${w.range.slice(0, 2)}-${w.range.slice(3, 5)}` }))
  const monday = thisMonday()
  return Array.from({ length: 8 }, (_, i) => weekOf(new Date(monday.getTime() - (7 - i) * 7 * DAY_MS)))
}

const prevMonday = (weekStartOn: string) => isoDay(new Date(new Date(`${weekStartOn}T00:00:00Z`).getTime() - 7 * DAY_MS))

function dueText(dueAt: string) {
  const left = new Date(dueAt).getTime() - Date.now()
  if (left <= 0) return '마감이 지났어요'
  const h = Math.floor(left / 3600000)
  return h < 24 ? `마감까지 ${Math.max(1, h)}시간` : `마감까지 ${Math.floor(h / 24)}일`
}

const toMyReport = (r: ReportDetail): MyWeekReport => ({
  reportId: r.reportId,
  meId: r.member.memberId,
  fields: { done: r.doneText ?? '', next: r.planText ?? '', issues: r.issueText ?? '' },
  tasks: r.tasks
    .filter((t) => !t.excluded)
    .map((t) => ({ key: t.task.taskKey, title: t.task.title, status: taskStatusName(t.task.status) })),
  excludedKeys: r.tasks.filter((t) => t.excluded).map((t) => t.task.taskKey),
  submitted: r.status !== 'DRAFT',
  editable: r.editable ?? r.status !== 'CONFIRMED',
  dueText: dueText(r.dueAt),
})

// 목업에서 주를 옮겼다 돌아와도 쓰던 내용이 남도록 기억해 둔다
const mockReportStore = new Map<string, MyWeekReport>()
export function keepMockReport(weekStartOn: string, r: MyWeekReport) {
  if (!isLive()) mockReportStore.set(weekStartOn, r)
}

/** 내 그 주 보고 (WR-2). 저장한 적 없으면 빈 초안 + 작업 자동 채움 */
export function useMyReport(weekStartOn: string, isCurrent: boolean) {
  return useResource<MyWeekReport>(
    ['my-report', weekStartOn],
    () => mockReportStore.get(weekStartOn) ?? {
      reportId: null,
      meId: null,
      fields: isCurrent ? { done: myReport.done, next: myReport.next, issues: myReport.issues } : lastWeekReport,
      tasks: isCurrent ? myReport.tasks : [],
      excludedKeys: [],
      submitted: false,
      editable: isCurrent,
      dueText: '마감까지 2시간',
    },
    async () => toMyReport(await api<ReportDetail>(`/weekly-reports/me/${weekStartOn}`)),
  )
}

/** WR-3 자동 저장 */
export async function saveMyReport(weekStartOn: string, fields: ReportFields, excludedKeys: string[]) {
  const r = await api<ReportDetail>(`/weekly-reports/me/${weekStartOn}`, {
    method: 'PUT',
    body: {
      doneText: fields.done,
      planText: fields.next,
      issueText: fields.issues,
      // 뺀 작업만 보낸다 (목록에 없는 작업은 자동 채우기 값 그대로)
      tasks: excludedKeys.map((taskKey) => ({ taskKey, excluded: true, note: null })),
    },
  })
  return toMyReport(r)
}

/** WR-5 제출. 아직 한 번도 저장하지 않았으면 먼저 WR-3 으로 만든다 */
export async function submitMyReport(weekStartOn: string, report: MyWeekReport) {
  const saved = await saveMyReport(weekStartOn, report.fields, report.excludedKeys)
  const id = saved.reportId ?? report.reportId
  if (id === null) throw new ApiError(500, 'NO_REPORT', '보고를 만들지 못했어요.')
  return toMyReport(await api<ReportDetail>(`/weekly-reports/${id}`, { method: 'PATCH', body: { status: 'SUBMITTED' } }))
}

/** 그 주 제출 현황 (WR-1 ?weekStartOn=) */
export function useWeekSubmissions(weekStartOn: string) {
  return useResource<Submission[]>(
    ['report-submissions', weekStartOn],
    () => submissions,
    async () => {
      const res = await api<ReportListResponse>('/weekly-reports', { query: { weekStartOn, size: 100 } })
      const missing = res.missingMembers ?? []
      const missingIds = new Set(missing.map((m) => m.memberId))
      const done: Submission[] = res.page.content
        // 작성 중(DRAFT)은 본인 것만 오고, 미제출 명단에도 들어 있다
        .filter((r) => r.status !== 'DRAFT' && !missingIds.has(r.member.memberId))
        .map((r) => ({ name: r.member.name, state: r.late ? 'LATE' : 'SUBMITTED', summary: r.doneSummary }))
      return [...done, ...missing.map((m): Submission => ({ name: m.name, state: 'MISSING' }))]
    },
  )
}

/** 지난 주 보고: "지난 주 복사" 와 지난 주 코멘트 (WR-2 + CM-1 targetType=WEEKLY_REPORT) */
export function useLastWeek(currentWeekStartOn: string) {
  return useResource<LastWeek>(
    ['report-last-week', currentWeekStartOn],
    () => ({ copy: lastWeekReport, comment: lastWeekComment }),
    async () => {
      const last = await api<ReportDetail>(`/weekly-reports/me/${prevMonday(currentWeekStartOn)}`)
      // 지난 주 계획을 이번 주 한 일로 옮긴다 (32 문서 "지난 주 복사")
      const copy = { done: last.planText ?? '' }
      if (last.reportId === null || last.status === 'DRAFT') return { copy, comment: null }
      const page = await listComments('WEEKLY_REPORT', last.reportId)
      const c = page.content.find((x) => !x.deleted && x.body)
      return {
        copy,
        comment: c ? { author: c.author.name, confirmed: last.status === 'CONFIRMED', body: c.body ?? '' } : null,
      }
    },
  )
}

/** 내 GitHub 활동 (WR-6 weekStartOn + memberId) */
export function useGithubActivity(weekStartOn: string, memberId: number | null | undefined) {
  return useResource<GithubActivity>(
    ['report-github', weekStartOn, memberId],
    () => ({
      fetchedAgo: github.fetchedAgo,
      rows: github.rows,
      totals: github.rows.reduce((a, r) => ({ c: a.c + r.commits, add: a.add + r.add, del: a.del + r.del }), { c: 0, add: 0, del: 0 }),
      mergeCount: 1,
    }),
    async () => {
      const res = await api<GithubActivityResponse>('/weekly-reports/github-activity', {
        query: { weekStartOn, memberId: memberId ?? undefined },
      })
      return {
        fetchedAgo: res.lastFetchedAt ? ago(res.lastFetchedAt) : '아직 받지 않음',
        rows: res.rows.flatMap((r) =>
          r.hidden || !r.repository
            ? [{ repo: '비공개 저장소', branch: '', commits: r.commitCount, add: r.additions, del: r.deletions }]
            : r.branches.map((b) => ({
                repo: r.repository!.fullName,
                branch: b.branch,
                commits: b.commitCount,
                add: b.additions,
                del: b.deletions,
              })),
        ),
        // 브랜치 합은 같은 커밋을 여러 번 셀 수 있어 합계는 서버 값을 쓴다
        totals: { c: res.totals.commitCount, add: res.totals.additions, del: res.totals.deletions },
        mergeCount: res.totals.mergeCommitCount,
      }
    },
  )
}

/** WR-7 지금 새로 받기 */
export async function refreshGithubActivity() {
  return api<{ queuedRepositoryCount: number; skippedRepositoryCount: number; lastFetchedAt: string | null }>(
    '/weekly-reports/github-activity/refresh',
    { method: 'POST' },
  )
}

/* ======================================================================
 * 자료실 (40-document-file.md D-1, D-8)
 * ==================================================================== */

export type DocumentItem = {
  documentId: number
  categoryCode: string
  categoryName: string
  title: string
  author: MemberRef
  project: { projectKey: string; name: string } | null
  visibility: 'LAB' | 'PROJECT_MEMBERS'
  tags: string[]
  fileTypes: string[]
  latestVersion: number | null
  commentCount: number
  resolved: boolean | null
  pinned: boolean
  createdAt: string
}
export type DocumentListResponse = {
  pinned: DocumentItem[]
  categoryCounts: Record<string, number>
  page: PageResponse<DocumentItem>
}

export type LibrarySort = '최신순' | '댓글 많은 순' | '제목순'
/** 화면의 거르기 값 (프로젝트 · 작성자는 화면에 보이는 이름) */
export type LibraryFilter = {
  category: 'ALL' | DocumentCategory
  tag: string
  project: string
  author: string
  fileType: string
  sort: LibrarySort
}
export type LibraryData = {
  documents: DocumentSummary[]
  categoryCounts: Record<DocumentCategory, number>
  pinnedDocs: { documentId: number; title: string; meta: string }[]
  unresolved: DocumentSummary[]
  popularTags: string[]
  options: { tags: string[]; projects: string[]; authors: string[]; types: string[] }
}

const uniq = (xs: string[]) => [...new Set(xs)].sort()

function mockLibrary(): LibraryData {
  return {
    documents: mockDocuments,
    categoryCounts: mockCategoryCounts,
    pinnedDocs: mockPinnedDocs,
    unresolved: mockDocuments.filter((d) => d.resolved === false),
    popularTags: mockPopularTags,
    options: {
      tags: uniq(mockDocuments.flatMap((d) => d.tags)),
      projects: uniq(mockDocuments.flatMap((d) => (d.project ? [d.project.name] : []))),
      authors: uniq(mockDocuments.map((d) => d.author)),
      types: uniq(mockDocuments.flatMap((d) => d.fileTypes)),
    },
  }
}

// 거르기 칸은 이름으로 고르고 API 는 projectKey · authorId 로 받으므로, 지금까지 본 이름 → ID 를 기억해 둔다
const seenProjects = new Map<string, string>()
const seenAuthors = new Map<string, number>()
const seenTypes = new Set<string>()

export const toDocument = (d: DocumentItem): DocumentSummary => {
  seenAuthors.set(d.author.name, d.author.memberId)
  if (d.project) seenProjects.set(d.project.name, d.project.projectKey)
  d.fileTypes.forEach((t) => seenTypes.add(t))
  return {
    documentId: d.documentId,
    // 명세 확인 필요: 카테고리는 공통코드라 화면의 7개 말고 더 생길 수 있다
    categoryCode: d.categoryCode as DocumentCategory,
    title: d.title,
    author: d.author.name,
    ago: ago(d.createdAt),
    ageMinutes: Math.max(0, Math.round((Date.now() - new Date(d.createdAt).getTime()) / 60000)),
    project: d.project,
    visibility: d.visibility,
    tags: d.tags,
    fileTypes: d.fileTypes,
    latestVersion: d.latestVersion ?? 1,
    commentCount: d.commentCount,
    resolved: d.resolved,
    pinned: d.pinned,
  }
}

const SORT_PARAM: Record<LibrarySort, string> = {
  최신순: 'createdAt,desc',
  '댓글 많은 순': 'commentCount,desc',
  // 명세 확인 필요: 제목순 정렬 파라미터가 없어 최신순으로 받고 화면에서 다시 정렬한다
  제목순: 'createdAt,desc',
}

/** 자료실 목록 · 고정 자료 · 카테고리 개수 · 해결 안 된 질문 · 많이 쓰는 태그 */
export function useLibrary(f: LibraryFilter) {
  return useResource<LibraryData>(['library', f], mockLibrary, async () => {
    const [list, side, tags] = await Promise.all([
      api<DocumentListResponse>('/documents', {
        query: {
          categoryCode: f.category === 'ALL' ? undefined : f.category,
          tag: f.tag || undefined,
          projectKey: f.project ? seenProjects.get(f.project) : undefined,
          authorId: f.author ? seenAuthors.get(f.author) : undefined,
          fileType: f.fileType || undefined,
          sort: SORT_PARAM[f.sort],
          size: 100,
        },
      }),
      // 카테고리 없이 부르면 pinned 에 전체 고정 자료가 온다 (옆 칸 "고정 자료")
      api<DocumentListResponse>('/documents', { query: { unresolved: true, size: 5 } }),
      api<{ tag: string; count: number }[]>('/documents/tags', { query: { limit: 30 } }),
    ])
    const page = list.page.content.map(toDocument)
    // 명세 확인 필요: pinned 에 태그 · 프로젝트 등 다른 거르기도 적용되는지 명세에 없어 화면에서 한 번 더 거른다
    const pinned = list.pinned.map(toDocument)
    const counts = Object.fromEntries(
      (['PAPER', 'SLIDE', 'DEV_DOC', 'DATA', 'FORM', 'QNA', 'FREE'] as DocumentCategory[]).map((c) => [c, list.categoryCounts[c] ?? 0]),
    ) as Record<DocumentCategory, number>
    return {
      documents: [...pinned, ...page],
      categoryCounts: counts,
      pinnedDocs: side.pinned.map((d) => ({
        documentId: d.documentId,
        title: d.title,
        meta: [d.categoryName, d.fileTypes[0]?.toUpperCase()].filter(Boolean).join(' · '),
      })),
      unresolved: side.page.content.map(toDocument),
      popularTags: tags.slice(0, 10).map((t) => t.tag),
      options: {
        tags: uniq([...tags.map((t) => t.tag), ...page.flatMap((d) => d.tags)]),
        projects: uniq([...seenProjects.keys()]),
        authors: uniq([...seenAuthors.keys()]),
        types: uniq([...seenTypes]),
      },
    }
  })
}
