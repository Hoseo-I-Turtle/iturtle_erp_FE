// 거래 적기 · 고치기 창과 거래 상세 창 (ERP-44)
import { useRef, useState } from 'react'
import { Check, History, Paperclip, Pencil, Receipt, Trash2, Undo2, Upload, X } from 'lucide-react'
import { Button, Chip, Loadable, Modal, Note, Segmented, Select } from '../../components/ui'
import { errorText, fileUrl, uploadFile } from '../../api/content'
import { todayKst } from '../../api/projects'
import { ago, dotDate } from '../../api/types'
import { getDataMode } from '../../lib/dataMode'
import { whenLive } from '../../api/useResource'
import {
  KIND_LABEL,
  VERSION_LABEL,
  createEntry,
  deleteEntry,
  mockLedger,
  reimburseEntry,
  updateEntry,
  useLedgerEntry,
  won,
  type EntryInput,
  type EntryKind,
  type LedgerBook,
  type LedgerEntry,
  type LedgerEntryDetail,
  type LedgerVersion,
  type PaidFrom,
} from '../../api/ledger'
import { amountText, humanSize, memberName, parseAmount, useLedgerMembers } from './common'
import { Who } from './Who'
import s from './LedgerPage.module.css'

const MAX_RECEIPTS = 10

type Attachment = { key: string; name: string; size: number; publicId?: string; state: 'uploading' | 'done' | 'failed' }

// ─────────────── 거래 적기 · 고치기 ───────────────

type EntryFormProps = {
  bookId: number
  categories: string[]
  editing?: LedgerEntry
  onClose: () => void
  onSaved: (detail: LedgerEntryDetail) => void
}

