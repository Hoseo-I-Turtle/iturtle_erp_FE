// 회의록 목록 · 쓰기 · 나에게 온 할 일 (docs/api/32-minute-report.md MM-1 · MM-2 · MM-3 · MM-4 · MM-9 ~ MM-12)
// 회의록 하나를 보는 화면(MM-3 · MM-6 · MM-8)은 content.ts 의 useMinute 를 그대로 쓴다.
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { useResource, whenLive } from './useResource'
import { appendUnique, mergeNext, NOT_PAGED, pagedOf, type Paged } from './useLoadMore'
import { getProject, toMembers } from './projects'
import { projectDetail } from '../mocks/projectDetail'
import { minuteRows, myMinuteActions, type MinuteRow, type MyMinuteAction } from '../mocks/minuteList'

export type { MinuteRow, MyMinuteAction }

const KST_MS = 9 * 60 * 60 * 1000
const WEEKDAY = '일월화수목금토'
const pad = (n: number) => String(n).padStart(2, '0')
const kst = (iso: string) => new Date(new Date(iso).getTime() + KST_MS)
const hm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
/** 오늘(KST) 'YYYY-MM-DD' 에서 days 만큼 */
const kstDay = (days = 0) => new Date(Date.now() + KST_MS + days * 86_400_000).toISOString().slice(0, 10)
/** 'YYYY-MM-DD' + 'HH:MM' (KST) → ISO 시각 */
export const kstIso = (day: string, time: string) => new Date(`${day}T${time}:00+09:00`).toISOString()
/** ISO 시각 → KST 'YYYY-MM-DD' · 'HH:MM' */
export const kstParts = (iso: string) => {
  const d = kst(iso)
  return { day: d.toISOString().slice(0, 10), time: hm(d) }
}

/* ---------------- 서버 모양 ---------------- */

type ProjectRef = { projectKey: string; name: string }
type TaskRefDto = { taskId?: number; taskKey: string; title: string; status: string }

/** MinuteSummaryResponse (MM-1) */
export type MinuteSummaryDto = {
  minuteId: number
  title: string
  startsAt: string
  endsAt: string
  project: ProjectRef | null
  author: MemberRef
  attendeeCount: number
  actionCount: number
  convertedTaskCount: number
  doneActionCount: number
  location: string | null
  online: boolean
  attendees: MemberRef[]
  draft: boolean
  publishedAt: string | null
  updatedAt: string
}

type MinuteActionDto = {
  actionId: number
  content: string
  assignee: MemberRef | null
  dueOn: string | null
  done: boolean
  convertRequested: boolean
  task: TaskRefDto | null
  displayOrder: number
}

/** MinuteDetailResponse (MM-3) — 쓰기 화면이 쓰는 칸만 */
type MinuteDetailDto = {
  minuteId: number
  project: ProjectRef | null
  title: string
  startsAt: string
  endsAt: string
  location: string | null
  onlineUrl: string | null
  templateCode: string | null
  calendarEvent: { eventId: number; title: string } | null
  attendees: { member: MemberRef; attended: boolean }[]
  agenda: string | null
  discussion: string | null
  decisions: string | null
  actions: MinuteActionDto[]
  attachments: { publicId: string }[]
  version: number
  draft: boolean
  updatedAt: string
  permissions: { edit: boolean; delete: boolean; convertActions: boolean }
}

/** MyMinuteActionResponse (MM-11) */
type MyMinuteActionDto = {
  actionId: number
  content: string
  dueOn: string | null
  minuteId: number
  minuteTitle: string
  minuteStartsAt: string
  project: ProjectRef | null
  task: TaskRefDto | null
}

/** MinuteEventPrefillResponse (MM-12) */
type MinuteEventPrefillDto = {
  eventId: number
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location: string | null
  onlineUrl: string | null
  project: ProjectRef | null
  attendees: MemberRef[]
  existingMinuteId: number | null
}

/** calendar OccurrenceResponse 의 쓰는 칸 (CE-1, 공용 일정 고르기) */
type OccurrenceDto = { eventId: number; title?: string; busyOnly: boolean; allDay: boolean; startsAt: string; startsOn?: string }

/* ---------------- 목록 (MM-1) ---------------- */

