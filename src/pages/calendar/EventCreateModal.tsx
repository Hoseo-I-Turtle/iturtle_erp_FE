import { useState } from 'react'
import { Calendar, Check, Clock, Info, Link2, MapPin } from 'lucide-react'
import { Button, Field, FormError, FormRow, Modal, Select, Switch, TextArea, TextInput, ToggleChip } from '../../components/ui'
import { addDaysYmd } from '../../api/communication'
import { errorText } from '../../api/content'
import { useMyProjectOptions } from '../../api/documents'
import { createEvent, useActiveMembers, type EventDraft, type EventKindChoice } from '../../api/events'
import { todayKst } from '../../api/projects'
import { getDataMode } from '../../lib/dataMode'
import s from './EventCreateModal.module.css'

const KINDS: [EventKindChoice, string][] = [
  ['meeting', '회의'],
  ['seminar', '세미나'],
  ['deadline', '마감'],
  ['event', '행사'],
  ['conference', '학회'],
  ['personal', '개인'],
]
const REPEATS: { value: EventDraft['repeat']; label: string }[] = [
  { value: 'NONE', label: '안 함' },
  { value: 'DAILY', label: '매일' },
  { value: 'WEEKLY', label: '매주 같은 요일' },
  { value: 'MONTHLY', label: '매월 같은 날' },
]
const SHARES: { value: EventDraft['shareMode']; label: string }[] = [
  { value: 'NONE', label: '공유 안 함' },
  { value: 'TITLE', label: '제목까지 공개' },
  { value: 'BUSY', label: '"바쁨"으로만' },
]

type Props = { initialDay?: string; onClose: () => void; onCreated: () => void }

