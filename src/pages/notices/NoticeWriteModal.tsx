import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock, FileText, Info, Paperclip, Plus, SquareCheck, Trash2, Upload, Users, X } from 'lucide-react'
import { Button, Modal, Switch } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { ApiError } from '../../api/client'
import {
  createNotice,
  deleteNotice,
  kstInstant,
  loadNoticeDraft,
  publishNotice,
  updateNotice,
  useNoticeDrafts,
  type NoticeAudienceType,
  type NoticeDraft,
  type NoticeForm,
} from '../../api/communication'
import { uploadFile } from '../../api/content'
import { useMe } from '../../api/members'
import { useProjectList } from '../../api/projects'
import { getDataMode } from '../../lib/dataMode'
import { MEMBER_TYPE_NAME } from '../../mocks/members'
import type { MemberTypeCode } from '../../api/types'
import s from './NoticeWriteModal.module.css'

const TITLE_MAX = 100
const BODY_MAX = 20000
const QUESTION_MAX = 100
const OPTION_MAX = 50
const MEMBER_TYPES: MemberTypeCode[] = ['PROFESSOR', 'STUDENT', 'INTERN']

type Attachment = { key: string; name: string; size: number; publicId?: string; state: 'uploading' | 'done' | 'failed' }
type Form = {
  title: string
  body: string
  mustRead: boolean
  pin: boolean
  pinUntil: string
  audience: NoticeAudienceType
  projectKey: string
  memberTypes: MemberTypeCode[]
  pollOn: boolean
  question: string
  /** optionId 는 저장된 투표의 선택지를 이을 때만 */
  options: { optionId: number | null; label: string }[]
  multiple: boolean
  anonymous: boolean
  resultVisibility: 'AFTER_VOTE' | 'AFTER_CLOSE'
  /** datetime-local 값 'YYYY-MM-DDTHH:mm' (KST) */
  closesAt: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')
/** 지금(KST)에서 days 뒤 'YYYY-MM-DD' */
const kstDay = (days: number) => {
  const t = new Date(Date.now() + 9 * 3600000 + days * 86400000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}
const emptyForm = (): Form => ({
  title: '',
  body: '',
  mustRead: false,
  pin: false,
  pinUntil: kstDay(7),
  audience: 'ALL',
  projectKey: '',
  memberTypes: [],
  pollOn: false,
  question: '',
  options: [
    { optionId: null, label: '' },
    { optionId: null, label: '' },
  ],
  multiple: false,
  anonymous: false,
  resultVisibility: 'AFTER_VOTE',
  closesAt: `${kstDay(3)}T18:00`,
})
/** 불러온 임시 저장 → 쓰기 칸 */
const formFromDraft = (dr: NoticeDraft): Form => {
  const f = dr.form
  const base = emptyForm()
  return {
    ...base,
    title: f.title,
    body: f.body,
    mustRead: f.mustRead,
    pin: !!f.pinnedUntilOn,
    pinUntil: f.pinnedUntilOn ?? base.pinUntil,
    audience: f.audience.type,
    projectKey: f.audience.projectKey ?? '',
    memberTypes: f.audience.memberTypes ?? [],
    pollOn: !!f.poll,
    question: f.poll?.question ?? '',
    options: f.poll?.options.length ? f.poll.options : base.options,
    multiple: f.poll?.multiple ?? false,
    anonymous: f.poll?.anonymous ?? false,
    resultVisibility: f.poll?.resultVisibility ?? 'AFTER_VOTE',
    closesAt: dr.pollClosesLocal ?? base.closesAt,
  }
}
const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`)
/** 'YYYY-MM-DDTHH:mm' (KST) → ISO */
const localToIso = (v: string) => {
  const [day, hm] = v.split('T')
  const [h, m] = (hm ?? '00:00').split(':').map(Number)
  return kstInstant(day, h * 60 + m)
}
/** '2026-11-30' → '11/30(월)' */
const shortDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${'일월화수목금토'[d.getUTCDay()]})`
}
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** 헤더의 '공지 쓰기' 버튼. notice-write 역할이 없으면 그리지 않는다 (목업 모드는 역할을 몰라 보여 준다) */
export function NoticeWriteButton({ onCreated }: { onCreated?: () => void }) {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const roles = me.data?.roles
  const canWrite = me.data !== undefined && (roles === null || !!roles?.includes('notice-write'))
  if (!canWrite) return null
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        공지 쓰기
      </Button>
      {open && <NoticeWriteModal onClose={() => setOpen(false)} onCreated={onCreated} />}
    </>
  )
}

