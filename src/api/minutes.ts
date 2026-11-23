// 회의록 목록 · 쓰기 — docs/api/32-minute-report.md MM-1, MM-2, MM-8
import { api } from './client'
import { ago, type MemberRef, type PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { addDaysYmd, kstHm, kstInstant, kstYmd } from './communication'
import { getProject, MOCK_ME, todayKst, toMembers } from './projects'
import { minuteList as mockList, myMinuteActions as mockActions, type MinuteListItem, type MyMinuteAction } from '../mocks/minuteList'
import { minutes as mockMinutes } from '../mocks/minutes'
import { projectDetail } from '../mocks/projectDetail'
import { findProject } from '../mocks/projects'
import { WEEKDAYS } from '../lib/date'

export type MinuteListFilter = { keyword: string; months: number; attendee: string }
export type MinuteListData = {
  items: MinuteListItem[]
  total: number
  myActions: MyMinuteAction[]
  members: { id: number; name: string }[]
  projectKey: string
  projectName: string
  me: string
  meId: number
}

type MinuteSummaryDto = {
  minuteId: number
  title: string
  startsAt: string
  endsAt: string
  author: MemberRef
  attendeeCount: number
  actionCount: number
  convertedTaskCount: number
  updatedAt: string
}

const mockMembers = () => projectDetail.members.map((m, i) => ({ id: i + 1, name: m.name }))

/** 회의록 목록 (MM-1) + 참석자 거르기 · 쓰기에 쓰는 참여자 (P-3) */
export function useMinuteListPage(key: string | undefined, f: MinuteListFilter) {
  return useResource<MinuteListData>(
    ['minute-list', key, f],
    () => {
      const p = findProject(key)
      const from = addDaysYmd(todayKst(), -f.months * 31)
      const kw = f.keyword.trim()
      const items = mockList.filter(
        (m) =>
          (f.months === 0 || m.date >= from) &&
          (!f.attendee || m.attendees.includes(f.attendee)) &&
          (!kw || m.title.includes(kw) || m.attendees.some((a) => a.includes(kw)) || (m.place ?? '').includes(kw)),
      )
      return { items, total: items.length, myActions: mockActions, members: mockMembers(), projectKey: p.projectKey, projectName: p.name, me: MOCK_ME, meId: 1 }
    },
    async () => {
      const [d, me] = await Promise.all([getProject(key ?? ''), api<MemberRef>('/members/me')])
      const members = toMembers(d).map((m) => ({ id: m.memberId, name: m.name }))
      const kw = f.keyword.trim()
      const page = await api<PageResponse<MinuteSummaryDto>>('/meeting-minutes', {
        query: {
          projectKey: d.projectKey,
          from: f.months ? addDaysYmd(todayKst(), -f.months * 31) : undefined,
          attendeeId: members.find((m) => m.name === f.attendee)?.id,
          keyword: kw.length >= 2 ? kw : undefined,
          size: 50,
        },
      })
      const recent = Date.now() - 86400000
      return {
        // 명세 확인 필요: 목록(MM-1)에 참석자 이름 · 장소 · 끝낸 할 일 수가 없다. 인원 수와 "작업으로 만든 수"만 보여 준다
        items: page.content.map((m) => ({
          minuteId: m.minuteId,
          title: m.title,
          date: kstYmd(m.startsAt),
          time: `${kstHm(m.startsAt)}–${kstHm(m.endsAt)}`,
          place: null,
          attendees: [],
          attendeeCount: m.attendeeCount,
          actionDone: null,
          actionCount: m.actionCount,
          convertedTaskCount: m.convertedTaskCount,
          author: m.author.name,
          edited: ago(m.updatedAt),
          isNew: Date.parse(m.updatedAt) > recent,
        })),
        total: page.totalElements,
        // 명세 확인 필요: "나에게 온 할 일"(여러 회의록의 내 할 일)을 주는 API 가 없다
        myActions: [],
        members,
        projectKey: d.projectKey,
        projectName: d.name,
        me: me.name,
        meId: me.memberId,
      }
    },
  )
}

/* ---------- 쓰기 (MM-2) ---------- */

export type MinuteActionDraft = { content: string; assigneeId: number | null; dueOn: string; toTask: boolean }
export type MinuteDraft = {
  title: string
  /** 'YYYY-MM-DD', 'HH:mm' */
  day: string
  start: string
  end: string
  location: string
  attendeeIds: number[]
  /** Markdown 한 덩어리. "## 결정" 아래는 결정 사항으로 나눠 보낸다 */
  body: string
  actions: MinuteActionDraft[]
}

const toMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

/** 본문을 안건 · 논의 / 결정 사항으로 나눈다 (MM-2 는 세 칸으로 받는다) */
function splitBody(body: string) {
  const i = body.search(/^##\s*결정/m)
  if (i < 0) return { agenda: body.trim(), decisions: '' }
  return { agenda: body.slice(0, i).trim(), decisions: body.slice(i).replace(/^##.*\n?/, '').trim() }
}

/** 실서버: 회의록을 만들고(MM-2) 켜 둔 할 일을 작업으로 만든다(MM-8). 새 회의록 번호를 돌려준다 */
export async function createMinute(projectKey: string, d: MinuteDraft, allMemberIds: number[]) {
  const { agenda, decisions } = splitBody(d.body)
  const made = await api<{ minuteId: number; actions: { actionId: number; content: string }[] }>('/meeting-minutes', {
    method: 'POST',
    body: {
      projectKey,
      title: d.title,
      startsAt: kstInstant(d.day, toMinutes(d.start)),
      endsAt: kstInstant(d.day, toMinutes(d.end)),
      location: d.location || undefined,
      attendees: allMemberIds.map((memberId) => ({ memberId, attended: d.attendeeIds.includes(memberId) })),
      agenda: agenda || undefined,
      decisions: decisions || undefined,
      actions: d.actions.map((a) => ({ content: a.content, assigneeMemberId: a.assigneeId ?? undefined, dueOn: a.dueOn || undefined })),
      attachmentFileIds: [],
    },
  })
  const convert = made.actions.filter((a) => d.actions.find((x) => x.content === a.content)?.toTask).map((a) => a.actionId)
  if (convert.length) await api(`/meeting-minutes/${made.minuteId}/actions/convert-to-tasks`, { method: 'POST', body: { actionIds: convert } })
  invalidateAll()
  return made.minuteId
}

/** 목업: 목록 · 상세에 바로 보이게 목업 배열에 더한다 */
export function addMockMinute(d: MinuteDraft, members: { id: number; name: string }[], me: string) {
  const minuteId = Math.max(...mockList.map((m) => m.minuteId)) + 1
  const names = members.filter((m) => d.attendeeIds.includes(m.id)).map((m) => m.name)
  const dt = new Date(`${d.day}T00:00:00`)
  const mdText = `${dt.getMonth() + 1}/${dt.getDate()}`
  const { agenda, decisions } = splitBody(d.body)
  const lines = (v: string) =>
    v
      .split('\n')
      .map((l) => l.replace(/^\s*(?:#+|[-*+]|\d+\.)\s*/, '').trim())
      .filter(Boolean)
  mockList.unshift({
    minuteId,
    title: d.title,
    date: d.day,
    time: `${d.start}–${d.end}`,
    place: d.location || null,
    attendees: names,
    attendeeCount: names.length,
    actionDone: 0,
    actionCount: d.actions.length,
    convertedTaskCount: d.actions.filter((a) => a.toTask).length,
    author: me,
    edited: '방금 전',
    isNew: true,
  })
  mockMinutes.unshift({
    minuteId,
    title: d.title,
    when: `${mdText}(${WEEKDAYS[dt.getDay()]}) ${d.start} – ${d.end}`,
    place: d.location || '—',
    event: '연결한 일정 없음',
    template: '양식 없음',
    attendees: names,
    absent: members.filter((m) => !d.attendeeIds.includes(m.id)).map((m) => m.name),
    agenda: lines(agenda),
    discussion: [],
    decisions: lines(decisions),
    todos: d.actions.map((a, i) => ({
      id: i + 1,
      text: a.content,
      assignee: members.find((m) => m.id === a.assigneeId)?.name ?? '담당 없음',
      dueOn: a.dueOn ? `${Number(a.dueOn.slice(5, 7))}/${Number(a.dueOn.slice(8, 10))}` : '',
    })),
    version: 1,
  })
  invalidateAll()
  return minuteId
}

/* ---------- 수정 이력 · 이전 버전 보기 (MM-6, MM-7) ---------- */

export type RevisionItem = { version: number; editor: string; when: string; summary: string }
export type RevisionSnapshot = {
  title: string
  when: string
  place: string
  attendees: string[]
  agenda: string[]
  discussion: string[]
  decisions: string[]
  actions: string[]
}
export type RevisionView = {
  revisions: RevisionItem[]
  /** 고른 버전과 바로 앞 버전 (비교용). 첫 버전이면 previous 는 null */
  snapshot: RevisionSnapshot
  previous: RevisionSnapshot | null
  version: number
  latest: number
}

const mdLines = (v: string | null | undefined) =>
  (v ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim())
    .filter(Boolean)

type SnapshotDto = {
  title: string
  startsAt: string
  endsAt: string
  location: string | null
  onlineUrl: string | null
  attendees: ({ member?: MemberRef; name?: string; attended?: boolean } | string)[]
  agenda: string | null
  discussion: string | null
  decisions: string | null
  actions: { content: string; assignee?: MemberRef | null; dueOn?: string | null; taskKey?: string | null }[]
}
type RevisionDto = { version: number; editor: MemberRef; summary: string | null; createdAt: string }

const whenOf = (startsAt: string, endsAt: string) => {
  const d = kstYmd(startsAt)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${kstHm(startsAt)}–${kstHm(endsAt)}`
}
const snapFromDto = (x: SnapshotDto): RevisionSnapshot => ({
  title: x.title,
  when: whenOf(x.startsAt, x.endsAt),
  place: x.location ?? x.onlineUrl ?? '—',
  // 명세 확인 필요: snapshot.attendees 의 모양이 명세에 없다. 이름을 꺼낼 수 있는 모양을 모두 받아 본다
  attendees: x.attendees.map((a) => (typeof a === 'string' ? a : (a.member?.name ?? a.name ?? ''))).filter(Boolean),
  agenda: mdLines(x.agenda),
  discussion: mdLines(x.discussion),
  decisions: mdLines(x.decisions),
  actions: x.actions.map((a) => [a.content, a.assignee?.name, a.dueOn && `~${Number(a.dueOn.slice(5, 7))}/${Number(a.dueOn.slice(8, 10))}`, a.taskKey].filter(Boolean).join(' · ')),
})

/** 목업: 지금 회의록에서 버전마다 조금씩 덜어 내 지난 버전을 만든다 */
function mockRevisions(minuteId: number, version: number | null): RevisionView {
  const m = mockMinutes.find((x) => x.minuteId === minuteId) ?? mockMinutes[0]
  const latest = Math.max(1, m.version)
  const full: RevisionSnapshot = {
    title: m.title,
    when: m.when,
    place: m.place,
    attendees: m.attendees,
    agenda: m.agenda,
    discussion: m.discussion,
    decisions: m.decisions,
    actions: m.todos.map((t) => [t.text, t.assignee, t.dueOn && `~${t.dueOn}`, t.task?.taskKey].filter(Boolean).join(' · ')),
  }
  const at = (v: number): RevisionSnapshot => {
    const back = latest - v
    if (back <= 0) return full
    if (back === 1) return { ...full, actions: full.actions.slice(0, Math.max(0, full.actions.length - 2)) }
    return { ...full, discussion: full.discussion.slice(0, 1), decisions: [], actions: [] }
  }
  const editors = ['최현우', '김민서', '박지훈']
  const summaries = ['처음 작성', '할 일 2개 추가', '결정 사항']
  const whens = ['1시간 전', '30분 전', '2분 전']
  const revisions = Array.from({ length: latest }, (_, i) => {
    const v = latest - i
    const k = Math.min(v - 1, 2)
    return { version: v, editor: editors[k], when: whens[k], summary: v === 1 ? '처음 작성' : summaries[k] }
  })
  const cur = Math.min(latest, Math.max(1, version ?? latest))
  return { revisions, snapshot: at(cur), previous: cur > 1 ? at(cur - 1) : null, version: cur, latest }
}

/** 수정 이력(MM-6)과 고른 버전 · 바로 앞 버전의 내용(MM-7). version 이 null 이면 가장 최근 버전 */
export function useMinuteRevisions(minuteId: number, version: number | null) {
  return useResource<RevisionView>(
    ['minute-revisions', minuteId, version],
    () => mockRevisions(minuteId, version),
    async () => {
      const list = await api<PageResponse<RevisionDto>>(`/meeting-minutes/${minuteId}/revisions`, { query: { size: 50 } })
      const revisions = list.content.map((r) => ({ version: r.version, editor: r.editor.name, when: ago(r.createdAt), summary: r.summary ?? `버전 ${r.version}` }))
      const latest = Math.max(1, ...revisions.map((r) => r.version))
      const cur = version ?? latest
      const get = (v: number) => api<{ snapshot: SnapshotDto }>(`/meeting-minutes/${minuteId}/revisions/${v}`).then((r) => snapFromDto(r.snapshot))
      const [snapshot, previous] = await Promise.all([get(cur), cur > 1 ? get(cur - 1).catch(() => null) : Promise.resolve(null)])
      return { revisions, snapshot, previous, version: cur, latest }
    },
  )
}
