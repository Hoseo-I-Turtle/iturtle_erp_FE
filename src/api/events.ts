// 일정 추가 · 모임 날짜 만들기 — docs/api/20-communication.md CL-3, MP-1, MP-2
import { api } from './client'
import type { MemberRef, PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { dday, kstInstant, kstYmd, shortDay, shortDayTime } from './communication'
import { getProject, MOCK_ME } from './projects'
import { events as mockEvents, type EventKind } from '../mocks/calendar'
import { members as mockMembers } from '../mocks/members'

/* ---------- 일정 추가 (CL-3) ---------- */

/** 화면의 종류 → 공통코드 CALENDAR_EVENT_TYPE. personal 은 개인 일정 */
export type EventKindChoice = Exclude<EventKind, 'off'> | 'personal'
// 명세 확인 필요: CALENDAR_EVENT_TYPE 의 실제 상세 코드. 화면 이름을 그대로 대문자로 보낸다
const TYPE_CODE: Record<Exclude<EventKindChoice, 'personal'>, string> = { meeting: 'MEETING', seminar: 'SEMINAR', deadline: 'DEADLINE', event: 'EVENT', conference: 'CONFERENCE' }

export type EventDraft = {
  title: string
  kind: EventKindChoice
  allDay: boolean
  /** 'YYYY-MM-DD', 'HH:mm' */
  startDay: string
  startTime: string
  endDay: string
  endTime: string
  repeat: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  repeatUntil: string
  location: string
  onlineUrl: string
  /** 비어 있으면 참석자를 정하지 않는다 (공용 일정은 모두에게 보인다) */
  attendeeIds: number[]
  projectKey: string
  shareMode: 'NONE' | 'TITLE' | 'BUSY'
  description: string
}

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))
const BY_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** 일정 만들기 (CL-3) */
export async function createEvent(d: EventDraft, isLive: boolean) {
  const personal = d.kind === 'personal'
  if (isLive) {
    const start = new Date(`${d.startDay}T00:00:00`)
    const projectId = !personal && d.projectKey ? (await getProject(d.projectKey)).projectId : null
    await api('/calendar-events', {
      method: 'POST',
      body: {
        calendarType: personal ? 'PERSONAL' : 'SHARED',
        eventTypeCode: personal ? undefined : TYPE_CODE[d.kind as Exclude<EventKindChoice, 'personal'>],
        title: d.title,
        description: d.description || null,
        location: d.location || null,
        onlineUrl: d.onlineUrl || null,
        allDay: d.allDay,
        ...(d.allDay ? { startsOn: d.startDay, endsOn: d.endDay } : { startsAt: kstInstant(d.startDay, toMin(d.startTime)), endsAt: kstInstant(d.endDay, toMin(d.endTime)) }),
        recurrence:
          d.repeat === 'NONE'
            ? null
            : {
                freq: d.repeat,
                byDay: d.repeat === 'WEEKLY' ? [BY_DAY[start.getDay()]] : undefined,
                byMonthDay: d.repeat === 'MONTHLY' ? start.getDate() : undefined,
                until: d.repeatUntil,
              },
        shareMode: personal ? d.shareMode : undefined,
        attendeeIds: personal ? undefined : d.attendeeIds,
        projectId: personal ? undefined : projectId,
      },
    })
  } else {
    mockEvents.push({
      id: `new-${mockEvents.length + 1}`,
      date: d.startDay,
      title: d.title,
      time: d.allDay ? undefined : d.startTime,
      kind: personal ? 'off' : (d.kind as EventKind),
      layer: personal ? 'personal' : 'public',
      place: d.location || undefined,
      attendees: personal ? undefined : d.attendeeIds.length || undefined,
      mine: true,
      note: personal && d.shareMode !== 'NONE' ? (d.shareMode === 'BUSY' ? '바쁨으로 공유' : '제목 공개') : undefined,
    })
  }
  invalidateAll()
}

/** 대상 · 참석자 고르기에 쓰는 재실 구성원 (M 2-1) */
export type ActiveMember = { id: number; name: string; type: MemberRef['memberType'] }
export function useActiveMembers() {
  return useResource<{ members: ActiveMember[]; meId: number }>(
    'active-members',
    () => ({
      members: mockMembers.filter((m) => m.status === 'ACTIVE').map((m) => ({ id: m.memberId, name: m.name, type: m.memberType })),
      meId: mockMembers.find((m) => m.name === MOCK_ME)?.memberId ?? 0,
    }),
    async () => {
      const [r, me] = await Promise.all([
        api<{ page: PageResponse<MemberRef> }>('/members', { query: { group: 'ACTIVE', size: 100 } }),
        api<MemberRef>('/members/me'),
      ])
      return { members: r.page.content.map((m) => ({ id: m.memberId, name: m.name, type: m.memberType })), meId: me.memberId }
    },
  )
}

