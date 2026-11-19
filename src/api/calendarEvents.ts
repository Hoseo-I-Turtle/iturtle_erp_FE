// 일정 추가 · 고치기 (CL-2 · CL-3 · CL-4) 와 겹치는 일정 (CL-12).
// 디자인: 06 Screens · 추가 › Screen · 일정 추가
import { useEffect } from 'react'
import { getDataMode } from '../lib/dataMode'
import { members as mockMembers } from '../mocks/members'
import { projects as mockProjects } from '../mocks/projects'
import { api } from './client'
import type { MemberRef, PageResponse } from './types'
import { useResource } from './useResource'

// ───────────────────────── 창 열기 · 바뀜 알림 ─────────────────────────

const OPEN = 'iturtle:event-editor'
const CHANGED = 'iturtle:events-changed'

/** 새 일정이면 date(YYYY-MM-DD) · projectId, 고치기면 eventId(+ 반복 회차 occurrence) */
export type EventEditorOpen = { date?: string; projectId?: number | null; eventId?: number; occurrence?: string | null }

export const openEventEditor = (detail: EventEditorOpen = {}) => window.dispatchEvent(new CustomEvent<EventEditorOpen>(OPEN, { detail }))

export function useEventEditorRequests(open: (d: EventEditorOpen) => void) {
  useEffect(() => {
    const on = (e: Event) => open((e as CustomEvent<EventEditorOpen>).detail ?? {})
    window.addEventListener(OPEN, on)
    return () => window.removeEventListener(OPEN, on)
  }, [open])
}

export const notifyEventsChanged = () => window.dispatchEvent(new Event(CHANGED))

/** 일정이 바뀌면 reload 를 부른다 */
export function useEventsChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGED, reload)
    return () => window.removeEventListener(CHANGED, reload)
  }, [reload])
}

/** 캘린더 칸의 일정 id (`${eventId}@${occurrenceStartsAt}`, 하루 종일이면 뒤에 `#날짜`) → 고치기 창 인자 */
export function eventRefOf(id: string): { eventId: number; occurrence: string } | null {
  const m = /^(\d+)@([^#]+)/.exec(id)
  return m ? { eventId: Number(m[1]), occurrence: m[2] } : null
}

// ───────────────────────── 고를 거리 ─────────────────────────

export type EventAudience = 'ALL' | 'PROJECT' | 'SELECTED'
export type ShareMode = 'NONE' | 'TITLE' | 'BUSY'
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type Option = { id: number; name: string }
export type ProjectOption = Option & { key: string }
/** 공통코드 CALENDAR_EVENT_TYPE (GET /codes/CALENDAR_EVENT_TYPE) */
export type EventTypeOption = { code: string; name: string; icon: string | null }
export type EventFormOptions = { me: Option; members: Option[]; projects: ProjectOption[]; types: EventTypeOption[] }

type MemberListDto = { page: PageResponse<MemberRef> }
type ProjectListDto = { page: PageResponse<{ projectKey: string; projectId: number; name: string }> }

const MOCK_TYPES: EventTypeOption[] = [
  { code: 'MEETING', name: '회의', icon: null },
  { code: 'SEMINAR', name: '세미나', icon: null },
  { code: 'DEADLINE', name: '마감', icon: null },
  { code: 'LEAVE', name: '휴가', icon: null },
]

export function useEventFormOptions() {
  return useResource<EventFormOptions>(
    'event-form',
    () => {
      const members = mockMembers.filter((m) => m.status === 'ACTIVE').map((m) => ({ id: m.memberId, name: m.name }))
      return {
        me: members.find((m) => m.name === '김민서') ?? members[0],
        members,
        projects: mockProjects.map((p, i) => ({ id: i + 1, key: p.projectKey, name: p.name })),
        types: MOCK_TYPES,
      }
    },
    async () => {
      const [me, list, projects, types] = await Promise.all([
        api<MemberRef>('/members/me'),
        api<MemberListDto>('/members', { query: { group: 'ACTIVE', size: 100 } }),
        api<ProjectListDto>('/projects', { query: { mine: true, size: 100 } }),
        api<EventTypeOption[]>('/codes/CALENDAR_EVENT_TYPE'),
      ])
      return {
        me: { id: me.memberId, name: me.name },
        members: list.page.content.map((m) => ({ id: m.memberId, name: m.name })),
        projects: projects.page.content.map((p) => ({ id: p.projectId, key: p.projectKey, name: p.name })),
        types,
      }
    },
  )
}

// ───────────────────────── 창의 내용 ─────────────────────────

export type EventForm = {
  calendarType: 'SHARED' | 'PERSONAL'
  eventTypeCode: string | null
  title: string
  description: string
  location: string
  onlineUrl: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  recurrence: Recurrence
  audience: EventAudience
  attendeeIds: number[]
  projectId: number | null
  reminderMinutes: number | null
  shareMode: ShareMode
}

/** 고치는 일정의 서버 값 */
export type EventDetail = {
  eventId: number
  occurrence: string | null
  recurring: boolean
  canEdit: boolean
  owner: string
  form: EventForm
}

type RecurrenceDto = { freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'; byDay: string[] | null; byMonthDay: number | null; until: string | null; count: number | null }
type EventDetailDto = {
  eventId: number
  calendarType: 'SHARED' | 'PERSONAL'
  eventTypeCode: string | null
  title: string
  description: string | null
  location: string | null
  onlineUrl: string | null
  allDay: boolean
  startsAt: string
  endsAt: string
  startsOn?: string
  endsOn?: string
  occurrenceStartsAt: string | null
  recurrence: RecurrenceDto | null
  shareMode: ShareMode | null
  attendees: MemberRef[] | null
  projectId: number | null
  audience?: EventAudience
  reminderMinutes: number | null
  owner: MemberRef
  canEdit: boolean
}

const KST = 'Asia/Seoul'
const kstDate = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: KST })
const kstTime = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { timeZone: KST, hour: '2-digit', minute: '2-digit' })
/** 'YYYY-MM-DD' + 'HH:mm' (한국 시간) → ISO */
export const kstIso = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString()
const WEEKDAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** 새 일정의 처음 값: 오늘이면 다음 정시(9시 ~ 22시 사이), 다른 날이면 10시부터 한 시간 */
export function emptyEventForm(date: string, projectId: number | null, now = new Date()): EventForm {
  const today = now.toLocaleDateString('sv-SE', { timeZone: KST })
  const hour = date === today ? Math.min(Math.max(Number(kstTime(now.toISOString()).slice(0, 2)) + 1, 9), 22) : 10
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
  return {
    calendarType: 'SHARED',
    eventTypeCode: null,
    title: '',
    description: '',
    location: '',
    onlineUrl: '',
    allDay: false,
    startDate: date,
    startTime: hh(hour),
    endDate: date,
    endTime: hh(hour + 1),
    recurrence: 'NONE',
    audience: projectId ? 'PROJECT' : 'ALL',
    attendeeIds: [],
    projectId,
    reminderMinutes: 10,
    shareMode: 'BUSY',
  }
}

