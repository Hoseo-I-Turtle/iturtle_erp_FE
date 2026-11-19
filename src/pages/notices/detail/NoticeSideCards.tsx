import { Link } from 'react-router-dom'
import { Eye, Info, Megaphone } from 'lucide-react'
import { Avatar, Card, KeyValue, Loadable, Progress, SectionHead } from '../../../components/ui'
import type { Resource } from '../../../api/useResource'
import type { NoticeView, OtherNotice } from '../../../api/communication'
import s from '../NoticeDetailPage.module.css'

type ReadSummary = NonNullable<NoticeView['read']>

/** 읽음 확인: 비율 막대 · 안 읽은 사람 (명단은 작성자 · content-manage 에게만 온다) */
export function ReadCheckCard({ read }: { read: ReadSummary }) {
  const readPct = read.total ? Math.round((read.readCount / read.total) * 100) : 0
  return (
    <Card className={s.sideCard}>
      <SectionHead icon={Eye} title="읽음 확인" />
      {read.unread && <span className={s.privateChip}>작성자에게만 보여요</span>}
      <Progress value={readPct} color="var(--status-positive)" track="var(--status-negative-bg)" />
      <div className={s.readNums}>
        <span className={s.readYes}>읽음 {read.readCount}명</span>
        <span className={s.readNo}>안 읽음 {read.total - read.readCount}명</span>
      </div>
      {/* 명단은 작성자 · content-manage 에게만 온다 */}
      {read.unread && (
        <>
          <div className={s.overline}>안 읽은 사람</div>
          <ul className={s.people}>
            {read.unread.map((p) => (
              <li key={p.name}>
                <Avatar name={p.name} size={28} />
                <span className={s.personName}>{p.name}</span>
                <span className={s.personRole}>{p.role}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** 공지 정보 (게시 · 대상 · 기한 등) */
export function NoticeInfoCard({ info }: { info: NoticeView['info'] }) {
  return (
    <Card>
      <SectionHead icon={Info} title="공지 정보" />
      <KeyValue items={info} />
    </Card>
  )
}

/** 다른 공지 몇 개 */
export function OtherNoticesCard({ others }: { others: Resource<OtherNotice[]> }) {
  return (
    <Card>
      <SectionHead icon={Megaphone} title="다른 공지" link={{ to: '/notices', label: '전체' }} />
      <Loadable resource={others} label="다른 공지">
        {(list) => (
          <ul className={s.others}>
            {list.map((n) => (
              <li key={n.id}>
                <Link to={`/notices/${n.id}`}>
                  <div className={s.otherTitle}>{n.title}</div>
                  <div className={s.otherMeta}>{n.meta}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Loadable>
    </Card>
  )
}
