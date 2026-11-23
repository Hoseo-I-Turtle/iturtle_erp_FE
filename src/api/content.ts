// 스레드 · 회의록 · 주간 보고 · 자료실 API
// - 스레드: docs/api/31-task.md H-1 ~ H-5, 답글은 60-common.md 댓글 (targetType=PROJECT_THREAD)
// - 회의록 · 주간 보고: docs/api/32-minute-report.md MM-1 ~ MM-8, WR-1 ~ WR-7
// - 자료실 · 파일: docs/api/40-document-file.md D-1, D-8, F-1, F-2
// 백엔드 기준: project 모듈 ThreadController · MinuteController · WeeklyReportController,
// comment 모듈 CommentController, document 모듈 DocumentController, file 모듈 FileController 와 각 dto.
// 응답을 화면이 쓰는 mocks/* 의 모양으로 바꾼다.
import { api, ApiError } from './client'
import { ago, type MemberRef, type PageResponse, type TaskRef } from './types'
import { useResource } from './useResource'
import { getApiBase, getDataMode } from '../lib/dataMode'
import { projectCategoryName } from './projects'
import { STATUS_NAME, type TaskStatus } from '../mocks/tasks'
import { THREAD_TOTAL, threadPosts, type ThreadPost } from '../mocks/threads'
import { minuteHistory, minutes as mockMinutes, otherMinutes, type Minute, type MinuteTodo } from '../mocks/minutes'
import { github, lastWeekComment, lastWeekReport, myReport, submissions, weeks, type ReportWeek, type Submission } from '../mocks/reports'
import {
  CATEGORY_NAME,
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
/**
 * comment 모듈 CommentResponse. @JsonInclude(NON_NULL) 이라 비어 있는 필드(parentId · replies · mentions …)는 빠져 온다.
 * 작성자가 없어진 경우 author 는 memberId 만 있다.
 */
type Comment = {
  commentId: number
  parentId?: number
  author: { memberId: number; name: string | null }
  body: string | null
  deleted: boolean
  kind: 'NORMAL' | 'REJECT_REASON' | 'STATUS_REASON'
  attachments?: FileRef[]
  editedAt: string | null
  createdAt: string
  replies?: Comment[]
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

/** FileUploadStartResponse */
type UploadStart = {
  publicId: string
  mode: 'SINGLE' | 'MULTIPART'
  single: { url: string; method: 'PUT'; headers: Record<string, string> | null } | null
  multipart: { partSize: number; parts: { partNumber: number; url: string }[] } | null
  expiresAt: string
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
    const res = await fetch(start.single.url, { method: 'PUT', headers: start.single.headers ?? undefined, body: file })
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
  // 응답은 FileResponse (FileRef 필드 + purpose · status · attachDeadlineAt)
  return api<FileRef>(`/files/uploads/${start.publicId}/complete`, { method: 'POST', body: parts ? { parts } : {} })
}

/* ======================================================================
 * 프로젝트 스레드 (31-task.md H-1 ~ H-5)
 * ==================================================================== */

/** ThreadItemResponse */
type ThreadItem = {
  threadId: number
  title: string | null
  body: string
  author: MemberRef | null
  createdAt: string
  editedAt: string | null
  editedBy: MemberRef | null
  pin: { pinnedAt: string; pinnedBy: MemberRef | null; order: number | null } | null
  replyCount: number
  lastActivityAt: string
  attachments: FileRef[]
  /** 연결한 자료실 자료 (ERP-18) */
  documents?: {
    documentId: number
    available: boolean
    title: string | null
    categoryName: string | null
    visibility: 'LAB' | 'PROJECT_MEMBERS' | 'PRIVATE' | null
    author: MemberRef | null
  }[]
  /** 본문에 링크한 다른 스레드 (ERP-20) */
  mentions?: {
    projectKey: string
    threadId: number
    available: boolean
    title: string | null
    excerpt: string | null
    author: MemberRef | null
    createdAt: string | null
  }[]
  convertedTask: TaskRef | null
  permissions: { canEdit: boolean; canDelete: boolean; canPin: boolean }
}
/** ThreadListResponse — page 에는 고정 안 된 글만 (최근 활동 순) */
type ThreadListResponse = {
  pinned: ThreadItem[]
  pinnedLimit: number
  page: PageResponse<ThreadItem>
  totalCount: number
  /** since 를 줬을 때만 */
  deletedThreadIds: number[] | null
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
  author: t.author?.name ?? '알 수 없음',
  createdAt: ago(t.createdAt),
  ago: ago(t.lastActivityAt),
  editedBy: t.editedBy?.name,
  editedAt: t.editedAt ? ago(t.editedAt) : undefined,
  body: t.body,
  pinnedOrder: t.pin?.order ?? null,
  pinnedBy: t.pin?.pinnedBy?.name,
  replyCount: t.replyCount,
  attachments: t.attachments.map((f) => ({
    name: f.name,
    size: humanSize(f.size),
    kind: f.contentType.startsWith('image/') ? 'image' : 'pdf',
    url: fileUrl(f.publicId),
  })),
  replies: [],
  documents: (t.documents ?? []).map((d) => ({ ...d, author: d.author?.name ?? null })),
  mentions: (t.mentions ?? []).map((m) => ({ ...m, author: m.author?.name ?? null, createdAt: m.createdAt ? ago(m.createdAt) : null })),
  canEdit: t.permissions.canEdit,
  canDelete: t.permissions.canDelete,
  canPin: t.permissions.canPin,
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
      return page.content.flatMap((c) => [c, ...(c.replies ?? [])]).map(toReply)
    },
  )
}

