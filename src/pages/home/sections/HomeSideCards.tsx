import { Link } from 'react-router-dom'
import { Calendar, GitBranch, Image, LayoutGrid, Lock, Megaphone, Pin, Play, type LucideIcon } from 'lucide-react'
import { Card, Chip, Empty, Loadable, SectionHead } from '../../../components/ui'
import type { Resource } from '../../../api/useResource'
import type { NoticeSummary, Service, WeekEvent } from '../../../mocks/home'
import { ThemeObjects } from '../../../components/theme/ThemeObjects'
import s from '../HomePage.module.css'

const SERVICE_ICON: Record<Service['icon'], LucideIcon> = {
  penpot: Image,
  jenkins: Play,
  vault: Lock,
  github: GitBranch,
}

/** 이번 주 일정 */
export function WeekEventsCard({ weekEvents }: { weekEvents: Resource<WeekEvent[]> }) {
  return (
    <Card>
      <SectionHead icon={Calendar} title="이번 주 일정" link={{ to: '/calendar', label: '캘린더' }} />
      <Loadable resource={weekEvents} label="이번 주 일정">
        {(events) =>
          events.length === 0 ? (
            <Empty>일정 없음</Empty>
          ) : (
            <ul className={s.list}>
              {events.map((e) => (
                <li key={e.id} className={s.event}>
                  <span className={s.eventBar} style={{ background: e.color }} />
                  <div className={s.rowText}>
                    <div className={s.rowTitle}>{e.title}</div>
                    <div className={s.rowMeta}>{e.meta}</div>
                  </div>
                  <Chip tone="tint">{e.scope}</Chip>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
    </Card>
  )
}

/** 최근 공지 */
export function RecentNoticesCard({ recentNotices }: { recentNotices: Resource<NoticeSummary[]> }) {
  return (
    <Card className={s.decorHost}>
      <ThemeObjects slot="notices" />
      <SectionHead icon={Megaphone} title="최근 공지" link={{ to: '/notices', label: '전체' }} />
      <Loadable resource={recentNotices} label="최근 공지">
        {(notices) =>
          notices.length === 0 ? (
            <Empty>공지가 없어요.</Empty>
          ) : (
            <ul className={s.list}>
              {notices.map((n) => (
                <li key={n.id}>
                  <Link to={`/notices/${n.id}`} className={s.notice}>
                    {n.pinned && <Pin size={16} strokeWidth={2} className={s.noticePin} />}
                    <div className={s.rowText}>
                      <div className={s.rowTitle}>{n.title}</div>
                      <div className={s.rowMeta}>{n.meta}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
    </Card>
  )
}

/** 서비스 바로 가기 (권한 없으면 흐리게) */
export function ServiceLinksCard({ services }: { services: Resource<Service[]> }) {
  return (
    <Card>
      <SectionHead icon={LayoutGrid} title="서비스 바로 가기" />
      <Loadable resource={services} label="서비스 바로 가기">
        {(list) => (
          <div className={s.services}>
            {list.map((svc) => {
              const Icon = SERVICE_ICON[svc.icon]
              return (
                <a
                  key={svc.name}
                  href={svc.enabled ? svc.url ?? '#' : undefined}
                  aria-disabled={!svc.enabled}
                  className={svc.enabled ? s.service : `${s.service} ${s.serviceDisabled}`}
                >
                  <Icon size={22} strokeWidth={2} />
                  <span className={s.serviceName}>{svc.name}</span>
                  <span className={s.serviceDesc}>{svc.desc}</span>
                </a>
              )
            })}
          </div>
        )}
      </Loadable>
    </Card>
  )
}
