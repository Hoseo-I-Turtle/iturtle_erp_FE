// 공지 목록 · 쓰기 — docs/api/20-communication.md N-1, N-3
import { api } from './client'
import type { MemberRef } from './types'
import { invalidateAll, useResource } from './useResource'
import { dday, fetchMe, kstYmd, shortDay, type NoticeDetailDto, type NoticeListDto, type NoticeSummaryDto } from './communication'
import { noticeList as mockNoticeList, openPolls as mockOpenPolls, type NoticeListItem } from '../mocks/noticeList'

export type NoticeTab = 'ALL' | 'MUST_READ' | 'POLL' | 'UNREAD'
export type OpenPoll = { id: string; title: string; participantCount: number; audienceCount: number; dday: string; note: string }
export type NoticeListData = {
  /** 탭 · 검색을 적용한 목록 (고정 먼저) */
  items: NoticeListItem[]
  counts: Record<NoticeTab, number>
  totalPages: number
  openPolls: OpenPoll[]
  /** 옆 칸 "나에게 남은 것" */
  unreadMustRead: NoticeListItem[]
  pendingPolls: NoticeListItem[]
  canWrite: boolean
}

const md = (iso: string) => {
  const d = kstYmd(iso)
  return `${d.slice(5, 7)}/${d.slice(8, 10)}`
}
const noticeItemFromDto = (n: NoticeSummaryDto): NoticeListItem => ({
  id: String(n.noticeId),
  title: n.title,
  author: n.author.name,
  date: md(n.createdAt),
  mustRead: n.mustRead,
  pinnedUntil: n.pinnedUntilOn ? `${Number(n.pinnedUntilOn.slice(5, 7))}/${Number(n.pinnedUntilOn.slice(8, 10))}` : undefined,
  read: n.read,
  commentCount: n.commentCount,
  attachmentCount: n.attachmentCount,
  poll: n.poll
    ? {
        closed: n.poll.closed,
        audience: n.poll.audience,
        voted: n.poll.voted,
        note: n.poll.closed ? '투표 마감' : `투표 마감 ${shortDay(kstYmd(n.poll.closesAt))} · ${dday(n.poll.closesAt)}`,
      }
    : undefined,
})

const inTab = (n: NoticeListItem, tab: NoticeTab) =>
  tab === 'ALL' || (tab === 'MUST_READ' && n.mustRead) || (tab === 'POLL' && !!n.poll) || (tab === 'UNREAD' && !n.read)

const countsOf = (all: NoticeListItem[]): Record<NoticeTab, number> => ({
  ALL: all.length,
  MUST_READ: all.filter((n) => n.mustRead).length,
  POLL: all.filter((n) => n.poll).length,
  UNREAD: all.filter((n) => !n.read).length,
})
const sideOf = (all: NoticeListItem[]) => ({
  unreadMustRead: all.filter((n) => n.mustRead && !n.read),
  pendingPolls: all.filter((n) => n.poll && !n.poll.closed && n.poll.audience && !n.poll.voted),
})

export const NOTICE_PAGE_SIZE = 20

/** 목업 모드에서 새로 쓴 공지를 목록 맨 위에 보여 주려고 잠깐 담아 둔다 (새로 고침하면 사라진다) */
const mockAdded: NoticeListItem[] = []

