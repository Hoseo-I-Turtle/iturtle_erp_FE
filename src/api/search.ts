// 통합 검색 (CMN-2) — docs/api/60-common.md 2. 통합 검색
// 검색 API 는 따로 없다. 종류마다 목록 API 를 keyword 로 동시에 부르고(size 5) 종류별로 묶는다.
// 볼 권한 거르기는 각 API 가 하므로 화면은 받은 것을 그대로 보여 준다.
import { api } from './client'
import { getDataMode } from '../lib/dataMode'
import { ago, dotDate, type PageResponse } from './types'
import { useResource } from './useResource'
import type { NoticeListDto } from './communication'
import type { DocumentListResponse, ThreadItem } from './content'
import type { MinuteSummaryDto } from './minutes'
import { PROJECT_STATUS_LABEL, type ProjectListResponse, type TaskListResponse } from './projects'
import type { MembersResponse } from './members'
import { CATEGORY_LABEL, mockPolicies, STATUS_LABEL as POLICY_STATUS_LABEL, type Policy } from './policies'
import { noticeRows } from '../mocks/notices'
import { documents as mockDocuments, CATEGORY_NAME } from '../mocks/documents'
import { STATUS_NAME, tasks as mockTasks, type TaskStatus } from '../mocks/tasks'
import { minuteRows } from '../mocks/minuteList'
import { threadPosts } from '../mocks/threads'
import { projects as mockProjects, PROJECT_CATEGORY_NAME } from '../mocks/projects'
import { MEMBER_TYPE_NAME, members as mockMembers } from '../mocks/members'

export type SearchKind = 'NOTICE' | 'TASK' | 'DOCUMENT' | 'MINUTE' | 'THREAD' | 'POLICY' | 'PROJECT' | 'MEMBER'

/** 화면에 묶어 보여 주는 순서 */
export const SEARCH_KINDS: { kind: SearchKind; label: string }[] = [
  { kind: 'NOTICE', label: '공지' },
  { kind: 'TASK', label: '작업' },
  { kind: 'DOCUMENT', label: '자료' },
  { kind: 'MINUTE', label: '회의록' },
  { kind: 'THREAD', label: '스레드' },
  { kind: 'POLICY', label: '정책' },
  { kind: 'PROJECT', label: '프로젝트' },
  { kind: 'MEMBER', label: '구성원' },
]

/** 종류마다 한 번에 받는 개수 */
export const SEARCH_SIZE = 5
/** 이보다 짧으면 부르지 않는다 (API 도 400, CMN-2-03) */
export const MIN_KEYWORD = 2

/** 결과 한 줄. to 가 null 이면 갈 화면이 없다 (프로젝트 밖 회의록 등) */
export type SearchHit = { id: string; title: string; meta: string; to: string | null }
/** 한 종류의 한 페이지 */
export type SearchPage = { hits: SearchHit[]; total: number; hasMore: boolean }
/** 한 종류의 첫 결과. 그 API 만 실패하면 error 에 문구를 담고 다른 종류는 그대로 보여 준다 */
export type SearchGroup = SearchPage & { kind: SearchKind; error: string | null }

const taskStatusName = (s: string) => (s in STATUS_NAME ? STATUS_NAME[s as TaskStatus] : s === 'CANCELLED' ? '취소' : s)
const join = (...xs: (string | null | undefined | false)[]) => xs.filter(Boolean).join(' · ')
const fromPage = <T>(p: PageResponse<T>, toHit: (x: T) => SearchHit, extra: T[] = []): SearchPage => ({
  hits: [...extra, ...p.content].map(toHit),
  total: p.totalElements + extra.length,
  hasMore: p.hasNext,
})

// ───────────────────────── 실서버: 종류마다 목록 API ─────────────────────────

type Fetcher = (keyword: string, page: number) => Promise<SearchPage>

