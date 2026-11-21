import { Link } from 'react-router-dom'
import { EyeOff, FileText, MessagesSquare, Paperclip, Pencil } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { ThreadDocumentCard, ThreadMentionCard } from '../../../mocks/threads'
import s from './cards.module.css'

const VISIBILITY_NAME = { LAB: '공용', PROJECT_MEMBERS: '참여자만', PRIVATE: '나만' } as const

/** 글에 연결한 자료실 자료 (ERP-18 · 23). 볼 수 없거나 지운 자료는 제목 없이 "볼 수 없는 자료" */
export function DocumentCards({ documents, onEdit }: { documents: ThreadDocumentCard[]; onEdit?: () => void }) {
  if (documents.length === 0 && !onEdit) return null
  return (
    <div className={s.block}>
      <div className={s.blockHead}>
        <Paperclip size={14} /> 연결한 자료 {documents.length}
        {onEdit && (
          <Button variant="ghost" icon={Pencil} onClick={onEdit}>
            자료 연결
          </Button>
        )}
      </div>
      {documents.length > 0 && (
        <div className={s.cards}>
          {documents.map((d) =>
            d.available ? (
              <Link key={d.documentId} to={`/library/${d.documentId}`} className={s.card}>
                <span className={s.cardTitle}>
                  <FileText size={16} /> {d.title}
                </span>
                <span className={s.cardMeta}>
                  {[d.categoryName, d.visibility ? VISIBILITY_NAME[d.visibility] : null, d.author].filter(Boolean).join(' · ')}
                </span>
              </Link>
            ) : (
              <span key={d.documentId} className={s.unavailable} title="권한이 없거나 지운 자료예요">
                <span className={s.cardTitle}>
                  <EyeOff size={16} /> 볼 수 없는 자료
                </span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** 본문에 링크한 다른 스레드의 미리보기 (ERP-20 · 21). 볼 수 없거나 없는 글은 "볼 수 없는 스레드" */
export function MentionCards({ mentions }: { mentions: ThreadMentionCard[] }) {
  if (mentions.length === 0) return null
  return (
    <div className={s.block}>
      <div className={s.blockHead}>
        <MessagesSquare size={14} /> 언급한 스레드 {mentions.length}
      </div>
      <div className={s.cards}>
        {mentions.map((m) =>
          m.available ? (
            <Link key={`${m.projectKey}-${m.threadId}`} to={`/projects/${m.projectKey}/threads/${m.threadId}`} className={s.card}>
              <span className={s.cardTitle}>
                <MessagesSquare size={16} /> {m.title}
              </span>
              {m.excerpt && <p className={s.excerpt}>{m.excerpt}</p>}
              <span className={s.cardMeta}>{[m.projectKey, m.author, m.createdAt].filter(Boolean).join(' · ')}</span>
            </Link>
          ) : (
            <span key={`${m.projectKey}-${m.threadId}`} className={s.unavailable} title="권한이 없거나 없는 · 지운 글이에요">
              <span className={s.cardTitle}>
                <EyeOff size={16} /> 볼 수 없는 스레드
              </span>
              <span className={s.cardMeta}>{m.projectKey}</span>
            </span>
          ),
        )}
      </div>
    </div>
  )
}
