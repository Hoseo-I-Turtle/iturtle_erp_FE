import { useMemo, useState } from 'react'
import { Lock, Plus } from 'lucide-react'
import { Button, Card, Columns, Empty, Loadable, Note, PillTabs } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { CATEGORY_NAME, type DocumentCategory } from '../../mocks/documents'
import { useLibrary, type LibraryData, type LibrarySort } from '../../api/content'
import { DocRow } from './list/DocRow'
import { LibraryFilters } from './list/LibraryFilters'
import { PinnedDocsCard, PopularTagsCard, UnresolvedCard } from './list/LibrarySideCards'
import s from './LibraryPage.module.css'

/** 'ALL' 또는 공통코드 DOCUMENT_CATEGORY 코드 (실서버는 기본 7개 밖의 코드도 온다) */
type Tab = string
const EMPTY: LibraryData = {
  documents: [],
  categories: (Object.keys(CATEGORY_NAME) as DocumentCategory[]).map((code) => ({ code, name: CATEGORY_NAME[code] })),
  categoryCounts: { PAPER: 0, SLIDE: 0, DEV_DOC: 0, DATA: 0, FORM: 0, QNA: 0, FREE: 0 },
  pinnedDocs: [],
  unresolved: [],
  popularTags: [],
  options: { tags: [], projects: [], authors: [], types: [] },
}

export function LibraryPage() {
  const [tab, setTab] = useState<Tab>('ALL')
  const [tag, setTag] = useState('')
  const [project, setProject] = useState('')
  const [author, setAuthor] = useState('')
  const [fileType, setFileType] = useState('')
  const [sort, setSort] = useState<LibrarySort>('최신순')

  // 거르기 · 정렬은 서버가 하고(실서버), 화면도 같은 조건으로 한 번 더 거른다(목업 · 고정 자료)
  const lib = useLibrary({ category: tab, tag, project, author, fileType, sort })
  // 다시 불러오는 동안에도 앞의 값으로 탭 · 거르기 칸을 그려 둔다
  const { documents, categories, categoryCounts, pinnedDocs, unresolved, popularTags, options } = lib.data ?? EMPTY

  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0)
  const tabs = [
    { value: 'ALL' as Tab, label: '전체', count: total },
    ...categories.map((c) => ({
      value: c.code as Tab,
      label: c.name,
      count: categoryCounts[c.code] ?? 0,
    })),
  ]

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
        action={<Button icon={Plus}>자료 올리기</Button>}
      />
      <Columns
        sideWidth={320}
        main={
          <Card className={s.docs}>
            <PillTabs value={tab} options={tabs} onChange={setTab} />
            <LibraryFilters
              f={{ tag, setTag, project, setProject, author, setAuthor, fileType, setFileType, sort, setSort }}
              options={options}
            />
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
            <PinnedDocsCard pinnedDocs={pinnedDocs} />
            <UnresolvedCard unresolved={unresolved} />
            <PopularTagsCard popularTags={popularTags} tag={tag} onTag={setTag} />
            <Note icon={Lock}>"참여자만" 자료는 그 프로젝트 참여자에게만 보여요.</Note>
          </>
        }
      />
    </>
  )
}