const LIVE: Record<SearchKind, Fetcher> = {
  // N-1. 고정 공지는 첫 페이지의 pinned 에만 오고 page 에서는 빠진다
  NOTICE: async (keyword, page) => {
    const r = await api<NoticeListDto>('/notices', { query: { keyword, page, size: SEARCH_SIZE } })
    return fromPage(
      r.page,
      (n) => ({ id: String(n.noticeId), title: n.title, meta: join(n.mustRead && '필독', n.author.name, ago(n.publishedAt ?? n.createdAt)), to: `/notices/${n.noticeId}` }),
      page === 0 ? r.pinned : [],
    )
  },
  // T-1. 프로젝트를 고르지 않으면 볼 수 있는 프로젝트 전부에서 찾는다
  TASK: async (keyword, page) => {
    const r = await api<TaskListResponse>('/tasks', { query: { keyword, sort: 'updatedAt,desc', page, size: SEARCH_SIZE } })
    return fromPage(r.page, (t) => ({
      id: t.taskKey,
      title: t.title,
      meta: join(t.taskKey, taskStatusName(t.status), t.assignee?.name ?? '담당자 없음', t.dueOn && `기한 ${dotDate(t.dueOn)}`),
      to: `/projects/${t.projectKey}/tasks/${t.taskKey}`,
    }))
  },
  // D-1. 고정 자료도 첫 페이지의 pinned 에만 온다
  DOCUMENT: async (keyword, page) => {
    const r = await api<DocumentListResponse>('/documents', { query: { keyword, page, size: SEARCH_SIZE } })
    return fromPage(
      r.page,
      (d) => ({
        id: String(d.documentId),
        title: d.title,
        meta: join(d.categoryName ?? d.categoryCode, d.project?.name, d.author.name, ago(d.updatedAt)),
        to: `/library/${d.documentId}`,
      }),
      page === 0 ? r.pinned : [],
    )
  },
  // MM-1. 프로젝트 밖(연구실) 회의록은 갈 화면이 아직 없다
  MINUTE: async (keyword, page) => {
    const r = await api<PageResponse<MinuteSummaryDto>>('/meeting-minutes', { query: { keyword, page, size: SEARCH_SIZE } })
    return fromPage(r, (m) => ({
      id: String(m.minuteId),
      title: m.title,
      meta: join(m.project?.name ?? '연구실', dotDate(m.startsAt), m.author.name),
      to: m.project ? `/projects/${m.project.projectKey}/minutes/${m.minuteId}` : null,
    }))
  },
  // H-1b. 여러 프로젝트의 스레드 글
  THREAD: async (keyword, page) => {
    const r = await api<PageResponse<ThreadItem & { project?: { projectKey: string; name: string } }>>('/projects/threads', {
      query: { keyword, page, size: SEARCH_SIZE },
    })
    return fromPage(r, (t) => ({
      id: String(t.threadId),
      title: t.title || firstLine(t.body),
      meta: join(t.project?.name, t.author?.name, ago(t.createdAt), t.replyCount > 0 && `답글 ${t.replyCount}`),
      to: t.project ? `/projects/${t.project.projectKey}/threads/${t.threadId}` : null,
    }))
  },
  // PL-0. page 가 없고 size 만 있어 "더 보기"는 더 크게 받아 뒷부분만 쓴다
  POLICY: async (keyword, page) => {
    const size = (page + 1) * SEARCH_SIZE
    const r = await api<{ policies: { projectKey: string; projectName: string; policy: Policy }[]; totalElements: number }>('/projects/policies', {
      query: { keyword, size },
    })
    return {
      hits: r.policies.slice(page * SEARCH_SIZE).map((x) => policyHit(x.projectKey, x.projectName, x.policy)),
      total: r.totalElements,
      hasMore: r.totalElements > size,
    }
  },
  // P-1
  PROJECT: async (keyword, page) => {
    const r = await api<ProjectListResponse>('/projects', { query: { keyword, page, size: SEARCH_SIZE } })
    return fromPage(r.page, (p) => ({
      id: p.projectKey,
      title: p.name,
      meta: join(p.projectKey, p.categoryName ?? p.categoryCode, PROJECT_STATUS_LABEL[p.status] ?? p.status, `${p.memberCount}명`),
      to: `/projects/${p.projectKey}`,
    }))
  },
  // 2-1. 졸업생도 찾는다. 연락처 · 이메일은 보여 주지 않는다 (NFR-PRI-02)
  MEMBER: async (keyword, page) => {
    const r = await api<MembersResponse>('/members', { query: { keyword, group: 'ALL', page, size: SEARCH_SIZE } })
    return fromPage(r.page, (m) => ({
      id: String(m.memberId),
      title: m.name,
      meta: join(MEMBER_TYPE_NAME[m.memberType], m.status === 'ACTIVE' ? '재실' : m.status === 'ON_LEAVE' ? '휴학' : '졸업', m.intro),
      to: `/members?member=${m.memberId}`,
    }))
  },
}

