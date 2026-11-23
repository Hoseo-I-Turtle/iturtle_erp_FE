import { useState } from 'react'
import { AtSign, Info, Paperclip, TriangleAlert, X } from 'lucide-react'
import { Button, Chip, Modal } from '../../../components/ui'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { errorText, threadLink } from '../../../api/content'
import { DocumentPicker } from './DocumentPicker'
import { MentionPicker } from './MentionPicker'
import c from './cards.module.css'
import s from '../ThreadPage.module.css'

type ComposerProps = {
  projectName: string
  projectKey: string
  onClose: () => void
  onSubmit: (title: string, body: string, documentIds: number[]) => Promise<void>
  /** 고치기 (ERP-33): 처음 값. 있으면 "글 고치기" 창이 되고 자료 연결은 글 화면에서 따로 한다 */
  initial?: { title: string | null; body: string }
}
/** 새 글 쓰기 · 고치기 모달 */
export function ThreadComposer({ projectName, projectKey, onClose, onSubmit, initial }: ComposerProps) {
  const editing = initial !== undefined
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 자료 연결 (ERP-23) · 다른 스레드 언급 (ERP-21)
  const [documents, setDocuments] = useState<{ documentId: number; title: string }[]>([])
  const [pickingDocs, setPickingDocs] = useState(false)
  const [mentioning, setMentioning] = useState(false)

  // TODO: 첨부 파일 고르는 칸 (api/content.ts 의 uploadFile → attachmentFileIds). 지금은 첨부 없이 올린다
  const submit = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await onSubmit(title, body, documents.map((d) => d.documentId))
    } catch (e) {
      setError(errorText(e, editing ? '고치지 못했어요.' : '글을 올리지 못했어요.'))
      setSending(false)
    }
  }

  return (
    <Modal
      title={editing ? '글 고치기' : '새 글'}
      badge={<Chip tone="tint">{projectName} · 스레드</Chip>}
      onClose={onClose}
      footer={
        <>
          <span className={s.composerHint}>
            {error ? <TriangleAlert size={16} /> : <Info size={16} />}
            {error ??
              `@ 를 치면 사람을 골라 알리고, ${projectKey}-12 처럼 쓰면 작업 링크가 돼요.${editing ? ' 고친 뒤 새로 언급한 사람에게만 알림이 가요.' : ' 상단 고정은 프로젝트 관리자가 글을 올린 뒤 할 수 있어요.'}`}
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={!body.trim() || sending}>
            {editing ? '저장' : '올리기'}
          </Button>
        </>
      }
    >
      <label className={s.titleInput}>
        <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <small>제목 (선택) · {title.length} / 100</small>
      </label>
      <div className={c.toolbar}>
        <Button variant="secondary" icon={AtSign} onClick={() => setMentioning(!mentioning)}>
          스레드 언급
        </Button>
        {!editing && (
          <Button variant="secondary" icon={Paperclip} onClick={() => setPickingDocs(true)}>
            자료 연결{documents.length > 0 && ` ${documents.length}`}
          </Button>
        )}
      </div>
      {mentioning && (
        <MentionPicker
          projectKey={projectKey}
          onClose={() => setMentioning(false)}
          onPick={(m) => {
            setBody((b) => `${b}${b && !b.endsWith('\n') ? '\n' : ''}${threadLink(m)}\n`)
            setMentioning(false)
          }}
        />
      )}
      {documents.length > 0 && (
        <div className={c.chips}>
          {documents.map((d) => (
            <span key={d.documentId} className={c.chip}>
              <Paperclip size={12} /> {d.title}
              <button type="button" onClick={() => setDocuments(documents.filter((x) => x.documentId !== d.documentId))} aria-label={`${d.title} 빼기`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {pickingDocs && (
        <DocumentPicker
          projectKey={projectKey}
          value={documents}
          onClose={() => setPickingDocs(false)}
          onSave={(picked) => {
            setDocuments(picked)
            setPickingDocs(false)
          }}
        />
      )}
      <MarkdownEditor value={body} onChange={setBody} projectKey={projectKey} placeholder="내용을 Markdown 으로 써 주세요." />
    </Modal>
  )
}
