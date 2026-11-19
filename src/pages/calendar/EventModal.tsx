import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bell, Calendar, Check, Clock, FlaskConical, Link2, MapPin, Plus, Repeat, TriangleAlert, X } from 'lucide-react'
import { Button, Loadable, Modal, Switch } from '../../components/ui'
import { ApiError } from '../../api/client'
import {
  emptyEventForm,
  fetchConflicts,
  fetchEventDetail,
  notifyEventsChanged,
  saveEvent,
  useEventEditorRequests,
  useEventFormOptions,
  type Conflict,
  type EditScope,
  type EventDetail,
  type EventEditorOpen,
  type EventForm,
  type EventFormOptions,
  type Recurrence,
  type ShareMode,
} from '../../api/calendarEvents'
import { getDataMode } from '../../lib/dataMode'
import s from './EventModal.module.css'

const TITLE_MAX = 100
const PERSONAL = '__PERSONAL__'
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: '알리지 않음' },
  { value: 0, label: '시작할 때' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '하루 전' },
]
const SHARE_MODES: { value: ShareMode; label: string }[] = [
  { value: 'BUSY', label: '바쁨으로만 보이기' },
  { value: 'TITLE', label: '제목까지 보이기' },
  { value: 'NONE', label: '나만 보기' },
]
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const SCOPES: { value: EditScope; label: string }[] = [
  { value: 'THIS', label: '이 일정만' },
  { value: 'FOLLOWING', label: '이후 모두' },
  { value: 'ALL', label: '전부' },
]

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const weekdayOf = (date: string) => WEEKDAY[new Date(`${date}T12:00:00+09:00`).getUTCDay()]
const dotDate = (date: string) => `${date.replace(/-/g, '.')} (${weekdayOf(date)})`

/** 캘린더 · 일정표 화면에 둔다: openEventEditor 로 열린다 */
export function EventEditorHost() {
  const [open, setOpen] = useState<EventEditorOpen | null>(null)
  useEventEditorRequests(useCallback((d: EventEditorOpen) => setOpen(d), []))
  return open ? <EventModal open={open} onClose={() => setOpen(null)} /> : null
}

/** 일정 추가 · 고치기 창 (디자인: 06 Screens · 추가 › Screen · 일정 추가) */
export function EventModal({ open, onClose }: { open: EventEditorOpen; onClose: () => void }) {
  const options = useEventFormOptions()
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const editing = open.eventId != null
  const live = getDataMode() === 'live'
  const loadError = editing && !live ? '목업 모드에서는 일정을 고칠 수 없어요.' : fetchError

  useEffect(() => {
    if (open.eventId == null || !live) return
    let alive = true
    fetchEventDetail(open.eventId, open.occurrence ?? null)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setFetchError(e instanceof ApiError ? e.message : '일정을 불러오지 못했어요.'))
    return () => {
      alive = false
    }
  }, [open.eventId, open.occurrence, live])

  return (
    <Modal title={editing ? '일정 고치기' : '새 일정'} onClose={onClose} width={760}>
      <Loadable resource={options} label="일정 창">
        {(o) =>
          !editing ? (
            <EventFormView o={o} initial={emptyEventForm(open.date ?? todayKst(), open.projectId ?? null)} detail={null} onClose={onClose} />
          ) : loadError ? (
            <p className={s.error}>{loadError}</p>
          ) : detail ? (
            <EventFormView o={o} initial={detail.form} detail={detail} onClose={onClose} />
          ) : (
            <p className={s.hint} aria-busy="true">일정을 불러오는 중…</p>
          )
        }
      </Loadable>
    </Modal>
  )
}

