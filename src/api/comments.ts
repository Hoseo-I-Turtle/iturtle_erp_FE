import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'

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

/** 대상의 댓글 (CM-1). mock 은 목업 모드에서 보일 목록 */
export function useComments(targetType: CommentTargetType, targetId: number | string | undefined, mock: () => CommentItem[]) {
  return useResource<CommentItem[]>(['comments', targetType, targetId], mock, async () => {
    const page = await api<PageResponse<CommentDto>>('/comments', { query: { targetType, targetId, size: 100 } })
    return page.content.flatMap((c) => [fromDto(c), ...(c.replies ?? []).map((r) => fromDto(r, true))])
  })
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