export type MinutePeriod = 'm3' | 'm6' | 'all'
export type MinuteFilter = { keyword: string; period: MinutePeriod; attendeeId: number | null }
export type MinuteRowsData = { rows: MinuteRow[]; total: number } & Paged

/** 회의록 목록 한 페이지 크기 (정책 ERP-P32 의 기본값) */
const MINUTE_PAGE_SIZE = 20

const minuteListQuery = (projectKey: string, f: MinuteFilter, page: number) => {
  const days = PERIOD_DAYS[f.period]
  const kw = f.keyword.trim()
  return {
    projectKey,
    keyword: kw.length >= 2 ? kw : undefined,
    from: days === null ? undefined : kstDay(-days),
    attendeeId: f.attendeeId ?? undefined,
    page,
    size: MINUTE_PAGE_SIZE,
  }
}

/** 회의록 목록의 다음 페이지 (useLoadMore 에 넘긴다) */
export const fetchMoreMinutes = (projectKey: string, f: MinuteFilter, d: MinuteRowsData) =>
  api<PageResponse<MinuteSummaryDto>>('/meeting-minutes', { query: minuteListQuery(projectKey, f, d.page + 1) }).then((p) =>
    mergeNext(d, (cur) => ({ ...cur, rows: appendUnique(cur.rows, p.content.map(toRow), (r) => r.minuteId), total: p.totalElements, ...pagedOf(p) })),
  )

const PERIOD_DAYS: Record<MinutePeriod, number | null> = { m3: 92, m6: 183, all: null }

function toRow(m: MinuteSummaryDto): MinuteRow {
  const s = kst(m.startsAt)
  const e = kst(m.endsAt)
  const published = m.publishedAt ? new Date(m.publishedAt).getTime() : 0
  return {
    minuteId: m.minuteId,
    title: m.title,
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    weekday: WEEKDAY[s.getUTCDay()],
    time: `${hm(s)}–${hm(e)}`,
    place: m.location ?? (m.online ? '온라인' : ''),
    attendees: m.attendees.map((a) => a.name),
    attendeeCount: m.attendeeCount,
    actionTotal: m.actionCount,
    actionDone: m.doneActionCount,
    converted: m.convertedTaskCount,
    author: m.author.name,
    edited: `수정 ${ago(m.updatedAt)}`,
    draft: m.draft,
    // 게시한 지 하루 안이면 "새 글"
    isNew: !m.draft && published > 0 && Date.now() - published < 86_400_000,
  }
}

/** 이 프로젝트 회의록 목록 — 검색 · 기간 · 참석자. 첫 페이지만 받고, 목록 끝에 닿으면 fetchMoreMinutes 가 이어 붙인다 */
export function useMinuteRows(projectKey: string, f: MinuteFilter) {
  return useResource<MinuteRowsData>(
    ['minute-rows', projectKey, f],
    () => {
      const kw = f.keyword.trim()
      const rows = minuteRows.filter((r) => !kw || r.title.includes(kw) || r.attendees.some((a) => a.includes(kw)))
      return { rows, total: rows.length, ...NOT_PAGED }
    },
    async () => {
      const page = await api<PageResponse<MinuteSummaryDto>>('/meeting-minutes', { query: minuteListQuery(projectKey, f, 0) })
      return { rows: page.content.map(toRow), total: page.totalElements, ...pagedOf(page) }
    },
  )
}

/* ---------------- 나에게 온 할 일 (MM-11 · MM-9) ---------------- */

function toMyAction(a: MyMinuteActionDto): MyMinuteAction {
  const s = kst(a.minuteStartsAt)
  return {
    actionId: a.actionId,
    minuteId: a.minuteId,
    content: a.content,
    minuteTitle: a.minuteTitle || `${s.getUTCMonth() + 1}/${s.getUTCDate()} 회의`,
    due: a.dueOn ? `~${Number(a.dueOn.slice(5, 7))}/${Number(a.dueOn.slice(8, 10))}` : '',
    overdue: !!a.dueOn && a.dueOn < kstDay(),
    lab: a.project === null,
    projectKey: a.project?.projectKey ?? null,
    taskKey: a.task?.taskKey ?? null,
  }
}

export function useMyMinuteActions() {
  return useResource<MyMinuteAction[]>(['my-minute-actions'], () => myMinuteActions, async () =>
    (await api<MyMinuteActionDto[]>('/meeting-minutes/actions/mine')).map(toMyAction),
  )
}

