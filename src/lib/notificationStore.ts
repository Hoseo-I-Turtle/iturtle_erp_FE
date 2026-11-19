// 헤더 종 · 알림 화면이 같은 "읽음" 상태를 보도록 아주 작은 공용 저장소
// 실서버 모드: 알림 목록(NT-1)을 불러 두고, 안 읽은 수(NT-2)를 1분마다 확인해 바뀌면 목록을 다시 부른다.
import { useSyncExternalStore } from 'react'
import { getDataMode } from './dataMode'
import { ApiError } from '../api/client'
import { whenLive } from '../api/useResource'
import { fetchNotifications, fetchUnreadCount, mockNotiItems, postNotificationsRead, type NotiItem } from '../api/communication'

export type NotificationState = {
  items: NotiItem[]
  /** 안 읽은 수 (실서버는 서버 숫자 — 불러온 목록 밖의 알림도 센다) */
  unreadCount: number
  loading: boolean
  error: string | null
  /** 읽음 처리 실패 같은 짧은 안내 */
  actionError: string | null
}

const POLL_MS = 60_000
const isLive = () => getDataMode() === 'live'
const countUnread = (items: NotiItem[]) => items.filter((n) => !n.read).length

const initial = (live: boolean): NotificationState =>
  live
    ? { items: [], unreadCount: 0, loading: true, error: null, actionError: null }
    : { items: mockNotiItems, unreadCount: countUnread(mockNotiItems), loading: false, error: null, actionError: null }
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
    const [items, unreadCount] = await Promise.all([fetchNotifications(), fetchUnreadCount()])
    if (seq === loadSeq) set({ items, unreadCount, loading: false, error: null })
  } catch (e) {
    if (seq === loadSeq) set({ loading: false, error: errMsg(e) })
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
