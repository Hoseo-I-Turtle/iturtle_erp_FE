import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, Check, ChevronLeft, Clock, Info, Link2, ListChecks, MapPin, Plus, TriangleAlert, X } from 'lucide-react'
import { Avatar, Button, Card, Loadable, Note, Segmented, Switch } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { ApiError } from '../../api/client'
import { errorText } from '../../api/content'
import {
  fetchEventPrefill,
  formProblem,
  newAction,
  saveMinuteForm,
  useMinuteForm,
  type MinuteForm,
  type MinuteFormAction,
  type MinuteFormData,
} from '../../api/minutes'
import s from './MinuteWritePage.module.css'

type Section = 'agenda' | 'discussion' | 'decisions'
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'agenda', label: '안건' },
  { value: 'discussion', label: '논의 내용' },
  { value: 'decisions', label: '결정 사항' },
]
/** 임시 저장 글을 손대고 이만큼 쉬면 저절로 임시 저장한다 */
const AUTOSAVE_MS = 8000

/** 회의록 쓰기 · 고치기 (Penpot `Screen · 회의록 쓰기`). minutes/new · minutes/:minuteId/edit */
export function MinuteWritePage() {
  const { key = '', minuteId } = useParams()
  const id = minuteId ? Number(minuteId) : null
  const data = useMinuteForm(key, id)
  return (
    <Loadable resource={data} label="회의록">
      {(d) => <WriteForm key={`${d.form.minuteId ?? 'new'}`} projectKey={key} data={d} />}
    </Loadable>
  )
}

