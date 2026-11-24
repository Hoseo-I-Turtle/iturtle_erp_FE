import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '../../../components/ui'
import { postComment, useComments, type CommentItem } from '../../../api/comments'
import { sectionCommentPrefix } from '../../../api/content'
import { ApiError } from '../../../api/client'
import { whenLive } from '../../../api/useResource'
import s from '../WeeklyReportPage.module.css'

/**
 * 프로젝트 칸 코멘트 (2026-11-20). 공통 댓글(WEEKLY_REPORT)의 본문 맨 앞 [프로젝트 키] 로 그 칸 것만 모아 본다.
 * 다는 사람: report-review 와 그 프로젝트 관리자 (서버 WeeklyReportCommentPolicy).
 */
export function SectionComments({
  reportId,
  projectKey,
  meName,
  canWrite,
}: {
  reportId: number
  projectKey: string
  meName: string
  canWrite: boolean
}) {
  const prefix = sectionCommentPrefix(projectKey)
  // 칸마다 머리말로 걸러 보여 주므로 보고의 댓글을 모두 받는다
  const comments = useComments('WEEKLY_REPORT', reportId, () => [], true)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const mine = (comments.data ?? []).filter((c) => !c.reply && c.text.startsWith(prefix))

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setError('')
    const temp: CommentItem = { id: `tmp${Date.now()}`, commentId: null, parentId: null, author: meName, ago: '방금', text: prefix + body, reply: false }
    comments.setData((prev) => [...prev, temp])
    setText('')
    try {
      const saved = await whenLive(() => postComment('WEEKLY_REPORT', reportId, prefix + body))
      if (saved) comments.setData((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
    } catch (e) {
      comments.setData((prev) => prev.filter((c) => c.id !== temp.id))
      setText(body)
      setError(e instanceof ApiError ? e.message : '코멘트를 달지 못했어요.')
    }
  }

  if (mine.length === 0 && !canWrite) return null
  return (
    <div className={s.sectionComments}>
      {mine.map((c) => (
        <p key={c.id}>
          <MessageCircle size={14} /> <strong>{c.author}</strong> {c.text.slice(prefix.length)} <small>{c.ago}</small>
        </p>
      ))}
      {canWrite && (
        <div className={s.sectionCommentInput}>
          <input value={text} placeholder={`${projectKey} 칸에 코멘트`} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <Button variant="ghost" icon={Send} onClick={send} disabled={!text.trim()}>
            달기
          </Button>
        </div>
      )}
      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
