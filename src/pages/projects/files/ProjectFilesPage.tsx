import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Folder, FolderOpen, FolderPlus, Lock, MessageCircle, Pencil, Trash2, X } from 'lucide-react'
import { Button, Card, Chip, Columns, Empty, Loadable, SectionHead } from '../../../components/ui'
import { getDataMode } from '../../../lib/dataMode'
import { errorText } from '../../../api/content'
import {
  createFolder,
  deleteFolder,
  renameFolder,
  useDocumentsChanged,
  useFolders,
  useProjectDocuments,
  VISIBILITY_LABEL,
  type Folder as FolderRow,
} from '../../../api/documents'
import s from './ProjectFilesPage.module.css'

/** 경로("상위 / 하위")의 깊이 — 들여쓰기 */
const depth = (path: string) => path.split(' / ').length - 1

/**
 * 프로젝트 "자료" 탭: 그 프로젝트에 연결한 자료와 프로젝트 폴더 (D-1 projectKey · D-9 ~ D-12).
 * 올리기는 머리의 "자료 올리기"(프로젝트가 고정된 올리기 모달).
 */
export function ProjectFilesPage() {
  const { key } = useParams()
  const live = getDataMode() === 'live'
  const [folderId, setFolderId] = useState<number | null>(null)
  const folders = useFolders(key ?? null)
  const docs = useProjectDocuments(key, folderId)
  useDocumentsChanged(docs.reload)

  const [naming, setNaming] = useState<{ id: number | null; value: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = folders.data?.folders ?? []
  const current = list.find((x) => x.folderId === folderId) ?? null

  const save = async () => {
    if (!naming) return
    const name = naming.value.trim()
    if (!name) return setNaming(null)
    setError(null)
    try {
      if (live) {
        if (naming.id === null) {
          const created = await createFolder(name, key ?? null, folderId)
          setFolderId(created.folderId)
        } else {
          await renameFolder(naming.id, name)
        }
        folders.reload()
      }
      setNaming(null)
    } catch (e) {
      setError(errorText(e, '폴더를 저장하지 못했어요.'))
    }
  }

  const remove = async (folder: FolderRow) => {
    setError(null)
    try {
      if (live) {
        const r = await deleteFolder(folder.folderId)
        setFolderId(r.parentId)
        folders.reload()
        docs.reload()
      }
    } catch (e) {
      setError(errorText(e, '폴더를 지우지 못했어요.'))
    }
  }

  return (
    <Columns
      sideWidth={300}
      main={
        <Card className={s.card}>
          <div className={s.head}>
            <h2>
              {current ? (
                <>
                  <FolderOpen size={18} /> {current.path}
                </>
              ) : (
                '모든 자료'
              )}
            </h2>
            {current?.editable && (
              <div className={s.headActions}>
                <Button variant="ghost" icon={Pencil} aria-label="폴더 이름 바꾸기" onClick={() => setNaming({ id: current.folderId, value: current.name })} />
                <Button variant="ghost" icon={Trash2} aria-label="폴더 지우기 (자료는 위 폴더로 옮겨져요)" onClick={() => void remove(current)} />
              </div>
            )}
          </div>
          {error && <p className={s.error}>{error}</p>}
          <Loadable resource={docs} label="프로젝트 자료">
            {(rows) =>
              rows.length === 0 ? (
                <Empty>{current ? '이 폴더에 자료가 없어요.' : '이 프로젝트에 연결한 자료가 없어요. 머리의 "자료 올리기"로 올려 보세요.'}</Empty>
              ) : (
                <ul className={s.list}>
                  {rows.map((d) => (
                    <li key={d.documentId} className={s.row}>
                      <span className={s.ext}>{d.fileType ? d.fileType.toUpperCase() : '글'}</span>
                      <div className={s.main}>
                        <Link to={`/library/${d.documentId}`} className={s.title}>
                          {d.title}
                        </Link>
                        <span className={s.meta}>
                          {d.category}
                          {d.folderPath && !current && ` · ${d.folderPath}`}
                          {d.tags.map((t) => ` #${t}`).join('')}
                        </span>
                      </div>
                      {d.visibility !== 'LAB' && (
                        <Chip tone={d.visibility === 'PRIVATE' ? 'muted' : 'warning'} icon={Lock}>
                          {VISIBILITY_LABEL[d.visibility]}
                        </Chip>
                      )}
                      <span className={s.who}>
                        <strong>{d.author}</strong>
                        <small>{d.ago}</small>
                      </span>
                      <span className={s.comments}>
                        <MessageCircle size={14} />
                        {d.commentCount}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }
          </Loadable>
        </Card>
      }
      side={
        <Card>
          <SectionHead icon={Folder} title="폴더" />
          <ul className={s.folders}>
            <li>
              <button type="button" className={folderId === null ? `${s.folder} ${s.folderOn}` : s.folder} onClick={() => setFolderId(null)}>
                <Folder size={16} /> 모든 자료
              </button>
            </li>
            {list.map((x) => (
              <li key={x.folderId}>
                <button
                  type="button"
                  className={folderId === x.folderId ? `${s.folder} ${s.folderOn}` : s.folder}
                  style={{ paddingLeft: 12 + depth(x.path) * 16 }}
                  onClick={() => setFolderId(x.folderId)}
                >
                  {folderId === x.folderId ? <FolderOpen size={16} /> : <Folder size={16} />}
                  <span className={s.folderName}>{x.name}</span>
                  <small>{x.documentCount}</small>
                </button>
              </li>
            ))}
          </ul>
          {naming ? (
            <div className={s.naming}>
              <input
                autoFocus
                value={naming.value}
                maxLength={50}
                placeholder={naming.id === null ? (current ? `${current.name} 안에 만들 폴더` : '새 폴더 이름') : '바꿀 이름'}
                onChange={(e) => setNaming({ ...naming, value: e.target.value.replace(/\//g, '') })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save()
                  if (e.key === 'Escape') setNaming(null)
                }}
              />
              <Button variant="ghost" icon={Check} aria-label="저장" onClick={() => void save()} />
              <Button variant="ghost" icon={X} aria-label="그만두기" onClick={() => setNaming(null)} />
            </div>
          ) : (
            (folders.data?.canCreate ?? true) && (
              <Button variant="secondary" icon={FolderPlus} onClick={() => setNaming({ id: null, value: '' })}>
                {current ? '이 폴더 안에 새 폴더' : '새 폴더'}
              </Button>
            )
          )}
          <p className={s.note}>폴더를 지우면 안의 자료와 하위 폴더는 위 폴더로 옮겨져요. 자료는 지우지 않아요.</p>
        </Card>
      }
    />
  )
}
