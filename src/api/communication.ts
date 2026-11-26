// 소통 · 일정 API — docs/api/20-communication.md (공지 · 캘린더 · 모임 날짜 · 알림), 60-common.md (홈 · 댓글)
// 응답을 화면이 쓰는 mocks/* 의 모양으로 바꾼다.
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource } from './useResource'
import type { CommentItem } from './comments'
import { getApiBase, getDataMode } from '../lib/dataMode'
import { activityLine, type ActivityDto } from './projects'
import { formatShortDay, parseYmd, WEEKDAYS } from '../lib/date'
import { MEMBER_TYPE_NAME } from '../mocks/members'
import {
  ME,
  noticeDrafts as mockNoticeDrafts,
  noticeRows as mockNoticeRows,
  notices as mockNotices,
  otherNotices as mockOtherNotices,
  type Notice,
  type NoticeRowMock,
  type Vote,
} from '../mocks/notices'
import { events as mockEvents, type CalEvent, type EventKind, type EventLayer } from '../mocks/calendar'
import { schedulePoll as mockPoll, type SchedulePoll } from '../mocks/schedulePoll'
import {
  mustCheck as mockMustCheck,
  myProjects as mockProjects,
  myTasks as mockTasks,
  recentNotices as mockRecentNotices,
  services as mockServices,
  weekEvents as mockWeekEvents,
  type MustCheck,
  type NoticeSummary as HomeNotice,
  type ProjectSummary,
  type Service,
  type Task,
  type WeekEvent,
} from '../mocks/home'
import { notifications as mockNotifications, type Notification, type NotiType } from '../mocks/notifications'

/* ================= 공통 도우미 ================= */

const KST_OFFSET = 9 * 60 * 60000
const pad2 = (n: number) => String(n).padStart(2, '0')
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + KST_OFFSET)

/** ISO 시각 → KST 'YYYY-MM-DD' */
export function kstYmd(iso: string) {
  const d = kstDate(iso)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}
