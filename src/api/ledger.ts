// 회계 장부 (ERP-44) — docs/api/90-ledger.md LG-1 ~ LG-10
// 연구실 돈은 구성원 개인 계좌로 관리한다. 장부 = 계좌 하나 + 계좌 주인. 누구나 적고 모두 보고, 기록은 남는다.
// 백엔드 기준: ledger 모듈 LedgerController · LedgerResponses · dto/request/*.
import { api } from './client'
import { todayKst } from './projects'
import { useResource } from './useResource'
import { ME_ID, members as mockMembers } from '../mocks/members'

export type EntryKind = 'INCOME' | 'EXPENSE'
/** 지출을 낸 곳: ACCOUNT 장부 계좌 · MEMBER 구성원이 먼저 냄 (→ 돌려받을 돈) */
export type PaidFrom = 'ACCOUNT' | 'MEMBER'
/** NONE 해당 없음 · PENDING 돌려받을 돈 · DONE 돌려줌 */
export type Reimbursement = 'NONE' | 'PENDING' | 'DONE'
export type VersionAction = 'UPDATED' | 'DELETED' | 'REIMBURSED'

/** LedgerResponses.Member — 없어진 구성원이면 name 이 null */
export type LedgerMember = { memberId: number; name: string | null }

/** LedgerResponses.Receipt — 내려받기는 파일 API (fileUrl(publicId)) */
export type LedgerReceipt = { publicId: string; name: string; size: number; contentType: string; extension: string | null }

/** LedgerResponses.Book. canManage: 장부 고치기 · 이관 · 돌려줌 표시 (계좌 주인 · member-manage) */
export type LedgerBook = {
  bookId: number
  name: string
  holder: LedgerMember | null
  bankName: string | null
  accountNumber: string | null
  note: string | null
  archived: boolean
  version: number
  balance: number
  pendingReimbursement: number
  monthIncome: number
  monthExpense: number
  entryCount: number
  canManage: boolean
}

export type LedgerHandover = {
  handoverId: number
  from: LedgerMember | null
  to: LedgerMember | null
  amount: number | null
  bankName: string | null
  accountNumber: string | null
  note: string | null
  handedOn: string
  recordedBy: LedgerMember | null
  recordedAt: string
}

/** LedgerResponses.Entry. canEdit: 고치기 · 지우기 (적은 사람 · 계좌 주인 · member-manage) */
export type LedgerEntry = {
  entryId: number
  bookId: number
  entryDate: string
  kind: EntryKind
  amount: number
  category: string
  title: string
  memo: string | null
  member: LedgerMember | null
  paidFrom: PaidFrom
  paidBy: LedgerMember | null
  reimbursement: Reimbursement
  reimbursedOn: string | null
  reimbursedBy: LedgerMember | null
  createdBy: LedgerMember | null
  createdAt: string
  updatedBy: LedgerMember | null
  updatedAt: string | null
  deleted: boolean
  deletedBy: LedgerMember | null
  deleteReason: string | null
  version: number
  /** 이 거래까지 쌓은 잔액 */
  balanceAfter: number
  receipts: LedgerReceipt[]
  canEdit: boolean
}

/** 이전 모습. snapshot 은 바뀌기 전 (entryDate · kind · amount · category · title · memo · memberId · paidFrom · paidBy · reimbursement · updatedBy) */
export type LedgerVersion = {
  version: number
  action: VersionAction
  snapshot: Record<string, unknown>
  changedBy: LedgerMember | null
  changedAt: string
}

export type LedgerOverview = { books: LedgerBook[] }

export type LedgerEntryList = {
  book: LedgerBook
  entries: LedgerEntry[]
  totalIncome: number
  totalExpense: number
  /** 기본 분류 + 이 장부에서 쓴 분류 */
  categories: string[]
  handovers: LedgerHandover[]
}

export type LedgerEntryDetail = { entry: LedgerEntry; versions: LedgerVersion[] }

