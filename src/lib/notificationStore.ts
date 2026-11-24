// 헤더 종 · 알림 화면이 같은 "읽음" 상태를 보도록 아주 작은 공용 저장소
// 실서버 모드: 알림 목록(NT-1)의 첫 페이지를 불러 두고, 안 읽은 수(NT-2)를 1분마다 확인해 바뀌면 첫 페이지를 다시 부른다.
// 알림 화면은 목록 끝에 닿으면 loadMore 로 다음 페이지를 이어 붙인다 (정책 ERP-P32).
import { useSyncExternalStore } from 'react'
import { getDataMode } from './dataMode'
import { ApiError } from '../api/client'
import { whenLive } from '../api/useResource'
import { fetchNotificationPage, fetchUnreadCount, mockNotiItems, postNotificationsRead, type NotiItem } from '../api/communication'
import { appendUnique } from '../api/useLoadMore'

export type NotificationState = {
  items: NotiItem[]
  /** 안 읽은 수 (실서버는 서버 숫자 — 불러온 목록 밖의 알림도 센다) */
  unreadCount: number
  loading: boolean
  error: string | null
  /** 읽음 처리 실패 같은 짧은 안내 */
  actionError: string | null
  /** 어디까지 받았는지 (무한 스크롤) */
  page: number
  hasNext: boolean
  loadingMore: boolean
  moreError: string | null
}

const POLL_MS = 60_000
const isLive = () => getDataMode() === 'live'
const countUnread = (items: NotiItem[]) => items.filter((n) => !n.read).length

const NO_MORE = { page: 0, hasNext: false, loadingMore: false, moreError: null }

const initial = (live: boolean): NotificationState =>
  live
    ? { items: [], unreadCount: 0, loading: true, error: null, actionError: null, ...NO_MORE }
    : { items: mockNotiItems, unreadCount: countUnread(mockNotiItems), loading: false, error: null, actionError: null, ...NO_MORE }
let stateLive = isLive()
let state: NotificationState = initial(stateLive)
const listeners = new Set<() => void>()
const set = (patch: Partial<NotificationState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : '알림을 불러오지 못했어요.')

let loadSeq = 0
async function load() {
  if (!isLive()) return
  const seq = ++loadSeq
  set({ loading: state.items.length === 0, error: null })
  try {
    const [first, unreadCount] = await Promise.all([fetchNotificationPage(0), fetchUnreadCount()])
    if (seq !== loadSeq) return
    // 이미 다음 페이지까지 내려가 있었으면 목록을 접지 않는다: 새 첫 페이지를 앞에 두고, 그 뒤에 받아 둔 것을 잇는다
    const fresh = new Set(first.items.map((n) => n.id))
    const keepOlder = state.page > 0
    set({
      items: keepOlder ? [...first.items, ...state.items.filter((n) => !fresh.has(n.id))] : first.items,
      page: keepOlder ? state.page : first.page,
      hasNext: keepOlder ? state.hasNext : first.hasNext,
      unreadCount,
      loading: false,
      error: null,
    })
  } catch (e) {
    if (seq === loadSeq) set({ loading: false, error: errMsg(e) })
  }
}

/** 다음 페이지를 이어 붙인다 (알림 화면의 목록 끝) */
async function loadMore() {
  if (!isLive() || !state.hasNext || state.loadingMore) return
  const from = state.page
  set({ loadingMore: true, moreError: null })
  try {
    const next = await fetchNotificationPage(from + 1)
    // 받는 사이에 목록이 바뀌었으면(모드 바꿈 등) 붙이지 않는다
    if (state.page !== from) return set({ loadingMore: false })
    set({ items: appendUnique(state.items, next.items, (n) => n.id), page: next.page, hasNext: next.hasNext, loadingMore: false })
  } catch (e) {
    set({ loadingMore: false, moreError: errMsg(e) })
  }
}

async function poll() {
  try {
    const count = await fetchUnreadCount()
    // 숫자가 바뀌었으면 새 알림이 왔거나 다른 곳에서 읽었으므로 목록도 다시 부른다
    if (count !== state.unreadCount) await load()
  } catch {
    /* 한 번 놓쳐도 다음 주기에 다시 부른다 */
  }
}

let users = 0
let timer: number | undefined

export const notificationStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  get: () => state,
  /** 다시 불러오기 (오류 후 "다시 시도") */
  reload: () => void load(),
  /** 목록 끝에 닿았을 때: 다음 페이지 */
  loadMore: () => void loadMore(),
  /**
   * 실서버 모드에서 불러오기 · 1분 주기 확인을 시작한다. 돌려준 함수로 멈춘다.
   * 여러 곳에서 불러도 주기는 하나만 돈다.
   */
  start() {
    // 시작 화면에서 목업 ↔ 실서버를 바꾸면 새로 고침 없이 들어오므로 여기서 맞춘다
    if (stateLive !== isLive()) {
      stateLive = isLive()
      set(initial(stateLive))
    }
    if (!stateLive) return () => undefined
    users += 1
    if (users === 1) {
      void load()
      timer = window.setInterval(() => void poll(), POLL_MS)
    }
    return () => {
      users -= 1
      if (users === 0) window.clearInterval(timer)
    }
  },
  markRead(id: number) {
    const target = state.items.find((n) => n.id === id)
    if (!target || target.read) return
    set({ items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)), unreadCount: Math.max(0, state.unreadCount - 1), actionError: null })
    whenLive(() => postNotificationsRead([id]))
      .then((r) => r && set({ unreadCount: r.unreadCount }))
      .catch((e) => {
        set({ actionError: `읽음 처리하지 못했어요. ${errMsg(e)}` })
        void load()
      })
  },
  markAllRead() {
    const before = state
    set({ items: state.items.map((n) => ({ ...n, read: true })), unreadCount: 0, actionError: null })
    whenLive(() => postNotificationsRead())
      .then((r) => r && set({ unreadCount: r.unreadCount }))
      .catch((e) => set({ items: before.items, unreadCount: before.unreadCount, actionError: `모두 읽음 처리하지 못했어요. ${errMsg(e)}` }))
  },
}

export function useNotifications() {
  return useSyncExternalStore(notificationStore.subscribe, notificationStore.get)
}
