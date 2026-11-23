import { useState } from 'react'
import { ArrowRightLeft, BookOpen, Check, Copy, HandCoins, Lock, Plus, Search, Settings, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Button, Card, Checkbox, Chip, Empty, FilterSelect, Loadable, Note, PillTabs, SectionHead, Segmented } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { ago, dotDate } from '../../api/types'
import {
  useLedgerEntries,
  useLedgerOverview,
  won,
  type EntryFilter,
  type EntryKind,
  type LedgerBook,
  type LedgerEntry,
  type LedgerEntryList,
  type LedgerHandover,
  type LedgerOverview,
} from '../../api/ledger'
import { memberName } from './common'
import { Who } from './Who'
import { EntryDetailModal, EntryFormModal, ReimburseChip } from './EntryModals'
import { BookFormModal, HandoverModal } from './BookModals'
import s from './LedgerPage.module.css'

type Dialog =
  | { type: 'book-new' }
  | { type: 'book-edit' }
  | { type: 'handover' }
  | { type: 'entry-new' }
  | { type: 'entry-edit'; entry: LedgerEntry }
  | { type: 'entry'; entryId: number }
  | null

/**
 * 회계 장부 (ERP-44). 연구실 돈은 구성원 개인 계좌로 관리한다 — 장부 하나가 계좌 하나, 계좌 주인만 둔다.
 * 누구나 적고 모두 보며, 고치고 지운 기록도 남는다. 구성원이 먼저 낸 지출은 돌려받을 돈으로 두었다가 계좌 주인이 돌려줌으로 표시한다.
 */
export function LedgerPage() {
  const overview = useLedgerOverview()
  return (
    <>
      <PageHeader title="회계" subtitle="연구실 돈 — 모두 보고 누구나 적어요" action={null} />
      {/* 한 번 불러온 뒤에는 다시 불러오는 동안에도 화면(고른 장부 · 조건 · 열린 창)을 그대로 둔다 */}
      {overview.data === undefined ? (
        <Loadable resource={overview} label="장부">
          {() => null}
        </Loadable>
      ) : (
        <>
          {overview.error && <p className={s.error}>장부 요약을 다시 불러오지 못했어요: {overview.error}</p>}
          <LedgerView overview={overview.data} reloadOverview={overview.reload} />
        </>
      )}
    </>
  )
}

