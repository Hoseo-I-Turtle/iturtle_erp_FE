// 회계 화면 여러 곳에서 쓰는 작은 조각
import { useMemberDirectory } from '../../api/members'
import type { LedgerMember } from '../../api/ledger'

/** 고르기 목록에 쓸 구성원 (재실 · 휴학) 과 이름 찾기 (졸업생 포함) */
export function useLedgerMembers() {
  const dir = useMemberDirectory()
  const all = dir.data?.members ?? []
  return {
    active: all.filter((m) => m.status === 'ACTIVE'),
    meId: dir.data?.meId,
    nameOf: (id: unknown) => (typeof id === 'number' ? (all.find((m) => m.memberId === id)?.name ?? `#${id}`) : '—'),
  }
}

export const memberName = (m: LedgerMember | null | undefined) => (m ? (m.name ?? '(없어진 구성원)') : '—')

/** '12,345' 처럼 입력한 금액 → 숫자 (없으면 0) */
export const parseAmount = (v: string) => Number(v.replace(/[^0-9]/g, '') || 0)
/** 입력 칸에 보여 줄 금액 */
export const amountText = (v: string) => {
  const digits = v.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

export const humanSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`
