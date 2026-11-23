import { useCallback, useMemo, useRef, useState } from 'react'
import { Archive, Check, FileText, FlaskConical, Folder, FolderPlus, Image, Info, Plus, Upload, X } from 'lucide-react'
import { Button, Modal } from '../../../components/ui'
import { getDataMode } from '../../../lib/dataMode'
import { errorText } from '../../../api/content'
import { useProjectList } from '../../../api/projects'
import {
  createDocument,
  createFolder,
  fakeUpload,
  fileSize,
  notifyDocumentsChanged,
  uploadWithProgress,
  useDocumentCategories,
  useDocumentPolicy,
  useFolders,
  VISIBILITY_LABEL,
  type DocVisibility,
} from '../../../api/documents'
import f from '../../../components/form/form.module.css'
import s from './UploadModal.module.css'

type Item = {
  id: number
  file: File
  status: 'waiting' | 'uploading' | 'done' | 'failed' | 'too-big'
  ratio: number
  startedAt: number
  /** 남은 시간(초) 어림 — 진행률을 받을 때 계산 */
  leftSec?: number | null
  publicId?: string
  error?: string
  abort?: AbortController
}

const IMAGE = /^image\//
const ARCHIVE = /\.(zip|tar|gz|7z|rar)$/i
const fileIcon = (file: File) => (IMAGE.test(file.type) ? Image : ARCHIVE.test(file.name) ? Archive : FileText)
const titleOf = (name: string) => name.replace(/\.[^.]+$/, '') || name

let seq = 0

/**
 * 자료 올리기 (Penpot 06 "자료 올리기"). 파일마다 자료 하나가 된다 — 제목은 파일 이름(확장자 뺌).
 * 고른 즉시 Garage 로 올리고(파일별 진행 막대 · 취소), "완료"를 누르면 올라간 파일로 자료를 만든다.
 * projectKey 를 주면 그 프로젝트로 고정한다 (프로젝트 "자료" 탭).
 */
