import { useRef, useState, type MouseEvent } from 'react'
import { Calendar, Check, Clock, Info, Paperclip, Plus, SquareCheck, Upload, X } from 'lucide-react'
import { Button, Field, FormError, Modal, Switch, TextInput, ToggleChip } from '../../components/ui'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { addMockNotice, createNotice, type NoticeDraft } from '../../api/notices'
import { addDaysYmd, formatBytes, kstInstant } from '../../api/communication'
import { errorText, uploadFile } from '../../api/content'
import { todayKst } from '../../api/projects'
import { getDataMode } from '../../lib/dataMode'
import { ME } from '../../mocks/notices'
import type { MemberRef } from '../../api/types'
import s from './NoticeWriteModal.module.css'

type MemberType = MemberRef['memberType']
type Attachment = { publicId: string; name: string; size: number }
type Form = {
  title: string
  body: string
  mustRead: boolean
  pinned: boolean
  pinnedUntilOn: string
  hasPoll: boolean
  question: string
  options: string[]
  multiple: boolean
  anonymous: boolean
  resultAfterClose: boolean
  /** 비어 있으면 전체 구성원 */
  audience: MemberType[]
  closesDay: string
  closesTime: string
  attachments: Attachment[]
}

const TYPES: [MemberType, string][] = [
  ['PROFESSOR', '교수'],
  ['STUDENT', '학생'],
  ['INTERN', '인턴'],
]
const MAX_FILES = 10
const DRAFT_KEY = 'iturtle.noticeDraft'

const blank = (): Form => ({
  title: '',
  body: '',
  mustRead: false,
  pinned: false,
  pinnedUntilOn: addDaysYmd(todayKst(), 7),
  hasPoll: false,
  question: '',
  options: ['', ''],
  multiple: false,
  anonymous: false,
  resultAfterClose: false,
  audience: [],
  closesDay: addDaysYmd(todayKst(), 3),
  closesTime: '18:00',
  attachments: [],
})

/** 임시 저장한 글이 있으면 이어서 쓴다 (이 브라우저 탭 안에서만) */
function loadDraft(): Form {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? { ...blank(), ...(JSON.parse(raw) as Partial<Form>) } : blank()
  } catch {
    return blank()
  }
}

type Props = {
  onClose: () => void
  /** 올린 뒤. 실서버면 새 공지 번호, 목업이면 null */
  onCreated: (noticeId: number | null) => void
}

