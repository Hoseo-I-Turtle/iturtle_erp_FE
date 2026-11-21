import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Loadable } from '../../../components/ui'
import { useMentionCandidates, type MentionCandidate } from '../../../api/content'
import s from './cards.module.css'

/**
 * 다른 스레드 언급 드롭다운 (ERP-21): 치기 전에는 이 프로젝트 최근 글, 2자 이상이면 여러 프로젝트에서 찾는다.
 * 고르면 본문에 링크를 넣고, 서버가 그 링크를 미리보기 카드로 바꾼다.
 */
export function MentionPicker({ projectKey, onPick, onClose }: { projectKey: string; onPick: (c: MentionCandidate) => void; onClose: () => void }) {
  const [keyword, setKeyword] = useState('')
  const list = useMentionCandidates(projectKey, keyword, true)
  return (
    <div className={s.mentionBox} role="dialog" aria-label="스레드 언급">
      <div className={s.pickSearch}>
        <Search size={16} />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="언급할 스레드 찾기 (2자 이상이면 모든 프로젝트)"
          autoFocus
        />
        <button type="button" className={s.mentionItem} style={{ width: 'auto' }} onClick={onClose} aria-label="닫기">
          <X size={14} />
        </button>
      </div>
      <Loadable resource={list} label="스레드">
        {(items) =>
          items.length === 0 ? (
            <span className={s.pickHint}>찾는 글이 없어요</span>
          ) : (
            <div>
              {items.map((c) => (
                <button key={`${c.projectKey}-${c.threadId}`} type="button" className={s.mentionItem} onClick={() => onPick(c)}>
                  <span>{c.title}</span>
                  <small>
                    {c.projectKey !== projectKey && `${c.projectKey} · `}
                    {c.author} · {c.ago}
                  </small>
                </button>
              ))}
            </div>
          )
        }
      </Loadable>
    </div>
  )
}