export function UploadModal({ projectKey: fixedProject, onClose }: { projectKey?: string | null; onClose: () => void }) {
  const live = getDataMode() === 'live'
  const policy = useDocumentPolicy().data
  const categories = useDocumentCategories().data ?? []
  const projects = useProjectList({ category: 'ALL', mine: true, activeOnly: true, archived: false }).data?.projects ?? []

  const [items, setItems] = useState<Item[]>([])
  const [dragging, setDragging] = useState(false)
  const [projectKey, setProjectKey] = useState<string | null>(fixedProject ?? null)
  const folders = useFolders(projectKey)
  const [folderId, setFolderId] = useState<number | null>(null)
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<DocVisibility>(fixedProject ? 'PROJECT_MEMBERS' : 'LAB')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const maxBytes = (policy?.maxFileMb ?? 200) * 1024 * 1024
  const maxAtOnce = policy?.maxFilesPerUpload ?? 10

  // 카테고리를 고르지 않았으면 서버 목록의 첫 값
  const categoryCode = category || categories[0]?.code || ''

  const patch = useCallback((id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))), [])

  const start = useCallback(
    (item: Item) => {
      const abort = new AbortController()
      const startedAt = Date.now()
      patch(item.id, { status: 'uploading', abort, startedAt, ratio: 0, leftSec: null, error: undefined })
      const run = live ? uploadWithProgress : fakeUpload
      const onProgress = (ratio: number) =>
        patch(item.id, { ratio, leftSec: ratio > 0.05 ? Math.round((((Date.now() - startedAt) / ratio) * (1 - ratio)) / 1000) : null })
      run(item.file, onProgress, abort.signal)
        .then((ref) => patch(item.id, { status: 'done', ratio: 1, publicId: ref.publicId, abort: undefined }))
        .catch((e) => patch(item.id, { status: 'failed', error: errorText(e, '파일을 올리지 못했어요.'), abort: undefined }))
    },
    [live, patch],
  )

  const add = (list: FileList | File[]) => {
    const room = maxAtOnce - items.filter((x) => x.status !== 'failed' && x.status !== 'too-big').length
    const picked = [...list]
    if (picked.length > room) setError(`한 번에 ${maxAtOnce}개까지 올릴 수 있어요. 앞의 ${Math.max(room, 0)}개만 넣었어요.`)
    const next: Item[] = picked.slice(0, Math.max(room, 0)).map((file) => ({
      id: ++seq,
      file,
      status: file.size > maxBytes ? 'too-big' : 'waiting',
      ratio: 0,
      startedAt: Date.now(),
    }))
    setItems((xs) => [...xs, ...next])
    next.filter((x) => x.status === 'waiting').forEach(start)
  }

  const remove = (item: Item) => {
    item.abort?.abort()
    setItems((xs) => xs.filter((x) => x.id !== item.id))
  }

  const counts = useMemo(
    () => ({
      done: items.filter((x) => x.status === 'done').length,
      uploading: items.filter((x) => x.status === 'uploading' || x.status === 'waiting').length,
      failed: items.filter((x) => x.status === 'failed' || x.status === 'too-big').length,
    }),
    [items],
  )

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t.slice(0, 20)])
    setTagDraft('')
  }

  const makeFolder = async () => {
    const name = newFolder?.trim()
    if (!name) return setNewFolder(null)
    if (!live) return setNewFolder(null)
    try {
      const created = await createFolder(name, projectKey, folderId)
      folders.reload()
      setFolderId(created.folderId)
      setNewFolder(null)
    } catch (e) {
      setError(errorText(e, '폴더를 만들지 못했어요.'))
    }
  }

  const close = () => {
    items.forEach((x) => x.abort?.abort())
    onClose()
  }

  const finish = async () => {
    setError(null)
    if (counts.uploading > 0) return setError('아직 올리는 중인 파일이 있어요. 다 올라간 뒤 눌러 주세요.')
    if (visibility === 'PROJECT_MEMBERS' && !projectKey) return setError('"프로젝트 참여자만"으로 올리려면 프로젝트를 골라 주세요.')
    const done = items.filter((x) => x.status === 'done' && x.publicId)
    if (done.length === 0) return close()
    if (!categoryCode) return setError('카테고리를 골라 주세요.')
    setSaving(true)
    try {
      if (live) {
        for (const x of done) {
          await createDocument({ categoryCode, title: titleOf(x.file.name), projectKey, visibility, folderId, tags, fileIds: [x.publicId!] })
        }
      }
      notifyDocumentsChanged()
      onClose()
    } catch (e) {
      setError(errorText(e, '자료를 만들지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }

  const folderOptions = folders.data?.folders ?? []
  const visibilityHint =
    visibility === 'PRIVATE' ? '나만 봐요. 프로젝트 관리자 · 관리자도 못 봐요.' : visibility === 'PROJECT_MEMBERS' ? '연결한 프로젝트 참여자만 봐요.' : '연구실 구성원 누구나 봐요.'

  return (
    <Modal
      title="자료 올리기"
      onClose={close}
      width={720}
      footer={
        <>
          {error ? (
            <span className={f.footError}>{error}</span>
          ) : (
            <span className={f.footNote}>
              <Info size={14} />
              {items.length === 0 ? '파일마다 자료 하나가 돼요' : `${counts.done}개 올림 · ${counts.uploading}개 올리는 중 · ${counts.failed}개 실패`}
            </span>
          )}
          <Button variant="secondary" onClick={close}>
            닫기
          </Button>
          <Button icon={Check} onClick={finish} disabled={saving}>
            {saving ? '만드는 중…' : '완료'}
          </Button>
        </>
      }
    >
      <div className={f.form}>
        <button
          type="button"
          className={dragging ? `${s.drop} ${s.dropOn}` : s.drop}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files.length) add(e.dataTransfer.files)
          }}
        >
          <span className={s.dropIcon}>
            <Upload size={20} />
          </span>
          <strong>파일을 여기로 끌어다 놓거나 눌러서 고르세요</strong>
          <small>
            한 번에 {maxAtOnce}개 · 파일마다 {policy?.maxFileMb ?? 200}MB 까지
          </small>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files)
            e.target.value = ''
          }}
        />

        {items.length > 0 && (
          <ul className={s.files}>
            {items.map((x) => {
              const Icon = fileIcon(x.file)
              const bad = x.status === 'failed' || x.status === 'too-big'
              return (
                <li key={x.id} className={bad ? `${s.file} ${s.fileBad}` : s.file}>
                  <span className={s.fileIcon}>
                    <Icon size={18} />
                  </span>
                  <div className={s.fileMain}>
                    <div className={s.fileName}>
                      <strong>{x.file.name}</strong>
                      <small>{fileSize(x.file.size)}</small>
                    </div>
                    {x.status === 'uploading' || x.status === 'waiting' ? (
                      <>
                        <div className={s.bar}>
                          <span style={{ width: `${Math.round(x.ratio * 100)}%` }} />
                        </div>
                        <small className={s.fileState}>
                          {Math.round(x.ratio * 100)}%{x.leftSec != null && ` · 남은 시간 약 ${x.leftSec}초`}
                        </small>
                      </>
                    ) : (
                      <small className={x.status === 'done' ? s.fileDone : s.fileError}>
                        {x.status === 'done'
                          ? '올렸어요'
                          : x.status === 'too-big'
                            ? `${policy?.maxFileMb ?? 200}MB 를 넘어서 올릴 수 없어요`
                            : x.error}
                      </small>
                    )}
                  </div>
                  {x.status === 'done' ? (
                    <Check size={20} className={s.doneMark} aria-label="올림" />
                  ) : x.status === 'failed' ? (
                    <Button variant="ghost" onClick={() => start(x)}>
                      다시
                    </Button>
                  ) : null}
                  {x.status !== 'done' && (
                    <button type="button" className={s.cancel} onClick={() => remove(x)} aria-label={`${x.file.name} 빼기`}>
                      <X size={18} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className={f.row2}>
          <label className={f.field}>
            <span className={f.label}>폴더</span>
            {newFolder === null ? (
              <span className={f.input}>
                <Folder size={18} />
                <select value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">폴더 밖</option>
                  {folderOptions.map((o) => (
                    <option key={o.folderId} value={o.folderId}>
                      {o.path}
                    </option>
                  ))}
                </select>
                {(folders.data?.canCreate ?? true) && (
                  <button type="button" className={s.inlineBtn} onClick={() => setNewFolder('')} title={folderId ? '이 폴더 안에 새 폴더' : '새 폴더'}>
                    <FolderPlus size={16} />
                  </button>
                )}
              </span>
            ) : (
              <span className={f.input}>
                <FolderPlus size={18} />
                <input
                  autoFocus
                  value={newFolder}
                  maxLength={50}
                  placeholder={folderId ? '이 폴더 안에 만들 이름' : '새 폴더 이름'}
                  onChange={(e) => setNewFolder(e.target.value.replace(/\//g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void makeFolder()
                    }
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setNewFolder(null)
                    }
                  }}
                />
                <button type="button" className={s.inlineBtn} onClick={() => void makeFolder()} aria-label="폴더 만들기">
                  <Check size={16} />
                </button>
              </span>
            )}
          </label>
          <label className={f.field}>
            <span className={f.label}>프로젝트 연결</span>
            <span className={f.input}>
              <FlaskConical size={18} />
              <select
                value={projectKey ?? ''}
                disabled={!!fixedProject}
                onChange={(e) => {
                  setProjectKey(e.target.value || null)
                  setFolderId(null)
                  if (!e.target.value && visibility === 'PROJECT_MEMBERS') setVisibility('LAB')
                }}
              >
                <option value="">연결 안 함</option>
                {fixedProject && !projects.some((p) => p.projectKey === fixedProject) && <option value={fixedProject}>{fixedProject}</option>}
                {projects.map((p) => (
                  <option key={p.projectKey} value={p.projectKey}>
                    {p.projectKey} · {p.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className={f.row2}>
          <div className={f.field}>
            <span className={f.label}>공개 범위</span>
            <div className={f.pills} role="radiogroup" aria-label="공개 범위">
              {(['LAB', 'PROJECT_MEMBERS', 'PRIVATE'] as DocVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={visibility === v}
                  disabled={v === 'PROJECT_MEMBERS' && !projectKey}
                  className={visibility === v ? `${f.pill} ${f.pillOn}` : f.pill}
                  onClick={() => setVisibility(v)}
                >
                  {visibility === v && <Check size={14} />}
                  {VISIBILITY_LABEL[v]}
                </button>
              ))}
            </div>
            <span className={f.hint}>{visibilityHint}</span>
          </div>
          <label className={f.field}>
            <span className={f.label}>
              카테고리<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <select value={categoryCode} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className={f.field}>
          <span className={f.label}>태그</span>
          <div className={f.tags}>
            {tags.map((t) => (
              <button key={t} type="button" className={f.tag} onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`${t} 태그 빼기`}>
                <X size={12} />
                {t}
              </button>
            ))}
            {tags.length < 10 && (
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
      </div>
    </Modal>
  )
}
