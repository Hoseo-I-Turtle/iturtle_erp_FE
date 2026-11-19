import { Link } from 'react-router-dom'
import { Download, Lock, MessageCircle, Pin } from 'lucide-react'
import { Chip } from '../../../components/ui'
import { documentCategoryName, type LibraryDocument } from '../../../api/content'
import s from '../LibraryPage.module.css'

const EXT_COLOR: Record<string, string> = {
  pdf: 'var(--status-negative)',
  pptx: 'var(--status-warning-text)',
  docx: 'var(--text-secondary)',
  md: 'var(--brand-500)',
  zip: 'var(--text-muted)',
}
const EXT_LABEL: Record<string, string> = { pptx: 'PPT', docx: 'DOC' }

/** 자료 한 줄: 파일 형식 · 제목 · 카테고리 · 태그 · 공개 범위 · 작성자 · 댓글 */
export function DocRow({ d, onTag }: { d: LibraryDocument; onTag: (t: string) => void }) {
  const ext = d.fileTypes[0]
  return (
    <li className={s.doc}>
      <span className={s.ft} style={{ color: ext ? EXT_COLOR[ext] : 'var(--text-secondary)' }}>
        {ext ? (EXT_LABEL[ext] ?? ext.toUpperCase()) : '?'}
      </span>
      <div className={s.docMain}>
        <div className={s.docTitle}>
          {d.pinned && <Pin size={14} />}
          <Link to={`/library/${d.documentId}`}>{d.title}</Link>
          {d.latestVersion > 1 && <span className={s.ver}>v{d.latestVersion}</span>}
        </div>
        <div className={s.docSub}>
          <span className={s.cat}>{d.categoryName ?? documentCategoryName(d.categoryCode)}</span>
          {d.tags.map((t) => (
            <button key={t} type="button" className={s.hash} onClick={() => onTag(t)}>
              #{t}
            </button>
          ))}
          {d.project && <span className={s.proj}>· {d.project.name}</span>}
          {d.folderPath && <span className={s.proj}>· {d.folderPath}</span>}
        </div>
      </div>
      {d.visibility === 'PROJECT_MEMBERS' && (
        <Chip tone="warning" icon={Lock}>
          참여자만
        </Chip>
      )}
      {d.visibility === 'PRIVATE' && (
        <Chip tone="muted" icon={Lock}>
          나만
        </Chip>
      )}
      <div className={s.who}>
        <strong>{d.author}</strong>
        <span>{d.ago}</span>
      </div>
      <span className={s.comments}>
        <MessageCircle size={14} />
        {d.commentCount}
      </span>
      {/* 백엔드 DocumentSummaryResponse 에 파일 publicId 가 없어 목록에서 바로 내려받을 수 없다. 상세(D-3 files[].latest.file)에서 받는다 */}
      <button type="button" className={s.dl} aria-label="내려받기">
        <Download size={18} />
      </button>
    </li>
  )
}
