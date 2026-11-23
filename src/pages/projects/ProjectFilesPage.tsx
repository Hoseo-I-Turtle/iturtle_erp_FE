import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronDown, Lock, MessageCircle, Pin, Search, Users } from 'lucide-react'
import { Card, Chip, Columns, Empty, FilterSelect, Loadable, Note, SectionHead } from '../../components/ui'
import { useProjectDocuments, type ProjectDocuments } from '../../api/documents'
import { CATEGORY_NAME, type DocumentCategory, type DocumentSummary } from '../../mocks/documents'
import s from './ProjectFilesPage.module.css'

const EMPTY: ProjectDocuments = { documents: [], total: 0, labCount: 0, privateCount: 0, tags: [] }
const PAGE = 7

/** 프로젝트 자료 (Penpot 06 · 프로젝트 자료) — D-1 projectKey */
export function ProjectFilesPage() {
  const { key } = useParams()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<'ALL' | DocumentCategory>('ALL')
  const [fileType, setFileType] = useState('')
  const [tag, setTag] = useState('')
  const [shown, setShown] = useState(PAGE)
  const res = useProjectDocuments(key, keyword)
  const data = res.data ?? EMPTY

  const cats = (Object.keys(CATEGORY_NAME) as DocumentCategory[])
    .map((c) => ({ c, n: data.documents.filter((d) => d.categoryCode === c).length }))
    .filter((x) => x.n > 0)
  const types = [...new Set(data.documents.flatMap((d) => d.fileTypes))].sort()
  const list = data.documents
    .filter((d) => (category === 'ALL' || d.categoryCode === category) && (!fileType || d.fileTypes.includes(fileType)) && (!tag || d.tags.includes(tag)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))

  return (
    <Columns
      sideWidth={320}
      main={
        <Card className={s.card}>
          <div className={s.toolbar}>
            <label className={s.search}>
              <Search size={16} />
              <input type="search" placeholder="제목 · 내용 · 파일 이름 · 태그 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </label>
            <FilterSelect label="파일 형식" value={fileType} options={types} onChange={setFileType} />
            {tag && (
              <button type="button" className={s.tagOn} onClick={() => setTag('')}>
                #{tag} ✕
              </button>
            )}
            <span className={s.count}>{list.length}개</span>
          </div>
          <div className={s.cats}>
            <button type="button" className={category === 'ALL' ? s.catOn : undefined} onClick={() => setCategory('ALL')}>
              전체 {data.documents.length}
            </button>
            {cats.map(({ c, n }) => (
              <button key={c} type="button" className={category === c ? s.catOn : undefined} onClick={() => setCategory(c)}>
                {CATEGORY_NAME[c]} {n}
              </button>
            ))}
          </div>
          <Loadable resource={res} label="프로젝트 자료">
            {() =>
              list.length === 0 ? (
                <Empty>{data.documents.length === 0 ? '이 프로젝트에 연결한 자료가 아직 없어요.' : '조건에 맞는 자료가 없어요.'}</Empty>
              ) : (
                <>
                  {list.slice(0, shown).map((d) => (
                    <DocRow key={d.documentId} d={d} onTag={setTag} />
                  ))}
                  {list.length > shown && (
                    <button type="button" className={s.more} onClick={() => setShown(shown + PAGE)}>
                      {Math.min(PAGE, list.length - shown)}개 더 보기
                      <ChevronDown size={14} />
                    </button>
                  )}
                </>
              )
            }
          </Loadable>
        </Card>
      }
      side={
        <>
          <Card>
            <SectionHead title="누가 볼 수 있나요" />
            <div className={s.vis}>
              <Users size={16} />
              <span>
                <strong>연구실 전체 · {data.labCount}개</strong>
                <small>자료실에서도 보여요</small>
              </span>
            </div>
            <div className={s.vis}>
              <Lock size={16} />
              <span>
                <strong>참여자만 · {data.privateCount}개</strong>
                <small>이 프로젝트 참여자와 관리 역할만 봐요. 자료실 목록 · 검색에도 안 나와요</small>
              </span>
            </div>
          </Card>
          {data.tags.length > 0 && (
            <Card>
              <SectionHead title="많이 쓰는 태그" />
              <div className={s.tags}>
                {data.tags.map((t) => (
                  <button key={t.tag} type="button" className={tag === t.tag ? s.tagOn : undefined} onClick={() => setTag(tag === t.tag ? '' : t.tag)}>
                    #{t.tag} {t.count}
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Note icon={Check}>여기서 "자료 올리기"를 누르면 연결 프로젝트가 이 프로젝트로 채워져요.</Note>
        </>
      }
    />
  )
}

function DocRow({ d, onTag }: { d: DocumentSummary; onTag: (t: string) => void }) {
  const ext = d.fileTypes[0]
  return (
    <div className={s.doc}>
      <span className={s.ext}>{ext ? ext.toUpperCase() : '—'}</span>
      <span className={s.text}>
        <span className={s.title}>
          {d.pinned && <Pin size={14} />}
          <Link to={`/library/${d.documentId}`}>{d.title}</Link>
          {d.latestVersion > 1 && <em>v{d.latestVersion}</em>}
          {d.visibility === 'PROJECT_MEMBERS' && (
            <Chip tone="tint" icon={Lock}>
              참여자만
            </Chip>
          )}
          {d.resolved === true && (
            <Chip tone="positive" icon={Check}>
              해결
            </Chip>
          )}
          {d.resolved === false && <Chip tone="warning">해결 안 됨</Chip>}
        </span>
        <small>
          {CATEGORY_NAME[d.categoryCode] ?? d.categoryCode} · {d.author} · {d.ago}
          {d.tags.map((t) => (
            <button key={t} type="button" onClick={() => onTag(t)}>
              #{t}
            </button>
          ))}
        </small>
      </span>
      <span className={s.comments}>
        <MessageCircle size={14} />
        {d.commentCount}
      </span>
    </div>
  )
}
