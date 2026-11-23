import { ChevronRight, GripVertical, Pin } from 'lucide-react'
import { Card, Chip, Empty } from '../../../components/ui'
import type { ThreadPostView } from '../../../api/content'
import s from '../ThreadPage.module.css'

type Props = {
  pinned: ThreadPostView[]
  limit: number
  selectedId: number | undefined
  onSelect: (postId: number) => void
  onDragStart: (postId: number) => void
  onDrop: (targetId: number) => void
  onDragEnd: () => void
}

/** 고정 글: 끌어서 순서 바꾸기 */
export function PinnedPostsCard({ pinned, limit, selectedId, onSelect, onDragStart, onDrop, onDragEnd }: Props) {
  return (
    <Card className={s.pinnedCard}>
      <div className={s.pinnedHead}>
        <Pin size={18} className={s.pinIcon} />
        <h2>고정 글</h2>
        <Chip tone="warning">
          {pinned.length} / {limit}
        </Chip>
        <span className={s.hint}>끌어서 순서 바꾸기</span>
      </div>
      {pinned.length === 0 && <Empty>고정된 글이 없어요.</Empty>}
      {pinned.map((p) => (
        <button
          key={p.postId}
          type="button"
          draggable
          onDragStart={() => onDragStart(p.postId)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(p.postId)}
          onDragEnd={onDragEnd}
          className={p.postId === selectedId ? `${s.pinned} ${s.pinnedOn}` : s.pinned}
          onClick={() => onSelect(p.postId)}
        >
          <GripVertical size={16} className={s.grip} />
          <span className={s.pinnedText}>
            <strong>{p.title}</strong>
            <small>
              {p.author} · {p.ago} · 답글 {p.replyCount}
            </small>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </Card>
  )
}
