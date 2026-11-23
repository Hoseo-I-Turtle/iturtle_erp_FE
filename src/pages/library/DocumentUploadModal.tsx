import { useRef, useState, type DragEvent } from 'react'
import { Archive, Check, FileText, FlaskConical, Image, Info, Plus, Upload, X } from 'lucide-react'
import { Button, Field, FormError, FormRow, Modal, Select, TextArea, TextInput, ToggleChip } from '../../components/ui'
import { formatBytes } from '../../api/communication'
import { errorText, uploadFile } from '../../api/content'
import { createDocument, useMyProjectOptions, type DocumentDraft } from '../../api/documents'
import { getDataMode } from '../../lib/dataMode'
import { CATEGORY_NAME, type DocumentCategory } from '../../mocks/documents'
import s from './DocumentUploadModal.module.css'

const MAX_FILES = 20
const MAX_BYTES = 200 * 1024 * 1024
type Item = { id: string; name: string; size: number; state: 'uploading' | 'done' | 'failed'; message?: string; publicId?: string }

const iconOf = (name: string) => (/\.(png|jpe?g|gif|webp|svg)$/i.test(name) ? Image : /\.(zip|tar|gz|7z)$/i.test(name) ? Archive : FileText)

type Props = {
  /** 프로젝트 자료 탭에서 열면 그 프로젝트로 채운다 */
  projectKey?: string
  onClose: () => void
  onCreated: (documentId: number) => void
}