const firstLine = (body: string) => body.split('\n').find((l) => l.trim())?.replace(/[#>*`_-]/g, '').trim().slice(0, 80) || '(제목 없음)'

const policyHit = (projectKey: string, projectName: string, p: Policy): SearchHit => ({
  id: p.key,
  title: p.title,
  meta: join(p.key, projectName, CATEGORY_LABEL[p.category], POLICY_STATUS_LABEL[p.status]),
  to: `/projects/${projectKey}/policies/${p.key}`,
})

// ───────────────────────── 목업: 목업 데이터에서 글자로 찾기 ─────────────────────────

const has = (kw: string, ...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(kw.toLowerCase()))

function mockHits(kind: SearchKind, kw: string): SearchHit[] {
  switch (kind) {
    case 'NOTICE':
      return noticeRows
        .filter((n) => has(kw, n.title, n.author))
        .map((n) => ({ id: n.id, title: n.title, meta: join(n.mustRead && '필독', n.author, n.date), to: `/notices/${n.id}` }))
    case 'TASK':
      return mockTasks
        .filter((t) => has(kw, t.title, t.taskKey))
        .map((t) => ({
          id: t.taskKey,
          title: t.title,
          meta: join(t.taskKey, STATUS_NAME[t.status], t.assignee ?? '담당자 없음', t.dueOn && `기한 ${t.dueOn}`),
          to: `/projects/${t.taskKey.replace(/-\d+$/, '')}/tasks/${t.taskKey}`,
        }))
    case 'DOCUMENT':
      return mockDocuments
        .filter((d) => has(kw, d.title, ...d.tags))
        .map((d) => ({ id: String(d.documentId), title: d.title, meta: join(CATEGORY_NAME[d.categoryCode], d.project?.name, d.author, d.ago), to: `/library/${d.documentId}` }))
    case 'MINUTE':
      return minuteRows
        .filter((m) => has(kw, m.title, m.author))
        .map((m) => ({ id: String(m.minuteId), title: m.title, meta: join('DEFME 백엔드', `${m.month}/${m.day}(${m.weekday})`, m.author), to: `/projects/DEFME/minutes/${m.minuteId}` }))
    case 'THREAD':
      return threadPosts
        .filter((t) => has(kw, t.title, t.body))
        .map((t) => ({
          id: String(t.postId),
          title: t.title || firstLine(t.body),
          meta: join('DEFME 백엔드', t.author, t.ago, t.replyCount > 0 && `답글 ${t.replyCount}`),
          to: `/projects/DEFME/threads/${t.postId}`,
        }))
    case 'POLICY':
      return mockProjects
        .flatMap((pr) => mockPolicies(pr.projectKey).map((p) => ({ pr, p })))
        .filter(({ p }) => has(kw, p.key, p.title, p.rule))
        .map(({ pr, p }) => policyHit(pr.projectKey, pr.name, p))
    case 'PROJECT':
      return mockProjects
        .filter((p) => has(kw, p.name, p.projectKey, p.summary))
        .map((p) => ({ id: p.projectKey, title: p.name, meta: join(p.projectKey, PROJECT_CATEGORY_NAME[p.categoryCode], PROJECT_STATUS_LABEL[p.status]), to: `/projects/${p.projectKey}` }))
    case 'MEMBER':
      return mockMembers
        .filter((m) => has(kw, m.name, m.memberNo))
        .map((m) => ({ id: String(m.memberId), title: m.name, meta: join(MEMBER_TYPE_NAME[m.memberType], m.status === 'ACTIVE' ? '재실' : '졸업', m.intro), to: `/members?member=${m.memberId}` }))
  }
}

const mockPage = (kind: SearchKind, kw: string, page: number): SearchPage => {
  const all = mockHits(kind, kw)
  return { hits: all.slice(page * SEARCH_SIZE, (page + 1) * SEARCH_SIZE), total: all.length, hasMore: all.length > (page + 1) * SEARCH_SIZE }
}

// ───────────────────────── 화면이 쓰는 것 ─────────────────────────

const failText = '불러오지 못했어요'

/**
 * 종류별 첫 결과 (size 5). 실서버는 모든 종류를 동시에 부르고(Promise.allSettled) 실패한 종류만 error 로 표시한다.
 * keyword 가 2자 미만이면 부르지 않고 빈 목록을 준다.
 */
export function useUnifiedSearch(keyword: string) {
  const kw = keyword.trim()
  const enough = kw.length >= MIN_KEYWORD
  return useResource<SearchGroup[]>(
    ['unified-search', kw],
    () => SEARCH_KINDS.map(({ kind }) => ({ kind, error: null, ...(enough ? mockPage(kind, kw, 0) : { hits: [], total: 0, hasMore: false }) })),
    async () => {
      if (!enough) return SEARCH_KINDS.map(({ kind }) => ({ kind, hits: [], total: 0, hasMore: false, error: null }))
      const settled = await Promise.allSettled(SEARCH_KINDS.map(({ kind }) => LIVE[kind](kw, 0)))
      return SEARCH_KINDS.map(({ kind }, i) => {
        const r = settled[i]
        return r.status === 'fulfilled' ? { kind, error: null, ...r.value } : { kind, hits: [], total: 0, hasMore: false, error: failText }
      })
    },
  )
}

/** "더 보기": 그 종류의 다음 페이지 (page 는 0 부터, 첫 결과 다음이면 1) */
export function searchMore(kind: SearchKind, keyword: string, page: number): Promise<SearchPage> {
  const kw = keyword.trim()
  if (getDataMode() !== 'live') return Promise.resolve(mockPage(kind, kw, page))
  return LIVE[kind](kw, page)
}
