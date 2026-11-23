import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Download, Eye, Kanban, Link2, Lock, MessageCircle, Paperclip, Pencil, Pin, Share2, Upload, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Columns, ConfirmDialog, Empty, FormError, KeyValue, Loadable, Note, SectionHead } from '../../components/ui'
import { Markdown } from '../../components/markdown/Markdown'
import { PageHeader } from '../../layouts/PageHeader'
import { errorText, uploadFile } from '../../api/content'
import { addDocumentFile, deleteDocument, deleteDocumentComment, patchDocument, postDocumentComment, useDocumentDetail, type DocumentDetail } from '../../api/documents'
import { getDataMode } from '../../lib/dataMode'
import { CATEGORY_NAME } from '../../mocks/documents'
import s from './DocumentDetailPage.module.css'

/** 자료 상세 (Penpot 06 · 자료 상세) — D-3, D-4, D-5, D-7, 댓글 */
export function DocumentDetailPage() {
  const { id } = useParams()
  const detail = useDocumentDetail(Number(id))
  return (
    <>
      <PageHeader title="자료실" subtitle="논문 · 발표자료 · 문서 · 질문을 카테고리로" action={null} />
      <Loadable resource={detail} label="자료">
        {(d) => <Detail key={d.doc.documentId} d={d} />}
      </Loadable>
    </>
  )
}