/** MM-9 연구실 회의 할 일 체크 (프로젝트 회의 할 일은 작업으로 관리 — P214) */
export const checkMinuteAction = (minuteId: number, actionId: number, done: boolean) =>
  whenLive(() => api(`/meeting-minutes/${minuteId}/actions/${actionId}`, { method: 'PATCH', body: { done } }))

/* ---------------- 쓰기 (MM-2 · MM-4 · MM-10 · MM-12) ---------------- */

export type MemberOption = { id: number; name: string }
export type EventOption = { eventId: number; label: string }
export type MinuteFormAction = {
  /** 화면 안 키 */
  key: string
  actionId: number | null
  content: string
  assigneeId: number | null
  /** 'YYYY-MM-DD' 또는 '' */
  dueOn: string
  done: boolean
  convertToTask: boolean
  /** 이미 작업이 됐으면 그 작업 키 (토글을 잠근다) */
  taskKey: string | null
}
export type MinuteForm = {
  minuteId: number | null
  version: number | null
  /** 서버에 임시 저장으로 있는지 (게시 전) */
  savedDraft: boolean
  title: string
  day: string
  start: string
  end: string
  location: string
  onlineUrl: string
  calendarEventId: number | null
  attendees: { memberId: number; name: string; attended: boolean }[]
  agenda: string
  discussion: string
  decisions: string
  actions: MinuteFormAction[]
  /** 고치지 않는 값 (그대로 돌려보낸다) */
  templateCode: string | null
  attachmentFileIds: string[]
}
export type MinuteFormData = {
  form: MinuteForm
  members: MemberOption[]
  me: MemberOption
  events: EventOption[]
  canConvert: boolean
}

let actionSeq = 0
export const newAction = (): MinuteFormAction => ({
  key: `new-${++actionSeq}`,
  actionId: null,
  content: '',
  assigneeId: null,
  dueOn: '',
  done: false,
  convertToTask: true,
  taskKey: null,
})

const blankForm = (me: MemberOption): MinuteForm => ({
  minuteId: null,
  version: null,
  savedDraft: false,
  title: '',
  day: kstDay(),
  start: '14:00',
  end: '15:00',
  location: '',
  onlineUrl: '',
  calendarEventId: null,
  attendees: [{ memberId: me.id, name: me.name, attended: true }],
  agenda: '',
  discussion: '',
  decisions: '',
  actions: [],
  templateCode: null,
  attachmentFileIds: [],
})

function fromDetail(d: MinuteDetailDto): MinuteForm {
  const s = kstParts(d.startsAt)
  const e = kstParts(d.endsAt)
  return {
    minuteId: d.minuteId,
    version: d.version,
    savedDraft: d.draft,
    title: d.title,
    day: s.day,
    start: s.time,
    end: e.time,
    location: d.location ?? '',
    onlineUrl: d.onlineUrl ?? '',
    calendarEventId: d.calendarEvent?.eventId ?? null,
    attendees: d.attendees.map((a) => ({ memberId: a.member.memberId, name: a.member.name, attended: a.attended })),
    agenda: d.agenda ?? '',
    discussion: d.discussion ?? '',
    decisions: d.decisions ?? '',
    actions: [...d.actions]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((a) => ({
        key: `a-${a.actionId}`,
        actionId: a.actionId,
        content: a.content,
        assigneeId: a.assignee?.memberId ?? null,
        dueOn: a.dueOn ?? '',
        done: a.done,
        convertToTask: a.convertRequested || a.task !== null,
        taskKey: a.task?.taskKey ?? null,
      })),
    templateCode: d.templateCode,
    attachmentFileIds: d.attachments.map((f) => f.publicId),
  }
}

const mockMembers: MemberOption[] = projectDetail.members.map((m, i) => ({ id: i + 1, name: m.name }))
const mockEvents: EventOption[] = [
  { eventId: 901, label: '11/19 주간 회의 (캘린더)' },
  { eventId: 902, label: '11/27 기술 세미나 (캘린더)' },
]

