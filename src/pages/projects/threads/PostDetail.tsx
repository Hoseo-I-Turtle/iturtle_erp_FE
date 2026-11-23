import { useMemo, useState, type ReactNode } from 'react'
import { Download, Ellipsis, FileText, Image, Paperclip, Pencil, Pin, PinOff, Trash2, TriangleAlert } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, Note } from '../../../components/ui'
import { Markdown } from '../../../components/markdown/Markdown'
import { threadKey, threadKeysIn } from '../../../components/markdown/threadLinks'
import { useAtMention } from '../../../components/markdown/useAtMention'
import type { ThreadPostView } from '../../../api/content'
import { DocumentCards, MentionCards, ThreadQuote } from './ThreadCards'
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
  /** 연결한 자료 바꾸기 (ERP-23) — 고칠 수 있는 글에서만 */
  onEditDocuments?: (post: ThreadPostView) => void
  /** 제목 · 본문 고치기 · 지우기 (ERP-33) */
  onEdit: (post: ThreadPostView) => void
  onDelete: (post: ThreadPostView) => void
}

/** 고른 글: 본문 · 첨부 · 답글 · 답글 쓰기 */
export function PostDetail({ selected, replies, projectKey, error, reply, onReplyChange, onSendReply, onTogglePin, onEditDocuments, onEdit, onDelete }: Props) {
  const [menu, setMenu] = useState(false)
  const { ref: mentionRef, detect: detectMention, onKeyDown: mentionKeyDown, popup: mentionPopup, close: closeMention } = useAtMention<HTMLInputElement>(reply, onReplyChange, 'above')
  // 언급한 스레드는 본문의 링크 자리에 인용 카드로 (ERP-32). 본문에서 못 찾은 것만 아래에 모은다
  const mentions = useMemo(() => selected?.mentions ?? [], [selected])
  const embeds = useMemo(() => {
    const map = new Map<string, ReactNode>()
    mentions.forEach((m) => map.set(threadKey(m.projectKey, m.threadId), <ThreadQuote m={m} />))
    return map
  }, [mentions])
  const inBody = useMemo(() => threadKeysIn(selected?.body ?? ''), [selected])
  const leftover = mentions.filter((m) => !inBody.has(threadKey(m.projectKey, m.threadId)))
  // 목업 글에는 권한 칸이 없을 수 있다 — 그때는 된다고 본다
  const canEdit = selected?.canEdit ?? false
  const canDelete = selected?.canDelete ?? canEdit
  const canPin = selected?.canPin ?? true
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
            {canPin && (
              <Button
                variant="secondary"
                className={s.small}
                icon={selected.pinnedOrder !== null ? PinOff : Pin}
                onClick={() => onTogglePin(selected)}
              >
                {selected.pinnedOrder !== null ? '고정 해제' : '고정'}
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" className={s.small} icon={Pencil} onClick={() => onEdit(selected)}>
                고치기
              </Button>
            )}
            {canDelete && (
              <span className={s.moreWrap}>
                <Button variant="icon" icon={Ellipsis} aria-label="더 보기" aria-expanded={menu} onClick={() => setMenu(!menu)} />
                {menu && (
                  <ul className={s.moreMenu} role="menu" onMouseLeave={() => setMenu(false)}>
                    <li>
                      <button
                        type="button"
                        role="menuitem"
                        className={s.danger}
                        onClick={() => {
                          setMenu(false)
                          onDelete(selected)
                        }}
                      >
                        <Trash2 size={14} /> 지우기
                      </button>
                    </li>
                  </ul>
                )}
              </span>
            )}
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
          <Markdown source={selected.body} projectKey={projectKey} embeds={embeds} />
          <MentionCards mentions={leftover} />
          <DocumentCards documents={selected.documents ?? []} onEdit={selected.canEdit && onEditDocuments ? () => onEditDocuments(selected) : undefined} />

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
              ref={mentionRef}
              value={reply}
              onChange={(e) => {
                onReplyChange(e.target.value)
                detectMention()
              }}
              onClick={() => detectMention()}
              onBlur={() => closeMention()}
              onKeyDown={(e) => {
                if (mentionKeyDown(e)) return
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSendReply()
              }}
              placeholder="답글 쓰기 · @ 로 사람 언급, Markdown 지원"
            />
            {mentionPopup}
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
