import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleHelp, Download, FileText, ListFilter, Lock, MessageCircle, Pin, Plus } from 'lucide-react'
import { Button, Card, Chip, Columns, Empty, FilterSelect, ListItem, Loadable, Note, PillTabs, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { CATEGORY_NAME, type DocumentCategory, type DocumentSummary } from '../../mocks/documents'
import { useLibrary, type LibraryData, type LibrarySort } from '../../api/content'
import { DocumentUploadModal } from './DocumentUploadModal'
import s from './LibraryPage.module.css'

type Tab = 'ALL' | DocumentCategory
const SORTS: readonly LibrarySort[] = ['최신순', '댓글 많은 순', '제목순']
const EMPTY: LibraryData = {
  documents: [],
  categoryCounts: { PAPER: 0, SLIDE: 0, DEV_DOC: 0, DATA: 0, FORM: 0, QNA: 0, FREE: 0 },
  pinnedDocs: [],
  unresolved: [],
  popularTags: [],
  options: { tags: [], projects: [], authors: [], types: [] },
}

const EXT_COLOR: Record<string, string> = {
  pdf: 'var(--status-negative)',
  pptx: 'var(--status-warning-text)',
  docx: 'var(--text-secondary)',
  md: 'var(--accent)',
  zip: 'var(--text-muted)',
}
const EXT_LABEL: Record<string, string> = { pptx: 'PPT', docx: 'DOC' }

export function LibraryPage() {
  const [tab, setTab] = useState<Tab>('ALL')
  const [tag, setTag] = useState('')
  const [project, setProject] = useState('')
  const [author, setAuthor] = useState('')
  const [fileType, setFileType] = useState('')
  const [sort, setSort] = useState<LibrarySort>('최신순')
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  // 거르기 · 정렬은 서버가 하고(실서버), 화면도 같은 조건으로 한 번 더 거른다(목업 · 고정 자료)
  const lib = useLibrary({ category: tab, tag, project, author, fileType, sort })
  // 다시 불러오는 동안에도 앞의 값으로 탭 · 거르기 칸을 그려 둔다
  const { documents, categoryCounts, pinnedDocs, unresolved, popularTags, options } = lib.data ?? EMPTY

  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
  const tabs = [
    { value: 'ALL' as Tab, label: '전체', count: total },
    ...(Object.keys(CATEGORY_NAME) as DocumentCategory[]).map((c) => ({
      value: c as Tab,
      label: CATEGORY_NAME[c],
      count: categoryCounts[c],
    })),
  ]

  const { tags: allTags, projects: allProjects, authors: allAuthors, types: allTypes } = options

  const list = useMemo(() => {
    const filtered = documents.filter(
      (d) =>
        (tab === 'ALL' || d.categoryCode === tab) &&
        (!tag || d.tags.includes(tag)) &&
        (!project || d.project?.name === project) &&
        (!author || d.author === author) &&
        (!fileType || d.fileTypes.includes(fileType)),
    )
    const sorted = [...filtered].sort((a, b) =>
      sort === '최신순'
        ? a.ageMinutes - b.ageMinutes
        : sort === '댓글 많은 순'
          ? b.commentCount - a.commentCount
          : a.title.localeCompare(b.title),
    )
    // 고정 자료는 맨 위
    return sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned))
  }, [documents, tab, tag, project, author, fileType, sort])

  return (
    <>
      <PageHeader
        title="자료실"
        subtitle="논문 · 발표자료 · 문서 · 질문을 카테고리로"
        action={
          <Button icon={Plus} onClick={() => setUploading(true)}>
            자료 올리기
          </Button>
        }
      />
      <Columns
        sideWidth={320}
        main={
          <Card className={s.docs}>
            <PillTabs value={tab} options={tabs} onChange={setTab} />
            <div className={s.filters}>
              <FilterSelect label="태그" value={tag} options={allTags} onChange={setTag} />
              <FilterSelect label="프로젝트" value={project} options={allProjects} onChange={setProject} />
              <FilterSelect label="작성자" value={author} options={allAuthors} onChange={setAuthor} />
              <FilterSelect label="파일 형식" value={fileType} options={allTypes} onChange={setFileType} />
              <button
                type="button"
                className={s.sort}
                onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}
              >
                <ListFilter size={16} />
                {sort}
              </button>
            </div>
            <Loadable resource={lib} label="자료 목록">
              {() =>
                list.length === 0 ? (
                  <Empty>조건에 맞는 자료가 없어요.</Empty>
                ) : (
                  <ul className={s.list}>
                    {list.map((d) => (
                      <DocRow key={d.documentId} d={d} onTag={setTag} />
                    ))}
                  </ul>
                )
              }
            </Loadable>
          </Card>
        }
        side={
          <>
            <Card>
              <SectionHead icon={Pin} title="고정 자료" />
              {pinnedDocs.map((d) => (
                <ListItem
                  key={d.documentId}
                  to={`/library/${d.documentId}`}
                  leading={<FileText size={18} />}
                  title={d.title}
                  meta={d.meta}
                />
              ))}
            </Card>
            <Card>
              <SectionHead icon={CircleHelp} title="해결 안 된 질문" link={{ to: '/library', label: '질문 · 도움' }} />
              {unresolved.map((d) => (
                <ListItem
                  key={d.documentId}
                  plain
                  to={`/library/${d.documentId}`}
                  title={d.title}
                  meta={`${d.author} · ${d.ago} · 댓글 ${d.commentCount}`}
                />
              ))}
            </Card>
            <Card>
              <SectionHead title="많이 쓰는 태그" />
              <div className={s.tags}>
                {popularTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={tag === t ? `${s.tag} ${s.tagOn}` : s.tag}
                    onClick={() => setTag(tag === t ? '' : t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </Card>
            <Note icon={Lock}>"참여자만" 자료는 그 프로젝트 참여자에게만 보여요.</Note>
            {/* 지운 자료는 content-manage 만 볼 수 있다 (없으면 서버가 403) */}
            <Link to="/library/deleted" className={s.deletedLink}>
              지운 자료 보기 (30일 안에 되살리기)
            </Link>
          </>
        }
      />
      {uploading && (
        <DocumentUploadModal
          onClose={() => setUploading(false)}
          onCreated={(id) => {
            setUploading(false)
            navigate(`/library/${id}`)
          }}
        />
      )}
    </>
  )
}

function DocRow({ d, onTag }: { d: DocumentSummary; onTag: (t: string) => void }) {
  const ext = d.fileTypes[0]
  return (
    <li className={s.doc}>
      <span className={s.ft} style={{ color: ext ? EXT_COLOR[ext] : 'var(--text-secondary)' }}>
        {ext ? (EXT_LABEL[ext] ?? ext.toUpperCase()) : '?'}
      </span>
      <div className={s.docMain}>
        <div className={s.docTitle}>
          {d.pinned && <Pin size={14} />}
          <Link to={`/library/${d.documentId}`}>{d.title}</Link>
          {d.latestVersion > 1 && <span className={s.ver}>v{d.latestVersion}</span>}
        </div>
        <div className={s.docSub}>
          <span className={s.cat}>{CATEGORY_NAME[d.categoryCode]}</span>
          {d.tags.map((t) => (
            <button key={t} type="button" className={s.hash} onClick={() => onTag(t)}>
              #{t}
            </button>
          ))}
          {d.project && <span className={s.proj}>· {d.project.name}</span>}
        </div>
      </div>
      {d.visibility === 'PROJECT_MEMBERS' && (
        <Chip tone="warning" icon={Lock}>
          참여자만
        </Chip>
      )}
      <div className={s.who}>
        <strong>{d.author}</strong>
        <span>{d.ago}</span>
      </div>
      <span className={s.comments}>
        <MessageCircle size={14} />
        {d.commentCount}
      </span>
      {/* 명세 확인 필요: 목록(DocumentSummary)에 파일 publicId 가 없어 바로 내려받을 수 없다. 상세(D-3)에서 받는다 */}
      <button type="button" className={s.dl} aria-label="내려받기">
        <Download size={18} />
      </button>
    </li>
  )
}
