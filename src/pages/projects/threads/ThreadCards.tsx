import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, EyeOff, FileText, MessagesSquare, Paperclip, Pencil } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { ThreadDocumentCard, ThreadMentionCard } from '../../../mocks/threads'
import { plainExcerpt } from '../../../components/markdown/threadLinks'
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

/**
 * 본문에서 링크한 자리에 들어가는 스레드 인용 카드 (ERP-32). 처음에는 제목 한 줄로 접혀 있고 눌러서 펼친다.
 * 볼 수 없거나 없는 글은 "볼 수 없는 스레드".
 */
export function ThreadQuote({ m }: { m: ThreadMentionCard }) {
  const [open, setOpen] = useState(false)
  const meta = [m.projectKey, m.author, m.createdAt].filter(Boolean).join(' · ')
  if (!m.available)
    return (
      <div className={`${s.quote} ${s.quoteOff}`} title="권한이 없거나 없는 · 지운 글이에요">
        <span className={s.quoteHead}>
          <EyeOff size={15} /> <span className={s.quoteTitle}>볼 수 없는 스레드</span>
          <span className={s.cardMeta}>{m.projectKey}</span>
        </span>
      </div>
    )
  return (
    <div className={s.quote}>
      <button type="button" className={s.quoteHead} onClick={() => setOpen(!open)} aria-expanded={open}>
        <MessagesSquare size={15} />
        <span className={s.quoteTitle}>{m.title}</span>
        <span className={s.cardMeta}>{meta}</span>
        <ChevronDown size={16} className={open ? `${s.chev} ${s.chevOpen}` : s.chev} aria-hidden />
      </button>
      {open && (
        <div className={s.quoteBody}>
          {m.excerpt ? <p className={s.excerpt}>{plainExcerpt(m.excerpt)}</p> : <p className={s.cardMeta}>본문 미리 보기가 없어요.</p>}
          <Link to={`/projects/${m.projectKey}/threads/${m.threadId}`} className={s.quoteLink}>
            스레드로 가기 <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}

/** 본문에서 찾지 못한 언급 (코드 블록 안 등)의 미리보기 (ERP-20 · 21). 볼 수 없거나 없는 글은 "볼 수 없는 스레드" */
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
              {m.excerpt && <p className={s.excerpt}>{plainExcerpt(m.excerpt)}</p>}
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
