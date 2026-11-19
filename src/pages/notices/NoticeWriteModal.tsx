import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock, Info, Paperclip, Plus, SquareCheck, Upload, X } from 'lucide-react'
import { Button, Modal, Switch } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { ApiError } from '../../api/client'
import { kstInstant, createNotice, type NoticeCreateBody } from '../../api/communication'
import { uploadFile } from '../../api/content'
import { useMe } from '../../api/members'
import { getDataMode } from '../../lib/dataMode'
import s from './NoticeWriteModal.module.css'

const TITLE_MAX = 100
const BODY_MAX = 20000
const QUESTION_MAX = 100
const OPTION_MAX = 50
const DRAFT_KEY = 'iturtle.notice-draft'

type Attachment = {
  key: string
  name: string
  size: number
  publicId?: string
  state: 'uploading' | 'done' | 'failed'
}
type Draft = {
  title: string
  body: string
  mustRead: boolean
  pin: boolean
  pinUntil: string
  pollOn: boolean
  question: string
  options: string[]
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
const emptyDraft = (): Draft => ({
  title: '',
  body: '',
  mustRead: false,
  pin: false,
  pinUntil: kstDay(7),
  pollOn: false,
  question: '',
  options: ['', ''],
  multiple: false,
  anonymous: false,
  resultVisibility: 'AFTER_VOTE',
  closesAt: `${kstDay(3)}T18:00`,
})
const readDraft = (): Draft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) } : null
  } catch {
    return null
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
  const [initial] = useState(() => readDraft())
  const [d, setD] = useState<Draft>(() => initial ?? emptyDraft())
  const [files, setFiles] = useState<Attachment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(initial ? '임시 저장한 글을 불러왔어요.' : null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setFiles((p) => [
        ...p,
        {
          key,
          name: file.name,
          size: file.size,
          state: getDataMode() === 'live' ? 'uploading' : 'done',
        },
      ])
      if (getDataMode() !== 'live') continue
      try {
        const ref = await uploadFile(file)
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, publicId: ref.publicId, state: 'done' } : f)))
      } catch {
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, state: 'failed' } : f)))
      }
    }
  }

  const validate = (): string | null => {
    if (!d.title.trim()) return '제목을 써 주세요.'
    if (d.title.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지예요.`
    if (!d.body.trim()) return '본문을 써 주세요.'
    if (d.body.length > BODY_MAX) return '본문은 20,000자까지예요.'
    if (d.pin && d.pinUntil < kstDay(0)) return '고정 기한은 오늘이나 그 뒤로 골라 주세요.'
    if (d.pollOn) {
      if (!d.question.trim()) return '투표 질문을 써 주세요.'
      const opts = d.options.map((o) => o.trim()).filter(Boolean)
      if (opts.length < 2) return '선택지를 2개 이상 넣어 주세요.'
      if (new Set(opts).size !== opts.length) return '같은 선택지가 두 번 있어요.'
      if (Date.parse(localToIso(d.closesAt)) <= Date.now()) return '투표 마감은 지금보다 뒤로 골라 주세요.'
    }
    if (files.some((f) => f.state === 'uploading')) return '파일을 올리는 중이에요. 끝나면 올려 주세요.'
    return null
  }

  const submit = async () => {
    const v = validate()
    if (v) return setError(v)
    setError(null)
    const body: NoticeCreateBody = {
      title: d.title.trim(),
      body: d.body,
      mustRead: d.mustRead,
      pinnedUntilOn: d.pin ? d.pinUntil : null,
      attachmentFileIds: files.filter((f) => f.state === 'done' && f.publicId).map((f) => f.publicId as string),
      poll: d.pollOn
        ? {
            question: d.question.trim(),
            options: d.options.map((o) => o.trim()).filter(Boolean),
            multiple: d.multiple,
            maxChoices: null,
            anonymous: d.anonymous,
            resultVisibility: d.resultVisibility,
            closesAt: localToIso(d.closesAt),
          }
        : null,
    }
    if (getDataMode() !== 'live') {
      localStorage.removeItem(DRAFT_KEY)
      onClose()
      return
    }
    setBusy(true)
    try {
      const id = await createNotice(body)
      localStorage.removeItem(DRAFT_KEY)
      onCreated?.()
      onClose()
      navigate(`/notices/${id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '공지를 올리지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
      setNotice('이 브라우저에 임시 저장했어요. 첨부 파일은 저장되지 않아요.')
    } catch {
      setNotice('임시 저장하지 못했어요.')
    }
  }

  return (
    <Modal
      title="새 공지"
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
              {d.mustRead ? '필독은 대상자에게 끌 수 없는 알림이 가요.' : '올리면 구성원에게 알림이 가요.'}
            </span>
          )}
          <Button variant="secondary" onClick={saveDraft} disabled={busy}>
            임시 저장
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy}>
            {busy ? '올리는 중…' : '올리기'}
          </Button>
        </>
      }
    >
      {/* 모달 본문은 넘치면 스크롤된다. 안의 칸들이 줄어들어 겹치지 않게 한 덩어리로 둔다 */}
      <div className={s.form}>
        {notice && <p className={s.info}>{notice}</p>}

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

        {d.pollOn && (
          <section className={s.poll}>
            <div className={s.pollHead}>
              <SquareCheck size={18} />
              <strong>투표</strong>
              <span className={s.grow} />
              <Toggle on={d.multiple} onClick={() => set('multiple', !d.multiple)}>
                복수 선택
              </Toggle>
              <Toggle on={!d.anonymous} onClick={() => set('anonymous', !d.anonymous)}>
                기명
              </Toggle>
              <label className={s.resultSel}>
                결과:
                <select value={d.resultVisibility} onChange={(e) => set('resultVisibility', e.target.value as Draft['resultVisibility'])}>
                  <option value="AFTER_VOTE">투표한 뒤 바로</option>
                  <option value="AFTER_CLOSE">마감 뒤</option>
                </select>
              </label>
            </div>
            <label className={s.field}>
              <span className={s.label}>질문</span>
              <span className={s.input}>
                <input
                  value={d.question}
                  maxLength={QUESTION_MAX}
                  onChange={(e) => set('question', e.target.value)}
                  placeholder="무엇을 물어볼까요?"
                />
              </span>
            </label>
            {d.options.map((o, i) => (
              <span key={i} className={s.optionRow}>
                <span className={s.optionNo}>{i + 1}</span>
                <input
                  value={o}
                  maxLength={OPTION_MAX}
                  placeholder={`선택지 ${i + 1}`}
                  onChange={(e) =>
                    set(
                      'options',
                      d.options.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
                {d.options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`선택지 ${i + 1} 빼기`}
                    onClick={() =>
                      set(
                        'options',
                        d.options.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </span>
            ))}
            <div className={s.pollFoot}>
              <button type="button" className={s.addOption} onClick={() => set('options', [...d.options, ''])}>
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
            <Upload size={14} /> 파일 올리기
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

function Option({
  on,
  onChange,
  title,
  desc,
  children,
}: {
  on: boolean
  onChange: (v: boolean) => void
  title: string
  desc: string
  children?: ReactNode
}) {
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

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} className={`${s.toggle} ${on ? s.toggleOn : ''}`} onClick={onClick}>
      {on && <Check size={14} />}
      {children}
    </button>
  )
}
