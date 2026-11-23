import type { LedgerMember } from '../../api/ledger'
import { Avatar } from '../../components/ui'
import { memberName } from './common'
import s from './LedgerPage.module.css'

/** 아바타 + 이름 (없으면 —) */
export function Who({ m, size = 20 }: { m: LedgerMember | null | undefined; size?: number }) {
  if (!m) return <span>—</span>
  return (
    <span className={s.who}>
      <Avatar name={memberName(m)} size={size} /> {memberName(m)}
    </span>
  )
}