export function EntryFormModal({ bookId, categories, editing, onClose, onSaved }: EntryFormProps) {
  const live = getDataMode() === 'live'
  const people = useLedgerMembers()
  const [entryDate, setEntryDate] = useState(editing?.entryDate ?? todayKst())
  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? 'EXPENSE')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [memberId, setMemberId] = useState(editing?.member ? String(editing.member.memberId) : '')
  const [paidFrom, setPaidFrom] = useState<PaidFrom>(editing?.paidFrom ?? 'ACCOUNT')
  // 비면 나 (고칠 때는 원래 사람)
  const [paidBy, setPaidBy] = useState(editing?.paidBy ? String(editing.paidBy.memberId) : '')
  const [files, setFiles] = useState<Attachment[]>(
    (editing?.receipts ?? []).map((r) => ({ key: r.publicId, name: r.name, size: r.size, publicId: r.publicId, state: 'done' })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const memberOptions = [{ value: '', label: '없음' }, ...people.active.map((m) => ({ value: String(m.memberId), label: m.name }))]
  const payerOptions = [{ value: '', label: '나' }, ...people.active.filter((m) => m.memberId !== people.meId).map((m) => ({ value: String(m.memberId), label: m.name }))]

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const room = MAX_RECEIPTS - files.length
    if (list.length > room) setError(`영수증은 ${MAX_RECEIPTS}개까지예요.`)
    for (const file of Array.from(list).slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      // 목업 모드는 올리지 않고 이름만 붙인다
      setFiles((p) => [...p, { key, name: file.name, size: file.size, state: live ? 'uploading' : 'done', publicId: live ? undefined : `mock-${file.name}` }])
      if (!live) continue
      try {
        const ref = await uploadFile(file)
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, publicId: ref.publicId, state: 'done' } : f)))
      } catch {
        setFiles((p) => p.map((f) => (f.key === key ? { ...f, state: 'failed' } : f)))
      }
    }
  }

  const save = async () => {
    const value = parseAmount(amount)
    if (!entryDate) return setError('날짜를 골라 주세요.')
    if (value <= 0) return setError('금액을 적어 주세요.')
    if (!category.trim()) return setError('분류를 골라 주세요.')
    if (!title.trim()) return setError('내용을 적어 주세요.')
    if (files.some((f) => f.state === 'uploading')) return setError('영수증을 올리는 중이에요. 끝나면 다시 눌러 주세요.')
    setError('')
    setBusy(true)
    const isMember = kind === 'EXPENSE' && paidFrom === 'MEMBER'
    const body: EntryInput = {
      entryDate,
      kind,
      amount: value,
      category: category.trim(),
      title: title.trim(),
      memo: memo.trim(),
      memberId: memberId ? Number(memberId) : null,
      paidFrom: kind === 'EXPENSE' ? paidFrom : 'ACCOUNT',
      // '나' 는 내 ID 를 그대로 보낸다 (비워 보내면 고칠 때 서버가 원래 낸 사람을 그대로 둔다)
      paidBy: isMember ? (paidBy ? Number(paidBy) : (people.meId ?? null)) : null,
      attachmentFileIds: files.filter((f) => f.state === 'done' && f.publicId).map((f) => f.publicId as string),
      version: editing?.version,
    }
    try {
      const saved = editing
        ? ((await whenLive(() => updateEntry(editing.entryId, body))) ?? mockLedger.updateEntry(editing.entryId, body))
        : ((await whenLive(() => createEntry(bookId, body))) ?? mockLedger.createEntry(bookId, body))
      onSaved(saved)
    } catch (e) {
      setError(errorText(e, editing ? '거래를 고치지 못했어요.' : '거래를 적지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? '거래 고치기' : '거래 적기'}
      onClose={onClose}
      width={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={save} disabled={busy}>
            {busy ? '저장하는 중…' : editing ? '고치기' : '적기'}
          </Button>
        </>
      }
    >
      <div className={s.form}>
        {editing && <p className={s.hint}>고치면 이전 모습이 기록으로 남아요.</p>}
        <div className={s.row}>
          <label className={s.field}>
            <span>날짜 *</span>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </label>
          <div className={s.field}>
            <span>수입 · 지출 *</span>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'INCOME' as const, label: '수입' },
                { value: 'EXPENSE' as const, label: '지출' },
              ]}
            />
          </div>
        </div>
        <div className={s.row}>
          <label className={s.field}>
            <span>금액 (원) *</span>
            <input
              className={s.amountInput}
              inputMode="numeric"
              value={amountText(amount)}
              placeholder="10,000"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 13))}
            />
          </label>
          <label className={s.field}>
            <span>분류 * (고르거나 새로 적기)</span>
            <input list="ledger-categories" value={category} maxLength={30} placeholder="회비 · 식비 · 장비 …" onChange={(e) => setCategory(e.target.value)} />
            <datalist id="ledger-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
        <label className={s.field}>
          <span>내용 *</span>
          <input value={title} maxLength={100} placeholder={kind === 'INCOME' ? '11월 회비' : '세미나 간식'} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={s.field}>
          <span>메모</span>
          <textarea rows={2} value={memo} maxLength={2000} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <div className={s.row}>
          <div className={s.field}>
            <span>관련 구성원 ({kind === 'INCOME' ? '회비를 낸 사람' : '받은 사람'}, 없어도 돼요)</span>
            <Select value={memberId} onChange={setMemberId} options={memberOptions} label="관련 구성원" />
          </div>
          {kind === 'EXPENSE' && (
            <div className={s.field}>
              <span>낸 곳</span>
              <Segmented
                value={paidFrom}
                onChange={setPaidFrom}
                options={[
                  { value: 'ACCOUNT' as const, label: '장부 계좌' },
                  { value: 'MEMBER' as const, label: '내 돈으로 먼저 냄' },
                ]}
              />
            </div>
          )}
        </div>
        {kind === 'EXPENSE' && paidFrom === 'MEMBER' && (
          <div className={s.row}>
            <div className={s.field}>
              <span>먼저 낸 사람</span>
              <Select value={paidBy} onChange={setPaidBy} options={payerOptions} label="먼저 낸 사람" />
            </div>
            <p className={s.hint} style={{ flex: 2, alignSelf: 'flex-end' }}>
              돌려받을 돈으로 남고, 계좌 주인이 돌려준 뒤 "돌려줌"으로 표시하면 그때 잔액에서 빠져요.
            </p>
          </div>
        )}
        <div className={s.field}>
          <span>영수증 ({files.length}/{MAX_RECEIPTS})</span>
          <div className={s.files}>
            {files.map((f) => (
              <span key={f.key} className={`${s.file} ${f.state === 'failed' ? s.fileFailed : ''}`}>
                <Paperclip size={14} />
                {f.name} · {f.state === 'uploading' ? '올리는 중' : f.state === 'failed' ? '실패' : humanSize(f.size)}
                <button type="button" aria-label={`${f.name} 빼기`} onClick={() => setFiles((p) => p.filter((x) => x.key !== f.key))}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {files.length < MAX_RECEIPTS && (
              <button type="button" className={s.upload} onClick={() => fileInput.current?.click()}>
                <Upload size={14} /> 영수증 올리기
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept="image/*,application/pdf"
              onChange={(e) => {
                void addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        {error && <p className={s.error}>{error}</p>}
      </div>
    </Modal>
  )
}

// ─────────────── 거래 상세 ───────────────

type DetailProps = {
  entryId: number
  book: LedgerBook
  onClose: () => void
  /** 지우기 · 돌려줌 뒤 (목록 · 요약 다시 불러오기) */
  onChanged: () => void
  onEdit: (entry: LedgerEntry) => void
}

export function EntryDetailModal({ entryId, book, onClose, onChanged, onEdit }: DetailProps) {
  const detail = useLedgerEntry(entryId)
  return (
    <Modal title="거래" onClose={onClose} width={680}>
      <Loadable resource={detail} label="거래">
        {(d) => (
          <EntryDetailBody
            d={d}
            book={book}
            onEdit={onEdit}
            onChanged={(next) => {
              detail.setData(() => next)
              onChanged()
            }}
          />
        )}
      </Loadable>
    </Modal>
  )
}

function EntryDetailBody({
  d,
  book,
  onEdit,
  onChanged,
}: {
  d: LedgerEntryDetail
  book: LedgerBook
  onEdit: (entry: LedgerEntry) => void
  onChanged: (next: LedgerEntryDetail) => void
}) {
  const e = d.entry
  const people = useLedgerMembers()
  const [mode, setMode] = useState<'none' | 'delete' | 'reimburse'>('none')
  const [reason, setReason] = useState('')
  const [paidOn, setPaidOn] = useState(todayKst())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (call: () => Promise<LedgerEntryDetail>, mock: () => LedgerEntryDetail, fail: string) => {
    setError('')
    setBusy(true)
    try {
      onChanged((await whenLive(call)) ?? mock())
      setMode('none')
    } catch (err) {
      setError(errorText(err, fail))
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!reason.trim()) return setError('지우는 이유를 적어 주세요.')
    void run(() => deleteEntry(e.entryId, reason.trim(), e.version), () => mockLedger.deleteEntry(e.entryId, reason.trim()), '지우지 못했어요.')
  }
  const reimburse = () =>
    void run(() => reimburseEntry(e.entryId, paidOn, e.version), () => mockLedger.reimburse(e.entryId, paidOn), '돌려줌으로 표시하지 못했어요.')

  const canReimburse = book.canManage && !book.archived && !e.deleted && e.reimbursement === 'PENDING'

  return (
    <div className={s.form}>
      <div className={s.headAmount}>
        <Chip tone={e.kind === 'INCOME' ? 'tint' : 'muted'}>{KIND_LABEL[e.kind]}</Chip>
        <strong className={e.kind === 'INCOME' ? s.income : s.expense}>
          {e.kind === 'INCOME' ? '+' : '−'}
          {won(e.amount)}
        </strong>
        <span>{e.title}</span>
        {e.deleted && <Chip tone="danger">지움</Chip>}
        <ReimburseChip entry={e} />
      </div>

      {e.deleted && (
        <Note icon={Trash2} tone="warning">
          {memberName(e.deletedBy)} 님이 지웠어요: {e.deleteReason || '—'}. 잔액 · 합계에서 빠져요.
        </Note>
      )}

      <dl className={s.facts}>
        <dt>날짜</dt>
        <dd>{dotDate(e.entryDate)}</dd>
        <dt>분류</dt>
        <dd>{e.category}</dd>
        <dt>메모</dt>
        <dd style={{ whiteSpace: 'pre-wrap' }}>{e.memo || '—'}</dd>
        <dt>관련 구성원</dt>
        <dd>{e.member ? <Who m={e.member} /> : '—'}</dd>
        <dt>낸 곳</dt>
        <dd>{e.paidFrom === 'MEMBER' ? `${memberName(e.paidBy)} 님이 먼저 냄` : '장부 계좌'}</dd>
        {e.reimbursement === 'DONE' && (
          <>
            <dt>돌려줌</dt>
            <dd>
              {dotDate(e.reimbursedOn)} · {memberName(e.reimbursedBy)}
            </dd>
          </>
        )}
        <dt>그때 잔액</dt>
        <dd>{won(e.balanceAfter)}</dd>
        <dt>적은 사람</dt>
        <dd>
          <Who m={e.createdBy} /> <small className={s.hint}>{ago(e.createdAt)}</small>
        </dd>
        {e.updatedBy && (
          <>
            <dt>고친 사람</dt>
            <dd>
              <Who m={e.updatedBy} /> <small className={s.hint}>{ago(e.updatedAt)}</small>
            </dd>
          </>
        )}
      </dl>

      <section className={s.block}>
        <h3>
          <Receipt size={16} /> 영수증
        </h3>
        {e.receipts.length === 0 ? (
          <p className={s.hint}>붙인 영수증이 없어요.</p>
        ) : (
          <div className={s.files}>
            {e.receipts.map((r) => (
              <a key={r.publicId} className={s.file} href={fileUrl(r.publicId)} target="_blank" rel="noreferrer" aria-label={`${r.name} 내려받기`}>
                <Paperclip size={14} /> {r.name} · {humanSize(r.size)}
              </a>
            ))}
          </div>
        )}
      </section>

      {d.versions.length > 0 && (
        <section className={s.block}>
          <h3>
            <History size={16} /> 이전 모습
          </h3>
          <ul className={s.versions}>
            {d.versions.map((v) => (
              <VersionRow key={`${v.version}-${v.action}`} v={v} nameOf={people.nameOf} />
            ))}
          </ul>
        </section>
      )}

      {mode === 'delete' && (
        <div className={s.confirm}>
          <label className={s.field}>
            <span>지우는 이유 * (행은 남고 이유가 모두에게 보여요)</span>
            <input value={reason} maxLength={200} autoFocus onChange={(ev) => setReason(ev.target.value)} placeholder="같은 거래를 두 번 적음" />
          </label>
          <div className={s.actions}>
            <Button variant="secondary" onClick={() => setMode('none')}>
              그만두기
            </Button>
            <Button icon={Trash2} onClick={remove} disabled={busy}>
              지우기
            </Button>
          </div>
        </div>
      )}
      {mode === 'reimburse' && (
        <div className={s.confirm}>
          <label className={s.field}>
            <span>
              {memberName(e.paidBy)} 님에게 {won(e.amount)} 돌려준 날
            </span>
            <input type="date" value={paidOn} onChange={(ev) => setPaidOn(ev.target.value)} />
          </label>
          <div className={s.actions}>
            <Button variant="secondary" onClick={() => setMode('none')}>
              그만두기
            </Button>
            <Button icon={Undo2} onClick={reimburse} disabled={busy}>
              돌려줌 표시
            </Button>
          </div>
        </div>
      )}

      {error && <p className={s.error}>{error}</p>}

      {mode === 'none' && (e.canEdit || canReimburse) && (
        <div className={s.actions}>
          {canReimburse && (
            <Button icon={Undo2} onClick={() => setMode('reimburse')}>
              돌려줌 표시
            </Button>
          )}
          {e.canEdit && !e.deleted && (
            <>
              <Button variant="secondary" icon={Pencil} onClick={() => onEdit(e)}>
                고치기
              </Button>
              <Button variant="secondary" icon={Trash2} onClick={() => setMode('delete')}>
                지우기
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ReimburseChip({ entry: e }: { entry: LedgerEntry }) {
  if (e.reimbursement === 'PENDING') return <Chip tone="warning">돌려받을 돈</Chip>
  if (e.reimbursement === 'DONE') return <Chip tone="tint">돌려줌</Chip>
  return null
}

function VersionRow({ v, nameOf }: { v: LedgerVersion; nameOf: (id: unknown) => string }) {
  const snap = v.snapshot
  const kind = snap.kind === 'INCOME' || snap.kind === 'EXPENSE' ? KIND_LABEL[snap.kind] : String(snap.kind ?? '')
  const amount = typeof snap.amount === 'number' ? won(snap.amount) : String(snap.amount ?? '')
  const paid =
    snap.paidFrom === 'MEMBER'
      ? ` · ${nameOf(snap.paidBy)} 먼저 냄${snap.reimbursement === 'DONE' ? ' (돌려줌)' : snap.reimbursement === 'PENDING' ? ' (돌려받을 돈)' : ''}`
      : ' · 장부 계좌'
  return (
    <li>
      <span>
        <strong>v{v.version}</strong> {VERSION_LABEL[v.action] ?? v.action}
        <small>
          {' '}
          · {memberName(v.changedBy)} · {ago(v.changedAt)}
        </small>
      </span>
      <span>
        {dotDate(String(snap.entryDate ?? ''))} · {kind} {amount} · {String(snap.category ?? '')} · {String(snap.title ?? '')}
        {paid}
        {typeof snap.memberId === 'number' ? ` · 관련 ${nameOf(snap.memberId)}` : ''}
      </span>
      {typeof snap.memo === 'string' && snap.memo && <p>{snap.memo}</p>}
    </li>
  )
}