/** 새 공지 (Penpot 06 · 공지 쓰기) — N-3 */
export function NoticeWriteModal({ onClose, onCreated }: Props) {
  const [f, setF] = useState<Form>(loadDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setSaved(false)
  }

  /** 옵션 카드는 어디를 눌러도 켜고 끈다 (스위치 · 날짜 입력은 제 몫을 한다) */
  const optClick = (e: MouseEvent<HTMLDivElement>, k: 'mustRead' | 'pinned' | 'hasPoll') => {
    if ((e.target as HTMLElement).closest('button, input, label')) return
    set(k, !f[k])
  }

  const options = f.options.map((o) => o.trim()).filter(Boolean)
  const problem =
    !f.title.trim()
      ? '제목을 적어 주세요.'
      : !f.body.trim()
        ? '내용을 적어 주세요.'
        : f.hasPoll && !f.question.trim()
          ? '투표 질문을 적어 주세요.'
          : f.hasPoll && options.length < 2
            ? '선택지는 2개 이상이어야 해요.'
            : f.hasPoll && new Set(options).size !== options.length
              ? '같은 선택지가 있어요.'
              : null

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_FILES - f.attachments.length
    const picked = [...files].slice(0, room)
    setError(files.length > room ? `첨부는 ${MAX_FILES}개까지 올릴 수 있어요.` : null)
    setBusy(true)
    try {
      const added: Attachment[] = []
      for (const file of picked) {
        if (getDataMode() === 'live') {
          const ref = await uploadFile(file)
          added.push({ publicId: ref.publicId, name: ref.name, size: ref.size })
        } else added.push({ publicId: `mock-${file.name}-${file.size}`, name: file.name, size: file.size })
      }
      set('attachments', [...f.attachments, ...added])
    } catch (e) {
      setError(errorText(e, '파일을 올리지 못했어요.'))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const saveDraft = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f))
      setSaved(true)
    } catch {
      setError('임시 저장을 하지 못했어요.')
    }
  }

  const submit = async () => {
    if (problem) return setError(problem)
    const [hh, mm] = f.closesTime.split(':').map(Number)
    const draft: NoticeDraft = {
      title: f.title.trim(),
      body: f.body,
      mustRead: f.mustRead,
      pinnedUntilOn: f.pinned ? f.pinnedUntilOn : null,
      attachmentFileIds: f.attachments.map((a) => a.publicId),
      poll: f.hasPoll
        ? {
            question: f.question.trim(),
            options,
            multiple: f.multiple,
            anonymous: f.anonymous,
            resultVisibility: f.resultAfterClose ? 'AFTER_CLOSE' : 'AFTER_VOTE',
            audienceMemberTypes: f.audience.length ? f.audience : null,
            closesAt: kstInstant(f.closesDay, hh * 60 + mm),
          }
        : null,
    }
    setBusy(true)
    setError(null)
    try {
      let id: number | null = null
      if (getDataMode() === 'live') id = await createNotice(draft)
      else addMockNotice(draft, ME)
      sessionStorage.removeItem(DRAFT_KEY)
      onCreated(id)
    } catch (e) {
      setError(errorText(e, '공지를 올리지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="새 공지"
      width={1000}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span className={s.footNote}>
            <Info size={16} />
            {saved ? '임시 저장했어요. 이 탭을 닫기 전까지 이어서 쓸 수 있어요.' : '올리면 대상자에게 알림이 가요. 필독은 끌 수 없는 알림이에요.'}
          </span>
          <Button variant="secondary" onClick={saveDraft} disabled={busy}>
            임시 저장
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy}>
            {busy ? '올리는 중…' : '올리기'}
          </Button>
        </div>
      }
    >
      <Field label="제목">
        <TextInput
          value={f.title}
          onChange={(v) => set('title', v.slice(0, 100))}
          placeholder="공지 제목"
          trailing={`${f.title.length} / 100`}
          autoFocus
        />
      </Field>

      <MarkdownEditor value={f.body} onChange={(v) => set('body', v)} placeholder="공지 내용을 적어 주세요. Markdown 을 쓸 수 있어요." minHeight={170} />

      <div className={s.options}>
        <div className={f.mustRead ? `${s.opt} ${s.optOn}` : s.opt} onClick={(e) => optClick(e, 'mustRead')}>
          <Switch checked={f.mustRead} onChange={(v) => set('mustRead', v)} label="필독" />
          <span>
            <strong>필독</strong>
            <small>읽음 확인을 받고 홈 "꼭 확인할 것"에 올라가요</small>
          </span>
        </div>
        <div className={f.pinned ? `${s.opt} ${s.optOn}` : s.opt} onClick={(e) => optClick(e, 'pinned')}>
          <Switch checked={f.pinned} onChange={(v) => set('pinned', v)} label="상단 고정" />
          <span>
            <strong>상단 고정</strong>
            <small>목록 맨 위에 보여요 (최대 3개)</small>
            {f.pinned && (
              <label className={s.dateChip}>
                <Calendar size={14} />
                <input type="date" value={f.pinnedUntilOn} min={todayKst()} onChange={(e) => set('pinnedUntilOn', e.target.value)} aria-label="고정 기한" />
                까지
              </label>
            )}
          </span>
        </div>
        <div className={f.hasPoll ? `${s.opt} ${s.optOn}` : s.opt} onClick={(e) => optClick(e, 'hasPoll')}>
          <Switch checked={f.hasPoll} onChange={(v) => set('hasPoll', v)} label="투표 넣기" />
          <span>
            <strong>투표 넣기</strong>
            <small>공지 하나에 투표 하나</small>
          </span>
        </div>
      </div>

      {f.hasPoll && (
        <>
          {/* 명세 확인 필요: 디자인의 "대상"은 공지 전체에 걸려 있지만 N-3 에는 투표 대상(audienceMemberTypes)만 있다 */}
          <div className={s.target}>
            <span>투표 대상</span>
            <ToggleChip on={f.audience.length === 0} check onClick={() => set('audience', [])}>
              전체 구성원
            </ToggleChip>
            {TYPES.map(([t, label]) => (
              <ToggleChip
                key={t}
                on={f.audience.includes(t)}
                check
                onClick={() => set('audience', f.audience.includes(t) ? f.audience.filter((x) => x !== t) : [...f.audience, t])}
              >
                {label}
              </ToggleChip>
            ))}
          </div>

          <section className={s.vote}>
            <div className={s.voteHead}>
              <SquareCheck size={18} />
              <strong>투표</strong>
              <span className={s.voteChips}>
                <ToggleChip on={f.multiple} check onClick={() => set('multiple', !f.multiple)}>
                  복수 선택
                </ToggleChip>
                <ToggleChip on={!f.anonymous} check onClick={() => set('anonymous', !f.anonymous)}>
                  {f.anonymous ? '익명' : '기명'}
                </ToggleChip>
                <ToggleChip on={false} onClick={() => set('resultAfterClose', !f.resultAfterClose)}>
                  결과: {f.resultAfterClose ? '마감 뒤' : '투표한 뒤 바로'}
                </ToggleChip>
              </span>
            </div>
            <Field label="질문">
              <TextInput value={f.question} onChange={(v) => set('question', v.slice(0, 100))} placeholder="무엇을 정하나요?" />
            </Field>
            {f.options.map((o, i) => (
              <label key={i} className={s.choice}>
                <b>{i + 1}</b>
                <input
                  value={o}
                  placeholder={`선택지 ${i + 1}`}
                  maxLength={50}
                  onChange={(e) => set('options', f.options.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {f.options.length > 2 && (
                  <button type="button" aria-label={`선택지 ${i + 1} 지우기`} onClick={() => set('options', f.options.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </button>
                )}
              </label>
            ))}
            <div className={s.voteFoot}>
              <ToggleChip on={false} icon={Plus} disabled={f.options.length >= 20} onClick={() => set('options', [...f.options, ''])}>
                선택지 추가
              </ToggleChip>
              <label className={s.deadline}>
                <Clock size={14} />
                마감
                <input type="date" value={f.closesDay} min={todayKst()} onChange={(e) => set('closesDay', e.target.value)} aria-label="투표 마감 날짜" />
                <input type="time" value={f.closesTime} step={1800} onChange={(e) => set('closesTime', e.target.value)} aria-label="투표 마감 시각" />
              </label>
            </div>
            <p className={s.voteNote}>익명 · 기명은 올린 뒤 바꿀 수 없어요.</p>
          </section>
        </>
      )}

      <div className={s.attach}>
        {f.attachments.map((a) => (
          <span key={a.publicId} className={s.file}>
            <Paperclip size={14} />
            {a.name} · {formatBytes(a.size)}
            <button type="button" aria-label={`${a.name} 빼기`} onClick={() => set('attachments', f.attachments.filter((x) => x !== a))}>
              <X size={14} />
            </button>
          </span>
        ))}
        <button type="button" className={s.upload} disabled={busy || f.attachments.length >= MAX_FILES} onClick={() => fileInput.current?.click()}>
          <Upload size={14} />
          파일 올리기 (최대 {MAX_FILES}개 · 200MB)
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>

      <FormError>{error}</FormError>
    </Modal>
  )
}