/* ---------- 모임 날짜 정하기 만들기 · 목록 (MP-1, MP-2) ---------- */

export type PollDraft = {
  title: string
  description: string
  candidateDates: string[]
  dayStartTime: string
  dayEndTime: string
  slotMinutes: 30 | 60
  durationMinutes: number
  location: string
  onlineUrl: string
  /** 응답 마감 'YYYY-MM-DD', 'HH:mm' */
  closesDay: string
  closesTime: string
  all: boolean
  memberTypes: MemberRef['memberType'][]
  memberIds: number[]
}

export type PollListItem = {
  pollId: number
  title: string
  creator: string
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED'
  /** '11/24(화) 18:00' */
  closes: string
  dday: string
  targetCount: number
  respondedCount: number
  state: 'todo' | 'done' | 'mine' | 'view'
  confirmed: string | null
}

type PollSummaryDto = {
  pollId: number
  title: string
  creator: MemberRef
  status: 'OPEN' | 'CONFIRMED' | 'CANCELLED'
  closesAt: string
  targetCount: number
  respondedCount: number
  iAmTarget: boolean
  iResponded: boolean
  confirmedStartsAt: string | null
}

const mockPolls: PollListItem[] = [
  { pollId: 9, title: 'DEFME 중간 점검 회의 시간 정하기', creator: '박지훈', status: 'OPEN', closes: '11/19(목) 18:00', dday: 'D-2', targetCount: 8, respondedCount: 5, state: 'todo', confirmed: null },
  { pollId: 8, title: '11월 기술 세미나 날짜', creator: '이정훈', status: 'OPEN', closes: '11/25(수) 12:00', dday: 'D-5', targetCount: 11, respondedCount: 7, state: 'done', confirmed: null },
  { pollId: 7, title: '연말 워크숍', creator: '김민서', status: 'OPEN', closes: '11/30(월) 18:00', dday: 'D-10', targetCount: 11, respondedCount: 4, state: 'mine', confirmed: null },
  { pollId: 6, title: 'SENS 현장 방문 일정', creator: '이정훈', status: 'CONFIRMED', closes: '11/10(화) 12:00', dday: '마감', targetCount: 4, respondedCount: 4, state: 'done', confirmed: '11/13(금) 14:00' },
]

/** 내가 대상이거나 만든 모임 날짜 정하기 (MP-2) */
export function useMeetingPollList(status: PollListItem['status']) {
  return useResource<PollListItem[]>(
    ['meeting-polls', status],
    () => mockPolls.filter((p) => p.status === status),
    async () => {
      const [page, me] = await Promise.all([api<PageResponse<PollSummaryDto>>('/meeting-polls', { query: { status, size: 20 } }), api<MemberRef>('/members/me')])
      return page.content.map((p) => ({
        pollId: p.pollId,
        title: p.title,
        creator: p.creator.name,
        status: p.status,
        closes: shortDayTime(p.closesAt),
        dday: dday(p.closesAt),
        targetCount: p.targetCount,
        respondedCount: p.respondedCount,
        state: p.creator.memberId === me.memberId ? 'mine' : !p.iAmTarget ? 'view' : p.iResponded ? 'done' : 'todo',
        confirmed: p.confirmedStartsAt ? shortDayTime(p.confirmedStartsAt) : null,
      }))
    },
  )
}

/** 모임 날짜 정하기 만들기 (MP-1). 만든 번호를 돌려준다 */
export async function createMeetingPoll(d: PollDraft, isLive: boolean, targetCount: number) {
  let id: number
  if (isLive) {
    const made = await api<{ pollId: number }>('/meeting-polls', {
      method: 'POST',
      body: {
        title: d.title,
        description: d.description || null,
        candidateDates: [...d.candidateDates].sort(),
        dayStartTime: d.dayStartTime,
        dayEndTime: d.dayEndTime,
        slotMinutes: d.slotMinutes,
        durationMinutes: d.durationMinutes,
        location: d.location || null,
        onlineUrl: d.onlineUrl || null,
        closesAt: kstInstant(d.closesDay, toMin(d.closesTime)),
        targets: { all: d.all, memberTypes: d.all ? [] : d.memberTypes, memberIds: d.all ? [] : d.memberIds },
      },
    })
    id = made.pollId
  } else {
    id = Math.max(...mockPolls.map((p) => p.pollId)) + 1
    const closesAt = kstInstant(d.closesDay, toMin(d.closesTime))
    mockPolls.unshift({
      pollId: id,
      title: d.title,
      creator: MOCK_ME,
      status: 'OPEN',
      closes: `${shortDay(kstYmd(closesAt))} ${d.closesTime}`,
      dday: dday(closesAt),
      targetCount,
      respondedCount: 0,
      state: 'mine',
      confirmed: null,
    })
  }
  invalidateAll()
  return id
}