/** 공지 목록 (N-1) */
export function useNoticeList(f: { tab: NoticeTab; keyword: string; page: number }) {
  return useResource<NoticeListData>(
    ['notice-list', f],
    () => {
      const all = [...mockAdded, ...mockNoticeList]
      const kw = f.keyword.trim()
      const hit = all.filter((n) => inTab(n, f.tab) && (!kw || n.title.includes(kw) || n.author.includes(kw)))
      return {
        items: [...hit].sort((a, b) => Number(!!b.pinnedUntil) - Number(!!a.pinnedUntil)),
        counts: countsOf(all),
        totalPages: 1,
        openPolls: mockOpenPolls,
        ...sideOf(all),
        canWrite: true,
      }
    },
    async () => {
      const kw = f.keyword.trim()
      // 명세 확인 필요: N-1 에 "투표 있는 공지만" 거르기와 탭별 개수가 없다. 투표 탭 · 탭 숫자는 받은 페이지 안에서 센다
      const [r, me] = await Promise.all([
        api<NoticeListDto>('/notices', {
          query: {
            keyword: kw.length >= 2 ? kw : undefined,
            mustRead: f.tab === 'MUST_READ' ? true : undefined,
            unreadOnly: f.tab === 'UNREAD' ? true : undefined,
            page: f.page,
            size: NOTICE_PAGE_SIZE,
          },
        }),
        fetchMe(),
      ])
      const all = [...r.pinned, ...r.page.content].map(noticeItemFromDto)
      // 진행 중인 투표의 참여 수는 목록에 없어 상세(N-2)를 따로 부른다 (최대 3개)
      const open = all.filter((n) => n.poll && !n.poll.closed).slice(0, 3)
      const polls = await Promise.all(
        open.map((n) =>
          api<NoticeDetailDto>(`/notices/${n.id}`)
            .then((d): OpenPoll | null =>
              d.poll
                ? {
                    id: n.id,
                    title: n.title,
                    participantCount: d.poll.participantCount,
                    audienceCount: d.poll.audienceCount,
                    dday: dday(d.poll.closesAt),
                    note: `${d.poll.multiple ? '복수 선택' : '하나만 선택'} · ${d.poll.anonymous ? '익명' : '기명'}`,
                  }
                : null,
            )
            .catch(() => null),
        ),
      )
      return {
        items: all.filter((n) => inTab(n, f.tab)),
        counts: { ...countsOf(all), ALL: r.page.totalElements + r.pinned.length },
        totalPages: Math.max(1, r.page.totalPages),
        openPolls: polls.filter((p): p is OpenPoll => p !== null),
        ...sideOf(all),
        canWrite: me.roles.includes('notice-write'),
      }
    },
  )
}

export type NoticeDraft = {
  title: string
  body: string
  mustRead: boolean
  /** 'YYYY-MM-DD' 또는 null (고정 안 함) */
  pinnedUntilOn: string | null
  attachmentFileIds: string[]
  poll: {
    question: string
    options: string[]
    multiple: boolean
    anonymous: boolean
    resultVisibility: 'AFTER_VOTE' | 'AFTER_CLOSE'
    audienceMemberTypes: MemberRef['memberType'][] | null
    /** ISO 시각 */
    closesAt: string
  } | null
}

/** 공지 쓰기 (N-3). 만든 공지의 번호를 돌려준다 */
export const createNotice = (d: NoticeDraft) =>
  api<{ noticeId: number }>('/notices', {
    method: 'POST',
    body: {
      ...d,
      // 복수 선택이면 고를 수 있는 수는 선택지 수까지 (N017)
      poll: d.poll && { ...d.poll, maxChoices: d.poll.multiple ? d.poll.options.length : undefined },
    },
  }).then((r) => r.noticeId)

/** 목업 모드: 새 공지를 목록에만 더한다 */
export function addMockNotice(d: NoticeDraft, author: string) {
  const now = new Date()
  mockAdded.unshift({
    id: `new-${mockAdded.length + 1}`,
    title: d.title,
    author,
    date: `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
    mustRead: d.mustRead,
    pinnedUntil: d.pinnedUntilOn ? `${Number(d.pinnedUntilOn.slice(5, 7))}/${Number(d.pinnedUntilOn.slice(8, 10))}` : undefined,
    read: true,
    commentCount: 0,
    attachmentCount: d.attachmentFileIds.length,
    poll: d.poll ? { closed: false, audience: true, voted: false, note: `투표 마감 ${shortDay(kstYmd(d.poll.closesAt))}` } : undefined,
  })
  invalidateAll()
}