function fromDetail(d: EventDetailDto): EventForm {
  return {
    calendarType: d.calendarType,
    eventTypeCode: d.eventTypeCode,
    title: d.title,
    description: d.description ?? '',
    location: d.location ?? '',
    onlineUrl: d.onlineUrl ?? '',
    allDay: d.allDay,
    startDate: d.allDay && d.startsOn ? d.startsOn : kstDate(d.startsAt),
    startTime: d.allDay ? '10:00' : kstTime(d.startsAt),
    endDate: d.allDay && d.endsOn ? d.endsOn : kstDate(d.endsAt),
    endTime: d.allDay ? '11:00' : kstTime(d.endsAt),
    recurrence: d.recurrence?.freq ?? 'NONE',
    audience: d.audience ?? 'SELECTED',
    attendeeIds: (d.attendees ?? []).map((a) => a.memberId),
    projectId: d.projectId,
    reminderMinutes: d.reminderMinutes,
    shareMode: d.shareMode ?? 'BUSY',
  }
}

export async function fetchEventDetail(eventId: number, occurrence: string | null): Promise<EventDetail> {
  const d = await api<EventDetailDto>(`/calendar-events/${eventId}`, { query: occurrence ? { occurrence } : {} })
  return {
    eventId: d.eventId,
    occurrence: d.recurrence ? (d.occurrenceStartsAt ?? occurrence) : null,
    recurring: !!d.recurrence,
    canEdit: d.canEdit,
    owner: d.owner.name,
    form: fromDetail(d),
  }
}

const recurrenceBody = (f: EventForm) =>
  f.recurrence === 'NONE'
    ? null
    : {
        freq: f.recurrence,
        byDay: f.recurrence === 'WEEKLY' ? [WEEKDAY_CODE[new Date(`${f.startDate}T12:00:00+09:00`).getUTCDay()]] : null,
        byMonthDay: f.recurrence === 'MONTHLY' ? Number(f.startDate.slice(8, 10)) : null,
        until: null,
        count: null,
      }

const timeBody = (f: EventForm) =>
  f.allDay
    ? { allDay: true, startsOn: f.startDate, endsOn: f.endDate, startsAt: null, endsAt: null }
    : { allDay: false, startsAt: kstIso(f.startDate, f.startTime), endsAt: kstIso(f.endDate, f.endTime), startsOn: null, endsOn: null }