function mockForm(minuteId: number | null): MinuteForm {
  const me = mockMembers[0]
  if (minuteId === null) return blankForm(me)
  return {
    ...blankForm(me),
    minuteId,
    version: 3,
    title: '11/17 주간 회의',
    day: '2026-11-17',
    location: '세미나실',
    attendees: mockMembers.slice(0, 4).map((m) => ({ memberId: m.id, name: m.name, attended: true })),
    agenda: '- v1.2 범위 확정 (공지 · 캘린더)\n- SSO 5단계 마무리와 Penpot 이관 남은 2명',
    discussion: '- 공지 투표는 공지 하나에 하나만 붙이기로 함',
    decisions: '- v1.2 마감은 12/1 로 유지',
    actions: [
      { key: 'a-1', actionId: 1, content: 'Penpot 남은 2명 계정 이관', assigneeId: 2, dueOn: '2026-11-21', done: false, convertToTask: true, taskKey: 'DEFME-50' },
      { key: 'a-3', actionId: 3, content: '공지 투표 UI 시안 정리', assigneeId: 1, dueOn: '2026-11-20', done: false, convertToTask: false, taskKey: null },
    ],
  }
}

/**
 * 쓰기 화면 데이터: 참여자(참석자 · 담당 고르기), 나, 고를 수 있는 공용 일정(앞뒤 한 달), 고칠 회의록.
 * 연구실 회의가 아니라 프로젝트 회의록만 쓴다 (프로젝트 탭 안 화면).
 */