function Detail({ d }: { d: DocumentDetail }) {
  const navigate = useNavigate()
  const isLive = getDataMode() === 'live'
  const { doc, permissions: perm } = d
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openVersions, setOpenVersions] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const resolved = d.comments.find((c) => c.id === d.resolvedCommentId)

  /** 저장 동작 공통: 실패하면 안내만 하고 화면은 그대로 둔다 */
  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  const addFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    void run(async () => {
      const ref = isLive ? await uploadFile(file) : { publicId: `mock-${file.name}`, name: file.name, size: file.size }
      await addDocumentFile(doc.documentId, isLive, ref, '', d.files)
    }, '파일을 올리지 못했어요.')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      <Columns
        sideWidth={380}
        main={
          <>
            <Card className={s.card}>
              <div className={s.top}>
                <Link to="/library" className={s.back}>
                  <ChevronLeft size={16} />
                  자료실 · {CATEGORY_NAME[doc.categoryCode] ?? doc.categoryCode}
                </Link>
                {perm.canPin && (
                  <button type="button" className={s.small} disabled={busy} onClick={() => run(() => patchDocument(doc.documentId, isLive, { pinned: !doc.pinned }), '고정을 바꾸지 못했어요.')}>
                    <Pin size={14} />
                    {doc.pinned ? '고정 풀기' : '고정'}
                  </button>
                )}
                {perm.canEdit && (
                  // TODO: 자료 고치기(D-4 내용 필드) — 올리기 창을 고치기로도 쓰게 한다
                  <button type="button" className={s.small} disabled title="자료 고치기는 준비 중이에요">
                    <Pencil size={14} />
                    고치기
                  </button>
                )}
                {perm.canDelete && (
                  <button type="button" className={`${s.small} ${s.danger}`} onClick={() => setConfirmDelete(true)}>
                    <X size={14} />
                    지우기
                  </button>
                )}
              </div>

              <div className={s.title}>
                <div className={s.badges}>
                  <Chip>{CATEGORY_NAME[doc.categoryCode] ?? doc.categoryCode}</Chip>
                  {doc.project && (
                    <Link to={`/projects/${doc.project.projectKey}/files`}>
                      <Chip tone="plain" icon={Kanban} className={s.soft}>
                        {doc.project.name}
                      </Chip>
                    </Link>
                  )}
                  {doc.visibility === 'PROJECT_MEMBERS' && (
                    <Chip tone="tint" icon={Lock}>
                      참여자만
                    </Chip>
                  )}
                  {doc.pinned && (
                    <Chip tone="tint" icon={Pin}>
                      고정
                    </Chip>
                  )}
                </div>
                <h2>{doc.title}</h2>
                <div className={s.author}>
                  <Avatar name={doc.author} size={24} />
                  <strong>{doc.author}</strong>
                  <span>
                    {d.created} 올림 · {d.edited} 고침
                  </span>
                  {doc.tags.map((t) => (
                    <Chip key={t} tone="plain" className={s.soft}>
                      #{t}
                    </Chip>
                  ))}
                </div>
              </div>

              {d.body && (
                <div className={s.body}>
                  <Markdown source={d.body} projectKey={doc.project?.projectKey} />
                </div>
              )}

              <div className={s.filesHead}>
                <Paperclip size={16} />
                <strong>파일 {d.files.length}개</strong>
                {perm.canEdit && (
                  <>
                    <button type="button" className={s.small} disabled={busy} onClick={() => fileInput.current?.click()}>
                      <Upload size={14} />
                      파일 더하기
                    </button>
                    <input ref={fileInput} type="file" hidden onChange={(e) => addFile(e.target.files)} />
                  </>
                )}
              </div>
              {d.files.length === 0 && <Empty>붙은 파일이 없어요.</Empty>}
              {d.files.map((g) => {
                const open = openVersions.includes(g.logicalName)
                return (
                  <div key={g.logicalName} className={s.file}>
                    <div className={s.fileRow}>
                      <span className={s.ext}>{(g.ext || '?').toUpperCase()}</span>
                      <span className={s.fileText}>
                        <strong>
                          {g.logicalName}
                          <em className={g.previous.length ? s.verOn : undefined}>v{g.latest.version}</em>
                        </strong>
                        <small>{[g.latest.size, g.latest.uploadedBy, g.latest.createdAt, g.latest.note].filter(Boolean).join(' · ')}</small>
                      </span>
                      {g.previous.length > 0 && (
                        <button
                          type="button"
                          className={s.small}
                          aria-expanded={open}
                          onClick={() => setOpenVersions(open ? openVersions.filter((x) => x !== g.logicalName) : [...openVersions, g.logicalName])}
                        >
                          <Eye size={14} />
                          이전 버전 {g.previous.length}
                        </button>
                      )}
                      <a className={`${s.small} ${s.primary}`} href={g.latest.url} download={g.latest.name}>
                        <Download size={14} />
                        내려받기
                      </a>
                    </div>
                    {open && (
                      <div className={s.versions}>
                        {g.previous.map((v) => (
                          <a key={v.version} href={v.url} download={v.name}>
                            <em>v{v.version}</em>
                            <span>{[v.size, v.uploadedBy, v.createdAt, v.note].filter(Boolean).join(' · ')}</span>
                            <Download size={14} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className={s.hint}>같은 이름으로 다시 올리면 새 버전이 돼요. 내려받기 주소는 5분 동안만 쓸 수 있어요.</p>
              <FormError>{error}</FormError>
            </Card>

            <Card className={s.comments}>
              <SectionHead icon={MessageCircle} title={`댓글 ${d.comments.length}`} />
              {d.comments.map((c) => (
                <div key={c.id} className={s.comment}>
                  <Avatar name={c.author} size={30} />
                  <div className={c.id === d.resolvedCommentId ? `${s.bubble} ${s.bubbleResolved}` : s.bubble}>
                    <div className={s.bubbleHead}>
                      <strong>{c.author}</strong>
                      <span>{c.ago}</span>
                      {c.id === d.resolvedCommentId && (
                        <Chip tone="positive" icon={Check}>
                          해결
                        </Chip>
                      )}
                      {perm.canResolve && c.id !== d.resolvedCommentId && (
                        <button type="button" disabled={busy} onClick={() => run(() => patchDocument(doc.documentId, isLive, { resolvedCommentId: c.id }), '해결 표시를 하지 못했어요.')}>
                          <Check size={14} />
                          해결로 고르기
                        </button>
                      )}
                      {c.mine && (
                        <button type="button" aria-label="댓글 지우기" disabled={busy} onClick={() => run(() => deleteDocumentComment(doc.documentId, isLive, c.id, d.comments), '댓글을 지우지 못했어요.')}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              <form
                className={s.write}
                onSubmit={(e) => {
                  e.preventDefault()
                  const text = comment.trim()
                  if (!text) return
                  void run(() => postDocumentComment(doc.documentId, isLive, text, d.comments), '댓글을 올리지 못했어요.').then(() => setComment(''))
                }}
              >
                <Avatar name={d.me} size={30} />
                <input value={comment} maxLength={2000} placeholder="댓글 쓰기 · @로 멘션 (2,000자)" onChange={(e) => setComment(e.target.value)} aria-label="댓글" />
                <Button type="submit" disabled={busy || !comment.trim()}>
                  올리기
                </Button>
              </form>
            </Card>
          </>
        }
        side={
          <>
            <Card>
              <SectionHead title="정보" />
              <KeyValue
                items={[
                  ['카테고리', CATEGORY_NAME[doc.categoryCode] ?? doc.categoryCode],
                  ['프로젝트', doc.project?.name ?? '없음'],
                  ['공개 범위', doc.visibility === 'LAB' ? '연구실 전체' : '프로젝트 참여자만'],
                  ['최신 버전', d.files.length ? `v${Math.max(...d.files.map((g) => g.latest.version))}` : '파일 없음'],
                  ['올린 날', d.created],
                ]}
              />
            </Card>
            <Card>
              <SectionHead title={`링크 ${d.links.length}개`} />
              {d.links.length === 0 && <Empty>연결한 링크가 없어요.</Empty>}
              {d.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className={s.link}>
                  <Link2 size={16} />
                  <span>
                    <strong>{l.title}</strong>
                    <small>{l.url.replace(/^https?:\/\//, '')}</small>
                  </span>
                  <Share2 size={14} />
                </a>
              ))}
            </Card>
            {doc.resolved !== null && (
              <Card>
                <SectionHead title={resolved ? '해결된 질문' : '해결 안 된 질문'} />
                {resolved ? (
                  <div className={s.resolved}>
                    <b>
                      <Check size={14} />
                      해결로 고른 댓글
                    </b>
                    <p>
                      {resolved.text} — {resolved.author}
                    </p>
                    {perm.canResolve && (
                      <button type="button" disabled={busy} onClick={() => run(() => patchDocument(doc.documentId, isLive, { resolvedCommentId: null }), '해결을 취소하지 못했어요.')}>
                        해결 취소
                      </button>
                    )}
                  </div>
                ) : (
                  <Empty>아직 해결로 고른 댓글이 없어요.</Empty>
                )}
                <p className={s.hint}>글쓴이만 댓글 하나를 "해결"로 고르거나 취소할 수 있어요</p>
              </Card>
            )}
            {doc.visibility === 'PROJECT_MEMBERS' && <Note icon={Lock}>이 자료는 프로젝트 참여자에게만 보여요. 자료실 목록 · 검색에도 다른 사람에게는 나오지 않아요.</Note>}
          </>
        }
      />
      {confirmDelete && (
        <ConfirmDialog
          title="이 자료를 지울까요?"
          confirmLabel="지우기"
          icon={X}
          danger
          busy={busy}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() =>
            run(async () => {
              await deleteDocument(doc.documentId, isLive)
              navigate('/library')
            }, '자료를 지우지 못했어요.')
          }
        >
          <p>
            파일 {d.files.length}개와 댓글 {d.comments.length}개도 함께 안 보이게 돼요. 30일 안에는 content-manage 역할이 되살릴 수 있고, 그 뒤에는 완전히 지워져요.
          </p>
          <FormError>{error}</FormError>
        </ConfirmDialog>
      )}
    </>
  )
}
