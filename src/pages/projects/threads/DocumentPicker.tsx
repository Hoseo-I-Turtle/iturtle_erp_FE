import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button, Loadable, Modal } from '../../../components/ui'
import { useLinkableDocuments, type LinkableDocument } from '../../../api/content'
import s from './cards.module.css'

/** 서버와 같은 한도 (P139) */
export const MAX_THREAD_DOCUMENTS = 10

type Props = {
  projectKey: string
  /** 지금 고른 자료 (ID · 제목) */
  value: { documentId: number; title: string }[]
  onClose: () => void
  onSave: (picked: { documentId: number; title: string }[]) => void
  saving?: boolean
}

/**
 * 스레드에 걸 자료 고르기 (ERP-23): 이 프로젝트 자료(공용 · 참여자만)와 공용 자료. 나만 보기는 서버가 막아서(P140) 보여 주지 않는다.
 * 2자 이상 치면 제목 · 본문 · 태그로 찾는다.
 */
export function DocumentPicker({ projectKey, value, onClose, onSave, saving }: Props) {
  const [keyword, setKeyword] = useState('')
  const [picked, setPicked] = useState(value)
  const list = useLinkableDocuments(projectKey, keyword)
  const has = (id: number) => picked.some((p) => p.documentId === id)
  const toggle = (d: LinkableDocument) =>
    setPicked(has(d.documentId) ? picked.filter((p) => p.documentId !== d.documentId) : [...picked, { documentId: d.documentId, title: d.title }])
  const full = picked.length >= MAX_THREAD_DOCUMENTS

  return (
    <Modal
      title="자료 연결"
      width={640}
      onClose={onClose}
      footer={
        <>
          <span className={s.pickHint}>
            {picked.length} / {MAX_THREAD_DOCUMENTS} — 자료를 복사하지 않고 걸어요. 자료가 바뀌면 최신이 보여요.
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => onSave(picked)} disabled={saving}>
            연결
          </Button>
        </>
      }
    >
      <label className={s.pickSearch}>
        <Search size={16} />
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="자료 찾기 (2자 이상)" autoFocus />
      </label>
      <Loadable resource={list} label="자료">
        {(docs) =>
          docs.length === 0 ? (
            <p className={s.pickHint}>걸 수 있는 자료가 없어요 (공용 자료 · 이 프로젝트 자료만).</p>
          ) : (
            <ul className={s.pickList}>
              {docs.map((d) => (
                <li key={d.documentId}>
                  <label className={s.pickItem}>
                    <input type="checkbox" checked={has(d.documentId)} disabled={!has(d.documentId) && full} onChange={() => toggle(d)} />
                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        {d.categoryName} · {d.inProject ? '이 프로젝트' : '공용 자료실'} · {d.visibility === 'LAB' ? '공용' : '참여자만'} · {d.author}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
    </Modal>
  )
}
