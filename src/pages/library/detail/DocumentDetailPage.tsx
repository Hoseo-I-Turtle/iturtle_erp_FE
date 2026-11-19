import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, ExternalLink, FilePlus, FileText, Folder, History, Link2, Lock, MessageCircle, Pencil, Tag, Upload, X } from 'lucide-react'
import { Breadcrumb, Button, Card, Chip, Columns, KeyValue, Loadable, SectionHead } from '../../../components/ui'
import { Markdown } from '../../../components/markdown/Markdown'
import { CommentThread } from '../../../components/comments/CommentThread'
import { PageHeader } from '../../../layouts/PageHeader'
import { ApiError } from '../../../api/client'
import { useMe } from '../../../api/members'
import type { CommentItem } from '../../../api/comments'
import { addDocumentFile, fileSize, useDocumentDetail, useDocumentPolicy, VISIBILITY_LABEL, type DocumentDetail, type DocVersion } from '../../../api/documents'
import { DocumentEditModal } from './DocumentEditModal'
import s from './DocumentDetailPage.module.css'

const MOCK_COMMENTS = (): CommentItem[] => [
  { id: 'm1', commentId: null, parentId: null, author: '박지훈', ago: '1시간 전', text: '3장 그래프 범례가 잘렸어요. 다음 버전에서 봐 주세요.' },
  { id: 'm2', commentId: null, parentId: null, author: '김민서', ago: '30분 전', text: '고쳐서 v4 로 올릴게요.', reply: true },
]

/** 자료 상세 (D-3): 본문 · 파일과 버전 · 링크 · 폴더 · 공개 범위, 고치기(D-4) · 새 버전 · 파일 더하기(D-7) · 댓글 */
export function DocumentDetailPage() {
  const { id } = useParams()
  const doc = useDocumentDetail(id)
  const [editing, setEditing] = useState(false)
  const d = doc.data
  return (
    <>
      <PageHeader
        title="자료실"
        subtitle="연구실 자료와 프로젝트 파일"
        action={
          d?.canEdit ? (
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              고치기
            </Button>
          ) : undefined
        }
      />
      <Loadable resource={doc} label="자료">
        {(x) => <DocumentBody d={x} onChanged={doc.reload} />}
      </Loadable>
      {editing && d && <DocumentEditModal d={d} onClose={() => setEditing(false)} onSaved={doc.reload} />}
    </>
  )
}

function VersionRow({ v, latest }: { v: DocVersion; latest?: boolean }) {
  return (
    <div className={latest ? `${s.version} ${s.latest}` : s.version}>
      <span className={s.vTag}>v{v.version}</span>
      <div className={s.vMain}>
        <strong>{v.name}</strong>
        <small>
          {fileSize(v.size)} · {v.who} · {v.ago}
          {v.note && ` · ${v.note}`}
        </small>
      </div>
      {v.url ? (
        <a className={s.download} href={v.url} aria-label={`${v.name} 내려받기`}>
          <Download size={16} />
          내려받기
        </a>
      ) : (
        <span className={s.noFile}>목업 파일</span>
      )}
    </div>
  )
}

