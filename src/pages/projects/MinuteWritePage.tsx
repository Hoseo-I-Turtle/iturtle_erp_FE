import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, Check, ChevronLeft, Clock, Info, ListChecks, MapPin, Plus, X } from 'lucide-react'
import { Button, Card, Field, FormError, FormRow, Loadable, Switch, TextInput } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { errorText } from '../../api/content'
import { addMockMinute, createMinute, useMinuteListPage, type MinuteActionDraft, type MinuteDraft } from '../../api/minutes'
import { todayKst } from '../../api/projects'
import { getDataMode } from '../../lib/dataMode'
import s from './MinuteWritePage.module.css'

const TEMPLATE = '## 안건\n1. \n\n## 논의\n- \n\n## 결정\n- '
const draftKey = (projectKey: string) => `iturtle.minuteDraft.${projectKey}`
const NO_FILTER = { keyword: '', months: 0, attendee: '' }

const blank = (): MinuteDraft => {
  const today = todayKst()
  return { title: `${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))} 주간 회의`, day: today, start: '14:00', end: '15:00', location: '', attendeeIds: [], body: TEMPLATE, actions: [] }
}

/** 회의록 쓰기 (Penpot 06 · 회의록 쓰기) — MM-2 */
export function MinuteWritePage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const meta = useMinuteListPage(key, NO_FILTER)
  const data = meta.data
  const base = `/projects/${data?.projectKey ?? key}/minutes`

  const [f, setF] = useState<MinuteDraft>(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(key ?? ''))
      return raw ? { ...blank(), ...(JSON.parse(raw) as Partial<MinuteDraft>) } : blank()
    } catch {
      return blank()
    }
  })
  const [touchedAttendees, setTouchedAttendees] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof MinuteDraft>(k: K, v: MinuteDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  // 참석자는 처음에 프로젝트 참여자 모두로 채운다
  const attendeeIds = touchedAttendees || f.attendeeIds.length > 0 ? f.attendeeIds : (data?.members.map((m) => m.id) ?? [])
  const setAttendees = (ids: number[]) => {
    setTouchedAttendees(true)
    set('attendeeIds', ids)
  }

  // 임시 저장: 고칠 때마다 조금 뒤에 이 탭에 남긴다
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey(key ?? ''), JSON.stringify(f))
        setSavedAt(Date.now())
      } catch {
        /* 저장하지 못하면 표시만 안 한다 */
      }
    }, 800)
    return () => window.clearTimeout(t)
  }, [f, key])
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(t)
  }, [])
  const savedAgo = savedAt === null ? null : Math.max(0, Math.round((now - savedAt) / 1000))

  const setAction = (i: number, patch: Partial<MinuteActionDraft>) => set('actions', f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const toTaskCount = f.actions.filter((a) => a.toTask && a.content.trim()).length

  const submit = async () => {
    if (!data) return
    const actions = f.actions.filter((a) => a.content.trim()).map((a) => ({ ...a, content: a.content.trim().slice(0, 200) }))
    if (!f.title.trim()) return setError('제목을 적어 주세요.')
    if (f.end <= f.start) return setError('끝나는 시각이 시작보다 뒤여야 해요.')
    if (attendeeIds.length === 0) return setError('참석자를 한 명 이상 골라 주세요.')
    const draft: MinuteDraft = { ...f, title: f.title.trim(), attendeeIds, actions }
    setBusy(true)
    setError(null)
    try {
      const id =
        getDataMode() === 'live'
          ? await createMinute(data.projectKey, draft, data.members.map((m) => m.id))
          : addMockMinute(draft, data.members, data.me)
      sessionStorage.removeItem(draftKey(key ?? ''))
      navigate(`${base}/${id}`)
    } catch (e) {
      setError(errorText(e, '회의록을 저장하지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Card className={s.card}>
      <div className={s.head}>
        <Link to={base}>
          <ChevronLeft size={16} />
          회의록 목록
        </Link>
        {savedAgo !== null && (
          <span className={s.saved}>
            <Check size={14} />
            임시 저장됨 · {savedAgo < 5 ? '방금 전' : savedAgo < 60 ? `${savedAgo}초 전` : `${Math.round(savedAgo / 60)}분 전`}
          </span>
        )}
      </div>

      <label className={s.title}>
        <input value={f.title} maxLength={100} placeholder="회의 제목" onChange={(e) => set('title', e.target.value)} aria-label="제목" />
        <span>{f.title.length} / 100</span>
      </label>

      <FormRow>
        <Field label="일시" className={s.when}>
          <div className={s.whenRow}>
            <TextInput type="date" icon={Calendar} value={f.day} onChange={(v) => set('day', v)} aria-label="날짜" />
            <TextInput type="time" icon={Clock} value={f.start} step={600} onChange={(v) => set('start', v)} aria-label="시작" />
            <span>–</span>
            <TextInput type="time" icon={Clock} value={f.end} step={600} onChange={(v) => set('end', v)} aria-label="끝" />
          </div>
        </Field>
        <Field label="장소">
          <TextInput icon={MapPin} value={f.location} onChange={(v) => set('location', v.slice(0, 200))} placeholder="회의실 또는 온라인" />
        </Field>
      </FormRow>

      <Loadable resource={meta} label="참여자">
        {(d) => (
          <Field label="참석자">
            <div className={s.attendees}>
              {d.members.map((m) => {
                const on = attendeeIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={on ? `${s.person} ${s.personOn}` : s.person}
                    aria-pressed={on}
                    onClick={() => setAttendees(on ? attendeeIds.filter((x) => x !== m.id) : [...attendeeIds, m.id])}
                  >
                    {on ? <X size={12} /> : <Plus size={12} />}
                    {m.name}
                  </button>
                )
              })}
              <small>· 프로젝트 참여자로 채웠어요. 빠진 사람은 불참으로 남아요</small>
            </div>
          </Field>
        )}
      </Loadable>

      <Field label="내용" hint="Markdown · @이름 · DEFME-12 링크 · “## 결정” 아래는 결정 사항으로 남아요">
        <MarkdownEditor value={f.body} onChange={(v) => set('body', v)} projectKey={key} minHeight={220} />
      </Field>

      <section className={s.actions}>
        <div className={s.actionsHead}>
          <ListChecks size={18} />
          <strong>할 일</strong>
          <small>
            {f.actions.length}개 · 작업으로 만들 것 {toTaskCount}개
          </small>
        </div>
        {f.actions.length > 0 && (
          <div className={`${s.action} ${s.thead}`}>
            <span>내용</span>
            <span>담당</span>
            <span>기한</span>
            <span>작업으로 만들기</span>
            <span />
          </div>
        )}
        {f.actions.map((a, i) => (
          <div key={i} className={s.action}>
            <input value={a.content} maxLength={200} placeholder="할 일" onChange={(e) => setAction(i, { content: e.target.value })} aria-label="할 일 내용" />
            <select value={a.assigneeId ?? ''} onChange={(e) => setAction(i, { assigneeId: e.target.value ? Number(e.target.value) : null })} aria-label="담당">
              <option value="">담당 없음</option>
              {(data?.members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input type="date" value={a.dueOn} onChange={(e) => setAction(i, { dueOn: e.target.value })} aria-label="기한" />
            <label className={s.toTask}>
              <Switch checked={a.toTask} onChange={(v) => setAction(i, { toTask: v })} label="작업으로 만들기" />
              {a.toTask ? '보드 · 할 일' : '안 만듦'}
            </label>
            <button type="button" aria-label="할 일 지우기" onClick={() => set('actions', f.actions.filter((_, j) => j !== i))}>
              <X size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={s.add}
          disabled={f.actions.length >= 50}
          onClick={() => set('actions', [...f.actions, { content: '', assigneeId: null, dueOn: '', toTask: true }])}
        >
          <Plus size={14} />
          할 일 추가
        </button>
      </section>

      <FormError>{error}</FormError>
      <div className={s.foot}>
        <span>
          <Info size={14} />
          저장하면 할 일 담당자에게 알림이 가고, 켠 할 일은 작업으로 만들어져요
        </span>
        <Button variant="secondary" onClick={() => navigate(base)}>
          취소
        </Button>
        <Button icon={Check} onClick={submit} disabled={busy || !data}>
          {busy ? '저장하는 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}
