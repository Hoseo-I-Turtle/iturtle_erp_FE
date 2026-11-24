import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Settings } from 'lucide-react'
import { Button, Card, Columns, Empty, Loadable, Note, Segmented } from '../../components/ui'
import { LoadMore } from '../../components/ui/LoadMore'
import { PageHeader } from '../../layouts/PageHeader'
import { getDataMode } from '../../lib/dataMode'
import { notificationStore, useNotifications } from '../../lib/notificationStore'
import { FILTER_MATCH, type Notification, type NotiFilter } from '../../mocks/notifications'
import type { NotiItem } from '../../api/communication'
import type { Resource } from '../../api/useResource'
import { NotificationIcon } from './NotificationIcon'
import s from './NotificationsPage.module.css'

/** 거르기: 목업 묶음 그대로. 실서버는 명세(NT-1 필터 표)처럼 주간 보고 알림도 "공지 · 일정"에 넣는다 */
function matches(filter: NotiFilter, n: NotiItem) {
  // FILTER_MATCH 는 type · read 만 보므로 day 모양이 달라도 그대로 쓸 수 있다
  if ((FILTER_MATCH[filter] as (x: Pick<Notification, 'type' | 'read'>) => boolean)(n)) return true
  return filter === 'NOTICE_CAL' && n.type === 'REPORT' && getDataMode() === 'live'
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const store = useNotifications()
  const all = store.items
  const [filter, setFilter] = useState<NotiFilter>('UNREAD')
  const list = all.filter((n) => matches(filter, n))
  // 공용 저장소를 Loadable 이 읽는 모양으로
  const resource: Resource<NotiItem[]> = {
    data: store.loading ? undefined : all,
    loading: store.loading,
    error: store.error,
    reload: notificationStore.reload,
    setData: () => undefined,
  }

  const open = (id: number, to: string) => {
    notificationStore.markRead(id)
    navigate(to)
  }

  return (
    <>
      <PageHeader title="알림" subtitle="사이트 안 알림 · 90일 동안 보관" action={null} />
      <Columns
        main={
          <Card className={s.card}>
            <div className={s.top}>
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: '전체' },
                  { value: 'UNREAD', label: `안 읽음 ${store.unreadCount}` },
                  { value: 'MENTION', label: '@멘션' },
                  { value: 'TASK', label: '작업' },
                  { value: 'NOTICE_CAL', label: '공지 · 일정' },
                  { value: 'ACCESS', label: '권한' },
                ]}
              />
              <Button variant="ghost" icon={Check} onClick={notificationStore.markAllRead} disabled={store.unreadCount === 0}>
                모두 읽음
              </Button>
            </div>
            {store.actionError && (
              <Note icon={Bell} tone="warning">
                {store.actionError}
              </Note>
            )}
            <Loadable resource={resource} label="알림">
              {() => (
                <>
                  <NotiList list={list} onOpen={open} more={store.hasNext} />
                  {/* 거르기는 받은 것 안에서 하므로, 끝에 닿으면 다음 페이지를 이어 받는다 */}
                  <LoadMore more={{ hasNext: store.hasNext, loadingMore: store.loadingMore, error: store.moreError, loadMore: notificationStore.loadMore }} />
                </>
              )}
            </Loadable>
          </Card>
        }
        side={
          <>
            <Card>
              <h2 className={s.sideTitle}>
                <Bell size={20} /> 헤더 알림 미리보기
              </h2>
              <p className={s.muted}>오른쪽 위 종 아이콘을 누르면 이렇게 보여요. 새로 고침 없이 1분 안에 숫자가 바뀌어요. 내가 한 일로는 알림을 받지 않아요.</p>
            </Card>
            <Note icon={Settings}>알림 종류별 받기 설정은 내 프로필에서 바꿀 수 있어요</Note>
          </>
        }
      />
    </>
  )
}

/** more: 아직 안 받은 알림이 더 있는지 (있으면 "없어요" 라고 하지 않는다) */
function NotiList({ list, onOpen, more }: { list: NotiItem[]; onOpen: (id: number, to: string) => void; more: boolean }) {
  // 같은 날 묶음 순서 (오늘 · 어제 · 그 전 날짜)
  const days = [...new Set(list.map((n) => n.day))]
  return (
    <>
      {list.length === 0 && !more && <Empty>알림이 없어요.</Empty>}
      {days.map((day) => {
        const items = list.filter((n) => n.day === day)
        return (
          <section key={day} className={s.day}>
            <h3>{day}</h3>
            {items.map((n) => (
              <button key={n.id} type="button" className={n.read ? s.item : `${s.item} ${s.unread}`} onClick={() => onOpen(n.id, n.to)}>
                <span className={s.icon}>
                  <NotificationIcon type={n.type} />
                </span>
                <span className={s.text}>
                  <strong>{n.title}</strong>
                  <small>{n.detail}</small>
                </span>
                {n.grouped && <span className={s.grouped}>{n.grouped}건</span>}
                <span className={s.ago}>{n.ago}</span>
                {!n.read && <i className={s.dot} aria-label="안 읽음" />}
              </button>
            ))}
          </section>
        )
      })}
    </>
  )
}
