import { ListFilter } from 'lucide-react'
import { FilterSelect } from '../../../components/ui'
import type { LibraryData, LibrarySort } from '../../../api/content'
import s from '../LibraryPage.module.css'

const SORTS: readonly LibrarySort[] = ['최신순', '댓글 많은 순', '제목순']

/** 거르기 칸 값 · 바꾸기 */
export type LibraryFilterState = {
  tag: string
  setTag: (v: string) => void
  project: string
  setProject: (v: string) => void
  author: string
  setAuthor: (v: string) => void
  fileType: string
  setFileType: (v: string) => void
  sort: LibrarySort
  setSort: (v: LibrarySort) => void
}

type Props = { f: LibraryFilterState; options: LibraryData['options'] }

/** 태그 · 프로젝트 · 작성자 · 파일 형식 거르기 · 정렬 바꾸기 */
export function LibraryFilters({ f, options }: Props) {
  const { tags: allTags, projects: allProjects, authors: allAuthors, types: allTypes } = options
  return (
    <div className={s.filters}>
      <FilterSelect label="태그" value={f.tag} options={allTags} onChange={f.setTag} />
      <FilterSelect label="프로젝트" value={f.project} options={allProjects} onChange={f.setProject} />
      <FilterSelect label="작성자" value={f.author} options={allAuthors} onChange={f.setAuthor} />
      <FilterSelect label="파일 형식" value={f.fileType} options={allTypes} onChange={f.setFileType} />
      <button
        type="button"
        className={s.sort}
        onClick={() => f.setSort(SORTS[(SORTS.indexOf(f.sort) + 1) % SORTS.length])}
      >
        <ListFilter size={16} />
        {f.sort}
      </button>
    </div>
  )
}