/** 새 일정 (Penpot 06 · 일정 추가) — CL-3 */
export function EventCreateModal({ initialDay, onClose, onCreated }: Props) {
  const day = initialDay ?? todayKst()
  const people = useActiveMembers()
  const projects = useMyProjectOptions()
  const [f, setF] = useState<EventDraft>({
    title: '',
    kind: 'meeting',
    allDay: false,
    startDay: day,
    startTime: '14:00',
    endDay: day,
    endTime: '15:00',
    repeat: 'NONE',
    repeatUntil: addDaysYmd(day, 90),
    location: '',
    onlineUrl: '',
    attendeeIds: [],
    projectKey: '',
    shareMode: 'NONE',
    description: '',
  })
  const [pickPeople, setPickPeople] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setF((p) => ({ ...p, [k]: v }))
  const personal = f.kind === 'personal'
  const members = people.data?.members ?? []

  // 시작을 바꾸면 끝이 앞서지 않게 따라 옮긴다
  const setStartDay = (v: string) => setF((p) => ({ ...p, startDay: v, endDay: p.endDay < v ? v : p.endDay }))

  const mins = (f.endDay === f.startDay ? 0 : (Date.parse(f.endDay) - Date.parse(f.startDay)) / 60000) + (Number(f.endTime.slice(0, 2)) * 60 + Number(f.endTime.slice(3))) - (Number(f.startTime.slice(0, 2)) * 60 + Number(f.startTime.slice(3)))
  const length = f.allDay
    ? `${Math.round((Date.parse(f.endDay) - Date.parse(f.startDay)) / 86400000) + 1}일`
    : mins > 0
      ? `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}시간 ` : ''}${mins % 60 ? `${mins % 60}분` : ''}`.trim()
      : null

  const submit = async () => {
    if (!f.title.trim()) return setError('제목을 적어 주세요.')
    if (f.endDay < f.startDay || (!f.allDay && mins <= 0)) return setError('끝나는 때가 시작보다 뒤여야 해요.')
    if (f.repeat !== 'NONE' && f.repeatUntil < f.startDay) return setError('반복이 끝나는 날이 시작보다 앞이에요.')
    setBusy(true)
    setError(null)
    try {
      await createEvent({ ...f, title: f.title.trim(), attendeeIds: pickPeople ? f.attendeeIds : members.map((m) => m.id) }, getDataMode() === 'live')
      onCreated()
    } catch (e) {
      setError(errorText(e, '일정을 추가하지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="새 일정"
      width={760}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span>
            <Info size={14} />
            {personal ? '개인 일정은 나에게만 보여요 (공유 방식은 아래에서)' : '저장하면 대상자 캘린더에 바로 보여요'}
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy}>
            {busy ? '추가하는 중…' : '일정 추가'}
          </Button>
        </div>
      }
    >
      <Field label="제목" required>
        <TextInput value={f.title} onChange={(v) => set('title', v.slice(0, 100))} placeholder="일정 제목" trailing={`${f.title.length} / 100`} autoFocus />
      </Field>
      <Field label="종류">
        <div className={s.pills}>
          {KINDS.map(([k, label]) => (
            <ToggleChip key={k} on={f.kind === k} check onClick={() => set('kind', k)}>
              {label}
            </ToggleChip>
          ))}
        </div>
      </Field>

      <Field
        label="날짜 · 시간"
        required
        help={length ? `${length}${f.repeat !== 'NONE' ? ` · ${REPEATS.find((r) => r.value === f.repeat)?.label} 반복` : ''}` : undefined}
        hint={
          <label className={s.allDay}>
            <Switch checked={f.allDay} onChange={(v) => set('allDay', v)} label="종일" />
            종일
          </label>
        }
      >
        <div className={s.when}>
          <TextInput type="date" icon={Calendar} value={f.startDay} onChange={setStartDay} aria-label="시작 날짜" />
          {!f.allDay && <TextInput type="time" icon={Clock} value={f.startTime} step={600} onChange={(v) => set('startTime', v)} aria-label="시작 시각" />}
          <span>–</span>
          <TextInput type="date" icon={Calendar} value={f.endDay} min={f.startDay} onChange={(v) => set('endDay', v)} aria-label="끝 날짜" />
          {!f.allDay && <TextInput type="time" icon={Clock} value={f.endTime} step={600} onChange={(v) => set('endTime', v)} aria-label="끝 시각" />}
        </div>
      </Field>

      <FormRow>
        <Field label="반복">
          <div className={s.repeat}>
            <Select block value={f.repeat} options={REPEATS} onChange={(v) => set('repeat', v)} label="반복" />
            {f.repeat !== 'NONE' && <TextInput type="date" value={f.repeatUntil} min={f.startDay} onChange={(v) => set('repeatUntil', v)} aria-label="반복 끝나는 날" />}
          </div>
        </Field>
        <Field label="장소">
          <TextInput icon={MapPin} value={f.location} onChange={(v) => set('location', v.slice(0, 200))} placeholder="회의실 · 건물" />
        </Field>
      </FormRow>
      <Field label="온라인 링크">
        <TextInput icon={Link2} type="url" value={f.onlineUrl} onChange={(v) => set('onlineUrl', v.slice(0, 500))} placeholder="https://" />
      </Field>

      {personal ? (
        <Field label="다른 구성원에게" help="공유하면 다른 사람의 캘린더 · 모임 날짜 정하기에 겹쳐 보여요">
          <Select block value={f.shareMode} options={SHARES} onChange={(v) => set('shareMode', v)} label="공유 방식" />
        </Field>
      ) : (
        <>
          <Field label="대상" help="대상에게 알림이 가고 각자 캘린더에 보여요">
            <div className={s.pills}>
              <ToggleChip on={!pickPeople} check onClick={() => setPickPeople(false)}>
                전체 구성원 ({members.length}명)
              </ToggleChip>
              <ToggleChip on={pickPeople} check onClick={() => setPickPeople(true)}>
                직접 고르기{pickPeople ? ` (${f.attendeeIds.length}명)` : ''}
              </ToggleChip>
            </div>
            {pickPeople && (
              <div className={s.people}>
                {members.map((m) => {
                  const on = f.attendeeIds.includes(m.id)
                  return (
                    <button key={m.id} type="button" className={on ? s.personOn : undefined} aria-pressed={on} onClick={() => set('attendeeIds', on ? f.attendeeIds.filter((x) => x !== m.id) : [...f.attendeeIds, m.id])}>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
          <Field label="프로젝트 연결" help={'프로젝트 홈 "다가오는 일정"에도 보여요'}>
            <Select
              block
              value={f.projectKey}
              options={[{ value: '', label: '연결 안 함' }, ...(projects.data ?? []).map((p) => ({ value: p.projectKey, label: p.name }))]}
              onChange={(v) => set('projectKey', v)}
              label="프로젝트 연결"
            />
          </Field>
        </>
      )}

      <Field label="설명">
        <TextArea value={f.description} onChange={(v) => set('description', v.slice(0, 5000))} rows={3} placeholder="준비물 · 안건 등" />
      </Field>
      {/* 명세 확인 필요: 디자인의 "알림 (10분 전)" 은 CL-3 에 없어 넣지 않았다 */}
      <FormError>{error ?? people.error}</FormError>
    </Modal>
  )
}