export function NoticeWriteModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const navigate = useNavigate()
  const live = getDataMode() === 'live'
  const drafts = useNoticeDrafts()
  const projects = useProjectList({ category: 'ALL', mine: true, activeOnly: true, archived: false })
  const [d, setD] = useState<Form>(emptyForm)
  /** 이어 쓰는 임시 저장 공지 id (없으면 새 글) */
  const [draftId, setDraftId] = useState<string | null>(null)
  /** 저장된 공지에 투표가 이미 있는지 (PATCH 모양이 달라진다) */
  const [hadPoll, setHadPoll] = useState(false)
  const [pickDraft, setPickDraft] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setD((p) => ({ ...p, [k]: v }))

  const otherDrafts = (drafts.data ?? []).filter((x) => x.id !== draftId)

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setFiles((p) => [...p, { key, name: file.name, size: file.size, state: live ? 'uploading' : 'done' }])
      if (!live) continue
      try {
        const ref = await uploadFile(file)
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, publicId: ref.publicId, state: 'done' } : f)))
      } catch {
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, state: 'failed' } : f)))
      }
    }
  }

  /** forPublish: 게시할 때만 보는 것 (고정 기한) */
  const validate = (forPublish: boolean): string | null => {
    if (!d.title.trim()) return '제목을 써 주세요.'
    if (d.title.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지예요.`
    if (!d.body.trim()) return '본문을 써 주세요.'
    if (d.body.length > BODY_MAX) return '본문은 20,000자까지예요.'
    if (forPublish && d.pin && d.pinUntil < kstDay(0)) return '고정 기한은 오늘이나 그 뒤로 골라 주세요.'
    if (d.audience === 'PROJECT' && !d.projectKey) return '대상 프로젝트를 골라 주세요.'
    if (d.audience === 'MEMBER_TYPES' && !d.memberTypes.length) return '대상 구분을 하나 이상 골라 주세요.'
    if (d.pollOn) {
      if (!d.question.trim()) return '투표 질문을 써 주세요.'
      const labels = d.options.map((o) => o.label.trim()).filter(Boolean)
      if (labels.length < 2) return '선택지를 2개 이상 넣어 주세요.'
      if (new Set(labels).size !== labels.length) return '같은 선택지가 두 번 있어요.'
      if (Date.parse(localToIso(d.closesAt)) <= Date.now()) return '투표 마감은 지금보다 뒤로 골라 주세요.'
    }
    if (files.some((f) => f.state === 'uploading')) return '파일을 올리는 중이에요. 끝나면 다시 눌러 주세요.'
    return null
  }

  const toForm = (): NoticeForm => ({
    title: d.title.trim(),
    body: d.body,
    mustRead: d.mustRead,
    pinnedUntilOn: d.pin ? d.pinUntil : null,
    attachmentFileIds: files.filter((f) => f.state === 'done' && f.publicId).map((f) => f.publicId as string),
    audience: {
      type: d.audience,
      projectKey: d.audience === 'PROJECT' ? d.projectKey : null,
      memberTypes: d.audience === 'MEMBER_TYPES' ? d.memberTypes : null,
    },
    poll: d.pollOn
      ? {
          question: d.question.trim(),
          options: d.options.filter((o) => o.label.trim()).map((o) => ({ optionId: o.optionId, label: o.label.trim() })),
          multiple: d.multiple,
          maxChoices: null,
          anonymous: d.anonymous,
          resultVisibility: d.resultVisibility,
          closesAt: localToIso(d.closesAt),
        }
      : null,
  })

  const saveDraft = async () => {
    const v = validate(false)
    if (v) return setError(v)
    setError(null)
    if (!live) return setInfo('목업 모드라 저장하지 않았어요.')
    setBusy(true)
    try {
      const id = draftId ? await updateNotice(draftId, toForm(), hadPoll) : await createNotice(toForm(), true)
      // 새로 만든 선택지에 id 가 생겼으니, 이어 쓸 때 선택지를 잇도록 다시 불러온다
      const fresh = await loadNoticeDraft(id)
      setD(formFromDraft(fresh))
      setDraftId(id)
      setHadPoll(!!fresh.form.poll)
      setInfo(`임시 저장했어요 (${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}). 공지 목록에는 보이지 않아요.`)
      drafts.reload()
    } catch (e) {
      setError(errText(e, '임시 저장하지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    const v = validate(true)
    if (v) return setError(v)
    setError(null)
    if (!live) return onClose()
    setBusy(true)
    try {
      let id: string
      if (draftId) {
        await updateNotice(draftId, toForm(), hadPoll)
        id = await publishNotice(draftId)
      } else {
        id = await createNotice(toForm(), false)
      }
      onCreated?.()
      onClose()
      navigate(`/notices/${id}`)
    } catch (e) {
      setError(errText(e, '공지를 올리지 못했어요. 잠시 뒤 다시 해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  const resume = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const dr = await loadNoticeDraft(id)
      setD(formFromDraft(dr))
      setDraftId(dr.id)
      setHadPoll(!!dr.form.poll)
      setFiles(dr.attachments.map((a) => ({ key: a.publicId, name: a.name, size: a.size, publicId: a.publicId, state: 'done' })))
      setInfo('임시 저장한 글을 이어 써요.')
      setPickDraft('')
    } catch (e) {
      setError(errText(e, '임시 저장한 글을 불러오지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  const discard = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      if (live) await deleteNotice(id)
      if (id === draftId) {
        setDraftId(null)
        setHadPoll(false)
        setD(emptyForm())
        setFiles([])
      }
      setInfo('임시 저장한 글을 버렸어요.')
      setPickDraft('')
      drafts.reload()
    } catch (e) {
      setError(errText(e, '임시 저장한 글을 지우지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  const myProjects = projects.data?.projects ?? []

  return (
    <Modal
      title={draftId ? '공지 이어 쓰기' : '새 공지'}
      badge={draftId ? <span className={s.draftBadge}>임시 저장</span> : undefined}
      width={1000}
      onClose={onClose}
      footer={
        <>
          {error ? (
            <span className={s.footError} role="alert">
              <Info size={16} />
              {error}
            </span>
          ) : (
            <span className={s.footNote}>
              <Info size={16} />
              {d.mustRead ? '필독은 대상자에게 끌 수 없는 알림이 가요.' : '올리면 대상자에게 알림이 가요.'}
            </span>
          )}
          {draftId && (
            <Button variant="ghost" icon={Trash2} onClick={() => void discard(draftId)} disabled={busy}>
              버리기
            </Button>
          )}
          <Button variant="secondary" onClick={() => void saveDraft()} disabled={busy}>
            임시 저장
          </Button>
          <Button icon={Check} onClick={() => void submit()} disabled={busy}>
            {busy ? '저장하는 중…' : '올리기'}
          </Button>
        </>
      }
    >
      {/* 모달 본문은 넘치면 스크롤된다. 안의 칸들이 줄어들어 겹치지 않게 한 덩어리로 둔다 */}
      <div className={s.form}>
        {otherDrafts.length > 0 && (
          <div className={s.drafts}>
            <FileText size={16} />
            <span>임시 저장한 글 {otherDrafts.length}개</span>
            <select value={pickDraft} onChange={(e) => setPickDraft(e.target.value)} aria-label="이어 쓸 임시 저장">
              <option value="">고르기</option>
              {otherDrafts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} · {x.savedAt}
                </option>
              ))}
            </select>
            <button type="button" className={s.draftAction} disabled={!pickDraft || busy} onClick={() => void resume(pickDraft)}>
              이어 쓰기
            </button>
            <button type="button" className={s.draftDiscard} disabled={!pickDraft || busy} onClick={() => void discard(pickDraft)}>
              버리기
            </button>
          </div>
        )}
        {info && <p className={s.info}>{info}</p>}

        <label className={s.field}>
          <span className={s.label}>제목</span>
          <span className={s.input}>
            <input value={d.title} maxLength={TITLE_MAX} onChange={(e) => set('title', e.target.value)} placeholder="공지 제목" autoFocus />
            <small>
              {d.title.length} / {TITLE_MAX}
            </small>
          </span>
        </label>

        <MarkdownEditor value={d.body} onChange={(v) => set('body', v)} placeholder="내용을 Markdown 으로 써 주세요." minHeight={180} />

        <div className={s.options}>
          <Option on={d.mustRead} onChange={(v) => set('mustRead', v)} title="필독" desc={'읽음 확인을 받고 홈 "꼭 확인할 것"에 올라가요'} />
          <Option on={d.pin} onChange={(v) => set('pin', v)} title="상단 고정" desc="목록 맨 위에 보여요">
            {d.pin && (
              <label className={s.dateChip}>
                <Calendar size={14} />
                <input type="date" value={d.pinUntil} min={kstDay(0)} onChange={(e) => set('pinUntil', e.target.value)} aria-label="고정 기한" />
                <span>{shortDay(d.pinUntil)}까지</span>
              </label>
            )}
          </Option>
          <Option on={d.pollOn} onChange={(v) => set('pollOn', v)} title="투표 넣기" desc="공지 하나에 투표 하나" />
        </div>

        <div className={s.audience} role="radiogroup" aria-label="대상">
          <span className={s.label}>
            <Users size={14} /> 대상
          </span>
          <Pill on={d.audience === 'ALL'} onClick={() => set('audience', 'ALL')}>
            전체 구성원
          </Pill>
          <Pill on={d.audience === 'PROJECT'} onClick={() => set('audience', 'PROJECT')}>
            프로젝트 참여자만
          </Pill>
          <Pill on={d.audience === 'MEMBER_TYPES'} onClick={() => set('audience', 'MEMBER_TYPES')}>
            구분 선택
          </Pill>
          {d.audience === 'PROJECT' && (
            <select className={s.audienceSel} value={d.projectKey} onChange={(e) => set('projectKey', e.target.value)} aria-label="대상 프로젝트">
              <option value="">프로젝트 고르기</option>
              {myProjects.map((p) => (
                <option key={p.projectKey} value={p.projectKey}>
                  {p.name} ({p.projectKey})
                </option>
              ))}
            </select>
          )}
          {d.audience === 'MEMBER_TYPES' &&
            MEMBER_TYPES.map((t) => (
              <Toggle
                key={t}
                on={d.memberTypes.includes(t)}
                onClick={() => set('memberTypes', d.memberTypes.includes(t) ? d.memberTypes.filter((x) => x !== t) : [...d.memberTypes, t])}
              >
                {MEMBER_TYPE_NAME[t]}
              </Toggle>
            ))}
        </div>

        {d.pollOn && (
          <section className={s.poll}>
            <div className={s.pollHead}>
              <SquareCheck size={18} />
              <strong>투표</strong>
              <span className={s.grow} />
              <Toggle on={d.multiple} onClick={() => set('multiple', !d.multiple)}>
                복수 선택
              </Toggle>
              <Toggle
                on={!d.anonymous}
                onClick={() => set('anonymous', !d.anonymous)}
                disabled={hadPoll}
                title={hadPoll ? '익명 여부는 투표를 만든 뒤 바꿀 수 없어요' : undefined}
              >
                기명
              </Toggle>
              <label className={s.resultSel}>
                결과:
                <select value={d.resultVisibility} onChange={(e) => set('resultVisibility', e.target.value as Form['resultVisibility'])}>
                  <option value="AFTER_VOTE">투표한 뒤 바로</option>
                  <option value="AFTER_CLOSE">마감 뒤</option>
                </select>
              </label>
            </div>
            <label className={s.field}>
              <span className={s.label}>질문</span>
              <span className={s.input}>
                <input value={d.question} maxLength={QUESTION_MAX} onChange={(e) => set('question', e.target.value)} placeholder="무엇을 물어볼까요?" />
              </span>
            </label>
            {d.options.map((o, i) => (
              <span key={i} className={s.optionRow}>
                <span className={s.optionNo}>{i + 1}</span>
                <input
                  value={o.label}
                  maxLength={OPTION_MAX}
                  placeholder={`선택지 ${i + 1}`}
                  onChange={(e) => set('options', d.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                {d.options.length > 2 && (
                  <button type="button" aria-label={`선택지 ${i + 1} 빼기`} onClick={() => set('options', d.options.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </button>
                )}
              </span>
            ))}
            <div className={s.pollFoot}>
              <button type="button" className={s.addOption} onClick={() => set('options', [...d.options, { optionId: null, label: '' }])}>
                <Plus size={14} /> 선택지 추가
              </button>
              <span className={s.grow} />
              <label className={s.deadline}>
                <Clock size={14} />
                마감
                <input type="datetime-local" value={d.closesAt} onChange={(e) => set('closesAt', e.target.value)} aria-label="투표 마감" />
              </label>
            </div>
          </section>
        )}

        <div className={s.files}>
          {files.map((f) => (
            <span key={f.key} className={`${s.file} ${f.state === 'failed' ? s.fileFailed : ''}`}>
              <Paperclip size={14} />
              {f.name} · {f.state === 'uploading' ? '올리는 중' : f.state === 'failed' ? '실패' : formatBytes(f.size)}
              <button type="button" aria-label={`${f.name} 빼기`} onClick={() => setFiles((p) => p.filter((x) => x.key !== f.key))}>
                <X size={14} />
              </button>
            </span>
          ))}
          <button type="button" className={s.upload} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> 파일 올리기 (최대 10개)
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </Modal>
  )
}

function Option({ on, onChange, title, desc, children }: { on: boolean; onChange: (v: boolean) => void; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className={`${s.option} ${on ? s.optionOn : ''}`}>
      <Switch checked={on} onChange={onChange} label={title} />
      <span className={s.optionText}>
        <strong>{title}</strong>
        <small>{desc}</small>
        {children}
      </span>
    </div>
  )
}

function Toggle({
  on,
  onClick,
  children,
  disabled,
  title,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <button type="button" aria-pressed={on} className={`${s.toggle} ${on ? s.toggleOn : ''}`} onClick={onClick} disabled={disabled} title={title}>
      {on && <Check size={14} />}
      {children}
    </button>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`${s.pill} ${on ? s.pillOn : ''}`} onClick={onClick}>
      {on && <Check size={14} />}
      {children}
    </button>
  )
}