/** ISO 시각 → KST 'HH:mm' */
export function kstHm(iso: string) {
  const d = kstDate(iso)
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}
/** KST 날짜 + 그날 몇 분 → ISO 시각 */
export function kstInstant(day: string, minutes: number) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + minutes * 60000 - KST_OFFSET).toISOString()
}
const todayKst = () => kstYmd(new Date().toISOString())
const addDaysYmd = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/** '2026-11-20' → '11/20(목)' */
const shortDay = (day: string) => formatShortDay(parseYmd(day))
/** ISO → '11/20(목) 18:00' */
const shortDayTime = (iso: string) => `${shortDay(kstYmd(iso))} ${kstHm(iso)}`
/** 마감까지 'D-3' · 'D-day' · '마감' */
function dday(iso: string) {
  if (Date.parse(iso) < Date.now()) return '마감'
  const n = daysBetween(todayKst(), kstYmd(iso))
  return n <= 0 ? 'D-day' : `D-${n}`
}
/** 1258291 → '1.2MB' */
function formatBytes(n: number) {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
const fileUrl = (publicId: string) => `${getApiBase().replace(/\/$/, '')}/files/${publicId}/download`
/** 백엔드 MemberStatus 는 휴학(ON_LEAVE)도 있다 (types.ts 의 MemberRef 에는 아직 없어 문자열로 본다) */
const roleName = (m: MemberRef) => {
  const status: string = m.status
  if (status === 'ACTIVE') return MEMBER_TYPE_NAME[m.memberType]
  if (status === 'ON_LEAVE') return `${MEMBER_TYPE_NAME[m.memberType]} · 휴학`
  return '졸업'
}

type Me = { memberId: number; name: string; roles: string[] }
const fetchMe = () => api<Me>('/members/me')

/* ================= 공지 · 투표 (N-1, N-2, N-6) ================= */

export type NoticeSummaryDto = {
  noticeId: number
  title: string
  mustRead: boolean
  pinnedUntilOn: string | null
  author: MemberRef
  createdAt: string
  /** 게시 시각 (임시 저장이면 null) */
  publishedAt: string | null
  draft: boolean
  audience: NoticeAudienceDto
  editedAt: string | null
  read: boolean
  commentCount: number
  attachmentCount: number
  poll: { closesAt: string; closed: boolean; audience: boolean; voted: boolean; participantCount: number; audienceCount: number } | null
  /** 필독이면 읽음 · 안 읽음 숫자 (명단은 상세에서만), 아니면 null */
  readSummary: { readCount: number; unreadCount: number } | null
}
export type NoticeListDto = { pinned: NoticeSummaryDto[]; page: PageResponse<NoticeSummaryDto> }

/** 공지 대상 (NoticeAudienceResponse / NoticeAudienceRequest) */
export type NoticeAudienceType = 'ALL' | 'PROJECT' | 'MEMBER_TYPES'
type NoticeAudienceDto = {
  type: NoticeAudienceType
  projectKey?: string | null
  projectName?: string | null
  memberTypes?: MemberRef['memberType'][] | null
}
/** '전체 구성원' · 'DEFME 백엔드 참여자' · '학생 · 인턴' */
export const audienceLabel = (a: NoticeAudienceDto | null | undefined) => {
  if (!a || a.type === 'ALL') return '전체 구성원'
  if (a.type === 'PROJECT') return `${a.projectName ?? a.projectKey ?? '프로젝트'} 참여자`
  return (a.memberTypes ?? []).map((t) => MEMBER_TYPE_NAME[t]).join(' · ') || '구분 선택'
}

type PollDto = {
  pollId: number
  question: string
  multiple: boolean
  maxChoices: number | null
  anonymous: boolean
  resultVisibility: 'AFTER_VOTE' | 'AFTER_CLOSE'
  audienceMemberTypes: MemberRef['memberType'][] | null
  audienceCount: number
  participantCount: number
  closesAt: string
  closedEarlyAt: string | null
  closed: boolean
  audience: boolean
  voted: boolean
  canChangeVote: boolean
  myOptionIds?: number[]
  resultVisible: boolean
  options: { optionId: number; label: string; count?: number; ratio?: number; voters?: MemberRef[] }[]
}
type FileRef = { publicId: string; name: string; size: number; contentType: string }
type NoticeDetailDto = {
  noticeId: number
  title: string
  body: string
  mustRead: boolean
  pinnedUntilOn: string | null
  author: MemberRef
  createdAt: string
  publishedAt: string | null
  draft: boolean
  audience: NoticeAudienceDto
  editedAt: string | null
  attachments: FileRef[]
  poll: PollDto | null
  canEdit: boolean
  readSummary: {
    readCount: number
    unreadCount: number
    readers?: { member: MemberRef; readAt: string }[]
    unreaders?: MemberRef[]
  } | null
  readsResetAt: string | null
}

/** 공지 목록 (pinned 먼저 → 나머지) */
const fetchNoticeList = (query: Record<string, string | number | boolean | undefined>) =>
  api<NoticeListDto>('/notices', { query }).then((r) => [...r.pinned, ...r.page.content])

const noticeMeta = (n: NoticeSummaryDto) =>
  [n.mustRead && '필독', n.poll && !n.poll.closed && '투표 진행 중', n.author.name, ago(n.createdAt)].filter(Boolean).join(' · ')

/** 투표 상자가 쓰는 모양 (목업 · 실서버 공통) */
export type VoteOptionView = { id: string; label: string; count: number | null; voters: string[]; mine: boolean }
export type VoteView = {
  question: string
  multiple: boolean
  maxChoices: number | null
  named: boolean
  dday: string
  eligible: number
  participantCount: number
  /** 마감 전 · 대상 · 기명이면 바꿀 수 있음 */
  canChange: boolean
  /** 아직 투표할 수 있음 (대상 · 마감 전 · 투표 안 함) */
  canVote: boolean
  voted: boolean
  resultVisible: boolean
  options: VoteOptionView[]
}

function voteFromMock(v: Vote): VoteView {
  const voters = new Set(v.options.flatMap((o) => o.voters))
  const voted = v.options.some((o) => o.voters.includes(ME))
  return {
    question: v.question,
    multiple: v.multiple,
    maxChoices: null,
    named: v.named,
    dday: v.dday,
    eligible: v.eligible,
    participantCount: voters.size,
    canChange: true,
    canVote: true,
    voted,
    resultVisible: true,
    options: v.options.map((o) => ({ id: o.id, label: o.label, count: o.voters.length, voters: o.voters, mine: o.voters.includes(ME) })),
  }
}

export function voteFromDto(p: PollDto): VoteView {
  const mine = new Set(p.myOptionIds ?? [])
  return {
    question: p.question,
    multiple: p.multiple,
    maxChoices: p.maxChoices,
    named: !p.anonymous,
    dday: dday(p.closesAt),
    eligible: p.audienceCount,
    participantCount: p.participantCount,
    canChange: p.canChangeVote,
    canVote: p.audience && !p.closed && !p.voted,
    voted: p.voted,
    resultVisible: p.resultVisible,
    options: p.options.map((o) => ({
      id: String(o.optionId),
      label: o.label,
      count: o.count ?? null,
      voters: (o.voters ?? []).map((m) => m.name),
      mine: mine.has(o.optionId),
    })),
  }
}

export type NoticeView = Omit<Notice, 'attachments' | 'vote' | 'comments' | 'read'> & {
  noticeId: number
  attachments: { name: string; size: string; url: string }[]
  vote: VoteView | null
  /** 필독이 아니면 null. unread 가 null 이면 명단을 볼 권한이 없음 (숫자만) */
  read: { total: number; readCount: number; unread: { name: string; role: string }[] | null } | null
  canEdit: boolean
  meName: string
  /** 게시 전 임시 저장 (작성자만 본다) */
  draft: boolean
}

function noticeFromMock(n: Notice): NoticeView {
  return {
    ...n,
    noticeId: Number(n.id),
    attachments: n.attachments.map((a) => ({ ...a, url: '#' })),
    vote: n.vote ? voteFromMock(n.vote) : null,
    read: n.read,
    canEdit: true,
    meName: ME,
    draft: false,
  }
}

function noticeFromDto(d: NoticeDetailDto, me: Me): NoticeView {
  const total = d.attachments.reduce((sum, a) => sum + a.size, 0)
  const info: [string, string][] = []
  info.push(['대상', audienceLabel(d.audience) + (d.readSummary ? ` (${d.readSummary.readCount + d.readSummary.unreadCount}명)` : '')])
  if (d.poll) {
    info.push([
      '투표 대상',
      d.poll.audienceMemberTypes?.length ? d.poll.audienceMemberTypes.map((t) => MEMBER_TYPE_NAME[t]).join(', ') : '전체 구성원',
    ])
    info.push(['결과 공개', d.poll.resultVisibility === 'AFTER_VOTE' ? '투표한 뒤 바로' : '마감 뒤'])
  }
  if (d.pinnedUntilOn) info.push(['고정 기한', `${shortDay(d.pinnedUntilOn)}까지`])
  info.push(['첨부', d.attachments.length ? `${d.attachments.length}개 · ${formatBytes(total)}` : '없음'])
  return {
    id: String(d.noticeId),
    noticeId: d.noticeId,
    title: d.title,
    body: d.body,
    author: d.author.name,
    createdAt: shortDayTime(d.publishedAt ?? d.createdAt),
    edited: !!d.editedAt,
    important: d.mustRead,
    pinnedUntil: d.pinnedUntilOn ? `${Number(d.pinnedUntilOn.slice(5, 7))}/${Number(d.pinnedUntilOn.slice(8, 10))}` : undefined,
    attachments: d.attachments.map((a) => ({ name: a.name, size: formatBytes(a.size), url: fileUrl(a.publicId) })),
    vote: d.poll ? voteFromDto(d.poll) : null,
    read: d.readSummary
      ? {
          total: d.readSummary.readCount + d.readSummary.unreadCount,
          readCount: d.readSummary.readCount,
          unread: d.author.memberId === me.memberId && d.readSummary.unreaders
            ? d.readSummary.unreaders.map((m) => ({ name: m.name, role: roleName(m) }))
            : null,
        }
      : null,
    info,
    canEdit: d.canEdit,
    meName: me.name,
    draft: d.draft,
  }
}

/** 공지 상세 (N-2, 열면 서버가 읽음 처리) */
export function useNoticeDetail(id: string | undefined) {
  return useResource<NoticeView>(
    ['notice', id],
    () => noticeFromMock(mockNotices.find((n) => n.id === id) ?? mockNotices[0]),
    async () => {
      const [d, me] = await Promise.all([api<NoticeDetailDto>(`/notices/${id}`), fetchMe()])
      return noticeFromDto(d, me)
    },
  )
}

/** 투표하기 · 선택 바꾸기 (N-6). 바뀐 투표를 돌려준다 */
export const putMyVote = (noticeId: number, optionIds: string[]) =>
  api<PollDto>(`/notices/${noticeId}/poll/my-vote`, { method: 'PUT', body: { optionIds: optionIds.map(Number) } }).then(voteFromDto)

export type OtherNotice = { id: string; title: string; meta: string }

/** 공지 상세 오른쪽 "다른 공지" (N-1 최신 순) */
export function useOtherNotices(currentId: string | undefined) {
  return useResource<OtherNotice[]>(
    ['other-notices', currentId],
    () => mockOtherNotices,
    async () => {
      const list = await fetchNoticeList({ size: 5 })
      return list
        .filter((n) => String(n.noticeId) !== currentId)
        .slice(0, 3)
        .map((n) => ({ id: String(n.noticeId), title: n.title, meta: noticeMeta(n) }))
    },
  )
}

/* ================= 공지 목록 · 쓰기 (N-1, N-3, N-4) ================= */

export type NoticeTab = 'all' | 'mustRead' | 'poll' | 'unread'
export type NoticeSort = 'LATEST' | 'DEADLINE'
export type NoticeRow = {
  id: string
  title: string
  author: string
  date: string
  mustRead: boolean
  /** 'M/D' (고정 기한) */
  pinnedUntil?: string
  read: boolean
  commentCount: number
  attachmentCount: number
  /** 전체가 아니면 '학생 · 인턴' 같은 대상 이름, 전체면 null */
  audience: string | null
  poll: { closed: boolean; voted: boolean; audience: boolean; dday: string; participantCount: number; audienceCount: number } | null
  /** 필독일 때 읽음 수 */
  readSummary: { readCount: number; total: number } | null
}
export type NoticeListView = {
  pinned: NoticeRow[]
  rows: NoticeRow[]
  page: number
  totalPages: number
  counts: Record<NoticeTab, number>
  /** 나에게 남은 것 */
  left: { unreadMustRead: number; latestMustRead: { id: string; title: string } | null; pendingPolls: number }
  /** 진행 중인 투표 (마감 가까운 순 몇 개) */
  openPolls: { id: string; title: string; dday: string; voted: boolean; audience: boolean; participantCount: number; audienceCount: number }[]
}

/** ISO → KST 'M/DD' */
const monthDayKst = (iso: string) => {
  const d = kstYmd(iso)
  return `${Number(d.slice(5, 7))}/${d.slice(8, 10)}`
}
const rowFromDto = (n: NoticeSummaryDto): NoticeRow => ({
  id: String(n.noticeId),
  title: n.title,
  author: n.author.name,
  date: monthDayKst(n.publishedAt ?? n.createdAt),
  mustRead: n.mustRead,
  pinnedUntil: n.pinnedUntilOn ? `${Number(n.pinnedUntilOn.slice(5, 7))}/${Number(n.pinnedUntilOn.slice(8, 10))}` : undefined,
  read: n.read,
  commentCount: n.commentCount,
  attachmentCount: n.attachmentCount,
  audience: !n.audience || n.audience.type === 'ALL' ? null : audienceLabel(n.audience),
  poll: n.poll
    ? {
        closed: n.poll.closed,
        voted: n.poll.voted,
        audience: n.poll.audience,
        dday: dday(n.poll.closesAt),
        participantCount: n.poll.participantCount,
        audienceCount: n.poll.audienceCount,
      }
    : null,
  readSummary: n.readSummary ? { readCount: n.readSummary.readCount, total: n.readSummary.readCount + n.readSummary.unreadCount } : null,
})
const rowFromMock = (n: NoticeRowMock): NoticeRow => ({
  ...n,
  audience: n.audience ?? null,
  poll: n.poll ? { ...n.poll, audience: true } : null,
  readSummary: n.mustRead ? { readCount: 8, total: 11 } : null,
})

export const NOTICE_PAGE_SIZE = 20
const TAB_QUERY: Record<NoticeTab, Record<string, boolean>> = {
  all: {},
  mustRead: { mustRead: true },
  poll: { hasPoll: true },
  unread: { unreadOnly: true },
}
type NoticeCountsDto = { all: number; mustRead: number; poll: number; unread: number }

/**
 * 공지 목록 (N-1). 탭 · 검색어(2자 이상) · 정렬 · 페이지.
 * 탭 숫자는 GET /notices/counts 한 번, 오른쪽 "나에게 남은 것"은 필독 · 안 읽음 1건과 열린 투표(마감 가까운 순)를 따로 받는다.
 */
export function useNoticeList(tab: NoticeTab, keyword: string, sort: NoticeSort, page: number) {
  const kw = keyword.trim().length >= 2 ? keyword.trim() : undefined
  return useResource<NoticeListView>(
    ['notice-list', tab, kw, sort, page],
    () => {
      const all = mockNoticeRows.map(rowFromMock)
      const inTab = (r: NoticeRow) =>
        tab === 'all' || (tab === 'mustRead' ? r.mustRead : tab === 'poll' ? !!r.poll : !r.read)
      const found = all.filter((r) => !kw || r.title.includes(kw) || r.author.includes(kw))
      const shown = found.filter(inTab)
      if (sort === 'DEADLINE') {
        // 열린 투표가 마감 가까운 순으로 앞, 나머지는 그대로 (목업 D-day 숫자로 비교)
        const left = (r: NoticeRow) => (r.poll && !r.poll.closed ? Number(r.poll.dday.replace(/\D/g, '') || 0) : Infinity)
        shown.sort((a, b) => left(a) - left(b))
      }
      const unreadMust = all.filter((r) => r.mustRead && !r.read)
      const polls = all.filter((r) => r.poll && !r.poll.closed)
      return {
        pinned: shown.filter((r) => r.pinnedUntil),
        rows: shown.filter((r) => !r.pinnedUntil),
        page: 0,
        totalPages: 1,
        counts: {
          all: found.length,
          mustRead: found.filter((r) => r.mustRead).length,
          poll: found.filter((r) => r.poll).length,
          unread: found.filter((r) => !r.read).length,
        },
        left: {
          unreadMustRead: unreadMust.length,
          latestMustRead: unreadMust[0] ? { id: unreadMust[0].id, title: unreadMust[0].title } : null,
          pendingPolls: polls.filter((r) => !r.poll?.voted).length,
        },
        openPolls: polls.map((r) => ({
          id: r.id,
          title: r.title,
          dday: r.poll?.dday ?? '',
          voted: !!r.poll?.voted,
          audience: true,
          participantCount: r.poll?.participantCount ?? 0,
          audienceCount: r.poll?.audienceCount ?? 0,
        })),
      }
    },
    async () => {
      const [list, counts, mustUnread, polls] = await Promise.all([
        api<NoticeListDto>('/notices', { query: { ...TAB_QUERY[tab], keyword: kw, sort, page, size: NOTICE_PAGE_SIZE } }),
        api<NoticeCountsDto>('/notices/counts', { query: { keyword: kw } }),
        api<NoticeListDto>('/notices', { query: { mustRead: true, unreadOnly: true, size: 1 } }),
        api<NoticeListDto>('/notices', { query: { hasPoll: true, sort: 'DEADLINE', size: 20 } }),
      ])
      const firstMust = mustUnread.pinned[0] ?? mustUnread.page.content[0]
      const open = [...polls.pinned, ...polls.page.content].filter((n) => n.poll && !n.poll.closed)
      return {
        pinned: list.pinned.map(rowFromDto),
        rows: list.page.content.map(rowFromDto),
        page: list.page.page,
        totalPages: list.page.totalPages,
        counts,
        left: {
          unreadMustRead: mustUnread.pinned.length + mustUnread.page.totalElements,
          latestMustRead: firstMust ? { id: String(firstMust.noticeId), title: firstMust.title } : null,
          pendingPolls: open.filter((n) => n.poll?.audience && !n.poll.voted).length,
        },
        openPolls: open
          .sort((a, b) => Date.parse(a.poll?.closesAt ?? '') - Date.parse(b.poll?.closesAt ?? ''))
          .slice(0, 3)
          .map((n) => ({
            id: String(n.noticeId),
            title: n.title,
            dday: n.poll ? dday(n.poll.closesAt) : '',
            voted: !!n.poll?.voted,
            audience: !!n.poll?.audience,
            participantCount: n.poll?.participantCount ?? 0,
            audienceCount: n.poll?.audienceCount ?? 0,
          })),
      }
    },
  )
}

/** 공지 대상 요청 (NoticeAudienceRequest) */
export type NoticeAudienceBody = { type: NoticeAudienceType; projectKey: string | null; memberTypes: MemberRef['memberType'][] | null }
/** 투표 (만들 때 PollCreateRequest, 고칠 때 PollUpdateRequest — 선택지는 optionId 로 같은 것을 잇는다) */
export type NoticePollBody = {
  question: string
  options: { optionId: number | null; label: string }[]
  multiple: boolean
  maxChoices: number | null
  anonymous: boolean
  resultVisibility: 'AFTER_VOTE' | 'AFTER_CLOSE'
  closesAt: string
}
/** 쓰기 화면의 내용 (만들기 · 임시 저장 이어 쓰기 공통) */
export type NoticeForm = {
  title: string
  body: string
  mustRead: boolean
  /** 'YYYY-MM-DD' 그날 끝까지 고정. null 이면 고정 안 함 */
  pinnedUntilOn: string | null
  attachmentFileIds: string[]
  poll: NoticePollBody | null
  audience: NoticeAudienceBody
}

const createPoll = (p: NoticePollBody) => ({
  question: p.question,
  options: p.options.map((o) => o.label),
  multiple: p.multiple,
  maxChoices: p.maxChoices,
  anonymous: p.anonymous,
  resultVisibility: p.resultVisibility,
  closesAt: p.closesAt,
})

/** 공지 올리기 · 임시 저장 (POST /notices, draft=true 면 게시하지 않고 저장). 공지 id 를 돌려준다 */
export const createNotice = (f: NoticeForm, draft: boolean) =>
  api<NoticeDetailDto>('/notices', {
    method: 'POST',
    body: { ...f, poll: f.poll ? createPoll(f.poll) : null, draft },
  }).then((d) => String(d.noticeId))

/**
 * 임시 저장한 공지 고치기 (PATCH). 고정 · 투표는 null 을 보내면 지운다.
 * hadPoll: 저장된 공지에 이미 투표가 있었는지 (있으면 고치기, 없으면 새로 만들기 모양으로 보낸다)
 */
export const updateNotice = (id: string, f: NoticeForm, hadPoll: boolean) =>
  api<NoticeDetailDto>(`/notices/${id}`, {
    method: 'PATCH',
    body: {
      ...f,
      // 고칠 때는 PollUpdateRequest 모양 (선택지 {optionId, label}). 투표가 없던 공지면 optionId 없이 새로 만든다
      poll: f.poll ? { ...f.poll, options: f.poll.options.map((o) => ({ optionId: hadPoll ? o.optionId : null, label: o.label })) } : null,
    },
  }).then((d) => String(d.noticeId))

/** 임시 저장 게시 (작성자만, 이미 게시면 N019) */
export const publishNotice = (id: string) => api<NoticeDetailDto>(`/notices/${id}/publish`, { method: 'POST' }).then((d) => String(d.noticeId))

/** 공지 지우기 (임시 저장 버리기에도 쓴다) */
export const deleteNotice = (id: string) => api<void>(`/notices/${id}`, { method: 'DELETE' })

export type NoticeDraftItem = { id: string; title: string; savedAt: string }
/** 내 임시 저장 목록 (GET /notices/drafts) */
export const fetchNoticeDrafts = () =>
  api<NoticeSummaryDto[]>('/notices/drafts').then((list) =>
    list.map((n) => ({ id: String(n.noticeId), title: n.title || '(제목 없음)', savedAt: ago(n.editedAt ?? n.createdAt) })),
  )

export type NoticeDraft = {
  id: string
  form: NoticeForm
  attachments: { publicId: string; name: string; size: number }[]
  /** 투표 마감을 쓰기 화면 칸('YYYY-MM-DDTHH:mm', KST)으로 */
  pollClosesLocal: string | null
}
/** 임시 저장 하나를 쓰기 화면 모양으로 (GET /notices/{id}) */
export const fetchNoticeDraft = (id: string) =>
  api<NoticeDetailDto>(`/notices/${id}`).then(
    (d): NoticeDraft => ({
      id: String(d.noticeId),
      form: {
        title: d.title,
        body: d.body,
        mustRead: d.mustRead,
        pinnedUntilOn: d.pinnedUntilOn,
        attachmentFileIds: d.attachments.map((a) => a.publicId),
        poll: d.poll
          ? {
              question: d.poll.question,
              options: d.poll.options.map((o) => ({ optionId: o.optionId, label: o.label })),
              multiple: d.poll.multiple,
              maxChoices: d.poll.maxChoices,
              anonymous: d.poll.anonymous,
              resultVisibility: d.poll.resultVisibility,
              closesAt: d.poll.closesAt,
            }
          : null,
        audience: {
          type: d.audience?.type ?? 'ALL',
          projectKey: d.audience?.projectKey ?? null,
          memberTypes: d.audience?.memberTypes ?? null,
        },
      },
      attachments: d.attachments.map((a) => ({ publicId: a.publicId, name: a.name, size: a.size })),
      pollClosesLocal: d.poll ? `${kstYmd(d.poll.closesAt)}T${kstHm(d.poll.closesAt)}` : null,
    }),
  )

/** 내 임시 저장 목록 (쓰기 모달 "이어 쓰기") */
export function useNoticeDrafts() {
  return useResource<NoticeDraftItem[]>('notice-drafts', () => mockNoticeDrafts, fetchNoticeDrafts)
}

/** 임시 저장 하나 불러오기. 목업 모드는 예시 글 */
export const loadNoticeDraft = (id: string): Promise<NoticeDraft> =>
  getDataMode() === 'live'
    ? fetchNoticeDraft(id)
    : Promise.resolve({
        id,
        form: {
          title: '12월 장비 점검 일정',
          body: '12월 첫 주에 서버실 장비를 점검해요.\n\n- 12/2(화) 오전: GPU 서버\n- 12/3(수) 오후: 스토리지',
          mustRead: true,
          pinnedUntilOn: null,
          attachmentFileIds: [],
          poll: null,
          audience: { type: 'MEMBER_TYPES', projectKey: null, memberTypes: ['STUDENT', 'INTERN'] },
        },
        attachments: [],
        pollClosesLocal: null,
      })

/* ================= 댓글 (CM-1, CM-2) ================= */

/** 공지 댓글 목업 (목업 모드에서 공지마다 보일 댓글). 실제 목록 · 쓰기는 api/comments 의 공용 함수 */
export function mockNoticeComments(id: string | undefined): CommentItem[] {
  return (mockNotices.find((n) => n.id === id) ?? mockNotices[0]).comments.map((c, i) => ({
    id: `m${i}`,
    commentId: null,
    parentId: null,
    ...c,
  }))
}

/* ================= 캘린더 (CL-1, CL-6, CL-7 + 작업 기한 · 마일스톤) ================= */

type OccurrenceDto = {
  eventId: number
  occurrenceStartsAt: string
  layer: 'SHARED' | 'PERSONAL' | 'MEMBER_SHARED'
  title?: string
  busyOnly: boolean
  owner?: MemberRef
  eventTypeCode: string | null
  color: string | null
  allDay: boolean
  startsAt: string
  endsAt: string
  startsOn?: string
  endsOn?: string
  location?: string | null
  recurring: boolean
  modified: boolean
  attendeeCount?: number
  attending?: boolean
  projectId?: number | null
}
type OccurrencesDto = { from: string; to: string; occurrences: OccurrenceDto[] }

// 공통코드 CALENDAR_EVENT_TYPE 의 상세 코드 (백엔드 migration V20261118_09). 관리 화면에서 더한 코드는 '행사' 로 그린다
const EVENT_KIND: Record<string, EventKind> = {
  MEETING: 'meeting',
  SEMINAR: 'seminar',
  DEADLINE: 'deadline',
  EVENT: 'event',
  CONFERENCE: 'conference',
  HOLIDAY: 'off',
}
const LAYER: Record<OccurrenceDto['layer'], EventLayer> = { SHARED: 'public', PERSONAL: 'personal', MEMBER_SHARED: 'member' }

function occTitle(o: OccurrenceDto) {
  if (o.layer === 'MEMBER_SHARED') return `${o.owner?.name ?? '구성원'}: ${o.busyOnly ? '바쁨' : o.title ?? ''}`
  return o.title ?? ''
}

/** 회차 → 달력 칸 (하루 종일 여러 날이면 날마다 하나씩) */
function occToCalEvents(o: OccurrenceDto): CalEvent[] {
  const base = {
    title: occTitle(o),
    kind: o.layer === 'SHARED' ? EVENT_KIND[o.eventTypeCode ?? ''] ?? 'event' : 'off',
    layer: LAYER[o.layer],
    place: o.location ?? undefined,
    attendees: o.attendeeCount || undefined,
    mine: o.attending,
  } satisfies Omit<CalEvent, 'id' | 'date'>
  const id = `${o.eventId}@${o.occurrenceStartsAt}`
  if (!o.allDay) return [{ ...base, id, date: kstYmd(o.startsAt), time: kstHm(o.startsAt) }]
  const from = o.startsOn ?? kstYmd(o.startsAt)
  const to = o.endsOn ?? from
  const out: CalEvent[] = []
  for (let d = from, i = 0; d <= to && i < 92; d = addDaysYmd(d, 1), i++) out.push({ ...base, id: `${id}#${d}`, date: d })
  return out
}

/**
 * CL-1 일정 조회 (from · to 는 'YYYY-MM-DD', 최대 92일). layers 는 쉼표 목록.
 * attendingOnly 를 보내면 내 설정(sharedScope)보다 앞선다
 */
const fetchOccurrences = (from: string, to: string, layers = 'SHARED,PERSONAL,MEMBER_SHARED', attendingOnly = false) =>
  api<OccurrencesDto>('/calendar-events', { query: { from, to, layers, attendingOnly } }).then((r) => r.occurrences)

type TaskCardDto = {
  taskId: number
  taskKey: string
  projectKey: string
  projectName: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED'
  dueOn: string | null
  overdue: boolean
}
type TaskListDto = { page: PageResponse<TaskCardDto>; serverTime: string }
type MilestoneDueDto = { items: { milestoneId: number; name: string; dueOn: string; overdue: boolean; project: { projectKey: string; name: string } }[] }

export type CalendarSettings = { showShared: boolean; sharedScope: 'ALL' | 'ATTENDING_ONLY'; showMemberEvents: boolean; showTaskDue: boolean }

/** 내 캘린더 보기 설정 (CL-6). 목업은 모두 켜짐 */
export function useCalendarSettings() {
  return useResource<CalendarSettings>(
    'calendar-settings',
    () => ({ showShared: true, sharedScope: 'ALL', showMemberEvents: true, showTaskDue: true }),
    () => api<CalendarSettings>('/calendar-settings/me'),
  )
}
/** 내 캘린더 보기 설정 저장 (CL-7) */
export const saveCalendarSettings = (s: CalendarSettings) => api<CalendarSettings>('/calendar-settings/me', { method: 'PUT', body: s })

/**
 * 달력에 그릴 기간의 일정 (공용 · 개인 · 구성원 공유 + 내 작업 기한 · 마일스톤).
 * 보기 체크는 화면이 거르므로 층은 모두 받아 둔다.
 */
export function useCalendarEvents(from: string, to: string) {
  return useResource<CalEvent[]>(
    ['calendar-events', from, to],
    () => mockEvents,
    async () => {
      const [occ, tasks, milestones] = await Promise.all([
        fetchOccurrences(from, to),
        api<TaskListDto>('/tasks', { query: { mine: true, dueFrom: from, dueTo: to, sort: 'dueOn', size: 100 } }),
        api<MilestoneDueDto>('/milestones', { query: { dueFrom: from, dueTo: to } }),
      ])
      const taskEvents: CalEvent[] = tasks.page.content
        .filter((t) => t.dueOn)
        .map((t) => ({ id: `task-${t.taskKey}`, date: t.dueOn!, title: `${t.taskKey} 기한`, kind: 'deadline', layer: 'task', note: `작업 · ${t.title}` }))
      const msEvents: CalEvent[] = milestones.items.map((m) => ({
        id: `ms-${m.milestoneId}`,
        date: m.dueOn,
        title: `마일스톤 ${m.name}`,
        kind: 'deadline',
        layer: 'task',
        note: `마일스톤 · ${m.project.name}`,
      }))
      return [...occ.flatMap(occToCalEvents), ...taskEvents, ...msEvents]
    },
  )
}

/* ================= 모임 날짜 정하기 (MP-2 ~ MP-6) ================= */

type MeetingPollSummaryDto = {
  pollId: number
  title: string
  creator: MemberRef
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED'
  closesAt: string
  targetCount: number
  respondedCount: number
  iAmTarget: boolean
  iResponded: boolean
  projectId: number | null
  confirmedStartsAt: string | null
}
type MeetingPollDto = {
  pollId: number
  title: string
  description: string | null
  location: string | null
  onlineUrl: string | null
  candidateDates: string[]
  dayStartTime: string
  dayEndTime: string
  slotMinutes: number
  durationMinutes: number
  closesAt: string
  closed: boolean
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED'
  creator: MemberRef
  projectId: number | null
  /** 볼 수 있는 프로젝트에 연결됐을 때만 */
  project: { projectKey: string; name: string } | null
  iAmTarget: boolean
  mySlots?: string[]
  targets: { member: MemberRef; respondedAt: string | null; remindedAt: string | null }[]
  targetCount: number
  respondedCount: number
  slots: { startsAt: string; count: number; availableMemberIds: number[] }[]
  recommendations: { startsAt: string; endsAt: string; availableCount: number; respondedCount: number; unavailableMemberIds: number[] }[]
  confirmed: { startsAt: string; endsAt: string; eventId: number } | null
}

/**
 * 화면 모양. 칸 키는 목업과 같이 "날짜 순번-시각" 이고, 시각은 시간 단위 숫자 (10.5 = 10:30).
 * durationSlots 는 칸 수, slotHours 는 한 칸의 길이(시간).
 */
export type PollView = Omit<SchedulePoll, 'pending'> & {
  pollId: number
  slotHours: number
  meName: string
  iAmTarget: boolean
  isCreator: boolean
  /** 실서버 총 대상 수 (목업은 화면이 센다) */
  targetCount: number | null
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED'
  closed: boolean
  confirmedKey: string | null
  pending: { name: string; role: string; memberId?: number }[]
}

function pollFromMock(): PollView {
  return {
    ...mockPoll,
    pollId: Number(mockPoll.id),
    slotHours: 1,
    meName: '김민서',
    iAmTarget: true,
    isCreator: true,
    targetCount: null,
    status: 'OPEN',
    closed: false,
    confirmedKey: null,
  }
}

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

function pollFromDto(p: MeetingPollDto, me: Me, busy: OccurrenceDto[]): PollView {
  const slotHours = p.slotMinutes / 60
  const startMin = toMin(p.dayStartTime)
  const endMin = toMin(p.dayEndTime)
  const hours: number[] = []
  for (let m = startMin; m < endMin; m += p.slotMinutes) hours.push(m / 60)
  const days = p.candidateDates.map((day) => {
    const d = parseYmd(day)
    return { key: day, label: `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`, long: shortDay(day) }
  })
  // ISO 시각 → 칸 키
  const keyOf = new Map<string, string>()
  days.forEach((d, i) => hours.forEach((h) => keyOf.set(new Date(kstInstant(d.key, h * 60)).toISOString(), `${i}-${h}`)))
  const keyFor = (iso: string) => keyOf.get(new Date(iso).toISOString())

  const responded = p.targets.filter((t) => t.respondedAt && t.member.memberId !== me.memberId)
  const others = responded.map((t) => ({
    name: t.member.name,
    role: roleName(t.member),
    availability: p.slots.filter((s) => s.availableMemberIds.includes(t.member.memberId)).map((s) => keyFor(s.startsAt)).filter((k): k is string => !!k),
  }))

  // 내 일정과 겹치는 칸 (첫 칸에만 제목)
  const myBusy: Record<string, string> = {}
  for (const o of busy) {
    if (o.allDay) continue
    const s = Date.parse(o.startsAt)
    const e = Date.parse(o.endsAt)
    let first = true
    days.forEach((d, i) =>
      hours.forEach((h) => {
        const cs = Date.parse(kstInstant(d.key, h * 60))
        const ce = cs + p.slotMinutes * 60000
        if (cs < e && ce > s) {
          const key = `${i}-${h}`
          if (!(key in myBusy)) myBusy[key] = first ? occTitle(o) : ''
          first = false
        }
      }),
    )
  }

  return {
    id: String(p.pollId),
    pollId: p.pollId,
    title: p.title,
    // 프로젝트에 연결되지 않았거나 볼 수 없으면 비워 두고 화면에서 칩을 숨긴다
    project: p.project?.name ?? '',
    durationSlots: Math.round(p.durationMinutes / p.slotMinutes),
    slotHours,
    place: [p.location, p.onlineUrl && '온라인'].filter(Boolean).join(' / '),
    deadline: shortDayTime(p.closesAt),
    dday: dday(p.closesAt),
    creator: p.creator.name,
    audience: `${p.targetCount}명`,
    days,
    hours,
    myBusy,
    myAvailability: (p.mySlots ?? []).map(keyFor).filter((k): k is string => !!k),
    others,
    pending: p.targets.filter((t) => !t.respondedAt).map((t) => ({ name: t.member.name, role: roleName(t.member), memberId: t.member.memberId })),
    meName: me.name,
    iAmTarget: p.iAmTarget,
    isCreator: p.creator.memberId === me.memberId,
    targetCount: p.targetCount,
    status: p.status,
    closed: p.closed,
    confirmedKey: p.confirmed ? keyFor(p.confirmed.startsAt) ?? null : null,
  }
}

/** 모임 날짜 정하기 상세 (MP-3) + 내 일정 겹쳐 보기 (CL-1) */
export function useMeetingPoll(id: string | undefined) {
  return useResource<PollView>(
    ['meeting-poll', id],
    pollFromMock,
    async () => {
      const [p, me] = await Promise.all([api<MeetingPollDto>(`/meeting-polls/${id}`), fetchMe()])
      const from = p.candidateDates[0]
      const to = p.candidateDates[p.candidateDates.length - 1]
      // 내 개인 일정 + 내가 참석하는 공용 일정만 겹친다 (attendingOnly=true 는 공용 층에만 걸린다).
      // 겹쳐 보기 실패는 화면 전체를 막지 않는다
      const busy = await fetchOccurrences(from, to, 'SHARED,PERSONAL', true).catch(() => [] as OccurrenceDto[])
      return pollFromDto(p, me, busy.filter((o) => o.layer === 'PERSONAL' || o.attending))
    },
  )
}

/** 칸 키 → ISO 시각 */
export const slotKeyToIso = (poll: PollView, key: string) => {
  const [d, h] = key.split('-')
  return kstInstant(poll.days[Number(d)].key, Number(h) * 60)
}

/** 내 응답 저장 (MP-4) */
export const saveMyPollResponse = (pollId: number, slotStarts: string[]) =>
  api<MeetingPollDto>(`/meeting-polls/${pollId}/my-response`, { method: 'PUT', body: { slotStarts } })
/** 알림 다시 보내기 (MP-5) */
export const remindPoll = (pollId: number, memberIds?: number[]) =>
  api<{ remindedCount: number }>(`/meeting-polls/${pollId}/remind`, { method: 'POST', body: { memberIds: memberIds ?? [] } })
/** 시간 확정 (MP-6) */
export const confirmPoll = (pollId: number, startsAt: string) =>
  api<MeetingPollDto>(`/meeting-polls/${pollId}/confirm`, { method: 'POST', body: { startsAt } })

/* ================= 홈 (60-common.md 1장) — 칸마다 따로 부른다 ================= */

/** 꼭 확인할 것: 필독 공지 · 투표 · 모임 날짜 · 주간 보고. 일부 API 만 실패하면 나머지는 보여 준다 */
export function useHomeMustCheck() {
  return useResource<MustCheck[]>('home-must-check', () => mockMustCheck, async () => {
    const results = await Promise.allSettled([
      fetchNoticeList({ mustRead: true, unreadOnly: true, size: 10 }).then((list) =>
        list.map<MustCheck>((n) => ({
          id: `n${n.noticeId}`,
          kind: 'notice',
          label: '필독 공지',
          title: n.title,
          meta: [
            n.author.name,
            ago(n.createdAt),
            n.readSummary && `${n.readSummary.readCount}명 확인 / ${n.readSummary.unreadCount}명 미확인`,
          ]
            .filter(Boolean)
            .join(' · '),
          action: '확인하기',
          to: `/notices/${n.noticeId}`,
        })),
      ),
      // 백엔드 NoticeListRequest 에 투표 공지만 거르는 파라미터가 없다 (keyword · mustRead · unreadOnly 뿐).
      // 최신 공지 20개에서 화면이 거르므로 더 오래된 진행 중 투표는 빠질 수 있다
      fetchNoticeList({ size: 20 }).then((list) =>
        list
          .filter((n) => n.poll && n.poll.audience && !n.poll.voted && !n.poll.closed)
          .map<MustCheck>((n) => ({
            id: `v${n.noticeId}`,
            kind: 'vote',
            label: '투표',
            title: n.title,
            meta: `공지에 포함된 투표 · 마감 ${shortDayTime(n.poll!.closesAt)} · ${dday(n.poll!.closesAt)}`,
            action: '투표하기',
            to: `/notices/${n.noticeId}`,
          })),
      ),
      api<PageResponse<MeetingPollSummaryDto>>('/meeting-polls', { query: { pendingMine: true, size: 10 } }).then((page) =>
        page.content.map<MustCheck>((p) => ({
          id: `p${p.pollId}`,
          kind: 'schedule-poll',
          label: '모임 날짜',
          title: p.title,
          meta: `${p.creator.name} · 응답 ${p.respondedCount}/${p.targetCount}명 · 마감 ${shortDay(kstYmd(p.closesAt))}`,
          action: '응답하기',
          to: `/calendar/polls/${p.pollId}`,
        })),
      ),
      fetchWeeklyReportCheck(),
    ])
    if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  })
}

/** 지난주 보고를 아직 내지 않았으면 한 줄 (report-write 가 없으면 부르지 않음) */
async function fetchWeeklyReportCheck(): Promise<MustCheck[]> {
  const me = await fetchMe()
  if (!me.roles.includes('report-write')) return []
  const today = todayKst()
  const weekday = (parseYmd(today).getDay() + 6) % 7 // 월=0
  const lastMonday = addDaysYmd(today, -weekday - 7)
  const r = await api<{ status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED'; dueAt: string }>(`/weekly-reports/me/${lastMonday}`)
  if (r.status !== 'DRAFT') return []
  const m = parseYmd(lastMonday)
  return [
    {
      id: `r${lastMonday}`,
      kind: 'report',
      label: '주간 보고',
      title: `${m.getMonth() + 1}월 ${Math.ceil(m.getDate() / 7)}주차 주간 보고를 아직 내지 않았어요`,
      meta: `마감 ${shortDayTime(r.dueAt)}${kstYmd(r.dueAt) === today ? ' · 오늘' : ''}`,
      action: '작성하기',
      to: '/reports',
    },
  ]
}

const TASK_STATUS: Record<TaskCardDto['status'], Task['status']> = {
  TODO: { label: '할 일', tone: 'tint' },
  IN_PROGRESS: { label: '진행 중', tone: 'brand' },
  REVIEW: { label: '검토', tone: 'warning' },
  DONE: { label: '완료', tone: 'muted' },
  CANCELLED: { label: '취소', tone: 'muted' },
}
function taskFromDto(t: TaskCardDto): Task {
  let due: Task['due']
  if (t.dueOn) {
    const n = daysBetween(todayKst(), t.dueOn)
    const label = n === -1 ? '어제' : n === 0 ? '오늘' : n === 1 ? '내일' : `${Number(t.dueOn.slice(5, 7))}/${Number(t.dueOn.slice(8, 10))}`
    due = { label, tone: t.overdue ? 'danger' : n <= 3 ? 'warning' : 'muted' }
  }
  return { key: t.taskKey, title: t.title, project: t.projectName || t.projectKey, due, status: TASK_STATUS[t.status] }
}

type ProjectSummaryDto = {
  projectKey: string
  name: string
  status: 'PREPARING' | 'ACTIVE' | 'ON_HOLD' | 'DONE' | 'ARCHIVED'
  categoryCode: string
  categoryName: string
  summary: string | null
  memberCount: number
  memberPreview: MemberRef[]
  nextMilestone: { milestoneId: number; name: string; dueOn: string | null; progress: { done: number; total: number; ratio: number } } | null
  recentActivity: ActivityDto | null
}
type ProjectListDto = { categoryCounts: Record<string, number>; page: PageResponse<ProjectSummaryDto> }

/** 작업 목록 (T-1). 카드에 프로젝트 이름(projectName)이 있다 */
const fetchTaskCards = (query: Record<string, string | number | boolean>) =>
  api<TaskListDto>('/tasks', { query }).then((r) => r.page.content.map(taskFromDto))

/** 내 작업 (기한 순 10개). 상태를 비우면 완료(DONE)도 섞여 열린 상태만 받는다 */
export function useHomeMyTasks() {
  return useResource<Task[]>('home-my-tasks', () => mockTasks, () =>
    fetchTaskCards({ mine: true, statuses: 'TODO,IN_PROGRESS,REVIEW', sort: 'dueOn', size: 10 }),
  )
}

/** 검토를 기다리는 작업 (비면 칸 숨김, 목업에는 없음) */
export function useHomeReviewTasks() {
  return useResource<Task[]>('home-review-tasks', () => [], () => fetchTaskCards({ awaitingMyReview: true, size: 10 }))
}

/** 내 프로젝트 (진행 중) */
export function useHomeProjects() {
  return useResource<ProjectSummary[]>('home-projects', () => mockProjects, async () => {
    const r = await api<ProjectListDto>('/projects', { query: { mine: true, status: 'ACTIVE', size: 20 } })
    return r.page.content.map((p) => ({
      id: p.projectKey,
      category: p.categoryName,
      code: p.projectKey,
      name: p.name,
      milestone: p.nextMilestone?.name ?? '열린 마일스톤 없음',
      progress: Math.round((p.nextMilestone?.progress.ratio ?? 0) * 100),
      members: p.memberPreview.map((m) => m.name),
      // 기록이 없는 새 프로젝트는 요약을 대신 보여 준다
      activity: p.recentActivity ? activityLine(p.recentActivity) : (p.summary ?? ''),
    }))
  })
}

/** 이번 주 일정 (오늘 ~ +6일) */
export function useHomeWeekEvents() {
  return useResource<WeekEvent[]>('home-week-events', () => mockWeekEvents, async () => {
    const today = todayKst()
    const occ = await api<OccurrencesDto>('/calendar-events', { query: { from: today, to: addDaysYmd(today, 6) } }).then((r) => r.occurrences)
    return occ.map((o) => {
      const day = o.allDay ? o.startsOn ?? kstYmd(o.startsAt) : kstYmd(o.startsAt)
      const when = `${day === today ? '오늘' : shortDay(day)} ${o.allDay ? '· 하루 종일' : kstHm(o.startsAt)}`
      return {
        id: `${o.eventId}@${o.occurrenceStartsAt}`,
        title: occTitle(o),
        meta: [when, o.location].filter(Boolean).join(' · '),
        scope: o.layer === 'SHARED' ? '공용' : '개인',
        color: o.layer === 'SHARED' ? o.color ?? 'var(--brand-400)' : 'var(--brand-200)',
      }
    })
  })
}

/** 최근 공지 5개 (고정 먼저, API 정렬 그대로) */
export function useHomeRecentNotices() {
  return useResource<HomeNotice[]>('home-recent-notices', () => mockRecentNotices, async () => {
    const r = await api<NoticeListDto>('/notices', { query: { size: 5 } })
    const pinnedIds = new Set(r.pinned.map((n) => n.noticeId))
    return [...r.pinned, ...r.page.content].slice(0, 5).map((n) => ({
      id: String(n.noticeId),
      title: n.title,
      meta: noticeMeta(n),
      pinned: pinnedIds.has(n.noticeId),
    }))
  })
}

/** GET /sso/apps 한 줄 (백엔드 MyAppResponse). code 는 공통코드 SSO_APP 의 상세 코드 (vault · jenkins · penpot) */
type SsoAppDto = { code: string; name: string; description: string | null; url: string | null; accessible: boolean }
const SERVICE_ICON_OF = (code: string): Service['icon'] => {
  const c = code.toLowerCase()
  if (c.includes('jenkins')) return 'jenkins'
  if (c.includes('vault')) return 'vault'
  if (c.includes('github')) return 'github'
  return 'penpot'
}

/** 서비스 바로 가기 (SSO 앱 + GitHub 연결) */
export function useHomeServices() {
  return useResource<Service[]>('home-services', () => mockServices, async () => {
    const [apps, me] = await Promise.all([api<SsoAppDto[]>('/sso/apps'), fetchMe()])
    const github = await api<{ githubLogin: string } | null>(`/github/accounts/${me.memberId}`).catch(() => undefined)
    const list: Service[] = apps.map((a) => ({
      name: a.name,
      desc: a.accessible ? a.description ?? '' : '권한 없음',
      icon: SERVICE_ICON_OF(a.code),
      enabled: a.accessible,
      url: a.url ?? undefined,
    }))
    if (github !== undefined) list.push({ name: 'GitHub', desc: github ? '연결됨' : '연결 안 됨', icon: 'github', enabled: true, url: github ? undefined : '/me' })
    return list
  })
}

/* ================= 알림 (NT-1 ~ NT-3) ================= */

type NotificationDto = {
  notificationId: number
  type: string
  title: string
  /** 종 메뉴용 짧은 문구 (제목 한 줄, 80자까지) */
  preview?: string
  body: string | null
  actorMemberId: number | null
  target: { type: string; id: string; url: string }
  groupCount: number
  readAt: string | null
  createdAt: string
  updatedAt: string
}

/** 화면 알림 한 줄. 실서버는 오래된 알림도 있어 day 가 '오늘' · '어제' 말고 날짜일 수 있다 */
export type NotiItem = Omit<Notification, 'day'> & { day: string }

/** 알림 종류 → 화면 아이콘 · 거르기 묶음 */
function notiType(t: string): NotiType {
  if (t === 'MENTIONED') return 'MENTION'
  if (t === 'TASK_ASSIGNED' || t === 'MINUTE_ACTION_ASSIGNED' || t === 'PROJECT_MEMBER_ADDED') return 'ASSIGN'
  // 정책 댓글은 프로젝트 묶음 (작업 · 스레드와 같이 거른다)
  if (t === 'TASK_WATCH' || t === 'TASK_DUE' || t === 'THREAD_REPLY' || t === 'POLICY_COMMENT') return 'TASK'
  if (t === 'NOTICE_MUST_READ' || t === 'NOTICE_COMMENT') return 'NOTICE'
  if (t === 'POLL_OPENED' || t === 'POLL_CLOSING') return 'VOTE'
  if (t.startsWith('MEETING_POLL_') || t.startsWith('EVENT_')) return 'CALENDAR'
  if (t.startsWith('REPORT_')) return 'REPORT'
  // 회계 장부: 먼저 낸 돈 돌려 달라는 요청 · 돌려받음 · 계좌 주인 넘겨받음
  if (t.startsWith('LEDGER_')) return 'LEDGER'
  return 'ACCESS'
}

function notiDay(iso: string) {
  const today = todayKst()
  const day = kstYmd(iso)
  if (day === today) return '오늘'
  if (day === addDaysYmd(today, -1)) return '어제'
  return shortDay(day)
}

/** target.url 이 이 앱 경로가 아닐 때 갈 화면 (대상 종류 → 목록 화면) */
const NOTI_FALLBACK: Record<string, string> = {
  NOTICE: '/',
  MEETING_POLL: '/calendar',
  EVENT: '/calendar',
  PROJECT: '/projects',
  TASK: '/projects',
  THREAD: '/projects',
  MINUTE: '/projects',
  POLICY: '/projects',
  LEDGER: '/ledger',
  REPORT: '/reports',
  ACCESS_REQUEST: '/admin/role-requests',
  SIGNUP_APPLICATION: '/admin/signups',
  MEMBER: '/members',
  VAULT_PATH_REQUEST: '/admin',
  JOB: '/admin',
}

/**
 * 알림 대상 → 화면 주소. 백엔드 target.url(NotificationLinkService)이 이 앱 경로를 주므로 그대로 쓴다.
 * 비었거나 앱 안 경로('/…')가 아니면 대상 종류의 목록 화면으로, 모르는 종류면 알림 화면으로
 */
function notiLink(n: NotificationDto) {
  const { type, url } = n.target
  if (url && url.startsWith('/') && !url.startsWith('//')) return url
  return NOTI_FALLBACK[type] ?? '/notifications'
}

const notiFromDto = (n: NotificationDto): NotiItem => ({
  id: n.notificationId,
  type: notiType(n.type),
  title: n.title,
  // 종 메뉴 한 줄: 서버가 제목을 한 줄 80자로 줄인 preview (예전 서버면 제목)
  short: n.preview || n.title,
  detail: n.body ?? '',
  ago: ago(n.updatedAt),
  day: notiDay(n.updatedAt),
  read: !!n.readAt,
  grouped: n.groupCount > 1 ? n.groupCount : undefined,
  to: notiLink(n),
})

export const mockNotiItems: NotiItem[] = mockNotifications

/** 알림 한 페이지 크기 (정책 ERP-P32 의 기본값) */
const NOTI_PAGE_SIZE = 20
/** 알림 목록의 한 페이지 (NT-1, 최신 순). 화면이 거르므로 필터 없이 받고, 끝에 닿으면 다음 page 를 이어 붙인다 */
export const fetchNotificationPage = (page: number) =>
  api<PageResponse<NotificationDto>>('/notifications', { query: { filter: 'ALL', page, size: NOTI_PAGE_SIZE } }).then((p) => ({
    items: p.content.map(notiFromDto),
    page: p.page,
    hasNext: p.hasNext,
  }))
/** 안 읽은 알림 수 (NT-2) */
export const fetchUnreadCount = () => api<{ count: number }>('/notifications/unread-count').then((r) => r.count)
/** 읽음 처리 (NT-3). ids 를 비우면 모두 읽음 */
export const postNotificationsRead = (ids?: number[]) =>
  api<{ updatedCount: number; unreadCount: number }>('/notifications/read', {
    method: 'POST',
    body: ids?.length ? { notificationIds: ids } : { filter: 'ALL' },
  })
