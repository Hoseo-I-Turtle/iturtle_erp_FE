import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  ListFilter,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pin,
  Plus,
  Search,
  SquareCheck,
  TriangleAlert,
} from 'lucide-react'
import { Button, Card, Chip, Columns, Empty, ListItem, Loadable, Note, Progress, SectionHead, Segmented } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { useNoticeList, type NoticeListData, type NoticeTab } from '../../api/notices'
import type { NoticeListItem } from '../../mocks/noticeList'
import { NoticeWriteModal } from './NoticeWriteModal'
import s from './NoticeListPage.module.css'

const EMPTY: NoticeListData = {
  items: [],
  counts: { ALL: 0, MUST_READ: 0, POLL: 0, UNREAD: 0 },
  totalPages: 1,
  openPolls: [],
  unreadMustRead: [],
  pendingPolls: [],
  canWrite: false,
}
const TAB_LABEL: Record<NoticeTab, string> = { ALL: '전체', MUST_READ: '필독', POLL: '투표', UNREAD: '안 읽음' }

export function NoticeListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<NoticeTab>('ALL')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [oldestFirst, setOldestFirst] = useState(false)
  const [writing, setWriting] = useState(false)

  const list = useNoticeList({ tab, keyword, page })
  const { items, counts, totalPages, openPolls, unreadMustRead, pendingPolls, canWrite } = list.data ?? EMPTY

  // 고정 공지는 첫 쪽 맨 위에 따로 묶는다. 나머지는 최신 순(서버 순서) 또는 뒤집어서
  const pinned = page === 0 ? items.filter((n) => n.pinnedUntil) : []
  const rest = items.filter((n) => !pinned.includes(n))
  const others = oldestFirst ? [...rest].reverse() : rest

  const change = (t: NoticeTab) => {
    setTab(t)
    setPage(0)
  }

  return (
    <>
      <PageHeader
        title="공지사항"
        subtitle="연구실 공지와 투표"
        action={
          canWrite ? (
            <Button icon={Plus} onClick={() => setWriting(true)}>
              공지 쓰기
            </Button>
          ) : null
        }
      />
      <Columns
        main={
          <Card className={s.list}>
            <div className={s.toolbar}>
              <Segmented
                value={tab}
                onChange={change}
                options={(Object.keys(TAB_LABEL) as NoticeTab[]).map((t) => ({ value: t, label: `${TAB_LABEL[t]} ${counts[t]}` }))}
              />
              <label className={s.search}>
                <Search size={16} />
                <input
                  type="search"
                  placeholder="제목 · 작성자 검색"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value)
                    setPage(0)
                  }}
                />
              </label>
              <button type="button" className={s.sort} onClick={() => setOldestFirst(!oldestFirst)}>
                <ListFilter size={16} />
                {oldestFirst ? '오래된 순' : '최신순'}
              </button>
            </div>
            <Loadable resource={list} label="공지 목록">
              {() =>
                items.length === 0 ? (
                  <Empty>{keyword ? '찾는 공지가 없어요.' : '아직 공지가 없어요.'}</Empty>
                ) : (
                  <>
                    {pinned.length > 0 && (
                      <>
                        <p className={s.label}>상단 고정 {pinned.length}</p>
                        {pinned.map((n) => (
                          <NoticeRow key={n.id} n={n} />
                        ))}
                        {others.length > 0 && <p className={s.label}>전체 공지</p>}
                      </>
                    )}
                    {others.map((n) => (
                      <NoticeRow key={n.id} n={n} />
                    ))}
                  </>
                )
              }
            </Loadable>
            {totalPages > 1 && (
              <nav className={s.pager} aria-label="쪽 이동">
                <button type="button" aria-label="앞 쪽" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} type="button" className={i === page ? s.pageOn : undefined} aria-current={i === page} onClick={() => setPage(i)}>
                    {i + 1}
                  </button>
                ))}
                <button type="button" aria-label="다음 쪽" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </Card>
        }
        side={
          <>
            <Card>
              <SectionHead icon={TriangleAlert} title="나에게 남은 것" />
              <ListItem
                leading={<Megaphone size={18} />}
                to={unreadMustRead[0] ? `/notices/${unreadMustRead[0].id}` : undefined}
                title={`안 읽은 필독 ${unreadMustRead.length}`}
                meta={unreadMustRead[0]?.title ?? '필독 공지를 모두 읽었어요'}
              />
              <ListItem
                leading={<SquareCheck size={18} />}
                to={pendingPolls[0] ? `/notices/${pendingPolls[0].id}` : undefined}
                title={`응답 안 한 투표 ${pendingPolls.length}`}
                meta={pendingPolls[0]?.title ?? '진행 중인 투표에 모두 응답했어요'}
              />
            </Card>
            <Card>
              <SectionHead icon={SquareCheck} title="진행 중인 투표" />
              {openPolls.length === 0 && <Empty>진행 중인 투표가 없어요.</Empty>}
              {openPolls.map((p) => (
                <Link key={p.id} to={`/notices/${p.id}`} className={s.poll}>
                  <strong>{p.title}</strong>
                  <span className={s.pollProgress}>
                    <Progress value={p.audienceCount ? (p.participantCount / p.audienceCount) * 100 : 0} />
                    <b>
                      {p.participantCount} / {p.audienceCount}명
                    </b>
                  </span>
                  <span className={s.pollMeta}>
                    <Chip tone="warning" icon={Clock}>
                      마감 {p.dday}
                    </Chip>
                    {p.note}
                  </span>
                </Link>
              ))}
            </Card>
            <Note icon={Info}>필독 공지는 끝까지 읽으면 자동으로 확인돼요. 공지 쓰기는 notice-write 역할이 있으면 보여요.</Note>
          </>
        }
      />
      {writing && (
        <NoticeWriteModal
          onClose={() => setWriting(false)}
          onCreated={(id) => {
            setWriting(false)
            if (id !== null) navigate(`/notices/${id}`)
            else list.reload()
          }}
        />
      )}
    </>
  )
}

function NoticeRow({ n }: { n: NoticeListItem }) {
  const meta = [
    n.author,
    n.date,
    n.pinnedUntil && !n.poll && `고정 ${n.pinnedUntil}까지`,
    n.poll?.note,
    n.attachmentCount > 0 && `첨부 ${n.attachmentCount}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/notices/${n.id}`} className={n.read ? s.notice : `${s.notice} ${s.unread}`}>
      {n.pinnedUntil ? <Pin size={18} /> : <Megaphone size={18} />}
      {(n.mustRead || n.poll) && (
        <span className={s.chips}>
          {n.mustRead && (
            <Chip tone="danger" icon={TriangleAlert}>
              필독
            </Chip>
          )}
          {n.poll && (n.poll.closed ? <Chip tone="gray">투표 마감</Chip> : <Chip icon={SquareCheck}>투표</Chip>)}
        </span>
      )}
      <span className={s.text}>
        <strong>{n.title}</strong>
        <small>{meta}</small>
      </span>
      {n.attachmentCount > 0 && <Paperclip size={16} className={s.clip} />}
      <span className={s.comments}>
        <MessageCircle size={14} />
        {n.commentCount}
      </span>
      {!n.read ? (
        <Chip tone="warning">안 읽음</Chip>
      ) : n.poll && !n.poll.closed && n.poll.voted ? (
        <Chip tone="positive" icon={Check}>
          투표 함
        </Chip>
      ) : (
        <Chip tone="positive" icon={Check}>
          읽음
        </Chip>
      )}
    </Link>
  )
}