function LedgerView({ overview, reloadOverview }: { overview: LedgerOverview; reloadOverview: () => void }) {
  const books = overview.books
  const firstOpen = books.find((b) => !b.archived) ?? books[0]
  const [picked, setPicked] = useState<number | undefined>(firstOpen?.bookId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const bookId = books.some((b) => b.bookId === picked) ? picked : firstOpen?.bookId

  const newBook = dialog?.type === 'book-new' && (
    <BookFormModal
      onClose={() => setDialog(null)}
      onSaved={(b) => {
        setDialog(null)
        setPicked(b.bookId)
        reloadOverview()
      }}
    />
  )

  if (bookId === undefined)
    return (
      <Card>
        <SectionHead icon={BookOpen} title="장부" />
        <Empty>아직 장부가 없어요. 회비를 모으는 계좌가 있으면 장부를 만들어 주세요.</Empty>
        <div>
          <Button icon={Plus} onClick={() => setDialog({ type: 'book-new' })}>
            장부 만들기
          </Button>
        </div>
        {newBook}
      </Card>
    )

  return (
    <>
      <div className={s.bar}>
        <PillTabs
          value={String(bookId)}
          onChange={(v) => setPicked(Number(v))}
          options={books.map((b) => ({ value: String(b.bookId), label: b.archived ? `${b.name} (닫음)` : b.name }))}
        />
        <span className={s.grow} />
        <Button variant="secondary" icon={Plus} onClick={() => setDialog({ type: 'book-new' })}>
          장부 만들기
        </Button>
      </div>
      <BookView
        key={bookId}
        bookId={bookId}
        fallback={books.find((b) => b.bookId === bookId) as LedgerBook}
        dialog={dialog}
        setDialog={setDialog}
        reloadOverview={reloadOverview}
      />
      {newBook}
    </>
  )
}

type BookViewProps = {
  bookId: number
  /** 목록(LG-1)의 장부 — 거래 목록(LG-5)이 오기 전에 요약을 그린다 */
  fallback: LedgerBook
  dialog: Dialog
  setDialog: (d: Dialog) => void
  reloadOverview: () => void
}

function BookView({ bookId, fallback, dialog, setDialog, reloadOverview }: BookViewProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<'ALL' | EntryKind>('ALL')
  const [category, setCategory] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const filter: EntryFilter = {
    from: from || undefined,
    to: to || undefined,
    kind: kind === 'ALL' ? undefined : kind,
    category: category || undefined,
    pendingOnly,
    query: applied || undefined,
    includeDeleted,
  }
  const list = useLedgerEntries(bookId, filter)
  const book = list.data?.book ?? fallback
  const filtered = !!(from || to || kind !== 'ALL' || category || pendingOnly || applied)

  const refresh = () => {
    list.reload()
    reloadOverview()
  }
  const close = () => setDialog(null)

  return (
    <>
      <BookSummary book={book} onEdit={() => setDialog({ type: 'book-edit' })} onHandover={() => setDialog({ type: 'handover' })} />

      <Card>
        <div className={s.bar}>
          <SectionHead icon={Wallet} title="거래" extra={list.data ? <Chip tone="count">{list.data.entries.length}</Chip> : undefined} />
          <span className={s.grow} />
          <form
            className={s.search}
            onSubmit={(e) => {
              e.preventDefault()
              setApplied(query.trim())
            }}
          >
            <Search size={16} />
            <input type="search" value={query} placeholder="내용 · 메모 · 분류" onChange={(e) => setQuery(e.target.value)} />
          </form>
          {!book.archived && (
            <Button icon={Plus} onClick={() => setDialog({ type: 'entry-new' })}>
              거래 적기
            </Button>
          )}
        </div>
        {book.archived && (
          <Note icon={Lock} tone="warning">
            닫은 장부예요. 읽기만 할 수 있어요.
          </Note>
        )}
        <div className={s.filters}>
          <span className={s.dates}>
            기간
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />~
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="끝일" />
          </span>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'ALL' as const, label: '전체' },
              { value: 'INCOME' as const, label: '수입' },
              { value: 'EXPENSE' as const, label: '지출' },
            ]}
          />
          <FilterSelect label="분류" value={category} options={list.data?.categories ?? []} onChange={setCategory} />
          <Checkbox checked={pendingOnly} onChange={setPendingOnly} className={s.check}>
            돌려받을 돈만
          </Checkbox>
          <Checkbox checked={includeDeleted} onChange={setIncludeDeleted} className={s.check}>
            지운 거래 보기
          </Checkbox>
        </div>
        <Loadable resource={list} label="거래">
          {(d) => <EntryTable d={d} filtered={filtered} onOpen={(entryId) => setDialog({ type: 'entry', entryId })} />}
        </Loadable>
      </Card>

      {list.data && list.data.handovers.length > 0 && <HandoverList handovers={list.data.handovers} />}

      {dialog?.type === 'book-edit' && (
        <BookFormModal
          editing={book}
          onClose={close}
          onSaved={() => {
            close()
            refresh()
          }}
        />
      )}
      {dialog?.type === 'handover' && (
        <HandoverModal
          book={book}
          onClose={close}
          onSaved={() => {
            close()
            refresh()
          }}
        />
      )}
      {(dialog?.type === 'entry-new' || dialog?.type === 'entry-edit') && (
        <EntryFormModal
          bookId={bookId}
          categories={list.data?.categories ?? []}
          editing={dialog.type === 'entry-edit' ? dialog.entry : undefined}
          onClose={close}
          onSaved={(saved) => {
            // 고쳤으면 고친 거래를 다시 열어 보여 준다
            setDialog(dialog.type === 'entry-edit' ? { type: 'entry', entryId: saved.entry.entryId } : null)
            refresh()
          }}
        />
      )}
      {dialog?.type === 'entry' && (
        <EntryDetailModal
          entryId={dialog.entryId}
          book={book}
          onClose={close}
          onChanged={refresh}
          onEdit={(entry) => setDialog({ type: 'entry-edit', entry })}
        />
      )}
    </>
  )
}

// ─────────────── 요약 · 계좌 ───────────────

function BookSummary({ book, onEdit, onHandover }: { book: LedgerBook; onEdit: () => void; onHandover: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (!book.accountNumber) return
    navigator.clipboard
      ?.writeText(`${book.bankName ?? ''} ${book.accountNumber}`.trim())
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => undefined)
  }

  const stats = [
    { icon: Wallet, value: won(book.balance), label: '잔액', tone: book.balance < 0 ? s.expense : '' },
    { icon: HandCoins, value: won(book.pendingReimbursement), label: '돌려받을 돈 (먼저 낸 돈, 아직 잔액에서 안 뺌)', tone: book.pendingReimbursement ? s.warnVal : '' },
    { icon: TrendingUp, value: won(book.monthIncome), label: '이번 달 수입', tone: s.income },
    { icon: TrendingDown, value: won(book.monthExpense), label: '이번 달 지출', tone: s.expense },
  ]

  return (
    <>
      <div className={s.stats}>
        {stats.map(({ icon: Icon, value, label, tone }) => (
          <Card key={label} className={s.stat}>
            <span className={s.statIcon}>
              <Icon size={20} />
            </span>
            <span>
              <strong className={tone}>{value}</strong>
              <small>{label}</small>
            </span>
          </Card>
        ))}
      </div>
      <Card className={s.account}>
        <div className={s.accountMain}>
          <div className={s.accountLine}>
            계좌 주인 <Who m={book.holder} size={22} />
            {book.archived && <Chip tone="muted">닫음</Chip>}
          </div>
          <div className={s.accountLine}>
            {book.accountNumber ? (
              <>
                <span>{book.bankName || '은행 미기재'}</span>
                <span className={s.accountNo}>{book.accountNumber}</span>
                <button type="button" className={s.copy} onClick={copy} aria-label="계좌번호 복사">
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? '복사했어요' : '복사'}
                </button>
              </>
            ) : (
              <span>계좌 정보가 아직 없어요.</span>
            )}
          </div>
          {book.note && <p className={s.note}>{book.note}</p>}
        </div>
        {book.canManage && (
          <div className={s.actions}>
            <Button variant="secondary" icon={Settings} onClick={onEdit}>
              장부 고치기
            </Button>
            {!book.archived && (
              <Button variant="secondary" icon={ArrowRightLeft} onClick={onHandover}>
                계좌 주인 넘기기
              </Button>
            )}
          </div>
        )}
      </Card>
    </>
  )
}

