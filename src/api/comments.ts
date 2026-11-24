import { useCallback, useState } from 'react'
import { api, ApiError } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource, type Resource } from './useResource'

/** 댓글을 달 수 있는 대상 (CM-1 targetType) */
export type CommentTargetType = 'NOTICE' | 'DOCUMENT' | 'TASK' | 'PROJECT_THREAD' | 'WEEKLY_REPORT' | 'PROJECT_POLICY'

type CommentDto = {
  commentId: number
  parentId: number | null
  author: MemberRef
  body: string | null
  deleted: boolean
  createdAt: string
  editedAt: string | null
  replies?: CommentDto[]
  permissions?: { canEdit: boolean; canDelete: boolean }
}

/** 화면 한 줄. 답글은 원 댓글 바로 아래에 펼친다 */
export type CommentItem = {
  id: string
  commentId: number | null
  parentId: number | null
  author: string
  ago: string
  text: string
  deleted?: boolean
  reply?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

const fromDto = (c: CommentDto, reply = false): CommentItem => ({
  id: String(c.commentId),
  commentId: c.commentId,
  parentId: c.parentId,
  author: c.author.name,
  ago: ago(c.createdAt) + (c.editedAt ? ' · 수정됨' : ''),
  text: c.deleted ? '삭제된 댓글입니다' : (c.body ?? ''),
  deleted: c.deleted,
  reply,
  canEdit: !c.deleted && !!c.permissions?.canEdit,
  canDelete: !c.deleted && !!c.permissions?.canDelete,
})

/** 댓글 한 페이지 크기 (원 댓글 기준, 정책 ERP-P32 의 기본값) */
const COMMENT_PAGE_SIZE = 20
/** 한 페이지: 원 댓글과 그 답글을 한 줄로 펼친다 */
const flat = (cs: CommentDto[]) => cs.flatMap((c) => [fromDto(c), ...(c.replies ?? []).map((r) => fromDto(r, true))])

/** 받은 댓글과, 그중 가장 오래된 쪽의 page 번호 (0 이면 맨 처음까지 다 받은 것) */
type LoadedComments = { items: CommentItem[]; from: number }

/** 아직 안 받은 앞쪽(더 오래된) 댓글 */
export type EarlierComments = { hasPrev: boolean; loading: boolean; error: string | null; loadPrev: () => void }
export type CommentsResource = Resource<CommentItem[]> & { earlier: EarlierComments }

/**
 * 대상의 댓글 (CM-1). mock 은 목업 모드에서 보일 목록.
 * 서버는 오래된 순으로만 준다 → 최신 댓글이 바로 보이게 **마지막 두 페이지**를 먼저 받고,
 * 앞쪽은 earlier.loadPrev ("이전 댓글 더 보기")로 한 페이지씩 앞에 붙인다 (정책 ERP-P32: size 를 키워 다시 부르지 않는다).
 * @param all true 면 페이지를 끝까지 돌며 모두 받는다 (받은 댓글을 화면이 다시 거르는 곳 — 주간 보고의 칸별 댓글)
 */
export function useComments(
  targetType: CommentTargetType,
  targetId: number | string | undefined,
  mock: () => CommentItem[],
  all = false,
): CommentsResource {
  const page = (n: number) => api<PageResponse<CommentDto>>('/comments', { query: { targetType, targetId, page: n, size: COMMENT_PAGE_SIZE } })
  const inner = useResource<LoadedComments>(
    ['comments', targetType, targetId, all],
    () => ({ items: mock(), from: 0 }),
    async () => {
      const first = await page(0)
      if (!first.hasNext) return { items: flat(first.content), from: 0 }
      const last = first.totalPages - 1
      // 받을 페이지: 모두 받기면 1 ~ 마지막, 아니면 마지막 두 페이지 (0 번은 이미 받았다)
      const from = all ? 0 : Math.max(0, last - 1)
      const numbers = Array.from({ length: last - Math.max(1, from) + 1 }, (_, i) => Math.max(1, from) + i)
      const rest = await Promise.all(numbers.map(page))
      return { items: flat([...(from === 0 ? first.content : []), ...rest.flatMap((p) => p.content)]), from }
    },
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data, setData: setInner } = inner
  const from = data?.from ?? 0
  const loadPrev = useCallback(() => {
    if (from <= 0 || loading) return
    setLoading(true)
    setError(null)
    page(from - 1)
      .then((p) =>
        // 받는 사이에 처음부터 다시 불려 왔으면(from 이 달라짐) 붙이지 않는다
        setInner((cur) => {
          if (cur.from !== from) return cur
          const seen = new Set(cur.items.map((c) => c.id))
          return { items: [...flat(p.content).filter((c) => !seen.has(c.id)), ...cur.items], from: from - 1 }
        }),
      )
      .catch((e) => setError(e instanceof ApiError ? e.message : '이전 댓글을 불러오지 못했어요.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page 는 targetType · targetId 로만 정해진다
  }, [from, loading, setInner, targetType, targetId])

  const setData = useCallback((f: (prev: CommentItem[]) => CommentItem[]) => setInner((x) => ({ ...x, items: f(x.items) })), [setInner])
  return {
    data: data?.items,
    loading: inner.loading,
    error: inner.error,
    reload: inner.reload,
    setData,
    earlier: { hasPrev: from > 0, loading, error, loadPrev },
  }
}

/** 댓글 · 답글 쓰기 (CM-2) */
export const postComment = (targetType: CommentTargetType, targetId: number, body: string, parentId: number | null = null) =>
  api<CommentDto>('/comments', { method: 'POST', body: { targetType, targetId, parentId, body, attachmentFileIds: [] } }).then((c) =>
    fromDto(c, parentId != null),
  )

/** 댓글 고치기 (CM-3) */
export const editComment = (commentId: number, body: string, reply: boolean) =>
  api<CommentDto>(`/comments/${commentId}`, { method: 'PATCH', body: { body } }).then((c) => fromDto(c, reply))

/** 댓글 지우기 (CM-4). 답글이 있으면 "삭제된 댓글입니다"로 남는다 */
export const removeComment = (commentId: number) => api<void>(`/comments/${commentId}`, { method: 'DELETE' })
