import { useParams } from 'react-router-dom'
import { Ellipsis, Paperclip, Pencil, Pin, Plus, SquareCheck, TriangleAlert } from 'lucide-react'
import { Avatar, Breadcrumb, Button, Card, Chip, Columns, Loadable } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { useNoticeDetail, useOtherNotices, type NoticeView } from '../../api/communication'
import { NoticeComments } from './detail/NoticeComments'
import { NoticeInfoCard, OtherNoticesCard, ReadCheckCard } from './detail/NoticeSideCards'
import { VoteBox } from './detail/VoteBox'
import s from './NoticeDetailPage.module.css'

export function NoticeDetailPage() {
  const { id } = useParams()
  const notice = useNoticeDetail(id)

  return (
    <>
      <PageHeader title="공지사항" subtitle="연구실 공지와 투표" action={<Button icon={Plus}>공지 쓰기</Button>} />
      <Loadable resource={notice} label="공지">
        {(n) => <NoticeBody key={n.id} notice={n} />}
      </Loadable>
    </>
  )
}

function NoticeBody({ notice }: { notice: NoticeView }) {
  const others = useOtherNotices(notice.id)
  const read = notice.read

  return (
    <Columns
      main={
        <Card className={s.article}>
          <Breadcrumb items={[{ label: '공지사항', to: '/notices' }, { label: '상세' }]} />

          <div className={s.chips}>
            {notice.important && (
              <Chip tone="danger" icon={TriangleAlert}>
                필독
              </Chip>
            )}
            {notice.pinnedUntil && (
              <Chip tone="tint" icon={Pin}>
                상단 고정 · {notice.pinnedUntil}까지
              </Chip>
            )}
            {notice.vote && (
              <Chip tone="brand" icon={SquareCheck}>
                투표 포함
              </Chip>
            )}
          </div>

          <h2 className={s.title}>{notice.title}</h2>

          <div className={s.meta}>
            <Avatar name={notice.author} size={32} colorIndex={3} />
            <span className={s.author}>{notice.author}</span>
            <span className={s.metaText}>
              · {notice.createdAt}
              {notice.edited && ' · 수정됨'}
            </span>
            {notice.canEdit && (
              <span className={s.metaActions}>
                <Button variant="ghost" icon={Pencil} aria-label="수정" />
                <Button variant="ghost" icon={Ellipsis} aria-label="더 보기" />
              </span>
            )}
          </div>

          <p className={s.body}>{notice.body}</p>

          {notice.attachments.map((a) => (
            <a key={a.name} href={a.url} className={s.attachment}>
              <Paperclip size={16} />
              <span className={s.attName}>{a.name}</span>
              <span className={s.attSize}>{a.size}</span>
            </a>
          ))}

          {notice.vote && <VoteBox noticeId={notice.noticeId} vote={notice.vote} meName={notice.meName} />}

          <NoticeComments noticeId={notice.noticeId} id={notice.id} meName={notice.meName} />
        </Card>
      }
      side={
        <>
          {read && <ReadCheckCard read={read} />}
          <NoticeInfoCard info={notice.info} />
          <OtherNoticesCard others={others} />
        </>
      }
    />
  )
}
