import { Ellipsis, Lock, Search } from 'lucide-react'
import { Avatar, Card } from '../../../components/ui'
import { isLive, type AdminRow } from '../../../api/admin'
import a from '../admin.module.css'
import s from './MemberTable.module.css'

export type MemberFilter = 'ACTIVE' | 'GRADUATED' | 'DISABLED' | 'LOCKED'

const FILTERS = [
  ['ACTIVE', '재실'],
  ['GRADUATED', '졸업생'],
  ['DISABLED', '비활성'],
  ['LOCKED', '잠김'],
] as const

type Props = {
  list: AdminRow[]
  counts: Record<MemberFilter, number>
  filter: MemberFilter
  onFilter: (f: MemberFilter) => void
  q: string
  onQuery: (q: string) => void
  selectedId: number
  onSelect: (id: number) => void
}

/** 구성원 표: 검색 · 상태 필터 · 행 (누르면 오른쪽 상세) */
export function MemberTable({ list, counts, filter, onFilter, q, onQuery, selectedId, onSelect }: Props) {
  return (
    <Card className={s.tableCard}>
      <div className={a.toolbar}>
        <label className={a.search}>
          <Search size={16} />
          <input value={q} onChange={(e) => onQuery(e.target.value)} placeholder="이름 · 로그인 ID · 구성원 번호" />
        </label>
        <span className={a.grow} />
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={filter === k ? `${a.chipBtn} ${a.chipBtnOn}` : a.chipBtn} onClick={() => onFilter(k)}>
            {label} {counts[k]}
          </button>
        ))}
      </div>

      <div className={s.thead}>
        <span>구성원</span>
        <span>구성원 번호</span>
        <span>구분</span>
        <span>상태</span>
        <span>역할</span>
        <span>마지막 로그인</span>
        <span />
      </div>
      {list.length === 0 && <p className={a.muted}>해당하는 구성원이 없어요.{isLive() ? '' : ' (졸업생 목록은 목업에 없어요)'}</p>}
      {list.map((m) => (
        <button key={m.memberId} type="button" className={m.memberId === selectedId ? `${s.row} ${s.rowOn}` : s.row} onClick={() => onSelect(m.memberId)}>
          <span className={s.who}>
            <Avatar name={m.name} size={32} />
            <span>
              <strong>{m.name}</strong>
              <small>{m.loginId}</small>
            </span>
          </span>
          <span>{m.memberNo}</span>
          <span>
            <span className={`${a.state} ${a.info}`}>{m.memberType}</span>
          </span>
          <span>
            <MemberStateBadge member={m} />
          </span>
          <span className={s.rolesCell}>
            {m.presets.join(' + ')} · {m.roleCount}개{m.tempPassword && <span className={`${a.state} ${a.warn}`}>임시 비밀번호</span>}
          </span>
          <span className={s.last}>{m.lastLogin}</span>
          <Ellipsis size={18} className={s.more} />
        </button>
      ))}
    </Card>
  )
}

/** 목록의 상태 칸: 졸업 → 휴학 → 잠김 → 비활성 → 재실 순으로 하나만 */
function MemberStateBadge({ member: m }: { member: AdminRow }) {
  if (m.graduated) return <span className={`${a.state} ${a.off}`}>졸업</span>
  if (m.onLeave) return <span className={`${a.state} ${a.warn}`}>휴학</span>
  if (m.state === 'LOCKED')
    return (
      <span className={`${a.state} ${a.bad}`}>
        <Lock size={12} /> 잠김
      </span>
    )
  if (m.state === 'DISABLED') return <span className={`${a.state} ${a.off}`}>비활성</span>
  return <span className={`${a.state} ${a.ok}`}>재실</span>
}
