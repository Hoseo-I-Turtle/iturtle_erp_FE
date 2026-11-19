import { useState, type FormEvent } from 'react'
import { CornerDownRight, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react'
import { Avatar, Button, Empty, Loadable } from '../ui'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import {
  editComment,
  postComment,
  removeComment,
  useComments,
  type CommentItem,
  type CommentTargetType,
} from '../../api/comments'
import s from './CommentThread.module.css'

const MAX = 2000
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

type Props = {
  targetType: CommentTargetType
  targetId: number
  meName: string
  /** 목업 모드에서 보일 목록 */
  mock: () => CommentItem[]
  /** 답글 · 고치기 · 지우기를 보여 줄지 (false 면 목록과 쓰기만) */
  manage?: boolean
}

/**
 * 댓글 목록 · 쓰기 (+ 답글 · 고치기 · 지우기). 새 댓글은 먼저 붙이고 서버 응답으로 바꾼다.
 * 고치기 · 지우기 버튼은 서버가 준 권한(permissions)대로만 보인다.
 */
export function CommentThread({ targetType, targetId, meName, mock, manage = true }: Props) {
  const comments = useComments(targetType, targetId, mock)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const add = async (body: string, parentId: number | null) => {
    setError('')
    const temp: CommentItem = { id: `tmp${Date.now()}`, commentId: null, parentId, author: meName, ago: '방금', text: body, reply: parentId != null }
    comments.setData((prev) => insertAfterThread(prev, temp))
    try {
      const saved = await whenLive(() => postComment(targetType, targetId, body, parentId))
      if (saved) comments.setData((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
      return true
    } catch (e) {
      comments.setData((prev) => prev.filter((c) => c.id !== temp.id))
      setError(errText(e, '댓글을 올리지 못했어요.'))
      return false
    }
  }

  const save = async (c: CommentItem, body: string) => {
    setError('')
    try {
      const saved = c.commentId != null ? await whenLive(() => editComment(c.commentId!, body, !!c.reply)) : null
      comments.setData((prev) => prev.map((x) => (x.id === c.id ? (saved ?? { ...x, text: body, ago: `${x.ago} · 수정됨` }) : x)))
      setEditing(null)
    } catch (e) {
      setError(errText(e, '댓글을 고치지 못했어요.'))
    }
  }

  const remove = async (c: CommentItem) => {
    setError('')
    try {
      if (c.commentId != null) await whenLive(() => removeComment(c.commentId!))
      // 답글이 남아 있으면 서버는 "삭제된 댓글입니다"로 남긴다 — 다시 불러와 맞춘다
      comments.reload()
      setConfirmDelete(null)
    } catch (e) {
      setError(errText(e, '댓글을 지우지 못했어요.'))
    }
  }

  return (
    <section className={s.thread} aria-label="댓글">
      <div className={s.head}>
        <MessageCircle size={18} />
        <span>댓글 {comments.data?.filter((c) => !c.deleted).length ?? ''}</span>
      </div>
      <Loadable resource={comments} label="댓글">
        {(list) =>
          list.length === 0 ? (
            <Empty>아직 댓글이 없어요.</Empty>
          ) : (
            <ul className={s.list}>
              {list.map((c) => (
                <li key={c.id} className={c.reply ? `${s.item} ${s.reply}` : s.item}>
                  <Avatar name={c.author} size={32} />
                  <div className={s.main}>
                    <div className={s.meta}>
                      <strong>{c.author}</strong>
                      <span>{c.ago}</span>
                    </div>
                    {editing === c.id ? (
                      <Composer
                        initial={c.text}
                        submitLabel="저장"
                        onCancel={() => setEditing(null)}
                        onSubmit={async (body) => {
                          await save(c, body)
                          return true
                        }}
                      />
                    ) : (
                      <p className={c.deleted ? s.deleted : s.text}>{c.text}</p>
                    )}
                    {manage && !c.deleted && editing !== c.id && (
                      <div className={s.actions}>
                        {!c.reply && c.commentId != null && (
                          <button type="button" onClick={() => setReplyTo(c)}>
                            <CornerDownRight size={13} /> 답글
                          </button>
                        )}
                        {c.canEdit && (
                          <button type="button" onClick={() => setEditing(c.id)}>
                            <Pencil size={13} /> 고치기
                          </button>
                        )}
                        {c.canDelete &&
                          (confirmDelete === c.id ? (
                            <span className={s.confirm}>
                              지울까요?
                              <button type="button" className={s.danger} onClick={() => void remove(c)}>
                                지우기
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)}>
                                그대로 두기
                              </button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirmDelete(c.id)}>
                              <Trash2 size={13} /> 지우기
                            </button>
                          ))}
                      </div>
                    )}
                    {replyTo?.id === c.id && (
                      <Composer
                        placeholder={`${c.author} 님에게 답글`}
                        submitLabel="답글"
                        onCancel={() => setReplyTo(null)}
                        onSubmit={async (body) => {
                          const ok = await add(body, c.commentId)
                          if (ok) setReplyTo(null)
                          return ok
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
      <Composer placeholder="댓글을 남겨 주세요" submitLabel="등록" onSubmit={(body) => add(body, null)} />
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
    </section>
  )
}

/** 답글은 그 댓글의 답글들 맨 뒤에, 새 댓글은 맨 뒤에 */
function insertAfterThread(list: CommentItem[], item: CommentItem) {
  if (item.parentId == null) return [...list, item]
  const at = list.findIndex((c) => c.commentId === item.parentId)
  if (at < 0) return [...list, item]
  let end = at + 1
  while (end < list.length && list[end].reply) end++
  return [...list.slice(0, end), item, ...list.slice(end)]
}

function Composer({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder?: string
  submitLabel: string
  onSubmit: (body: string) => Promise<boolean>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initial)
  const [sending, setSending] = useState(false)
  const [tooLong, setTooLong] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    if (body.length > MAX) return setTooLong(true)
    setTooLong(false)
    setSending(true)
    const ok = await onSubmit(body)
    setSending(false)
    if (ok && !onCancel) setText('')
  }

  return (
    <form onSubmit={submit} className={s.composer}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder ?? '댓글'}
        rows={2}
        maxLength={MAX}
        className={s.textarea}
      />
      <div className={s.composerButtons}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" icon={Send} disabled={!text.trim() || sending}>
          {submitLabel}
        </Button>
      </div>
      {tooLong && <p className={s.error}>댓글은 2,000자까지 쓸 수 있어요.</p>}
    </form>
  )
}