/** 만들기 본문 (CL-3) */
function createBody(f: EventForm) {
  const shared = f.calendarType === 'SHARED'
  return {
    calendarType: f.calendarType,
    eventTypeCode: shared ? f.eventTypeCode : null,
    title: f.title.trim(),
    description: f.description.trim() || null,
    location: f.location.trim() || null,
    onlineUrl: f.onlineUrl.trim() || null,
    ...timeBody(f),
    recurrence: recurrenceBody(f),
    shareMode: shared ? null : f.shareMode,
    attendeeIds: shared && f.audience === 'SELECTED' ? f.attendeeIds : shared ? [] : null,
    projectId: shared ? f.projectId : null,
    audience: shared ? f.audience : null,
    reminderMinutes: f.reminderMinutes,
  }
}

export type EditScope = 'THIS' | 'FOLLOWING' | 'ALL'

/** 고치기 본문 (CL-4): 바뀐 칸만. "이 일정만"(THIS)은 제목 · 시각 · 장소만 */
function patchBody(before: EventForm, f: EventForm, scope: EditScope | null) {
  const full = createBody(f)
  const old = createBody(before)
  const body: Record<string, unknown> = {}
  const timeChanged = (['allDay', 'startDate', 'startTime', 'endDate', 'endTime'] as const).some((k) => before[k] !== f[k])
  const keys = scope === 'THIS' ? (['title', 'location'] as const) : (Object.keys(full) as (keyof typeof full)[])
  for (const k of keys) {
    if (k === 'calendarType' || k in timeBody(f)) continue
    if (JSON.stringify(full[k]) !== JSON.stringify(old[k])) body[k] = full[k]
  }
  if (timeChanged) Object.assign(body, timeBody(f))
  // 반복은 바꿨을 때만 (그대로면 서버의 until · count 를 지키게 보내지 않는다)
  if (scope !== 'THIS' && before.recurrence === f.recurrence) delete body.recurrence
  // 직접 고른 사람을 바꿨으면 참석자도 보낸다
  if (scope !== 'THIS' && f.audience === 'SELECTED' && JSON.stringify(before.attendeeIds) !== JSON.stringify(f.attendeeIds)) body.attendeeIds = f.attendeeIds
  return body
}

/** 만들기 · 고치기. 목업 모드면 저장하지 않는다 */
export async function saveEvent(f: EventForm, edit: { detail: EventDetail; scope: EditScope | null } | null): Promise<void> {
  if (getDataMode() !== 'live') return
  if (!edit) {
    await api('/calendar-events', { method: 'POST', body: createBody(f) })
    return
  }
  const { detail, scope } = edit
  const query: Record<string, string> = {}
  if (detail.recurring && scope) query.scope = scope
  if (detail.recurring && scope !== 'ALL' && detail.occurrence) query.occurrence = detail.occurrence
  await api(`/calendar-events/${detail.eventId}`, { method: 'PATCH', query, body: patchBody(detail.form, f, detail.recurring ? scope : null) })
}

/**
 * 지우기 (CL-5). 반복 일정이면 범위(THIS 그 회차 · FOLLOWING 이후 모두 · ALL 전부)와 그 회차 시각을 보낸다.
 * 공용 일정이면 참석자에게 취소 알림이 간다 (서버 규칙). 목업 모드면 보내지 않는다
 */
export async function deleteEvent(detail: EventDetail, scope: EditScope | null): Promise<void> {
  if (getDataMode() !== 'live') return
  const query: Record<string, string> = {}
  if (detail.recurring && scope) query.scope = scope
  if (detail.recurring && scope !== 'ALL' && detail.occurrence) query.occurrence = detail.occurrence
  await api(`/calendar-events/${detail.eventId}`, { method: 'DELETE', query })
}

// ───────────────────────── 겹치는 일정 (CL-12) ─────────────────────────

export type Conflict = { member: string; title: string | null; busyOnly: boolean; time: string }
type ConflictDto = { member: MemberRef; title: string | null; busyOnly: boolean; allDay: boolean; startsAt: string; endsAt: string }

/** 그 시간에 고른 사람(비면 나)이 참석하거나 주인인 일정. 목업이면 없음 */
export type EventSpan = Pick<EventForm, 'allDay' | 'startDate' | 'startTime' | 'endDate' | 'endTime'>

export async function fetchConflicts(f: EventSpan, memberIds: number[], excludeEventId: number | null): Promise<Conflict[]> {
  if (getDataMode() !== 'live') return []
  const startsAt = f.allDay ? kstIso(f.startDate, '00:00') : kstIso(f.startDate, f.startTime)
  const endsAt = f.allDay ? new Date(Date.parse(kstIso(f.endDate, '00:00')) + 86_400_000).toISOString() : kstIso(f.endDate, f.endTime)
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return []
  const r = await api<{ conflicts: ConflictDto[] }>('/calendar-events/conflicts', {
    query: { startsAt, endsAt, memberIds: memberIds.join(','), ...(excludeEventId ? { excludeEventId } : {}) },
  })
  return r.conflicts.map((c) => ({
    member: c.member.name,
    title: c.title,
    busyOnly: c.busyOnly,
    time: c.allDay ? '하루 종일' : `${kstTime(c.startsAt)}–${kstTime(c.endsAt)}`,
  }))
}
