import { useState } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { Button, Chip, Modal } from '../../../components/ui'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { errorText } from '../../../api/content'
import s from '../ThreadPage.module.css'

type ComposerProps = {
  projectName: string
  projectKey: string
  onClose: () => void
  onSubmit: (title: string, body: string) => Promise<void>
}
/** 새 글 쓰기 모달 */
export function ThreadComposer({ projectName, projectKey, onClose, onSubmit }: ComposerProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: 첨부 파일 고르는 칸 (api/content.ts 의 uploadFile → attachmentFileIds). 지금은 첨부 없이 올린다
  const submit = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await onSubmit(title, body)
    } catch (e) {
      setError(errorText(e, '글을 올리지 못했어요.'))
      setSending(false)
    }
  }

  return (
    <Modal
      title="새 글"
      badge={<Chip tone="tint">{projectName} · 스레드</Chip>}
      onClose={onClose}
      footer={
        <>
          <span className={s.composerHint}>
            {error ? <TriangleAlert size={16} /> : <Info size={16} />}
            {error ??
              `@이름으로 알리고, ${projectKey}-12 처럼 쓰면 작업 링크가 돼요. 상단 고정은 프로젝트 관리자가 글을 올린 뒤 할 수 있어요.`}
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={!body.trim() || sending}>
            올리기
          </Button>
        </>
      }
    >
      <label className={s.titleInput}>
        <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <small>제목 (선택) · {title.length} / 100</small>
      </label>
      <MarkdownEditor value={body} onChange={setBody} projectKey={projectKey} placeholder="내용을 Markdown 으로 써 주세요." />
    </Modal>
  )
}
