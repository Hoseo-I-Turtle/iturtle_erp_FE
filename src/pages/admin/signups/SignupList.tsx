import { Avatar, Card, Empty, Segmented } from '../../../components/ui'
import type { SignupRequest } from '../../../mocks/admin'
import { STATUS_LABEL, type SignupTab } from './status'
import a from '../admin.module.css'

type Props = {
  tab: SignupTab
  onTab: (t: SignupTab) => void
  count: (t: SignupTab) => number
  list: SignupRequest[]
  selectedId: number | undefined
  onChoose: (r: SignupRequest) => void
}

/** 왼쪽: 상태 탭 · 신청서 목록 */
export function SignupList({ tab, onTab, count, list, selectedId, onChoose }: Props) {
  return (
    <Card>
      <Segmented
        value={tab}
        onChange={onTab}
        options={(['PENDING', 'APPROVED', 'REJECTED'] as SignupTab[]).map((t) => ({ value: t, label: `${STATUS_LABEL[t]} ${count(t)}` }))}
      />
      {list.length === 0 && <Empty>신청이 없어요.</Empty>}
      {list.map((r) => (
        <button key={r.id} type="button" className={r.id === selectedId ? `${a.pick} ${a.pickOn}` : a.pick} onClick={() => onChoose(r)}>
          <Avatar name={r.name} size={36} />
          <span className={a.pickText}>
            <strong>{r.name}</strong>
            <small>
              {r.type} · {r.wantedId} · {r.ago}
            </small>
          </span>
          {r.idTaken && <span className={`${a.state} ${a.warn}`}>희망 ID 사용 중</span>}
        </button>
      ))}
      <p className={a.muted}>거절했거나 30일 동안 처리하지 않은 신청서는 90일 뒤 지워져요.</p>
    </Card>
  )
}