/** LG-5 조건 (모두 비면 지운 것 빼고 전부, 최근 순) */
export type EntryFilter = {
  from?: string
  to?: string
  kind?: EntryKind
  category?: string
  memberId?: number
  pendingOnly?: boolean
  query?: string
  includeDeleted?: boolean
}

/** LG-2 · LG-3 본문. 고칠 때는 보낸 칸만 바뀐다 (빈 글자면 비움) */
export type BookInput = {
  name?: string
  /** 만들 때만 (비면 나) */
  holderId?: number
  bankName?: string
  accountNumber?: string
  note?: string
  /** 고칠 때만 — 닫으면 읽기만 */
  archived?: boolean
  version?: number
}

/** LG-6 · LG-8 본문. 고칠 때도 모든 칸을 보낸다 */
export type EntryInput = {
  entryDate: string
  kind: EntryKind
  amount: number
  category: string
  title: string
  memo?: string
  memberId?: number | null
  paidFrom?: PaidFrom
  paidBy?: number | null
  /** 영수증 publicId (10개까지). 고칠 때 보내면 통째로 바꿈 */
  attachmentFileIds?: string[]
  version?: number
}

/** LG-4 본문 */
export type HandoverInput = {
  toHolderId: number
  amount?: number
  bankName?: string
  accountNumber?: string
  note?: string
  handedOn?: string
}

export const KIND_LABEL: Record<EntryKind, string> = { INCOME: '수입', EXPENSE: '지출' }
export const VERSION_LABEL: Record<VersionAction, string> = { UPDATED: '고치기 전', DELETED: '지우기 전', REIMBURSED: '돌려줌 표시 전' }

/** 12345 → '12,345원' */
export const won = (n: number | null | undefined) => `${(n ?? 0).toLocaleString('ko-KR')}원`

/* ---------- 목업 (화면에서 적고 고친 것이 이 페이지 동안 남는다) ---------- */

const DEFAULT_CATEGORIES = ['회비', '식비', '장비', '소모품', '행사', '기타']

const ref = (memberId: number): LedgerMember => ({ memberId, name: mockMembers.find((m) => m.memberId === memberId)?.name ?? null })

type MockEntry = Omit<LedgerEntry, 'balanceAfter' | 'canEdit'>
type MockBook = Omit<LedgerBook, 'balance' | 'pendingReimbursement' | 'monthIncome' | 'monthExpense' | 'entryCount' | 'canManage'>