/** 파일 새 버전 · 새 파일: 고르고 버전 메모를 적어 올린다 (진행 막대 · 취소). logicalName 이 있으면 그 파일의 다음 버전 */
function FileUploader({ documentId, logicalName, onDone, label }: { documentId: number; logicalName: string | null; onDone: () => void; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const ctrl = useRef<AbortController | null>(null)
  const policy = useDocumentPolicy().data
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [ratio, setRatio] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = (f: File | undefined) => {
    setError(null)
    if (input.current) input.current.value = ''
    if (!f) return
    if (policy && f.size > policy.maxFileMb * 1024 * 1024) {
      setError(`파일 하나는 ${policy.maxFileMb}MB 까지 올릴 수 있어요.`)
      return
    }
    setFile(f)
  }
  const start = async () => {
    if (!file) return
    ctrl.current = new AbortController()
    setRatio(0)
    setError(null)
    try {
      await addDocumentFile(documentId, file, logicalName, note.trim() || null, setRatio, ctrl.current.signal)
      setFile(null)
      setNote('')
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '파일을 올리지 못했어요.')
    } finally {
      setRatio(null)
    }
  }

  return (
    <div className={s.uploader}>
      <input ref={input} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {!file ? (
        <button type="button" className={s.uploadLink} onClick={() => input.current?.click()}>
          {logicalName ? <Upload size={14} /> : <FilePlus size={14} />} {label}
        </button>
      ) : (
        <div className={s.uploadRow}>
          <span className={s.uploadName}>
            {file.name} · {fileSize(file.size)}
          </span>
          {ratio == null ? (
            <>
              <input className={s.noteInput} value={note} maxLength={200} placeholder="버전 메모 (선택)" onChange={(e) => setNote(e.target.value)} />
              <Button onClick={() => void start()}>올리기</Button>
              <Button variant="secondary" onClick={() => setFile(null)}>
                취소
              </Button>
            </>
          ) : (
            <>
              <span className={s.progress} aria-label="올리는 중">
                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
              <span className={s.uploadPct}>{Math.round(ratio * 100)}%</span>
              <button type="button" className={s.uploadCancel} aria-label="올리기 취소" onClick={() => ctrl.current?.abort()}>
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className={s.uploadError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function DocumentBody({ d, onChanged }: { d: DocumentDetail; onChanged: () => void }) {
  const me = useMe().data
  return (
    <Columns
      sideWidth={320}
      main={
        <Card className={s.article}>
          <Breadcrumb items={[{ label: '자료실', to: '/library' }, { label: d.category }, { label: '상세' }]} />
          <h2 className={s.title}>{d.title}</h2>
          <div className={s.meta}>
            <span>{d.author}</span>
            <span>· {d.ago}</span>
            {d.edited && <span>· 수정됨</span>}
            {d.visibility !== 'LAB' && (
              <Chip tone={d.visibility === 'PRIVATE' ? 'muted' : 'warning'} icon={Lock}>
                {VISIBILITY_LABEL[d.visibility]}
              </Chip>
            )}
          </div>
          {d.body && (
            <div className={s.body}>
              <Markdown source={d.body} />
            </div>
          )}

          {d.files.length > 0 && (
            <section className={s.section}>
              <SectionHead icon={FileText} title={`파일 ${d.files.length}개`} />
              {d.files.map((g) => (
                <div key={g.name} className={s.group}>
                  <VersionRow v={g.latest} latest />
                  {g.previous.length > 0 && (
                    <details className={s.previous}>
                      <summary>
                        <History size={14} /> 이전 버전 {g.previous.length}개
                      </summary>
                      {g.previous.map((v) => (
                        <VersionRow key={v.version} v={v} />
                      ))}
                    </details>
                  )}
                  {d.canEdit && <FileUploader documentId={d.documentId} logicalName={g.name} onDone={onChanged} label="새 버전 올리기" />}
                </div>
              ))}
            </section>
          )}
          {d.canEdit && (
            <section className={s.section}>
              <FileUploader documentId={d.documentId} logicalName={null} onDone={onChanged} label="파일 더하기" />
            </section>
          )}

          {d.links.length > 0 && (
            <section className={s.section}>
              <SectionHead icon={Link2} title="링크" />
              {d.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={s.link}>
                  <ExternalLink size={14} />
                  {l.title}
                </a>
              ))}
            </section>
          )}

          <section className={s.section}>
            <CommentThread targetType="DOCUMENT" targetId={d.documentId} meName={me?.name ?? '나'} mock={MOCK_COMMENTS} />
          </section>
        </Card>
      }
      side={
        <Card>
          <SectionHead icon={Folder} title="자료 정보" />
          <KeyValue
            items={[
              ['카테고리', d.category],
              ['폴더', d.folderPath ?? '폴더 밖'],
              ['프로젝트', d.project ? `${d.project.projectKey} · ${d.project.name}` : '연결 안 함'],
              ['공개 범위', VISIBILITY_LABEL[d.visibility]],
              [
                '태그',
                d.tags.length ? (
                  <span className={s.tags}>
                    <Tag size={12} />
                    {d.tags.map((t) => `#${t}`).join(' ')}
                  </span>
                ) : (
                  '없음'
                ),
              ],
              [
                '댓글',
                <span key="c" className={s.tags}>
                  <MessageCircle size={12} />
                  {d.commentCount}
                </span>,
              ],
            ]}
          />
        </Card>
      }
    />
  )
}
