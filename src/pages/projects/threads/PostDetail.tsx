import { Download, Ellipsis, FileText, Image, Paperclip, Pencil, Pin, PinOff, TriangleAlert } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, Note } from '../../../components/ui'
import { Markdown } from '../../../components/markdown/Markdown'
import type { ThreadPostView } from '../../../api/content'
import s from '../ThreadPage.module.css'

type Props = {
  selected: ThreadPostView | undefined
  replies: ThreadPostView['replies']
  projectKey: string
  error: string | null
  reply: string
  onReplyChange: (v: string) => void
  onSendReply: () => void
  onTogglePin: (p: ThreadPostView) => void
}

/** 고른 글: 본문 · 첨부 · 답글 · 답글 쓰기 */
export function PostDetail({ selected, replies, projectKey, error, reply, onReplyChange, onSendReply, onTogglePin }: Props) {
  return (
    <Card className={s.detail}>
      {error && (
        <Note icon={TriangleAlert} tone="warning">
          {error}
        </Note>
      )}
      {!selected ? (
        <Empty>아직 글이 없어요.</Empty>
      ) : (
        <>
          <div className={s.detailTop}>
            {selected.pinnedOrder !== null && (
              <Chip tone="warning" icon={Pin}>
                고정됨 · {selected.pinnedOrder}번째
              </Chip>
            )}
            <Chip tone="tint" icon={FileText}>
              Markdown
            </Chip>
            <span className={s.grow} />
            <Button
              variant="secondary"
              className={s.small}
              icon={selected.pinnedOrder !== null ? PinOff : Pin}
              onClick={() => onTogglePin(selected)}
            >
              {selected.pinnedOrder !== null ? '고정 해제' : '고정'}
            </Button>
            <Button variant="secondary" className={s.small} icon={Pencil}>
              고치기
            </Button>
            <Button variant="icon" icon={Ellipsis} aria-label="더 보기" />
          </div>
          {selected.title && <h2 className={s.detailTitle}>{selected.title}</h2>}
          <div className={s.detailMeta}>
            <Avatar name={selected.author} size={26} />
            <strong>{selected.author}</strong>
            <span>
              · {selected.createdAt} 작성
              {selected.editedBy && ` · ${selected.editedAt} ${selected.editedBy} 수정`}
              {selected.pinnedBy && ` · 고정: ${selected.pinnedBy}`}
            </span>
          </div>
          <hr className={s.hr} />
          <Markdown source={selected.body} projectKey={projectKey} />

          {selected.attachments.length > 0 && (
            <div className={s.files}>
              {selected.attachments.map((a) => (
                <a key={a.name} href={a.url ?? '#'} className={s.file}>
                  {a.kind === 'image' ? <Image size={16} /> : <FileText size={16} />}
                  <strong>{a.name}</strong>
                  <small>{a.size}</small>
                  <Download size={16} />
                </a>
              ))}
            </div>
          )}

          <hr className={s.hr} />
          <div className={s.repliesHead}>
            <h3>답글 {selected.replyCount}</h3>
            <span>글쓴이와 지켜보는 사람에게 알림</span>
          </div>
          {replies.map((r, i) => (
            <div key={i} className={s.reply}>
              <Avatar name={r.author} size={26} />
              <div>
                <div className={s.replyHead}>
                  <strong>{r.author}</strong>
                  <small>{r.ago}</small>
                </div>
                <Markdown source={r.body} projectKey={projectKey} />
              </div>
            </div>
          ))}
          <div className={s.replyBox}>
            <input
              value={reply}
              onChange={(e) => onReplyChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onSendReply()}
              placeholder="답글 쓰기 · Markdown, mermaid 코드 블록 지원"
            />
            {/* TODO: 답글 첨부 (uploadFile → attachmentFileIds) */}
            <Paperclip size={18} className={s.clip} />
            <Button onClick={onSendReply} className={s.small}>
              올리기
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