const toReply = (c: Comment): ThreadReply => ({
  author: c.author.name ?? '알 수 없음',
  ago: ago(c.createdAt),
  body: c.deleted || c.body === null ? '_삭제된 댓글입니다_' : c.body,
})

/** H-2 글쓰기. documentIds: 연결할 자료실 자료 (공용 · 이 프로젝트 자료, 10개 — P139 · P140) */
export async function createThread(projectKey: string, title: string, body: string, documentIds: number[] = []) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads`, {
    method: 'POST',
    body: { title: title || null, body, attachmentFileIds: [], documentIds },
  })
  return toThreadPost(t)
}

/** H-4 제목 · 본문 고치기 (ERP-33). 빈 제목은 지운다 (null) */
export async function updateThread(projectKey: string, threadId: number, title: string, body: string) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads/${threadId}`, {
    method: 'PATCH',
    body: { title: title.trim() || null, body },
  })
  return toThreadPost(t)
}

/** H-6 글 지우기 (ERP-33) */
export const deleteThread = (projectKey: string, threadId: number) =>
  api<unknown>(`/projects/${projectKey}/threads/${threadId}`, { method: 'DELETE' })

/** H-4 연결한 자료 바꾸기 (통째로, 빈 목록이면 모두 뺌) */
export async function updateThreadDocuments(projectKey: string, threadId: number, documentIds: number[]) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads/${threadId}`, { method: 'PATCH', body: { documentIds } })
  return toThreadPost(t)
}

/** 스레드에 걸 수 있는 자료 후보: 이 프로젝트 자료(공용 · 참여자만) + 공용 자료. "나만 보기" 는 뺀다 */
export type LinkableDocument = { documentId: number; title: string; categoryName: string; visibility: 'LAB' | 'PROJECT_MEMBERS'; author: string; inProject: boolean }
type DocumentPickDto = {
  documentId: number
  title: string
  categoryCode: string
  categoryName: string | null
  visibility: 'LAB' | 'PROJECT_MEMBERS' | 'PRIVATE'
  author: MemberRef | null
}
const MOCK_LINKABLE: LinkableDocument[] = [
  { documentId: 1, title: '11/17 주간 회의 자료', categoryName: '발표자료', visibility: 'PROJECT_MEMBERS', author: '박지훈', inProject: true },
  { documentId: 2, title: 'SSO 로그인 흐름도', categoryName: '개발 문서', visibility: 'LAB', author: '김민서', inProject: true },
  { documentId: 5, title: '연구실 발표 템플릿', categoryName: '양식', visibility: 'LAB', author: '박제민', inProject: false },
]
export function useLinkableDocuments(projectKey: string, keyword: string) {
  const q = keyword.trim()
  return useResource<LinkableDocument[]>(
    ['linkable-documents', projectKey, q.length >= 2 ? q : ''],
    () => MOCK_LINKABLE.filter((d) => q.length < 2 || d.title.includes(q)),
    async () => {
      const keywordQuery = q.length >= 2 ? q : undefined
      const [inProject, lab] = await Promise.all([
        api<{ pinned: DocumentPickDto[]; page: PageResponse<DocumentPickDto> }>('/documents', { query: { projectKey, keyword: keywordQuery, size: 50 } }),
        api<{ pinned: DocumentPickDto[]; page: PageResponse<DocumentPickDto> }>('/documents', { query: { keyword: keywordQuery, size: 50 } }),
      ])
      const seen = new Set<number>()
      const out: LinkableDocument[] = []
      const push = (d: DocumentPickDto, own: boolean) => {
        if (seen.has(d.documentId) || d.visibility === 'PRIVATE' || (!own && d.visibility !== 'LAB')) return
        seen.add(d.documentId)
        out.push({ documentId: d.documentId, title: d.title, categoryName: d.categoryName ?? d.categoryCode, visibility: d.visibility, author: d.author?.name ?? '알 수 없음', inProject: own })
      }
      ;[...inProject.pinned, ...inProject.page.content].forEach((d) => push(d, true))
      ;[...lab.pinned, ...lab.page.content].forEach((d) => push(d, false))
      return out
    },
  )
}

/** 언급할 스레드 고르기 (ERP-21): 2자 미만이면 이 프로젝트 최근 글(H-1), 2자 이상이면 검색(H-1b, 여러 프로젝트) */
export type MentionCandidate = { projectKey: string; threadId: number; title: string; author: string; ago: string }
export function useMentionCandidates(projectKey: string, keyword: string, enabled: boolean) {
  const q = keyword.trim()
  const titleOf = (t: { title: string | null; body: string }) => t.title ?? (t.body.split('\n').find((l) => l.trim()) ?? '스레드 글').slice(0, 60)
  return useResource<MentionCandidate[]>(
    ['mention-candidates', projectKey, q.length >= 2 ? q : '', enabled],
    () =>
      threadPosts
        .filter((p) => q.length < 2 || (p.title ?? p.body).includes(q))
        .slice(0, 10)
        .map((p) => ({ projectKey, threadId: p.postId, title: titleOf(p), author: p.author, ago: p.ago })),
    async () => {
      if (!enabled) return []
      if (q.length < 2) {
        const list = await api<ThreadListResponse>(`/projects/${projectKey}/threads`, { query: { size: 10 } })
        return [...list.pinned, ...list.page.content].slice(0, 10).map((t) => ({ projectKey, threadId: t.threadId, title: titleOf(t), author: t.author?.name ?? '', ago: ago(t.lastActivityAt) }))
      }
      const page = await api<PageResponse<ThreadItem & { project?: { projectKey: string } }>>('/projects/threads', { query: { keyword: q, size: 10 } })
      return page.content.map((t) => ({ projectKey: t.project?.projectKey ?? projectKey, threadId: t.threadId, title: titleOf(t), author: t.author?.name ?? '', ago: ago(t.createdAt) }))
    },
  )
}

/** 본문에 넣을 스레드 링크 (서버가 이 주소를 미리보기 카드로 바꾼다) */
export const threadLink = (c: { projectKey: string; threadId: number; title: string }) => `[${c.title.replace(/[[\]]/g, '')}](/projects/${c.projectKey}/threads/${c.threadId})`

/** H-4 상단 고정 · 해제. 제목 없는 글을 고정할 때는 title 을 함께 보낸다 */
export async function pinThread(projectKey: string, threadId: number, pinned: boolean, title?: string) {
  const t = await api<ThreadItem>(`/projects/${projectKey}/threads/${threadId}`, {
    method: 'PATCH',
    body: title === undefined ? { pinned } : { pinned, title },
  })
  return toThreadPost(t)
}

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
/** MinuteDetailResponse */
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
  createdAt: string
  updatedAt: string
  permissions: { edit: boolean; delete: boolean; convertActions: boolean }
}
/** MinuteSummaryResponse */
type MinuteSummary = {
  minuteId: number
  title: string
  startsAt: string
  endsAt: string
  project: { projectKey: string; name: string } | null
  author: MemberRef
  templateCode: string | null
  attendeeCount: number
  actionCount: number
  convertedTaskCount: number
  updatedAt: string
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
  // 양식 코드는 공통코드 PROJECT_CATEGORY 코드다 (MinuteFacade.validate). 응답에 이름이 없어 카테고리 이름으로 보여 준다
  template: d.templateCode ? `양식 · ${projectCategoryName(d.templateCode)}` : '양식 없음',
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

/** 이 프로젝트의 회의록 목록 (MM-1 GET /meeting-minutes?projectKey=). 서버는 회의 시작 시각 최신순 */
export function useMinuteList(projectKey: string) {
  return useResource<MinuteList>(
    ['minutes', projectKey],
    () => ({ latest: { id: mockMinutes[0].minuteId, title: mockMinutes[0].title }, others: otherMinutes }),
    async () => {
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

/** MM-8 할 일 여러 개를 작업으로. 바뀐 할 일을 돌려준다 */
export async function convertMinuteActions(minuteId: number, actionIds: number[]) {
  const res = await api<{ actions: MinuteAction[] }>(`/meeting-minutes/${minuteId}/actions/convert-to-tasks`, {
    method: 'POST',
    body: { actionIds },
  })
  return res.actions.map(toTodo)
}

/* ======================================================================
 * 주간 보고 (32-minute-report.md WR-1 ~ WR-8)
 * 2026-11-20: 한 사람 한 장 안에 진행 중 프로젝트마다 칸(한 일 · 계획 · 이슈) + 공통 메모
 * ==================================================================== */

export type ReportFields = { done: string; next: string; issues: string }
export type ReportTaskChip = { key: string; title: string; status: string; projectKey: string }
/** 프로젝트 칸. detached = 이제 그 프로젝트에 진행 중으로 참여하지 않지만 쓴 내용이 있어 남은 칸 (제출 때 필수 아님) */
export type ReportSectionView = { projectKey: string; projectName: string; fields: ReportFields; detached: boolean }
export type WeekRef = ReportWeek & { weekStartOn: string }
export type MyWeekReport = {
  reportId: number | null
  meId: number | null
  /** 프로젝트 밖 일 (선택) */
  note: string
  sections: ReportSectionView[]
  tasks: ReportTaskChip[]
  /** 작업 연동에서 뺀 작업 (WR-3 의 tasks[].excluded) */
  excludedKeys: string[]
  /** 뺀 작업 칩 ("작업 넣기"로 되돌릴 수 있는 것) */
  excluded: ReportTaskChip[]
  submitted: boolean
  editable: boolean
  dueText: string
  /** 서버가 정한 그 주 마감 (공통코드 WEEKLY_REPORT_POLICY 를 반영한 dueAt). 목업은 없음 */
  deadline?: string
}
export type LastWeek = {
  /** "지난 주 복사" 때 칸마다 덮어쓸 값 (프로젝트 키 → 지난 주 계획을 이번 주 한 일로) */
  copy: Record<string, Partial<ReportFields>>
  comment: { author: string; confirmed: boolean; body: string } | null
}
export type GithubActivity = {
  fetchedAgo: string
  rows: { repo: string; branch: string; commits: number; add: number; del: number; projectKey: string | null }[]
  totals: { c: number; add: number; del: number }
  mergeCount: number
}

/** ReportTaskResponse (ReportTaskKind: DONE · IN_PROGRESS) */
type ReportTask = { task: TaskRef; projectKey: string; kind: 'DONE' | 'IN_PROGRESS'; excluded: boolean; note: string | null }
/** ReportDetailResponse — 저장한 적 없는 주는 reportId 가 null 인 빈 초안 */
type ReportDetail = {
  reportId: number | null
  member: MemberRef
  weekStartOn: string
  weekEndOn: string
  dueAt: string
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'
  late: boolean
  submittedAt: string | null
  confirmedAt: string | null
  confirmedBy: MemberRef | null
  commonNote: string | null
  sections: ReportSectionDto[]
  hiddenSectionCount: number
  tasks: ReportTask[]
  hiddenTaskCount: number
  updatedAt: string | null
  editable: boolean
  /** confirmBlockedReason: 확인 권한은 있지만 지금 확인할 수 없는 이유 (자기 보고 등) */
  permissions: { edit: boolean; confirm: boolean; comment: boolean; confirmBlockedReason: string | null }
}
/** ReportSectionResponse */
type ReportSectionDto = {
  project: { projectKey: string; name: string }
  doneText: string | null
  planText: string | null
  issueText: string | null
  detached: boolean
}
/** ReportSummaryResponse */
type ReportSummary = {
  reportId: number
  member: MemberRef
  weekStartOn: string
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'
  late: boolean
  submittedAt: string | null
  doneSummary: string | null
  projectKeys: string[] | null
  taskCounts: { done: number; inProgress: number }
  commentCount: number
}
/** ReportListResponse — week · counts · missingMembers 는 weekStartOn 으로 불렀을 때만 */
type ReportListResponse = {
  week: { weekStartOn: string; weekEndOn: string; dueAt: string } | null
  counts: { submitted: number; late: number; missing: number } | null
  missingMembers: MemberRef[] | null
  page: PageResponse<ReportSummary>
}
/** GithubActivityResponse */
type GithubActivityResponse = {
  weekStartOn: string
  lastFetchedAt: string | null
  rows: {
    member: MemberRef | null
    authorLogin: string | null
    repository: { repositoryId: number; fullName: string; projectKey: string } | null
    hidden: boolean
    commitCount: number
    mergeCommitCount: number
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
    // 마감은 공통코드 WEEKLY_REPORT_POLICY 를 따른다. 주 목록은 기본값(다음 월요일 10:00)으로 그리고,
    // 화면 머리는 내 보고(WR-2)의 dueAt 을 받으면 그 값(MyWeekReport.deadline)을 보여 준다
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

/** dueAt(ISO) → 'MM/DD(요일) HH:mm' (KST) */
function deadlineText(iso: string) {
  const d = kst(iso)
  return `${md(d)}(${WEEKDAY[d.getUTCDay()]}) ${hm(d)}`
}

const toChip = (t: ReportTask): ReportTaskChip => ({
  key: t.task.taskKey,
  title: t.task.title,
  status: taskStatusName(t.task.status),
  projectKey: t.projectKey,
})

const toSection = (x: ReportSectionDto): ReportSectionView => ({
  projectKey: x.project.projectKey,
  projectName: x.project.name,
  fields: { done: x.doneText ?? '', next: x.planText ?? '', issues: x.issueText ?? '' },
  detached: x.detached,
})

const toMyReport = (r: ReportDetail): MyWeekReport => ({
  reportId: r.reportId,
  meId: r.member.memberId,
  note: r.commonNote ?? '',
  sections: r.sections.map(toSection),
  tasks: r.tasks.filter((t) => !t.excluded).map(toChip),
  excludedKeys: r.tasks.filter((t) => t.excluded).map((t) => t.task.taskKey),
  excluded: r.tasks.filter((t) => t.excluded).map(toChip),
  submitted: r.status !== 'DRAFT',
  editable: r.editable,
  dueText: dueText(r.dueAt),
  deadline: deadlineText(r.dueAt),
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
      note: isCurrent ? myReport.note : '',
      sections: isCurrent
        ? myReport.sections.map((x) => ({ ...x, fields: { ...x.fields } }))
        : myReport.sections.map((x) => ({ ...x, fields: lastWeekReport[x.projectKey] ?? { done: '', next: '', issues: '' } })),
      tasks: isCurrent ? myReport.tasks : [],
      excludedKeys: [],
      excluded: [],
      submitted: false,
      editable: isCurrent,
      dueText: '마감까지 2시간',
    },
    async () => toMyReport(await api<ReportDetail>(`/weekly-reports/me/${weekStartOn}`)),
  )
}

/**
 * WR-3 자동 저장 (PUT /weekly-reports/me/{weekStartOn}).
 * 서버는 보낸 작업만 조정하고, 안 보낸 작업은 앞서 저장한 조정을 그대로 둔다 (WeeklyReportService.adjust).
 * 그래서 뺀 작업은 excluded: true, 되돌린 작업(includedKeys)은 excluded: false 로 보낸다.
 * 자동 채우기 대상이 아닌 작업 키는 P238 이라 서버가 준 목록 안의 키만 보낸다.
 */
export async function saveMyReport(
  weekStartOn: string,
  content: Pick<MyWeekReport, 'note' | 'sections'>,
  excludedKeys: string[],
  includedKeys: string[] = [],
) {
  const r = await api<ReportDetail>(`/weekly-reports/me/${weekStartOn}`, {
    method: 'PUT',
    body: {
      commonNote: content.note,
      // 칸은 서버가 진행 중 프로젝트에 맞춰 만든다. 화면에 있는 칸만 보낸다 (없는 칸이면 P243)
      sections: content.sections.map((x) => ({
        projectKey: x.projectKey,
        doneText: x.fields.done,
        planText: x.fields.next,
        issueText: x.fields.issues,
      })),
      tasks: [
        ...includedKeys.map((taskKey) => ({ taskKey, excluded: false, note: null })),
        ...excludedKeys.map((taskKey) => ({ taskKey, excluded: true, note: null })),
      ],
    },
  })
  return toMyReport(r)
}

/** WR-5 제출 (PATCH /weekly-reports/{id} { status: SUBMITTED }). 아직 한 번도 저장하지 않았으면 먼저 WR-3 으로 만든다 */
export async function submitMyReport(weekStartOn: string, report: MyWeekReport) {
  const saved = await saveMyReport(weekStartOn, report, report.excludedKeys)
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
        .map((r) => ({
          name: r.member.name,
          state: r.late ? 'LATE' : 'SUBMITTED',
          summary: r.doneSummary ?? '',
          reportId: r.reportId,
          projectKeys: r.projectKeys ?? [],
        }))
      return [...done, ...missing.map((m): Submission => ({ name: m.name, state: 'MISSING' }))]
    },
  )
}

/** 지난 주 보고: "지난 주 복사" 와 지난 주 코멘트 (WR-2 + CM-1 targetType=WEEKLY_REPORT) */
export function useLastWeek(currentWeekStartOn: string) {
  return useResource<LastWeek>(
    ['report-last-week', currentWeekStartOn],
    () => ({
      copy: Object.fromEntries(Object.entries(lastWeekReport).map(([key, f]) => [key, { done: f.next }])),
      comment: lastWeekComment,
    }),
    async () => {
      const last = await api<ReportDetail>(`/weekly-reports/me/${prevMonday(currentWeekStartOn)}`)
      // 지난 주 칸마다 계획을 이번 주 같은 프로젝트 칸의 한 일로 옮긴다 (32 문서 "지난 주 복사", 칸별)
      const copy: LastWeek['copy'] = {}
      for (const x of last.sections ?? []) copy[x.project.projectKey] = { done: x.planText ?? '' }
      if (last.reportId === null || last.status === 'DRAFT') return { copy, comment: null }
      const page = await listComments('WEEKLY_REPORT', last.reportId)
      const c = page.content.find((x) => !x.deleted && x.body)
      return {
        copy,
        comment: c ? { author: c.author.name ?? '알 수 없음', confirmed: last.status === 'CONFIRMED', body: c.body ?? '' } : null,
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
            ? [{ repo: '비공개 저장소', branch: '', commits: r.commitCount, add: r.additions, del: r.deletions, projectKey: null as string | null }]
            : r.branches.map((b) => ({
                repo: r.repository!.fullName,
                branch: b.branch,
                commits: b.commitCount,
                add: b.additions,
                del: b.deletions,
                projectKey: r.repository!.projectKey,
              })),
        ),
        // 브랜치 합은 같은 커밋을 여러 번 셀 수 있어 합계는 서버 값을 쓴다
        totals: { c: res.totals.commitCount, add: res.totals.additions, del: res.totals.deletions },
        mergeCount: res.totals.mergeCommitCount,
      }
    },
  )
}

/** 남의 보고 한 장 (WR-4) — 구성원별 보고에서 펼쳐 보기 · 확인 */
export type ReportView = {
  reportId: number
  author: string
  /** 작성자 · 주 — GitHub 활동(WR-6)을 부를 때 (ERP-39) */
  memberId: number | null
  weekStartOn: string
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'
  late: boolean
  note: string
  sections: ReportSectionView[]
  hiddenSectionCount: number
  tasks: ReportTaskChip[]
  confirmedBy: string | null
  canConfirm: boolean
  /** 확인 권한은 있지만 막힌 이유 (자기 보고 — P245) */
  confirmBlockedReason: string | null
  canComment: boolean
}

const toReportView = (r: ReportDetail): ReportView => ({
  reportId: r.reportId ?? 0,
  author: r.member.name ?? '알 수 없음',
  memberId: r.member.memberId ?? null,
  weekStartOn: r.weekStartOn,
  status: r.status,
  late: r.late,
  note: r.commonNote ?? '',
  sections: r.sections.map(toSection),
  hiddenSectionCount: r.hiddenSectionCount,
  tasks: r.tasks.filter((t) => !t.excluded).map(toChip),
  confirmedBy: r.confirmedBy?.name ?? null,
  canConfirm: r.permissions.confirm,
  confirmBlockedReason: r.permissions.confirmBlockedReason,
  canComment: r.permissions.comment,
})

export function useReportView(reportId: number | null) {
  return useResource<ReportView>(
    ['report-view', reportId],
    () => {
      // 목업의 나는 김민서(11번 보고). 자기 보고는 확인을 막는다 (P245)
      const own = reportId === 11
      return {
        reportId: reportId ?? 0,
        author: own ? '김민서' : '박지훈',
        memberId: own ? 2 : 3,
        weekStartOn: reportWeeks()[reportWeeks().length - 1].weekStartOn,
        status: 'SUBMITTED',
        late: false,
        note: own ? myReport.note : '',
        sections: own ? myReport.sections : myReport.sections.slice(0, 1),
        hiddenSectionCount: 0,
        tasks: myReport.tasks,
        confirmedBy: null,
        canConfirm: !own,
        confirmBlockedReason: own ? '자기 주간 보고는 확인할 수 없어요. 다른 검토자가 확인해야 해요.' : null,
        canComment: true,
      }
    },
    async () => toReportView(await api<ReportDetail>(`/weekly-reports/${reportId}`)),
  )
}

/** WR-5 확인 (report-review). 자기 보고는 P245 */
export async function confirmReport(reportId: number) {
  return toReportView(await api<ReportDetail>(`/weekly-reports/${reportId}`, { method: 'PATCH', body: { status: 'CONFIRMED' } }))
}

/** 프로젝트의 그 주 주간 보고 (WR-8) */
export type ProjectWeekRow = {
  memberId: number
  name: string
  role: string
  reportId: number | null
  state: 'SUBMITTED' | 'LATE' | 'CONFIRMED' | 'MISSING'
  section: ReportFields | null
}
export type ProjectWeek = { target: boolean; rows: ProjectWeekRow[]; counts: { submitted: number; late: number; missing: number } }

type ProjectReportWeekResponse = {
  target: boolean
  counts: { submitted: number; late: number; missing: number }
  rows: {
    member: MemberRef
    role: string
    reportId: number | null
    status: 'SUBMITTED' | 'CONFIRMED' | null
    late: boolean
    section: ReportSectionDto | null
  }[]
}

export function useProjectWeek(projectKey: string | undefined, weekStartOn: string) {
  return useResource<ProjectWeek>(
    ['project-report-week', projectKey, weekStartOn],
    () => ({
      target: true,
      counts: { submitted: 1, late: 0, missing: 1 },
      rows: [
        { memberId: 2, name: '김민서', role: 'MANAGER', reportId: 11, state: 'SUBMITTED', section: myReport.sections[0].fields },
        { memberId: 4, name: '한유진', role: 'MEMBER', reportId: null, state: 'MISSING', section: null },
      ],
    }),
    async () => {
      const res = await api<ProjectReportWeekResponse>(`/weekly-reports/projects/${encodeURIComponent(projectKey ?? '')}`, {
        query: { weekStartOn },
      })
      return {
        target: res.target,
        counts: res.counts,
        rows: res.rows.map((r) => ({
          memberId: r.member.memberId,
          name: r.member.name ?? '알 수 없음',
          role: r.role,
          reportId: r.reportId,
          state: r.status === null ? 'MISSING' : r.status === 'CONFIRMED' ? 'CONFIRMED' : r.late ? 'LATE' : 'SUBMITTED',
          section: r.section ? { done: r.section.doneText ?? '', next: r.section.planText ?? '', issues: r.section.issueText ?? '' } : null,
        })),
      }
    },
  )
}

/** 프로젝트 칸 코멘트: 공통 댓글(WEEKLY_REPORT)의 본문 맨 앞에 [프로젝트 키] 를 붙여 그 칸 것으로 본다 */
export const sectionCommentPrefix = (projectKey: string) => `[${projectKey}] `

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

/** document 모듈 DocumentSummaryResponse */
type DocumentItem = {
  documentId: number
  categoryCode: string
  categoryName: string | null
  title: string
  author: MemberRef
  project: { projectKey: string; name: string } | null
  visibility: 'LAB' | 'PROJECT_MEMBERS' | 'PRIVATE'
  folder?: { folderId: number; name: string; path: string } | null
  tags: string[]
  fileTypes: string[]
  latestVersion: number | null
  commentCount: number
  resolved: boolean | null
  pinned: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
/**
 * DocumentListResponse.
 * - pinned: 같은 거르기 조건에 맞는 고정 자료 (첫 페이지에서만). page 에는 고정 안 된 자료만 온다
 * - categoryCounts: 공통코드 DOCUMENT_CATEGORY 전부(표시 순서, 0 포함). ALL 은 없다
 */
type DocumentListResponse = {
  pinned: DocumentItem[]
  categoryCounts: Record<string, number>
  page: PageResponse<DocumentItem>
}

/** 화면 자료 + 서버의 카테고리 이름 (공통코드라 화면 기본 7개 밖의 코드도 온다) */
export type LibraryDocument = Omit<DocumentSummary, 'categoryCode'> & { categoryCode: string; categoryName?: string }

export type LibrarySort = '최신순' | '댓글 많은 순' | '제목순'
/** 화면의 거르기 값 (프로젝트 · 작성자는 화면에 보이는 이름, category 는 'ALL' 또는 카테고리 코드) */
export type LibraryFilter = {
  category: string
  tag: string
  project: string
  author: string
  fileType: string
  sort: LibrarySort
  /** 폴더 바로 안의 자료만 (null 이면 거르지 않음) */
  folderId?: number | null
}
export type LibraryData = {
  documents: LibraryDocument[]
  /** 탭 (서버 순서) */
  categories: { code: string; name: string }[]
  categoryCounts: Record<string, number>
  pinnedDocs: { documentId: number; title: string; meta: string }[]
  unresolved: LibraryDocument[]
  popularTags: string[]
  options: { tags: string[]; projects: string[]; authors: string[]; types: string[] }
}

const uniq = (xs: string[]) => [...new Set(xs)].sort()

// 서버가 준 카테고리 이름 (공통코드 목록 API 는 code-manage 권한만 부를 수 있어 응답에서 기억해 둔다)
const seenDocCategories = new Map<string, string>()
export const documentCategoryName = (code: string) => seenDocCategories.get(code) ?? CATEGORY_NAME[code as DocumentCategory] ?? code

function mockLibrary(): LibraryData {
  return {
    documents: mockDocuments,
    categories: (Object.keys(CATEGORY_NAME) as DocumentCategory[]).map((code) => ({ code, name: CATEGORY_NAME[code] })),
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

const toDocument = (d: DocumentItem): LibraryDocument => {
  seenAuthors.set(d.author.name, d.author.memberId)
  if (d.project) seenProjects.set(d.project.name, d.project.projectKey)
  if (d.categoryName) seenDocCategories.set(d.categoryCode, d.categoryName)
  d.fileTypes.forEach((t) => seenTypes.add(t))
  return {
    documentId: d.documentId,
    categoryCode: d.categoryCode,
    categoryName: d.categoryName ?? documentCategoryName(d.categoryCode),
    title: d.title,
    author: d.author.name,
    ago: ago(d.createdAt),
    ageMinutes: Math.max(0, Math.round((Date.now() - new Date(d.createdAt).getTime()) / 60000)),
    project: d.project,
    visibility: d.visibility,
    folderPath: d.folder?.path ?? null,
    tags: d.tags,
    fileTypes: d.fileTypes,
    latestVersion: d.latestVersion ?? 1,
    commentCount: d.commentCount,
    resolved: d.resolved,
    pinned: d.pinned,
  }
}

/**
 * 서버 정렬 (DocumentService: createdAt · updatedAt 과 commentCount 만 받는다, 모두 내림차순).
 * 백엔드에 제목 정렬이 없어 제목순은 최신순으로 받고 화면에서 다시 정렬한다 (한 번에 100개까지라 그 안에서만 맞다).
 */
const SORT_PARAM: Record<LibrarySort, string> = {
  최신순: 'createdAt,desc',
  '댓글 많은 순': 'commentCount,desc',
  제목순: 'createdAt,desc',
}

/** 자료실 목록 · 고정 자료 · 카테고리 개수 · 해결 안 된 질문 · 많이 쓰는 태그 (D-1, D-8) */
export function useLibrary(f: LibraryFilter) {
  return useResource<LibraryData>(['library', f], mockLibrary, async () => {
    const filtered = f.category !== 'ALL' || !!f.tag || !!f.project || !!f.author || !!f.fileType || f.folderId != null
    const [list, unresolvedList, tags, all] = await Promise.all([
      api<DocumentListResponse>('/documents', {
        query: {
          categoryCode: f.category === 'ALL' ? undefined : f.category,
          tag: f.tag || undefined,
          projectKey: f.project ? seenProjects.get(f.project) : undefined,
          authorId: f.author ? seenAuthors.get(f.author) : undefined,
          fileType: f.fileType || undefined,
          folderId: f.folderId ?? undefined,
          sort: SORT_PARAM[f.sort],
          size: 100,
        },
      }),
      // 해결 안 된 질문: unresolved 는 해결 표시가 되는 카테고리(공통코드 extra=Y, 기본 QNA)만 거른다
      api<DocumentListResponse>('/documents', { query: { unresolved: true, size: 5 } }),
      api<{ tag: string; count: number }[]>('/documents/tags', { query: { limit: 30 } }),
      // 옆 칸 "고정 자료"는 거르기 없이 본 전체 고정 자료. pinned 는 목록과 같은 조건으로 걸러지므로 거르기 중이면 따로 받는다
      filtered ? api<DocumentListResponse>('/documents', { query: { size: 1 } }) : Promise.resolve(null),
    ])
    const page = list.page.content.map(toDocument)
    const pinned = list.pinned.map(toDocument)
    const allPinned = (all ?? list).pinned
    return {
      documents: [...pinned, ...page],
      categories: Object.keys(list.categoryCounts).map((code) => ({ code, name: documentCategoryName(code) })),
      categoryCounts: list.categoryCounts,
      pinnedDocs: allPinned.map((d) => ({
        documentId: d.documentId,
        title: d.title,
        meta: [d.categoryName ?? documentCategoryName(d.categoryCode), d.fileTypes[0]?.toUpperCase()].filter(Boolean).join(' · '),
      })),
      // 고정된 질문은 pinned 쪽에 온다
      unresolved: [...unresolvedList.pinned, ...unresolvedList.page.content].slice(0, 5).map(toDocument),
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