function EventFormView({ o, initial, detail, onClose }: { o: EventFormOptions; initial: EventForm; detail: EventDetail | null; onClose: () => void }) {
  const [f, setF] = useState<EventForm>(() => (initial.eventTypeCode || initial.calendarType === 'PERSONAL' ? initial : { ...initial, eventTypeCode: o.types[0]?.code ?? null }))
  const [scope, setScope] = useState<EditScope>('THIS')
  const [showLink, setShowLink] = useState(!!initial.onlineUrl)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setError(null)
  }

  const shared = f.calendarType === 'SHARED'
  const onlyOccurrence = !!detail?.recurring && scope === 'THIS'
  const readOnly = !!detail && !detail.canEdit
  const start = f.allDay ? f.startDate : `${f.startDate}T${f.startTime}`
  const end = f.allDay ? f.endDate : `${f.endDate}T${f.endTime}`
  const badTime = f.allDay ? f.endDate < f.startDate : end <= start
  const titleOk = f.title.trim().length > 0 && f.title.length <= TITLE_MAX
  const needsProject = shared && f.audience === 'PROJECT' && !f.projectId
  const badLink = !!f.onlineUrl.trim() && !/^https?:\/\/.+/.test(f.onlineUrl.trim())
  const canSave = titleOk && !badTime && !needsProject && !badLink && !saving && !readOnly

  // 겹치는 일정: 시간 · 사람이 바뀌면 조금 기다렸다 다시 본다
  const people = useMemo(
    () => (shared && f.audience === 'SELECTED' ? [o.me.id, ...f.attendeeIds] : [o.me.id]),
    [shared, f.audience, f.attendeeIds, o.me.id],
  )
  // f 전체가 아니라 시간 칸만 본다
  const span = useMemo(
    () => ({ allDay: f.allDay, startDate: f.startDate, startTime: f.startTime, endDate: f.endDate, endTime: f.endTime }),
    [f.allDay, f.startDate, f.startTime, f.endDate, f.endTime],
  )
  const excludeId = detail?.eventId ?? null
  useEffect(() => {
    if (badTime) return
    let alive = true
    const t = window.setTimeout(() => {
      fetchConflicts(span, people, excludeId)
        .then((c) => alive && setConflicts(c))
        .catch(() => alive && setConflicts(null))
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [span, people, badTime, excludeId])

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await saveEvent(f, detail ? { detail, scope: detail.recurring ? scope : null } : null)
      notifyEventsChanged()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '일정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const minutes = f.allDay
    ? null
    : Math.round((Date.parse(`${f.endDate}T${f.endTime}:00+09:00`) - Date.parse(`${f.startDate}T${f.startTime}:00+09:00`)) / 60_000)
  const lengthText = minutes == null ? '하루 종일' : minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`
  const conflictText =
    conflicts == null
      ? ''
      : conflicts.length === 0
        ? '다른 일정과 겹치지 않아요'
        : `${conflicts[0].member} · ${conflicts[0].time} ${conflicts[0].busyOnly ? '바쁨' : (conflicts[0].title ?? '일정')}과 겹쳐요${conflicts.length > 1 ? ` 외 ${conflicts.length - 1}건` : ''}`
  const memberName = new Map(o.members.map((m) => [m.id, m.name]))
  const restMembers = o.members.filter((m) => !f.attendeeIds.includes(m.id))
  const recurrenceLabel = (r: Recurrence) =>
    r === 'NONE' ? '안 함' : r === 'DAILY' ? '매일' : r === 'WEEKLY' ? `매주 ${weekdayOf(f.startDate)}요일` : `매월 ${Number(f.startDate.slice(8, 10))}일`

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {detail?.recurring && (
        <div className={s.scope} role="radiogroup" aria-label="고칠 범위">
          <Repeat size={15} />
          <span>반복 일정이에요. 고칠 범위:</span>
          {SCOPES.map((x) => (
            <button key={x.value} type="button" role="radio" aria-checked={scope === x.value} className={scope === x.value ? `${s.pill} ${s.pillOn}` : s.pill} onClick={() => setScope(x.value)}>
              {scope === x.value && <Check size={13} />}
              {x.label}
            </button>
          ))}
        </div>
      )}

      <label className={s.field}>
        <span className={s.label}>
          제목 <b className={s.req}>*</b>
        </span>
        <span className={s.input}>
          <input autoFocus={!detail} value={f.title} maxLength={TITLE_MAX} placeholder="무슨 일정인지 적어 주세요" onChange={(e) => set('title', e.target.value)} />
          <small>
            {f.title.length} / {TITLE_MAX}
          </small>
        </span>
      </label>

      {!onlyOccurrence && (
        <div className={s.field}>
          <span className={s.label}>종류</span>
          <div className={s.pills} role="radiogroup" aria-label="종류">
            {o.types.map((t) => {
              const on = shared && f.eventTypeCode === t.code
              return (
                <button
                  key={t.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!detail && !shared}
                  className={on ? `${s.pill} ${s.pillOn}` : s.pill}
                  onClick={() => setF((x) => ({ ...x, calendarType: 'SHARED', eventTypeCode: t.code }))}
                >
                  {on && <Check size={13} />}
                  {t.name}
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={!shared}
              disabled={!!detail && shared}
              className={!shared ? `${s.pill} ${s.pillOn}` : s.pill}
              onClick={() => setF((x) => ({ ...x, calendarType: 'PERSONAL', eventTypeCode: PERSONAL }))}
            >
              {!shared && <Check size={13} />}
              개인
            </button>
          </div>
          {detail && <small className={s.hint}>공용 · 개인은 만든 뒤 바꿀 수 없어요</small>}
        </div>
      )}

      <div className={s.field}>
        <span className={s.labelRow}>
          <span className={s.label}>
            날짜 · 시간 <b className={s.req}>*</b>
          </span>
          {!onlyOccurrence && (
            <span className={s.allDay}>
              <Switch checked={f.allDay} onChange={(v) => set('allDay', v)} label="종일" />
              <span>종일</span>
            </span>
          )}
        </span>
        <div className={f.allDay ? `${s.when} ${s.whenAllDay}` : s.when}>
          <DateInput value={f.startDate} onChange={(v) => setF((x) => ({ ...x, startDate: v, endDate: x.endDate < v ? v : x.endDate }))} label="시작 날짜" />
          {!f.allDay && <TimeSelect value={f.startTime} onChange={(v) => set('startTime', v)} label="시작 시각" />}
          <span className={s.dash}>–</span>
          <DateInput value={f.endDate} min={f.startDate} onChange={(v) => set('endDate', v)} label="끝 날짜" />
          {!f.allDay && <TimeSelect value={f.endTime} onChange={(v) => set('endTime', v)} label="끝 시각" />}
        </div>
        <small className={badTime || (conflicts?.length ?? 0) > 0 ? s.hintBad : s.hint}>
          {badTime ? '끝은 시작보다 뒤여야 해요' : [lengthText, conflictText].filter(Boolean).join(' · ')}
        </small>
      </div>

      <div className={s.grid}>
        {!onlyOccurrence && (
          <Field label="반복" icon={<Repeat size={16} />}>
            <select value={f.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
              {(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as Recurrence[]).map((r) => (
                <option key={r} value={r}>
                  {recurrenceLabel(r)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className={s.field}>
          <span className={s.label}>장소 · 온라인 링크</span>
          <span className={s.input}>
            <MapPin size={16} />
            <input value={f.location} maxLength={200} placeholder="예: 본관 412호" onChange={(e) => set('location', e.target.value)} />
            {!showLink && !onlyOccurrence && (
              <button type="button" className={s.inlineBtn} onClick={() => setShowLink(true)}>
                링크 붙여넣기
              </button>
            )}
          </span>
          {showLink && !onlyOccurrence && (
            <span className={s.input}>
              <Link2 size={16} />
              <input value={f.onlineUrl} maxLength={500} placeholder="https://" onChange={(e) => set('onlineUrl', e.target.value)} />
            </span>
          )}
          {badLink && <small className={s.hintBad}>온라인 링크는 http · https 주소예요</small>}
        </div>
      </div>

      {!onlyOccurrence && shared && (
        <div className={s.field}>
          <span className={s.label}>대상</span>
          <div className={s.pills} role="radiogroup" aria-label="대상">
            {(
              [
                ['ALL', `전체 구성원 (${o.members.length}명)`],
                ['PROJECT', '프로젝트 참여자'],
                ['SELECTED', '직접 고르기'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={f.audience === value} className={f.audience === value ? `${s.pill} ${s.pillOn}` : s.pill} onClick={() => set('audience', value)}>
                {f.audience === value && <Check size={13} />}
                {label}
              </button>
            ))}
          </div>
          {f.audience === 'SELECTED' && (
            <div className={s.people}>
              {f.attendeeIds.map((id) => (
                <button key={id} type="button" className={s.person} onClick={() => set('attendeeIds', f.attendeeIds.filter((x) => x !== id))} aria-label={`${memberName.get(id)} 빼기`}>
                  <X size={13} />
                  {memberName.get(id) ?? `#${id}`}
                </button>
              ))}
              {picking ? (
                <select
                  className={s.pick}
                  autoFocus
                  value=""
                  onBlur={() => setPicking(false)}
                  onChange={(e) => {
                    if (e.target.value) set('attendeeIds', [...f.attendeeIds, Number(e.target.value)])
                    setPicking(false)
                  }}
                >
                  <option value="">사람 고르기</option>
                  {restMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button type="button" className={s.addPerson} disabled={restMembers.length === 0} onClick={() => setPicking(true)}>
                  <Plus size={13} /> 사람 더하기
                </button>
              )}
            </div>
          )}
          <small className={needsProject ? s.hintBad : s.hint}>
            {needsProject ? '프로젝트 참여자를 대상으로 하려면 아래에서 프로젝트를 골라 주세요' : '대상에게 알림이 가고 각자 캘린더에 보여요'}
          </small>
        </div>
      )}

      {!onlyOccurrence && (
        <div className={s.grid}>
          {shared ? (
            <Field label="프로젝트 연결" icon={<FlaskConical size={16} />} hint={'프로젝트 홈 "다가오는 일정"에도 보여요'}>
              <select value={f.projectId ?? ''} onChange={(e) => set('projectId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">연결 안 함</option>
                {o.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="다른 사람에게" icon={<Calendar size={16} />} hint="연구실 캘린더에 어떻게 보일지 골라요">
              <select value={f.shareMode} onChange={(e) => set('shareMode', e.target.value as ShareMode)}>
                {SHARE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="알림" icon={<Bell size={16} />}>
            <select value={f.reminderMinutes ?? ''} onChange={(e) => set('reminderMinutes', e.target.value === '' ? null : Number(e.target.value))}>
              {REMINDERS.map((r) => (
                <option key={r.label} value={r.value ?? ''}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {!onlyOccurrence && (
        <label className={s.field}>
          <span className={s.label}>설명</span>
          <textarea className={s.textarea} value={f.description} rows={3} maxLength={5000} placeholder="준비할 것, 진행 방식 같은 것을 적어 주세요" onChange={(e) => set('description', e.target.value)} />
        </label>
      )}

      {error && (
        <p className={s.error} role="alert">
          <TriangleAlert size={14} /> {error}
        </p>
      )}
      {readOnly && <p className={s.error}>{detail?.owner} 님이 만든 일정이라 고칠 수 없어요.</p>}

      <div className={s.foot}>
        <span className={s.footNote}>
          <Clock size={13} /> {shared ? '저장하면 대상자 캘린더에 바로 보여요' : '내 캘린더에만 저장돼요'}
        </span>
        <span className={s.grow} />
        <Button variant="secondary" type="button" onClick={onClose}>
          취소
        </Button>
        <Button icon={Check} type="submit" disabled={!canSave}>
          {saving ? '저장하는 중…' : detail ? '저장' : '일정 추가'}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, icon, hint, children }: { label: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <span className={s.input}>
        {icon}
        {children}
      </span>
      {hint && <small className={s.hint}>{hint}</small>}
    </label>
  )
}

function DateInput({ value, min, onChange, label }: { value: string; min?: string; onChange: (v: string) => void; label: string }) {
  return (
    <span className={s.input} title={dotDate(value)}>
      <Calendar size={16} />
      <input type="date" aria-label={label} value={value} min={min} required onChange={(e) => e.target.value && onChange(e.target.value)} />
    </span>
  )
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const times = TIMES.includes(value) ? TIMES : [...TIMES, value].sort()
  return (
    <span className={s.input}>
      <Clock size={16} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {times.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </span>
  )
}