export function useMinuteForm(projectKey: string, minuteId: number | null) {
  return useResource<MinuteFormData>(
    ['minute-form', projectKey, minuteId],
    () => ({ form: mockForm(minuteId), members: mockMembers, me: mockMembers[0], events: mockEvents, canConvert: true }),
    async () => {
      const [project, meRef, detail] = await Promise.all([
        getProject(projectKey),
        api<MemberRef>('/members/me'),
        minuteId === null ? Promise.resolve(null) : api<MinuteDetailDto>(`/meeting-minutes/${minuteId}`),
      ])
      const occ = await api<{ occurrences: OccurrenceDto[] }>('/calendar-events', {
        query: { from: kstDay(-30), to: kstDay(30), layers: 'SHARED', projectId: project.projectId },
      }).catch(() => ({ occurrences: [] as OccurrenceDto[] }))
      const seen = new Set<number>()
      const events: EventOption[] = []
      for (const o of occ.occurrences) {
        if (o.busyOnly || seen.has(o.eventId)) continue
        seen.add(o.eventId)
        const d = o.allDay && o.startsOn ? o.startsOn : kstParts(o.startsAt).day
        events.push({ eventId: o.eventId, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${o.title ?? '일정'} (캘린더)` })
      }
      const me = { id: meRef.memberId, name: meRef.name }
      const form = detail ? fromDetail(detail) : blankForm(me)
      // 고르던 일정이 목록 밖(한 달 넘음)이면 그것도 넣어 둔다
      if (detail?.calendarEvent && !seen.has(detail.calendarEvent.eventId)) {
        events.unshift({ eventId: detail.calendarEvent.eventId, label: `${detail.calendarEvent.title} (캘린더)` })
      }
      return {
        form,
        members: toMembers(project).map((m) => ({ id: m.memberId, name: m.name })),
        me,
        events,
        canConvert: detail ? detail.permissions.convertActions : project.permissions.canWriteTasks,
      }
    },
  )
}

/** 참석자로 거를 프로젝트 참여자 (목록 화면) */
export function useProjectMembers(projectKey: string) {
  return useResource<MemberOption[]>(['minute-members', projectKey], () => mockMembers, async () =>
    toMembers(await getProject(projectKey)).map((m) => ({ id: m.memberId, name: m.name })),
  )
}

export type EventPrefill = {
  title: string
  day: string
  start: string
  end: string
  location: string
  onlineUrl: string
  attendees: { memberId: number; name: string; attended: boolean }[]
  existingMinuteId: number | null
}

/** MM-12 일정에서 가져오기. 목업은 고른 일정 이름으로 채운다 */
export async function fetchEventPrefill(eventId: number, members: MemberOption[]): Promise<EventPrefill> {
  const live = await whenLive(() => api<MinuteEventPrefillDto>(`/meeting-minutes/from-event/${eventId}`))
  if (!live) {
    const ev = mockEvents.find((e) => e.eventId === eventId)
    return {
      title: (ev?.label ?? '회의').replace(/^\d+\/\d+ /, '').replace(' (캘린더)', ''),
      day: kstDay(),
      start: '14:00',
      end: '15:00',
      location: '본관 412호',
      onlineUrl: '',
      attendees: members.map((m) => ({ memberId: m.id, name: m.name, attended: true })),
      existingMinuteId: null,
    }
  }
  const s = kstParts(live.startsAt)
  const e = kstParts(live.endsAt)
  return {
    title: live.title,
    day: s.day,
    start: live.allDay ? '09:00' : s.time,
    end: live.allDay ? '18:00' : e.time,
    location: live.location ?? '',
    onlineUrl: live.onlineUrl ?? '',
    attendees: live.attendees.map((m) => ({ memberId: m.memberId, name: m.name, attended: true })),
    existingMinuteId: live.existingMinuteId,
  }
}

/** 보내기 전에 화면에서 막는 것 (서버도 다시 본다) */
export function formProblem(f: MinuteForm): string | null {
  if (!f.title.trim()) return '제목을 써 주세요.'
  if (f.title.trim().length > 100) return '제목은 100자까지예요.'
  if (!f.day || !f.start || !f.end) return '일시를 골라 주세요.'
  if (f.end <= f.start) return '끝 시각은 시작 시각 뒤여야 해요.'
  if (f.attendees.length === 0) return '참석자를 한 명 이상 넣어 주세요.'
  if (f.onlineUrl && !/^https?:\/\/.+/.test(f.onlineUrl)) return '온라인 주소는 http · https 로 시작해야 해요.'
  if (f.actions.length > 50) return '할 일은 50개까지 넣을 수 있어요.'
  if (f.actions.some((a) => a.content.trim().length > 200)) return '할 일은 200자까지예요.'
  return null
}

function body(projectKey: string, f: MinuteForm) {
  return {
    projectKey,
    title: f.title.trim(),
    startsAt: kstIso(f.day, f.start),
    endsAt: kstIso(f.day, f.end),
    location: f.location.trim() || null,
    onlineUrl: f.onlineUrl.trim() || null,
    templateCode: f.templateCode,
    calendarEventId: f.calendarEventId,
    attendees: f.attendees.map((a) => ({ memberId: a.memberId, attended: a.attended })),
    agenda: f.agenda.trim() || null,
    discussion: f.discussion.trim() || null,
    decisions: f.decisions.trim() || null,
    actions: f.actions
      .filter((a) => a.content.trim())
      .map((a) => ({
        actionId: a.actionId,
        content: a.content.trim(),
        assigneeMemberId: a.assigneeId,
        dueOn: a.dueOn || null,
        done: a.done,
        convertToTask: a.convertToTask,
      })),
    attachmentFileIds: f.attachmentFileIds,
  }
}

export type SaveResult = { minuteId: number; version: number; draft: boolean; madeTasks: string[] }

/**
 * 저장. mode=draft 면 임시 저장 (새 글은 draft=true 로 만들고, 이어 쓰면 그대로 저장),
 * mode=publish 면 게시 — 새 글은 바로 게시, 임시 저장이던 글은 저장한 뒤 MM-10 게시.
 * 목업이면 undefined.
 */
export async function saveMinuteForm(projectKey: string, f: MinuteForm, mode: 'draft' | 'publish'): Promise<SaveResult | undefined> {
  return whenLive(async () => {
    const payload = body(projectKey, f)
    let saved: MinuteDetailDto
    if (f.minuteId === null) {
      saved = await api<MinuteDetailDto>('/meeting-minutes', { method: 'POST', body: { ...payload, draft: mode === 'draft' } })
    } else {
      const { projectKey: _omit, ...rest } = payload
      void _omit
      saved = await api<MinuteDetailDto>(`/meeting-minutes/${f.minuteId}`, { method: 'PUT', body: { ...rest, version: f.version } })
      if (mode === 'publish' && saved.draft) {
        saved = await api<MinuteDetailDto>(`/meeting-minutes/${f.minuteId}/publish`, { method: 'POST' })
      }
    }
    const before = new Set(f.actions.map((a) => a.taskKey).filter(Boolean))
    return {
      minuteId: saved.minuteId,
      version: saved.version,
      draft: saved.draft,
      madeTasks: saved.actions.map((a) => a.task?.taskKey).filter((k): k is string => !!k && !before.has(k)),
    }
  })
}