// ─────────────── 거래 표 ───────────────

function EntryTable({ d, filtered, onOpen }: { d: LedgerEntryList; filtered: boolean; onOpen: (entryId: number) => void }) {
  return (
    <>
      <div className={s.totals}>
        <span>
          수입 합계<strong className={s.income}>{won(d.totalIncome)}</strong>
        </span>
        <span>
          지출 합계<strong className={s.expense}>{won(d.totalExpense)}</strong>
        </span>
        <span>
          차이<strong>{won(d.totalIncome - d.totalExpense)}</strong>
        </span>
        <span className={s.grow} />
        <span>{filtered ? '조건에 맞는 거래 (지운 거래 빼고)' : '모든 거래 (지운 거래 빼고)'}</span>
      </div>
      {d.entries.length === 0 ? (
        <Empty>{filtered ? '조건에 맞는 거래가 없어요.' : '아직 적은 거래가 없어요.'}</Empty>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>분류</th>
                <th>내용</th>
                <th className={s.num}>금액</th>
                <th className={s.num}>그때 잔액</th>
                <th>낸 곳</th>
                <th>적은 사람</th>
                <th className={s.num}>영수증</th>
              </tr>
            </thead>
            <tbody>
              {d.entries.map((e) => (
                <tr
                  key={e.entryId}
                  className={e.deleted ? s.deletedRow : undefined}
                  tabIndex={0}
                  onClick={() => onOpen(e.entryId)}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen(e.entryId))}
                >
                  <td className={s.nowrap}>{dotDate(e.entryDate)}</td>
                  <td className={s.nowrap}>{e.category}</td>
                  <td className={s.titleCell}>
                    <strong>{e.title}</strong>
                    {e.deleted ? (
                      <small>
                        지움 · {memberName(e.deletedBy)} · {e.deleteReason}
                      </small>
                    ) : (
                      e.member && <small>관련 {memberName(e.member)}</small>
                    )}
                  </td>
                  <td className={`${s.num} ${e.kind === 'INCOME' ? s.income : s.expense}`}>
                    {e.kind === 'INCOME' ? '+' : '−'}
                    {won(e.amount)}
                  </td>
                  <td className={s.num}>{e.deleted ? '—' : won(e.balanceAfter)}</td>
                  <td>
                    {e.paidFrom === 'MEMBER' ? (
                      <span className={s.paid}>
                        {memberName(e.paidBy)} 먼저 냄 <ReimburseChip entry={e} />
                      </span>
                    ) : (
                      '계좌'
                    )}
                  </td>
                  <td className={s.nowrap}>{memberName(e.createdBy)}</td>
                  <td className={s.num}>{e.receipts.length || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─────────────── 이관 기록 ───────────────

function HandoverList({ handovers }: { handovers: LedgerHandover[] }) {
  return (
    <Card>
      <SectionHead icon={ArrowRightLeft} title="계좌 주인 넘긴 기록" />
      <ul className={s.list}>
        {handovers.map((h) => (
          <li key={h.handoverId}>
            <span className={s.handLine}>
              <strong>{dotDate(h.handedOn)}</strong>
              <Who m={h.from} /> → <Who m={h.to} />
              {h.amount !== null && h.amount !== undefined && <Chip tone="tint">{won(h.amount)} 옮김</Chip>}
            </span>
            {(h.bankName || h.accountNumber) && (
              <span>
                계좌 {h.bankName ?? ''} {h.accountNumber ?? ''}
              </span>
            )}
            {h.note && <span>{h.note}</span>}
            <small>
              {memberName(h.recordedBy)} 님이 적음 · {ago(h.recordedAt)}
            </small>
          </li>
        ))}
      </ul>
    </Card>
  )
}