function WriteForm({ projectKey, data }: { projectKey: string; data: MinuteFormData }) {
  const navigate = useNavigate()
  const [f, setF] = useState<MinuteForm>(data.form)
  const [section, setSection] = useState<Section>('discussion')
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [prefillNote, setPrefillNote] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [, tick] = useState(0)

  const list = `/projects/${projectKey}/minutes`
  const published = f.minuteId !== null && !f.savedDraft
  const memberName = (memberId: number) => data.members.find((m) => m.id === memberId)?.name ?? `#${memberId}`
  const chosenIds = new Set(f.attendees.map((a) => a.memberId))
  const addable = data.members.filter((m) => !chosenIds.has(m.id))
  const toConvert = f.actions.filter((a) => a.content.trim() && a.convertToTask && !a.taskKey).length

  const change = (patch: Partial<MinuteForm>) => {
    setF((x) => ({ ...x, ...patch }))
    setDirty(true)
  }
  const changeAction = (k: string, patch: Partial<MinuteFormAction>) => change({ actions: f.actions.map((a) => (a.key === k ? { ...a, ...patch } : a)) })

  // "N초 전" 을 새로 그린다
  useEffect(() => {
    if (savedAt === null) return
    const t = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [savedAt])

  const save = async (mode: 'draft' | 'publish', auto = false) => {
    const problem = formProblem(f)
    if (problem) {
      if (!auto) setError(problem)
      return
    }
    setError(null)
    setSaving(mode)
    try {
      const res = await saveMinuteForm(projectKey, f, mode)
      if (mode === 'publish') {
        // 게시 · 저장이 끝나면 그 회의록 보기로 (목업은 목록으로)
        navigate(res ? `${list}/${res.minuteId}` : list)
        return
      }
      if (res) {
        setF((x) => ({ ...x, minuteId: res.minuteId, version: res.version, savedDraft: res.draft }))
        // 새 글을 처음 임시 저장했으면 주소를 고치기 주소로 (새로고침해도 이어 쓴다)
        if (f.minuteId === null) navigate(`${list}/${res.minuteId}/edit`, { replace: true })
      }
      setSavedAt(Date.now())
      setDirty(false)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'P201') setConflict(true)
      else if (!auto) setError(errorText(e))
    } finally {
      setSaving(null)
    }
  }

  // 임시 저장 글(또는 새 글)은 손대고 잠시 쉬면 저절로 임시 저장한다. 게시된 글은 저절로 저장하지 않는다
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    if (!dirty || published || saving || conflict || !f.title.trim()) return
    const t = setTimeout(() => void saveRef.current('draft', true), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [f, dirty, published, saving, conflict])

  const pickEvent = async (eventId: number | null) => {
    change({ calendarEventId: eventId })
    setPrefillNote(null)
    if (eventId === null) return
    try {
      const p = await fetchEventPrefill(eventId, data.members)
      // 비어 있는 칸만 채우고, 참석자는 일정 참석자로 바꾼다
      setF((x) => ({
        ...x,
        calendarEventId: eventId,
        title: x.title.trim() ? x.title : p.title,
        day: p.day,
        start: p.start,
        end: p.end,
        location: x.location.trim() ? x.location : p.location,
        onlineUrl: x.onlineUrl.trim() ? x.onlineUrl : p.onlineUrl,
        attendees: p.attendees.length ? p.attendees : x.attendees,
      }))
      setPrefillNote(
        p.existingMinuteId && p.existingMinuteId !== f.minuteId
          ? '이 일정에는 이미 회의록이 있어요'
          : p.attendees.length
            ? '일정 참석자로 채웠어요'
            : '일정 시각으로 채웠어요',
      )
      if (p.existingMinuteId && p.existingMinuteId !== f.minuteId) setError(null)
    } catch (e) {
      setError(errorText(e, '일정을 불러오지 못했어요.'))
    }
  }

  const sectionValue = f[section]
  const counts = SECTIONS.map((x) => (f[x.value].trim() ? `${x.label} ✓` : x.label))

  return (
    <Card className={s.card}>
      <div className={s.top}>
        <Link to={list} className={s.back}>
          <ChevronLeft size={16} /> 회의록 목록
        </Link>
        <span className={s.grow} />
        {saving === 'draft' ? (
          <span className={s.status}>임시 저장 중…</span>
        ) : savedAt !== null ? (
          <span className={`${s.status} ${s.statusOk}`}>
            <Check size={14} /> 임시 저장됨 · {secondsAgo(savedAt)}
          </span>
        ) : published ? (
          <span className={s.status}>게시된 회의록 · 저장하면 참석자에게 바뀐 내용이 보여요</span>
        ) : f.savedDraft ? (
          <span className={s.status}>임시 저장한 글 · 나만 보여요</span>
        ) : null}
      </div>

      {conflict && (
        <Note icon={TriangleAlert} tone="warning">
          다른 사람이 먼저 저장했어요. 지금 내용은 아직 저장되지 않았어요 —{' '}
          <button type="button" className={s.linkBtn} onClick={() => window.location.reload()}>
            새 내용 다시 불러오기
          </button>
        </Note>
      )}

      <label className={s.titleBox}>
        <input value={f.title} onChange={(e) => change({ title: e.target.value })} placeholder="회의 제목 (예: 11/19 주간 회의)" maxLength={100} aria-label="제목" />
        <span className={s.counter}>{f.title.length} / 100</span>
      </label>

      <div className={s.grid}>
        <div className={s.field}>
          <span className={s.label}>일시</span>
          <div className={s.when}>
            <label className={s.input}>
              <Calendar size={18} />
              <input type="date" value={f.day} onChange={(e) => change({ day: e.target.value })} aria-label="날짜" />
            </label>
            <label className={s.input}>
              <Clock size={18} />
              <input type="time" value={f.start} onChange={(e) => change({ start: e.target.value })} aria-label="시작" />
            </label>
            <span className={s.dash}>–</span>
            <label className={s.input}>
              <Clock size={18} />
              <input type="time" value={f.end} onChange={(e) => change({ end: e.target.value })} aria-label="끝" />
            </label>
          </div>
        </div>
        <div className={s.field}>
          <span className={s.label}>장소</span>
          <label className={s.input}>
            <MapPin size={18} />
            <input value={f.location} onChange={(e) => change({ location: e.target.value })} placeholder="본관 412호 · 온라인" maxLength={200} aria-label="장소" />
          </label>
        </div>
        <div className={s.field}>
          <span className={s.label}>일정에서 가져오기</span>
          <label className={s.input}>
            <Link2 size={18} />
            <select
              value={f.calendarEventId ?? ''}
              onChange={(e) => void pickEvent(e.target.value ? Number(e.target.value) : null)}
              aria-label="일정에서 가져오기"
            >
              <option value="">연결 안 함</option>
              {data.events.map((ev) => (
                <option key={ev.eventId} value={ev.eventId}>
                  {ev.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={s.field}>
        <span className={s.label}>참석자</span>
        <div className={s.people}>
          {f.attendees.map((a) => (
            <span key={a.memberId} className={a.attended ? s.person : `${s.person} ${s.absent}`}>
              <button
                type="button"
                className={s.attend}
                title={a.attended ? '불참으로 바꾸기' : '참석으로 바꾸기'}
                onClick={() => change({ attendees: f.attendees.map((x) => (x.memberId === a.memberId ? { ...x, attended: !x.attended } : x)) })}
              >
                <Avatar name={a.name || memberName(a.memberId)} size={18} /> {a.name || memberName(a.memberId)}
                {!a.attended && <small>불참</small>}
              </button>
              <button
                type="button"
                className={s.remove}
                aria-label={`${a.name} 빼기`}
                onClick={() => change({ attendees: f.attendees.filter((x) => x.memberId !== a.memberId) })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {addable.length > 0 && (
            <label className={s.addPerson}>
              <Plus size={14} /> 참석자 추가
              <select
                value=""
                onChange={(e) => {
                  const m = data.members.find((x) => x.id === Number(e.target.value))
                  if (m) change({ attendees: [...f.attendees, { memberId: m.id, name: m.name, attended: true }] })
                }}
                aria-label="참석자 추가"
              >
                <option value="">참석자 고르기</option>
                {addable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {prefillNote && <span className={s.hint}>· {prefillNote}</span>}
        </div>
      </div>

      <div className={s.field}>
        <div className={s.sectionHead}>
          <span className={s.label}>내용</span>
          <Segmented value={section} options={SECTIONS.map((x, i) => ({ value: x.value, label: counts[i] }))} onChange={setSection} />
        </div>
        <MarkdownEditor
          key={section}
          value={sectionValue}
          onChange={(v) => change({ [section]: v } as Partial<MinuteForm>)}
          projectKey={projectKey}
          minHeight={220}
          placeholder={
            section === 'agenda' ? '1. 다룰 안건' : section === 'discussion' ? '- 오간 이야기 · @이름 · DEFME-12 링크' : '- 정한 것'
          }
        />
      </div>

      <section className={s.todos} aria-label="할 일">
        <div className={s.todoHead}>
          <ListChecks size={18} />
          <strong>할 일</strong>
          <small>
            {f.actions.length}개 · 작업으로 만들 것 {toConvert}개
          </small>
        </div>
        {f.actions.length > 0 && (
          <div className={s.todoCols} aria-hidden>
            <span>내용</span>
            <span>담당</span>
            <span>기한</span>
            <span>작업으로 만들기</span>
            <span />
          </div>
        )}
        {f.actions.map((a) => (
          <div key={a.key} className={s.todoRow}>
            <input
              className={s.todoText}
              value={a.content}
              onChange={(e) => changeAction(a.key, { content: e.target.value })}
              placeholder="할 일"
              maxLength={200}
              aria-label="할 일 내용"
            />
            <label className={s.small}>
              {a.assigneeId !== null && <Avatar name={memberName(a.assigneeId)} size={18} />}
              <select
                value={a.assigneeId ?? ''}
                onChange={(e) => changeAction(a.key, { assigneeId: e.target.value ? Number(e.target.value) : null })}
                aria-label="담당"
              >
                <option value="">담당 없음</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.small}>
              <Calendar size={14} />
              <input type="date" value={a.dueOn} onChange={(e) => changeAction(a.key, { dueOn: e.target.value })} aria-label="기한" />
            </label>
            <span className={s.convert}>
              {a.taskKey ? (
                <Link className={s.taskChip} to={`/projects/${projectKey}/tasks/${a.taskKey}`}>
                  {a.taskKey}
                </Link>
              ) : (
                <>
                  <Switch
                    checked={a.convertToTask}
                    onChange={(v) => changeAction(a.key, { convertToTask: v })}
                    label={`${a.content || '할 일'} 작업으로 만들기`}
                  />
                  <small className={a.convertToTask ? s.on : undefined}>{a.convertToTask ? '보드 · 할 일' : '안 만듦'}</small>
                </>
              )}
            </span>
            <button
              type="button"
              className={s.del}
              aria-label="할 일 빼기"
              disabled={!!a.taskKey}
              title={a.taskKey ? '작업이 된 할 일은 작업 화면에서 관리해요' : undefined}
              onClick={() => change({ actions: f.actions.filter((x) => x.key !== a.key) })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button type="button" className={s.addTodo} onClick={() => change({ actions: [...f.actions, { ...newAction(), convertToTask: data.canConvert }] })}>
          <Plus size={14} /> 할 일 추가
        </button>
        {!data.canConvert && <p className={s.hint}>작업을 만들 권한이 없어 할 일만 남겨요.</p>}
      </section>

      {error && (
        <Note icon={TriangleAlert} tone="warning">
          {error}
        </Note>
      )}

      <div className={s.foot}>
        <span className={s.footNote}>
          <Info size={14} />
          {published
            ? `저장하면 새 담당자에게 알림이 가고, 켠 할 일 ${toConvert}개는 작업으로 만들어져요`
            : `저장하면 참석자에게 알림이 가고, 켠 할 일 ${toConvert}개는 작업으로 만들어져요`}
        </span>
        <span className={s.grow} />
        {!published && (
          <Button variant="secondary" onClick={() => void save('draft')} disabled={saving !== null}>
            임시 저장
          </Button>
        )}
        <Button icon={Check} onClick={() => void save('publish')} disabled={saving !== null}>
          {saving === 'publish' ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}

function secondsAgo(t: number) {
  const sec = Math.max(1, Math.round((Date.now() - t) / 1000))
  return sec < 60 ? `${sec}초 전` : `${Math.round(sec / 60)}분 전`
}
