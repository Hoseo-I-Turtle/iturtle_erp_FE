import { useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Avatar, Button, Empty, Loadable } from '../../../components/ui'
import { ApiError } from '../../../api/client'
import { whenLive } from '../../../api/useResource'
import { postNoticeComment, useNoticeComments, type CommentView } from '../../../api/communication'
import s from '../NoticeDetailPage.module.css'

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** 댓글 목록 · 쓰기 (먼저 붙이고 서버 응답으로 바꾼다) */
export function NoticeComments({ noticeId, id, meName }: { noticeId: number; id: string; meName: string }) {
  const comments = useNoticeComments(id)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    if (body.length > 2000) return setError('댓글은 2,000자까지 쓸 수 있어요.')
    setError('')
    setSending(true)
    // 먼저 목록에 붙이고, 서버 응답이 오면 그 값으로 바꾼다
    const temp: CommentView = { id: `tmp${Date.now()}`, author: meName, ago: '방금', text: body }
    comments.setData((prev) => [...prev, temp])
    setText('')
    try {
      const saved = await whenLive(() => postNoticeComment(noticeId, body))
      if (saved) comments.setData((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
    } catch (err) {
      comments.setData((prev) => prev.filter((c) => c.id !== temp.id))
      setText(body)
      setError(errText(err, '댓글을 올리지 못했어요.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className={s.commentsHead}>
        <MessageCircle size={18} />
        <span>댓글 {comments.data?.filter((c) => !c.deleted).length ?? ''}</span>
      </div>
      <Loadable resource={comments} label="댓글">
        {(list) =>
          list.length === 0 ? (
            <Empty>아직 댓글이 없어요.</Empty>
          ) : (
            <ul className={s.comments}>
              {list.map((c) => (
                <li key={c.id} className={s.comment} style={c.reply ? { marginLeft: 40 } : undefined}>
                  <Avatar name={c.author} size={32} />
                  <div>
                    <div className={s.commentHead}>
                      <strong>{c.author}</strong>
                      <span>{c.ago}</span>
                    </div>
                    <p style={c.deleted ? { color: 'var(--text-muted)' } : undefined}>{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-start' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="댓글을 남겨 주세요"
          aria-label="댓글"
          rows={2}
          maxLength={2000}
          style={{ flex: 1, resize: 'vertical', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #d5dde6)', font: 'inherit' }}
        />
        <Button type="submit" icon={Send} disabled={!text.trim() || sending}>
          등록
        </Button>
      </form>
      {error && (
        <p role="alert" style={{ color: 'var(--status-negative)', marginTop: 6 }}>
          {error}
        </p>
      )}
    </>
  )
}
