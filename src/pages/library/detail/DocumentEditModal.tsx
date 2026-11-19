import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Button, Modal } from '../../../components/ui'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { ApiError } from '../../../api/client'
import {
  updateDocument,
  useDocumentCategories,
  useFolders,
  VISIBILITY_LABEL,
  type DocumentDetail,
  type DocumentEdit,
  type DocVisibility,
} from '../../../api/documents'
import f from '../../../components/form/form.module.css'
import s from './DocumentDetailPage.module.css'

const MAX_TAGS = 10

/** 자료 고치기 (D-4): 제목 · 본문 · 카테고리 · 폴더 · 공개 범위 · 태그. 프로젝트 연결과 파일은 상세 화면에서 */
export function DocumentEditModal({ d, onClose, onSaved }: { d: DocumentDetail; onClose: () => void; onSaved: () => void }) {
  const before: DocumentEdit = { categoryCode: d.categoryCode, title: d.title, body: d.body, visibility: d.visibility, folderId: d.folderId, tags: d.tags }
  const [form, setForm] = useState<DocumentEdit>(before)
  const [tagDraft, setTagDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categories = useDocumentCategories().data ?? []
  const folders = useFolders(d.project?.projectKey ?? null).data?.folders ?? []

  const set = <K extends keyof DocumentEdit>(k: K, v: DocumentEdit[K]) => setForm((x) => ({ ...x, [k]: v }))
  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t && t.length <= 20 && !form.tags.includes(t) && form.tags.length < MAX_TAGS) set('tags', [...form.tags, t])
    setTagDraft('')
  }
  const title = form.title.trim()
  const canSave = !!title && title.length <= 200 && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await updateDocument(d.documentId, before, { ...form, title })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '자료를 고치지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="자료 고치기"
      onClose={onClose}
      width={860}
      footer={
        <>
          {error && (
            <span className={f.footError} role="alert">
              {error}
            </span>
          )}
          <span className={s.grow} />
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} disabled={!canSave} onClick={() => void submit()}>
            {saving ? '저장하는 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className={f.form}>
        <label className={f.field}>
          <span className={f.label}>
            제목<span className={f.req}>*</span>
          </span>
          <span className={f.input}>
            <input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
          </span>
        </label>

        <div className={f.row2}>
          <label className={f.field}>
            <span className={f.label}>카테고리</span>
            <span className={f.input}>
              <select value={form.categoryCode} onChange={(e) => set('categoryCode', e.target.value)}>
                {!categories.some((c) => c.code === form.categoryCode) && <option value={form.categoryCode}>{d.category}</option>}
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={f.field}>
            <span className={f.label}>폴더</span>
            <span className={f.input}>
              <select value={form.folderId ?? ''} onChange={(e) => set('folderId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">폴더 밖</option>
                {form.folderId != null && !folders.some((x) => x.folderId === form.folderId) && (
                  <option value={form.folderId}>{d.folderPath ?? '지금 폴더'}</option>
                )}
                {folders.map((x) => (
                  <option key={x.folderId} value={x.folderId}>
                    {x.path}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className={f.field}>
          <span className={f.label}>공개 범위</span>
          <div className={f.pills} role="radiogroup" aria-label="공개 범위">
            {(['LAB', 'PROJECT_MEMBERS', 'PRIVATE'] as DocVisibility[]).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.visibility === v}
                disabled={v === 'PROJECT_MEMBERS' && !d.project}
                className={form.visibility === v ? `${f.pill} ${f.pillOn}` : f.pill}
                onClick={() => set('visibility', v)}
              >
                {form.visibility === v && <Check size={14} />}
                {VISIBILITY_LABEL[v]}
              </button>
            ))}
          </div>
          {!d.project && <span className={f.hint}>프로젝트에 연결하지 않은 자료라 "프로젝트 참여자만"은 고를 수 없어요.</span>}
        </div>

        <div className={f.field}>
          <span className={f.label}>태그</span>
          <div className={f.tags}>
            {form.tags.map((t) => (
              <button key={t} type="button" className={f.tag} onClick={() => set('tags', form.tags.filter((x) => x !== t))} aria-label={`${t} 태그 빼기`}>
                <X size={12} />
                {t}
              </button>
            ))}
            {form.tags.length < MAX_TAGS && (
              <span className={s.tagAdd}>
                <Plus size={12} />
                <input
                  className={f.tagInput}
                  value={tagDraft}
                  placeholder="태그 추가"
                  maxLength={21}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onBlur={addTag}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
              </span>
            )}
          </div>
        </div>

        <div className={f.field}>
          <span className={f.label}>본문</span>
          <MarkdownEditor value={form.body} onChange={(v) => set('body', v)} projectKey={d.project?.projectKey} placeholder="자료 설명 (Markdown)" minHeight={240} />
        </div>
      </div>
    </Modal>
  )
}
