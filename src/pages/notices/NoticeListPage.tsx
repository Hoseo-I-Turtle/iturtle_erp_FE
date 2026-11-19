import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pin,
  Search,
  SquareCheck,
  TriangleAlert,
} from 'lucide-react'
import { Card, Chip, Empty, Loadable, PillTabs, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { useNoticeList, type NoticeListView, type NoticeRow, type NoticeTab } from '../../api/communication'
import { NoticeWriteButton } from './NoticeWriteModal'
import s from './NoticeListPage.module.css'

export function NoticeListPage() {
  const [tab, setTab] = useState<NoticeTab>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const list = useNoticeList(tab, keyword, page)

  const changeTab = (t: NoticeTab) => {
    setTab(t)
    setPage(0)
  }

  return (
    <>
      <PageHeader title="공지사항" subtitle="연구실 공지와 투표" action={<NoticeWriteButton onCreated={list.reload} />} />
      <div className={s.columns}>
        <Card className={s.listCard}>
          <div className={s.toolbar}>
            <PillTabs
              value={tab}
              onChange={changeTab}
              options={[
                { value: 'all', label: '전체', count: list.data?.counts.all },
                { value: 'mustRead', label: '필독', count: list.data?.counts.mustRead },
                { value: 'unread', label: '안 읽음', count: list.data?.counts.unread },
              ]}
            />
            <label className={s.search}>
              <Search size={16} />
              <input
                type="search"
                value={keyword}
                placeholder="제목 · 작성자 검색 (2자 이상)"
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(0)
                }}
              />
            </label>
          </div>
          <Loadable resource={list} label="공지">
            {(d) => <NoticeLists data={d} page={page} onPage={setPage} filtered={tab !== 'all' || keyword.trim().length >= 2} />}
          </Loadable>
        </Card>
        <div className={s.side}>{list.data && <SidePanel data={list.data} />}</div>
      </div>
    </>
  )
}

function NoticeLists({ data, page, onPage, filtered }: { data: NoticeListView; page: number; onPage: (p: number) => void; filtered: boolean }) {
  if (!data.pinned.length && !data.rows.length) return <Empty>{filtered ? '조건에 맞는 공지가 없어요.' : '아직 공지가 없어요.'}</Empty>
  return (
    <>
      {data.pinned.length > 0 && (
        <section className={s.group}>
          <h3 className={s.groupTitle}>
            상단 고정 <span>{data.pinned.length}</span>
          </h3>
          {data.pinned.map((n) => (
            <Row key={n.id} n={n} pinned />
          ))}
        </section>
      )}
      {data.rows.length > 0 && (
        <section className={s.group}>
          <h3 className={s.groupTitle}>전체 공지</h3>
          {data.rows.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </section>
      )}
      {data.totalPages > 1 && <Pager page={page} total={data.totalPages} onPage={onPage} />}
    </>
  )
}

function Row({ n, pinned }: { n: NoticeRow; pinned?: boolean }) {
  const meta = [
    n.author,
    n.date,
    pinned && n.pinnedUntil && `고정 ${n.pinnedUntil}까지`,
    n.attachmentCount > 0 && `첨부 ${n.attachmentCount}`,
    n.poll && !n.poll.closed && `투표 ${n.poll.dday}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/notices/${n.id}`} className={`${s.row} ${pinned ? s.rowPinned : ''}`}>
      {pinned ? <Pin size={18} className={s.pinIcon} /> : <Megaphone size={18} className={s.rowIcon} />}
      {n.mustRead && (
        <Chip tone="danger" icon={TriangleAlert}>
          필독
        </Chip>
      )}
      {n.poll &&
        (n.poll.closed ? (
          <span className={s.closedChip}>투표 마감</span>
        ) : (
          <Chip tone="tint" icon={SquareCheck}>
            투표
          </Chip>
        ))}
      <span className={s.rowText}>
        <span className={`${s.rowTitle} ${n.read ? '' : s.unreadTitle}`}>{n.title}</span>
        <span className={s.rowMeta}>{meta}</span>
      </span>
      <span className={s.rowEnd}>
        {n.attachmentCount > 0 && <Paperclip size={15} aria-label={`첨부 ${n.attachmentCount}개`} />}
        <span className={s.count}>
          <MessageCircle size={15} />
          {n.commentCount}
        </span>
        <ReadChip n={n} />
      </span>
    </Link>
  )
}

function ReadChip({ n }: { n: NoticeRow }) {
  if (!n.read) return <Chip tone="warning">안 읽음</Chip>
  if (n.poll && !n.poll.closed && n.poll.audience)
    return n.poll.voted ? (
      <span className={s.done}>
        <Check size={14} /> 투표 함
      </span>
    ) : (
      <Chip tone="warning">투표 전</Chip>
    )
  return (
    <span className={s.done}>
      <Check size={14} /> 읽음
    </span>
  )
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  // 지금 페이지 앞뒤로 2쪽씩
  const from = Math.max(0, Math.min(page - 2, total - 5))
  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => from + i)
  return (
    <nav className={s.pager} aria-label="페이지">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="이전 페이지">
        <ChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button key={p} type="button" className={p === page ? s.pageOn : ''} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}>
          {p + 1}
        </button>
      ))}
      <button type="button" disabled={page >= total - 1} onClick={() => onPage(page + 1)} aria-label="다음 페이지">
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

function SidePanel({ data }: { data: NoticeListView }) {
  const navigate = useNavigate()
  const { left } = data
  return (
    <>
      <Card className={s.sideCard}>
        <SectionHead icon={TriangleAlert} title="나에게 남은 것" />
        <button
          type="button"
          className={s.leftItem}
          disabled={!left.latestMustRead}
          onClick={() => left.latestMustRead && navigate(`/notices/${left.latestMustRead.id}`)}
        >
          <Megaphone size={18} className={left.unreadMustRead ? s.danger : s.muted} />
          <span>
            <strong>안 읽은 필독 {left.unreadMustRead}</strong>
            <small>{left.latestMustRead ? left.latestMustRead.title : '필독 공지를 모두 읽었어요'}</small>
          </span>
        </button>
        <div className={s.leftItem}>
          <SquareCheck size={18} className={left.pendingPolls ? s.brand : s.muted} />
          <span>
            <strong>응답 안 한 투표 {left.pendingPolls}</strong>
            <small>{left.pendingPolls ? '마감 전에 투표해 주세요' : '진행 중 투표에 모두 응답했어요'}</small>
          </span>
        </div>
      </Card>
      {data.openPolls.length > 0 && (
        <Card className={s.sideCard}>
          <SectionHead icon={SquareCheck} title="진행 중인 투표" />
          {data.openPolls.map((p) => (
            <Link key={p.id} to={`/notices/${p.id}`} className={s.poll}>
              <span className={s.pollTitle}>{p.title}</span>
              <span className={s.pollMeta}>
                <Chip tone="warning" icon={Clock}>
                  마감 {p.dday}
                </Chip>
                <span>{!p.audience ? '투표 대상 아님' : p.voted ? '투표했어요' : '아직 투표 안 했어요'}</span>
              </span>
            </Link>
          ))}
        </Card>
      )}
      <div className={s.note}>
        <Info size={18} />
        <span>필독 공지는 끝까지 읽으면 자동으로 확인돼요. 공지 쓰기는 notice-write 역할이 있으면 보여요.</span>
      </div>
    </>
  )
}
