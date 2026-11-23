import { useState } from 'react'
import { GitBranch, Image, Lock, Play, X, type LucideIcon } from 'lucide-react'
import { type ServiceCode } from '../../mocks/projects'
import { PROJECT_STATUS_LABEL, type ProjectStatusLive } from '../../api/projects'
import { MAX_TAG_LENGTH, MAX_TAGS, normalizeTags } from '../../api/memberTags'
import s from './common.module.css'

const SERVICE_ICON: Record<ServiceCode, LucideIcon> = {
  GITHUB: GitBranch,
  JENKINS: Play,
  VAULT: Lock,
  PENPOT: Image,
}

export function ServiceIcon({ code, size = 16, className }: { code: ServiceCode; size?: number; className?: string }) {
  const Icon = SERVICE_ICON[code]
  return <Icon size={size} className={className} aria-label={code} />
}

/** 프로젝트 상태 칩. 서버의 ON_HOLD(보류) 도 받는다 */
export function StatusChip({ status }: { status: ProjectStatusLive }) {
  const cls = status === 'ACTIVE' ? s.active : status === 'PREPARING' || status === 'ON_HOLD' ? s.prep : s.done
  return <span className={`${s.status} ${cls}`}>{PROJECT_STATUS_LABEL[status] ?? status}</span>
}

/** 참여자가 맡은 일 태그 (ERP-14). 권한과 상관없는 표시용 */
export function MemberTags({ tags }: { tags: string[] | undefined }) {
  if (!tags || tags.length === 0) return null
  return (
    <span className={s.tags}>
      {tags.map((t) => (
        <span key={t} className={s.tag}>
          {t}
        </span>
      ))}
    </span>
  )
}

/**
 * 맡은 일 태그 고치기: 칩 + 입력 (Enter · 쉼표로 더하기, 자동 완성은 그 프로젝트에서 쓰는 태그).
 * 바뀔 때마다 onSave 를 부른다 (서버는 통째로 바꿈). 5개 · 20자.
 */
export function TagEditor({ tags, suggestions, disabled, onSave }: {
  tags: string[]
  suggestions: string[]
  disabled?: boolean
  onSave: (tags: string[]) => void
}) {
  const [text, setText] = useState('')
  const listId = `tag-suggest-${tags.join('-')}-${suggestions.length}`
  const full = tags.length >= MAX_TAGS
  const add = (raw: string) => {
    const next = normalizeTags([...tags, ...raw.split(',')])
    setText('')
    if (next.length !== tags.length && next.length <= MAX_TAGS) onSave(next)
  }
  return (
    <span className={s.tagEditor}>
      {tags.map((t) => (
        <span key={t} className={s.tag}>
          {t}
          {!disabled && (
            <button type="button" className={s.tagRemove} onClick={() => onSave(tags.filter((x) => x !== t))} aria-label={`${t} 빼기`}>
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {!disabled && !full && (
        <>
          <input
            className={s.tagInput}
            value={text}
            maxLength={MAX_TAG_LENGTH + 1}
            placeholder={tags.length === 0 ? '맡은 일 (예: 백엔드)' : '+'}
            list={listId}
            onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault()
                add(text)
              }
            }}
            onBlur={() => text.trim() && add(text)}
            aria-label="맡은 일 태그 더하기"
          />
          <datalist id={listId}>
            {suggestions.filter((t) => !tags.includes(t)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </>
      )}
      {text.trim().length > MAX_TAG_LENGTH && <small className={s.tagWarn}>20자까지</small>}
    </span>
  )
}