const iso = (date: string) => `${date}T03:00:00Z`
const month = todayKst().slice(0, 7)
const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`
const lastMonth = (() => {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
})()

const mockEntry = (
  entryId: number,
  entryDate: string,
  kind: EntryKind,
  amount: number,
  category: string,
  title: string,
  by: number,
  extra: Partial<MockEntry> = {},
): MockEntry => ({
  entryId,
  bookId: 1,
  entryDate,
  kind,
  amount,
  category,
  title,
  memo: null,
  member: null,
  paidFrom: 'ACCOUNT',
  paidBy: null,
  reimbursement: 'NONE',
  reimbursedOn: null,
  reimbursedBy: null,
  createdBy: ref(by),
  createdAt: iso(entryDate),
  updatedBy: null,
  updatedAt: null,
  deleted: false,
  deletedBy: null,
  deleteReason: null,
  version: 0,
  receipts: [],
  ...extra,
})

const store = {
  seq: 100,
  books: [
    {
      bookId: 1,
      name: '연구실 운영비',
      holder: ref(ME_ID),
      bankName: '토스뱅크',
      accountNumber: '1000-1234-5678',
      note: '회비는 매달 10일까지 1만 원',
      archived: false,
      version: 0,
    },
    { bookId: 2, name: '2025 학회비', holder: ref(1), bankName: '국민은행', accountNumber: '123401-04-567890', note: null, archived: true, version: 1 },
  ] as MockBook[],
  entries: [
    mockEntry(1, `${lastMonth}-28`, 'INCOME', 50000, '회비', '이월 금액', 3, { memo: '지난 계좌 주인에게서 받음' }),
    mockEntry(2, day(3), 'INCOME', 10000, '회비', '11월 회비', 2, { member: ref(2) }),
    mockEntry(3, day(4), 'INCOME', 10000, '회비', '11월 회비', 4, { member: ref(4) }),
    mockEntry(4, day(8), 'EXPENSE', 23500, '소모품', '프린터 토너', 3, {
      receipts: [{ publicId: 'mock-r1', name: '토너-영수증.jpg', size: 182000, contentType: 'image/jpeg', extension: 'jpg' }],
    }),
    mockEntry(5, day(12), 'EXPENSE', 8000, '식비', '세미나 간식', 2, {
      paidFrom: 'MEMBER',
      paidBy: ref(2),
      reimbursement: 'PENDING',
      receipts: [{ publicId: 'mock-r2', name: '편의점.png', size: 64000, contentType: 'image/png', extension: 'png' }],
    }),
    mockEntry(6, day(14), 'EXPENSE', 12000, '식비', '회의 커피', 5, {
      paidFrom: 'MEMBER',
      paidBy: ref(5),
      reimbursement: 'DONE',
      reimbursedOn: day(15),
      reimbursedBy: ref(3),
    }),
    mockEntry(7, day(15), 'EXPENSE', 3000, '기타', '잘못 적음', 4, { deleted: true, deletedBy: ref(4), deleteReason: '같은 거래를 두 번 적음' }),
  ] as MockEntry[],
  handovers: [
    {
      handoverId: 1,
      from: ref(1),
      to: ref(ME_ID),
      amount: 50000,
      bankName: '토스뱅크',
      accountNumber: '1000-1234-5678',
      note: '학기 바뀌어서 넘김',
      handedOn: `${lastMonth}-28`,
      recordedBy: ref(1),
      recordedAt: iso(`${lastMonth}-28`),
    },
  ] as (LedgerHandover & { bookId?: number })[],
  versions: new Map<number, LedgerVersion[]>([
    [
      7,
      [
        {
          version: 1,
          action: 'DELETED',
          snapshot: { entryDate: day(15), kind: 'EXPENSE', amount: 3000, category: '기타', title: '잘못 적음', memo: null, paidFrom: 'ACCOUNT', reimbursement: 'NONE' },
          changedBy: ref(4),
          changedAt: iso(day(15)),
        },
      ],
    ],
  ]),
}
store.handovers[0].bookId = 1

/** 목업의 나(ME_ID)는 첫 장부의 계좌 주인 — 그 장부는 canManage, 닫은 장부는 남의 것이라 읽기만 */
const mockCanManage = (b: MockBook) => b.holder?.memberId === ME_ID
const mockCanEdit = (e: MockEntry, b: MockBook) => !b.archived && !e.deleted && (e.createdBy?.memberId === ME_ID || mockCanManage(b))

/** 잔액에 들어가는 금액 (수입 +, 계좌에서 낸 지출 −, 돌려준 먼저 낸 지출 −) */
const effect = (e: MockEntry) => {
  if (e.deleted) return 0
  if (e.kind === 'INCOME') return e.amount
  if (e.paidFrom === 'ACCOUNT' || e.reimbursement === 'DONE') return -e.amount
  return 0
}

const withBalance = (book: MockBook) => {
  const sorted = store.entries.filter((e) => e.bookId === book.bookId).sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.entryId - b.entryId)
  let running = 0
  const balances = new Map<number, number>()
  for (const e of sorted) {
    running += effect(e)
    balances.set(e.entryId, running)
  }
  return { sorted, balances, balance: running }
}

const mockBook = (b: MockBook): LedgerBook => {
  const { sorted, balance } = withBalance(b)
  const live = sorted.filter((e) => !e.deleted)
  const thisMonth = live.filter((e) => e.entryDate.startsWith(month))
  return {
    ...b,
    balance,
    pendingReimbursement: live.filter((e) => e.reimbursement === 'PENDING').reduce((n, e) => n + e.amount, 0),
    monthIncome: thisMonth.filter((e) => e.kind === 'INCOME').reduce((n, e) => n + e.amount, 0),
    monthExpense: thisMonth.filter((e) => e.kind === 'EXPENSE').reduce((n, e) => n + e.amount, 0),
    entryCount: live.length,
    canManage: mockCanManage(b),
  }
}

const findBook = (bookId: number) => store.books.find((b) => b.bookId === bookId) ?? store.books[0]

const mockFull = (e: MockEntry): LedgerEntry => {
  const book = findBook(e.bookId)
  return { ...e, balanceAfter: withBalance(book).balances.get(e.entryId) ?? 0, canEdit: mockCanEdit(e, book) }
}

const mockOverview = (): LedgerOverview => ({ books: store.books.map(mockBook) })

const mockEntries = (bookId: number, f: EntryFilter): LedgerEntryList => {
  const book = findBook(bookId)
  const q = f.query?.trim().toLowerCase()
  const entries = store.entries
    .filter(
      (e) =>
        e.bookId === book.bookId &&
        (f.includeDeleted || !e.deleted) &&
        (!f.from || e.entryDate >= f.from) &&
        (!f.to || e.entryDate <= f.to) &&
        (!f.kind || e.kind === f.kind) &&
        (!f.category || e.category === f.category) &&
        (!f.pendingOnly || e.reimbursement === 'PENDING') &&
        (!q || `${e.title} ${e.memo ?? ''} ${e.category}`.toLowerCase().includes(q)),
    )
    .map(mockFull)
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.entryId - a.entryId)
  const counted = entries.filter((e) => !e.deleted)
  const used = store.entries.filter((e) => e.bookId === book.bookId).map((e) => e.category)
  return {
    book: mockBook(book),
    entries,
    totalIncome: counted.filter((e) => e.kind === 'INCOME').reduce((n, e) => n + e.amount, 0),
    totalExpense: counted.filter((e) => e.kind === 'EXPENSE').reduce((n, e) => n + e.amount, 0),
    categories: [...new Set([...DEFAULT_CATEGORIES, ...used])],
    handovers: store.handovers.filter((h) => h.bookId === book.bookId),
  }
}

const mockDetail = (entryId: number): LedgerEntryDetail => {
  const e = store.entries.find((x) => x.entryId === entryId) ?? store.entries[0]
  return { entry: mockFull(e), versions: store.versions.get(e.entryId) ?? [] }
}

const snapshotOf = (e: MockEntry): Record<string, unknown> => ({
  entryDate: e.entryDate,
  kind: e.kind,
  amount: e.amount,
  category: e.category,
  title: e.title,
  memo: e.memo,
  memberId: e.member?.memberId ?? null,
  paidFrom: e.paidFrom,
  paidBy: e.paidBy?.memberId ?? null,
  reimbursement: e.reimbursement,
  updatedBy: e.updatedBy?.memberId ?? null,
})

const pushVersion = (e: MockEntry, action: VersionAction) => {
  const list = store.versions.get(e.entryId) ?? []
  store.versions.set(e.entryId, [
    { version: e.version + 1, action, snapshot: snapshotOf(e), changedBy: ref(ME_ID), changedAt: new Date().toISOString() },
    ...list,
  ])
  e.version += 1
}

const mockReceipts = (ids: string[] | undefined, keep: LedgerReceipt[]): LedgerReceipt[] =>
  (ids ?? []).map(
    (id) => keep.find((r) => r.publicId === id) ?? { publicId: id, name: id.replace(/^mock-/, ''), size: 0, contentType: 'application/octet-stream', extension: null },
  )

/** 실서버가 아닐 때 화면에서 부르는 저장 동작 (whenLive(...) ?? mockLedger.xxx(...)) */
export const mockLedger = {
  createBook(body: BookInput): LedgerBook {
    const b: MockBook = {
      bookId: ++store.seq,
      name: body.name?.trim() || '연구실 운영비',
      holder: ref(body.holderId ?? ME_ID),
      bankName: body.bankName || null,
      accountNumber: body.accountNumber || null,
      note: body.note || null,
      archived: false,
      version: 0,
    }
    store.books.push(b)
    return mockBook(b)
  },
  updateBook(bookId: number, body: BookInput): LedgerBook {
    const b = findBook(bookId)
    if (body.name !== undefined) b.name = body.name
    if (body.bankName !== undefined) b.bankName = body.bankName || null
    if (body.accountNumber !== undefined) b.accountNumber = body.accountNumber || null
    if (body.note !== undefined) b.note = body.note || null
    if (body.archived !== undefined) b.archived = body.archived
    b.version += 1
    return mockBook(b)
  },
  handOver(bookId: number, body: HandoverInput): LedgerBook {
    const b = findBook(bookId)
    store.handovers.unshift({
      handoverId: ++store.seq,
      bookId,
      from: b.holder,
      to: ref(body.toHolderId),
      amount: body.amount ?? null,
      bankName: body.bankName || b.bankName,
      accountNumber: body.accountNumber || b.accountNumber,
      note: body.note || null,
      handedOn: body.handedOn || todayKst(),
      recordedBy: ref(ME_ID),
      recordedAt: new Date().toISOString(),
    })
    b.holder = ref(body.toHolderId)
    if (body.bankName) b.bankName = body.bankName
    if (body.accountNumber) b.accountNumber = body.accountNumber
    b.version += 1
    return mockBook(b)
  },
  createEntry(bookId: number, body: EntryInput): LedgerEntryDetail {
    const member = body.paidFrom === 'MEMBER' && body.kind === 'EXPENSE'
    const e = mockEntry(++store.seq, body.entryDate, body.kind, body.amount, body.category, body.title, ME_ID, {
      bookId,
      memo: body.memo || null,
      member: body.memberId ? ref(body.memberId) : null,
      paidFrom: member ? 'MEMBER' : 'ACCOUNT',
      paidBy: member ? ref(body.paidBy ?? ME_ID) : null,
      reimbursement: member ? 'PENDING' : 'NONE',
      createdAt: new Date().toISOString(),
      receipts: mockReceipts(body.attachmentFileIds, []),
    })
    store.entries.push(e)
    return mockDetail(e.entryId)
  },
  updateEntry(entryId: number, body: EntryInput): LedgerEntryDetail {
    const e = store.entries.find((x) => x.entryId === entryId)
    if (!e) return mockDetail(entryId)
    pushVersion(e, 'UPDATED')
    const member = body.paidFrom === 'MEMBER' && body.kind === 'EXPENSE'
    const samePayer = member && e.paidFrom === 'MEMBER'
    Object.assign(e, {
      entryDate: body.entryDate,
      kind: body.kind,
      amount: body.amount,
      category: body.category,
      title: body.title,
      memo: body.memo || null,
      member: body.memberId ? ref(body.memberId) : null,
      paidFrom: member ? 'MEMBER' : 'ACCOUNT',
      paidBy: member ? ref(body.paidBy ?? e.paidBy?.memberId ?? ME_ID) : null,
      reimbursement: member ? (samePayer ? e.reimbursement : 'PENDING') : 'NONE',
      updatedBy: ref(ME_ID),
      updatedAt: new Date().toISOString(),
      receipts: body.attachmentFileIds ? mockReceipts(body.attachmentFileIds, e.receipts) : e.receipts,
    })
    return mockDetail(entryId)
  },
  deleteEntry(entryId: number, reason: string): LedgerEntryDetail {
    const e = store.entries.find((x) => x.entryId === entryId)
    if (e && !e.deleted) {
      pushVersion(e, 'DELETED')
      Object.assign(e, { deleted: true, deletedBy: ref(ME_ID), deleteReason: reason })
    }
    return mockDetail(entryId)
  },
  reimburse(entryId: number, reimbursedOn?: string): LedgerEntryDetail {
    const e = store.entries.find((x) => x.entryId === entryId)
    if (e && e.reimbursement === 'PENDING') {
      pushVersion(e, 'REIMBURSED')
      Object.assign(e, { reimbursement: 'DONE', reimbursedOn: reimbursedOn || todayKst(), reimbursedBy: ref(ME_ID) })
    }
    return mockDetail(entryId)
  },
}

/* ---------- 불러오기 ---------- */

const BASE = '/ledger'

/** LG-1 장부 목록 · 요약 */
export function useLedgerOverview() {
  return useResource<LedgerOverview>('ledger-books', mockOverview, () => api<LedgerOverview>(`${BASE}/books`))
}

/** LG-5 장부 하나의 거래 · 합계 · 분류 · 이관 기록 */
export function useLedgerEntries(bookId: number, filter: EntryFilter) {
  return useResource<LedgerEntryList>(
    ['ledger-entries', bookId, filter],
    () => mockEntries(bookId, filter),
    async () => {
      // 백엔드가 목록을 페이지로 주게 바꾸는 중이다 (정책 ERP-P32): 거래가 entries 로 오든 page 로 오든 읽는다.
      // 잔액 · 합계와 맞춰 보는 화면이라 page 로 오면 끝까지 돌며 모두 받는다
      type Dto = Omit<LedgerEntryList, 'entries'> & { entries?: LedgerEntry[]; page?: { content: LedgerEntry[]; hasNext: boolean } }
      const get = (page: number) =>
        api<Dto>(`${BASE}/books/${bookId}/entries`, {
          query: {
            from: filter.from || undefined,
            to: filter.to || undefined,
            kind: filter.kind,
            category: filter.category || undefined,
            memberId: filter.memberId,
            pendingOnly: filter.pendingOnly || undefined,
            query: filter.query?.trim() || undefined,
            includeDeleted: filter.includeDeleted || undefined,
            page,
            size: 100,
          },
        })
      const first = await get(0)
      const entries = [...(first.entries ?? first.page?.content ?? [])]
      for (let page = 1, more = first.page?.hasNext ?? false; more && page < 10; page++) {
        const next = await get(page)
        entries.push(...(next.page?.content ?? []))
        more = next.page?.hasNext ?? false
      }
      return { ...first, entries }
    },
  )
}

/** LG-7 거래 하나 · 이전 모습 */
export function useLedgerEntry(entryId: number) {
  return useResource<LedgerEntryDetail>(['ledger-entry', entryId], () => mockDetail(entryId), () => api<LedgerEntryDetail>(`${BASE}/entries/${entryId}`))
}

/* ---------- 저장 ---------- */

/** LG-2 장부 만들기 (구성원 누구나) */
export const createBook = (body: BookInput) => api<LedgerBook>(`${BASE}/books`, { method: 'POST', body })

/** LG-3 장부 고치기 · 닫기 (canManage, version 이 다르면 L007) */
export const updateBook = (bookId: number, body: BookInput) => api<LedgerBook>(`${BASE}/books/${bookId}`, { method: 'PATCH', body })

/** LG-4 계좌 주인 넘기기 (canManage) */
export const handOverBook = (bookId: number, body: HandoverInput) =>
  api<LedgerBook>(`${BASE}/books/${bookId}/handover`, { method: 'POST', body })

/** LG-6 거래 적기 (구성원 누구나, 닫은 장부면 L005) */
export const createEntry = (bookId: number, body: EntryInput) =>
  api<LedgerEntryDetail>(`${BASE}/books/${bookId}/entries`, { method: 'POST', body })

/** LG-8 거래 고치기 (canEdit, 모든 칸을 보낸다) */
export const updateEntry = (entryId: number, body: EntryInput) => api<LedgerEntryDetail>(`${BASE}/entries/${entryId}`, { method: 'PATCH', body })

/** LG-9 거래 지우기 (canEdit, 행은 남는다) */
export const deleteEntry = (entryId: number, reason: string, version?: number) =>
  api<LedgerEntryDetail>(`${BASE}/entries/${entryId}/delete`, { method: 'POST', body: { reason, version } })

/** LG-10 먼저 낸 돈 돌려줌 표시 (canManage) */
export const reimburseEntry = (entryId: number, reimbursedOn?: string, version?: number) =>
  api<LedgerEntryDetail>(`${BASE}/entries/${entryId}/reimburse`, { method: 'POST', body: { reimbursedOn: reimbursedOn || undefined, version } })