/** 자료 올리기 (Penpot 06 · 자료 올리기) — F-1 · F-2 로 올린 뒤 D-2 */
export function DocumentUploadModal({ projectKey = '', onClose, onCreated }: Props) {
  const isLive = getDataMode() === 'live'
  const projects = useMyProjectOptions()
  const [items, setItems] = useState<Item[]>([])
  const [f, setF] = useState<Omit<DocumentDraft, 'files'>>({
    categoryCode: 'DEV_DOC',
    title: '',
    body: '',
    projectKey,
    visibility: 'LAB',
    tags: [],
  })
  const [tag, setTag] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const add = (files: FileList | null) => {
    if (!files) return
    const room = MAX_FILES - items.length
    ;[...files].slice(0, room).forEach((file) => {
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`
      if (file.size > MAX_BYTES) {
        setItems((l) => [...l, { id, name: file.name, size: file.size, state: 'failed', message: '200MB 를 넘어서 올릴 수 없어요' }])
        return
      }
      setItems((l) => [...l, { id, name: file.name, size: file.size, state: 'uploading' }])
      const done = isLive ? uploadFile(file).then((r) => r.publicId) : new Promise<string>((ok) => window.setTimeout(() => ok(`mock-${id}`), 500))
      done.then((publicId) => patch(id, { state: 'done', publicId })).catch((e) => patch(id, { state: 'failed', message: errorText(e, '올리지 못했어요') }))
    })
    if (files.length > room) setError(`파일은 ${MAX_FILES}개까지 올릴 수 있어요.`)
    // 제목이 비어 있으면 첫 파일 이름으로 채운다
    if (!f.title && files[0]) set('title', files[0].name.replace(/\.[^.]+$/, '').slice(0, 200))
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    add(e.dataTransfer.files)
  }
  const addTag = () => {
    const t = tag.trim().replace(/^#/, '').slice(0, 20)
    if (t && !f.tags.includes(t) && f.tags.length < 10) set('tags', [...f.tags, t])
    setTag('')
  }

  const done = items.filter((x) => x.state === 'done')
  const uploading = items.filter((x) => x.state === 'uploading').length
  const failed = items.filter((x) => x.state === 'failed').length
  const visibility = f.projectKey ? f.visibility : 'LAB'

  const submit = async () => {
    if (!f.title.trim()) return setError('제목을 적어 주세요.')
    if (!f.body.trim() && done.length === 0) return setError('파일을 올리거나 내용을 적어 주세요.')
    if (uploading > 0) return setError('아직 올리는 중인 파일이 있어요.')
    setBusy(true)
    setError(null)
    try {
      const id = await createDocument(
        { ...f, title: f.title.trim(), visibility, files: done.map((x) => ({ publicId: x.publicId!, name: x.name, size: x.size })) },
        isLive,
        projects.data ?? [],
      )
      onCreated(id)
    } catch (e) {
      setError(errorText(e, '자료를 올리지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="자료 올리기"
      width={720}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span>
            <Info size={14} />
            {items.length === 0 ? '파일 없이 글만 올릴 수도 있어요' : [`${done.length}개 올림`, uploading && `${uploading}개 올리는 중`, failed && `${failed}개 실패`].filter(Boolean).join(' · ')}
          </span>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy || uploading > 0}>
            {busy ? '올리는 중…' : '완료'}
          </Button>
        </div>
      }
    >
      <button
        type="button"
        className={over ? `${s.drop} ${s.dropOver}` : s.drop}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <i>
          <Upload size={22} />
        </i>
        <strong>파일을 여기로 끌어다 놓거나 눌러서 고르세요</strong>
        <small>
          한 번에 {MAX_FILES}개 · 파일마다 200MB 까지 · 같은 이름을 두 번 올리면 버전(v1 · v2)으로 저장돼요
        </small>
      </button>
      <input ref={input} type="file" multiple hidden onChange={(e) => add(e.target.files)} />

      {items.length > 0 && (
        <div className={s.files}>
          {items.map((x) => {
            const Icon = iconOf(x.name)
            return (
              <div key={x.id} className={x.state === 'failed' ? `${s.file} ${s.fileFailed}` : s.file}>
                <i>
                  <Icon size={16} />
                </i>
                <span>
                  <strong>
                    {x.name}
                    <small>{formatBytes(x.size)}</small>
                  </strong>
                  {x.state === 'uploading' && <span className={s.bar} />}
                  <em className={s[x.state]}>{x.state === 'done' ? '올렸어요' : x.state === 'uploading' ? '올리는 중…' : x.message}</em>
                </span>
                {x.state === 'done' ? <Check size={16} className={s.ok} /> : null}
                <button type="button" aria-label={`${x.name} 빼기`} onClick={() => setItems((l) => l.filter((y) => y.id !== x.id))}>
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Field label="제목" required>
        <TextInput value={f.title} onChange={(v) => set('title', v.slice(0, 200))} placeholder="자료 제목" trailing={`${f.title.length} / 200`} />
      </Field>
      <FormRow>
        {/* 명세 확인 필요: 디자인의 "폴더"는 API 에 없다. 자료실은 카테고리(DOCUMENT_CATEGORY)로 나눈다 */}
        <Field label="카테고리" required>
          <Select
            block
            value={f.categoryCode}
            options={(Object.keys(CATEGORY_NAME) as DocumentCategory[]).map((c) => ({ value: c, label: CATEGORY_NAME[c] }))}
            onChange={(v) => set('categoryCode', v)}
            label="카테고리"
          />
        </Field>
        <Field label="프로젝트 연결">
          <Select
            block
            value={f.projectKey}
            options={[{ value: '', label: '연결 안 함' }, ...(projects.data ?? []).map((p) => ({ value: p.projectKey, label: `${p.projectKey} · ${p.name}` }))]}
            onChange={(v) => set('projectKey', v)}
            label="프로젝트 연결"
          />
        </Field>
      </FormRow>
      <Field label="공개 범위" help={f.projectKey ? '"프로젝트 참여자만"은 자료실 목록 · 검색에서도 참여자에게만 보여요' : '프로젝트를 연결하면 참여자만 보게 할 수 있어요'}>
        <div className={s.pills}>
          <ToggleChip on={visibility === 'LAB'} check onClick={() => set('visibility', 'LAB')}>
            연구실 전체
          </ToggleChip>
          <ToggleChip on={visibility === 'PROJECT_MEMBERS'} check icon={FlaskConical} disabled={!f.projectKey} onClick={() => set('visibility', 'PROJECT_MEMBERS')}>
            프로젝트 참여자만
          </ToggleChip>
        </div>
      </Field>
      <Field label="태그" hint="10개까지">
        <div className={s.pills}>
          {f.tags.map((t) => (
            <button key={t} type="button" className={s.tag} onClick={() => set('tags', f.tags.filter((x) => x !== t))}>
              <X size={12} />
              {t}
            </button>
          ))}
          <label className={s.tagAdd}>
            <Plus size={12} />
            <input
              value={tag}
              placeholder="태그 추가"
              maxLength={20}
              onChange={(e) => setTag(e.target.value)}
              onBlur={addTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
          </label>
        </div>
      </Field>
      <Field label="설명" hint="Markdown · 파일이 없으면 꼭 적어 주세요">
        <TextArea value={f.body} onChange={(v) => set('body', v)} rows={3} placeholder="이 자료가 무엇인지 한두 줄로" />
      </Field>
      <FormError>{error ?? projects.error}</FormError>
    </Modal>
  )
}
