import { ChevronDown, MessageCircle, Paperclip, Pin, Share2 } from 'lucide-react'
import { Avatar } from '../../../components/ui'
import type { ThreadPostView } from '../../../api/content'
import s from '../ThreadPage.module.css'

const firstLine = (p: ThreadPostView) => p.body.replace(/```[\s\S]*?```/g, '').trim()

type Props = {
  total: number
  posts: ThreadPostView[]
  pinnedOnly: boolean
  onTogglePinnedOnly: () => void
  selectedId: number | undefined
  onSelect: (postId: number) => void
}

/** 전체 글 목록 (고정 글만 보기 토글) */
export function PostList({ total, posts, pinnedOnly, onTogglePinnedOnly, selectedId, onSelect }: Props) {
  return (
    <>
          <div className={s.allHead}>
            <h2>
              전체 글 <span>{total}</span>
            </h2>
            <button
              type="button"
              className={pinnedOnly ? `${s.pill} ${s.pillOn}` : s.pill}
              onClick={onTogglePinnedOnly}
            >
              <Pin size={14} /> 고정 글만 보기
            </button>
            <span className={s.pill}>
              최근 답글 순 <ChevronDown size={14} />
            </span>
          </div>

          {posts.map((p) => (
            <button
              key={p.postId}
              type="button"
              className={p.postId === selectedId ? `${s.post} ${s.postOn}` : s.post}
              onClick={() => onSelect(p.postId)}
            >
              <span className={s.postHead}>
                <Avatar name={p.author} size={26} />
                <strong>{p.author}</strong>
                <small>{p.ago}</small>
              </span>
              {p.title && <span className={s.postTitle}>{p.title}</span>}
              <span className={s.postBody}>{firstLine(p)}</span>
              <span className={s.postMeta}>
                <span>
                  <MessageCircle size={14} /> 답글 {p.replyCount}
                </span>
                {p.body.includes('```mermaid') && (
                  <span>
                    <Share2 size={14} /> 다이어그램
                  </span>
                )}
                {p.attachments.length > 0 && (
                  <span>
                    <Paperclip size={14} /> 첨부 {p.attachments.length}
                  </span>
                )}
              </span>
            </button>
          ))}
    </>
  )
}
