import { CircleHelp, FileText, Pin } from 'lucide-react'
import { Card, ListItem, SectionHead } from '../../../components/ui'
import type { LibraryData } from '../../../api/content'
import s from '../LibraryPage.module.css'

/** 고정 자료 */
export function PinnedDocsCard({ pinnedDocs }: { pinnedDocs: LibraryData['pinnedDocs'] }) {
  return (
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
  )
}

/** 해결 안 된 질문 */
export function UnresolvedCard({ unresolved }: { unresolved: LibraryData['unresolved'] }) {
  return (
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
  )
}

/** 많이 쓰는 태그 (누르면 그 태그로 거르기, 다시 누르면 풀기) */
export function PopularTagsCard({ popularTags, tag, onTag }: { popularTags: string[]; tag: string; onTag: (t: string) => void }) {
  return (
    <Card>
      <SectionHead title="많이 쓰는 태그" />
      <div className={s.tags}>
        {popularTags.map((t) => (
          <button
            key={t}
            type="button"
            className={tag === t ? `${s.tag} ${s.tagOn}` : s.tag}
            onClick={() => onTag(tag === t ? '' : t)}
          >
            #{t}
          </button>
        ))}
      </div>
    </Card>
  )
}
