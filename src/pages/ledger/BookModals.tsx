// 장부 만들기 · 고치기 창과 계좌 주인 넘기기 창 (ERP-44)
import { useState } from 'react'
import { ArrowRightLeft, Check } from 'lucide-react'
import { Button, Checkbox, Modal, Note, Select } from '../../components/ui'
import { errorText } from '../../api/content'
import { todayKst } from '../../api/projects'
import { whenLive } from '../../api/useResource'
import { createBook, handOverBook, mockLedger, updateBook, won, type BookInput, type HandoverInput, type LedgerBook } from '../../api/ledger'
import { amountText, memberName, parseAmount, useLedgerMembers } from './common'
import s from './LedgerPage.module.css'

// ─────────────── 장부 만들기 · 고치기 ───────────────

type BookFormProps = { editing?: LedgerBook; onClose: () => void; onSaved: (book: LedgerBook) => void }

export function BookFormModal({ editing, onClose, onSaved }: BookFormProps) {
  const people = useLedgerMembers()
  const [name, setName] = useState(editing?.name ?? '')
  const [holderId, setHolderId] = useState('')
  const [bankName, setBankName] = useState(editing?.bankName ?? '')
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [archived, setArchived] = useState(editing?.archived ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const holderOptions = [
    { value: '', label: '나' },
    ...people.active.filter((m) => m.memberId !== people.meId).map((m) => ({ value: String(m.memberId), label: m.name })),
  ]

  const save = async () => {
    if (editing && !name.trim()) return setError('장부 이름을 적어 주세요.')
    setError('')
    setBusy(true)
    // 고칠 때 빈 글자는 그 칸을 비운다 (안 보내면 그대로)
    const body: BookInput = editing
      ? { name: name.trim(), bankName: bankName.trim(), accountNumber: accountNumber.trim(), note: note.trim(), archived, version: editing.version }
      : {
          name: name.trim() || undefined,
          holderId: holderId ? Number(holderId) : undefined,
          bankName: bankName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          note: note.trim() || undefined,
        }
    try {
      const saved = editing
        ? ((await whenLive(() => updateBook(editing.bookId, body))) ?? mockLedger.updateBook(editing.bookId, body))
        : ((await whenLive(() => createBook(body))) ?? mockLedger.createBook(body))
      onSaved(saved)
    } catch (e) {
      setError(errorText(e, editing ? '장부를 고치지 못했어요.' : '장부를 만들지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? '장부 고치기' : '장부 만들기'}
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={save} disabled={busy}>
            {editing ? '고치기' : '만들기'}
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <p className={s.hint}>
          장부 하나가 계좌 하나예요. 계좌번호는 회비를 보낼 수 있게 구성원 모두에게 보여요.
          {editing ? ' 계좌 주인은 "계좌 주인 넘기기"로 바꿔요.' : ''}
        </p>
        <label className={s.field}>
          <span>장부 이름{editing ? ' *' : ' (비우면 "연구실 운영비")'}</span>
          <input value={name} maxLength={50} placeholder="연구실 운영비" onChange={(e) => setName(e.target.value)} />
        </label>
        {!editing && (
          <div className={s.field}>
            <span>계좌 주인</span>
            <Select value={holderId} onChange={setHolderId} options={holderOptions} label="계좌 주인" />
          </div>
        )}
        <div className={s.row}>
          <label className={s.field}>
            <span>은행</span>
            <input value={bankName} maxLength={30} placeholder="토스뱅크" onChange={(e) => setBankName(e.target.value)} />
          </label>
          <label className={s.field}>
            <span>계좌번호</span>
            <input value={accountNumber} maxLength={40} placeholder="1000-1234-5678" onChange={(e) => setAccountNumber(e.target.value)} />
          </label>
        </div>
        <label className={s.field}>
          <span>메모</span>
          <textarea rows={2} value={note} maxLength={500} placeholder="회비는 매달 10일까지 1만 원" onChange={(e) => setNote(e.target.value)} />
        </label>
        {editing && (
          <Checkbox checked={archived} onChange={setArchived} className={s.check}>
            장부 닫기 — 닫으면 읽기만 할 수 있어요 (적기 · 고치기 · 지우기 · 넘기기가 막혀요)
          </Checkbox>
        )}
        {error && <p className={s.error}>{error}</p>}
      </div>
    </Modal>
  )
}

// ─────────────── 계좌 주인 넘기기 ───────────────

type HandoverProps = { book: LedgerBook; onClose: () => void; onSaved: (book: LedgerBook) => void }

export function HandoverModal({ book, onClose, onSaved }: HandoverProps) {
  const people = useLedgerMembers()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState(book.balance > 0 ? String(book.balance) : '')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [handedOn, setHandedOn] = useState(todayKst())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const options = [
    { value: '', label: '고르기' },
    ...people.active.filter((m) => m.memberId !== book.holder?.memberId).map((m) => ({ value: String(m.memberId), label: m.name })),
  ]

  const save = async () => {
    if (!to) return setError('새 계좌 주인을 골라 주세요.')
    setError('')
    setBusy(true)
    const body: HandoverInput = {
      toHolderId: Number(to),
      amount: amount ? parseAmount(amount) : undefined,
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      note: note.trim() || undefined,
      handedOn: handedOn || undefined,
    }
    try {
      onSaved((await whenLive(() => handOverBook(book.bookId, body))) ?? mockLedger.handOver(book.bookId, body))
    } catch (e) {
      setError(errorText(e, '넘기지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="계좌 주인 넘기기"
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={ArrowRightLeft} onClick={save} disabled={busy}>
            넘기기
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <Note icon={ArrowRightLeft}>
          {memberName(book.holder)} 님 → 새 주인. 넘긴 기록(누가 · 누구에게 · 얼마 · 언제)이 장부에 남고, 계좌 정보가 새 계좌로 바뀌어요. 지금 잔액은{' '}
          {won(book.balance)}이에요.
        </Note>
        <div className={s.row}>
          <div className={s.field}>
            <span>새 계좌 주인 *</span>
            <Select value={to} onChange={setTo} options={options} label="새 계좌 주인" />
          </div>
          <label className={s.field}>
            <span>넘긴 날</span>
            <input type="date" value={handedOn} onChange={(e) => setHandedOn(e.target.value)} />
          </label>
        </div>
        <label className={s.field}>
          <span>옮긴 금액 (원, 기록용 — 잔액은 바뀌지 않아요. 모르면 비우기)</span>
          <input inputMode="numeric" value={amountText(amount)} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 13))} />
        </label>
        <div className={s.row}>
          <label className={s.field}>
            <span>새 은행 (비우면 그대로)</span>
            <input value={bankName} maxLength={30} placeholder={book.bankName ?? ''} onChange={(e) => setBankName(e.target.value)} />
          </label>
          <label className={s.field}>
            <span>새 계좌번호 (비우면 그대로)</span>
            <input value={accountNumber} maxLength={40} placeholder={book.accountNumber ?? ''} onChange={(e) => setAccountNumber(e.target.value)} />
          </label>
        </div>
        <label className={s.field}>
          <span>메모</span>
          <textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className={s.error}>{error}</p>}
      </div>
    </Modal>
  )
}
