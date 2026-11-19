import { useState } from 'react'
import { Calendar, Check, X } from 'lucide-react'
import { Avatar, Button, Card, Empty, Loadable, Segmented } from '../../components/ui'
import { type RoleRequest } from '../../mocks/adminOps'
import { whenLive } from '../../api/useResource'
import { errorText, isLive, reviewAccessRequest, useRoleRequests, type ReviewRequest, type RoleRequestsData } from '../../api/admin'
import { StateBadge } from './StateBadge'
import a from './admin.module.css'
import s from './RoleRequestsPage.module.css'

type Tab = RoleRequest['status']
const LABEL: Record<Tab, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절', EXPIRED: '만료' }
const TONE: Record<Tab, string> = { PENDING: a.warn, APPROVED: a.ok, REJECTED: a.bad, EXPIRED: a.off }
const ME = '김민서'

export function RoleRequestsPage() {
  const res = useRoleRequests()
  return (
    <Loadable resource={res} label="권한 신청">
      {(d) => <RoleRequestsView data={d} />}
    </Loadable>
  )
}

function RoleRequestsView({ data }: { data: RoleRequestsData }) {
  const [reqs, setReqs] = useState(data.requests)
  const [tab, setTab] = useState<Tab>('PENDING')
  const [openId, setOpenId] = useState<number | null>(() => (isLive() ? null : 1))
  const [until, setUntil] = useState('2026-11-24')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 받아 온 목록에 없는 지난 처리 건수만큼 더한다 (목업은 시안 숫자 승인 8 · 거절 1 · 만료 3)
  const count = (t: Tab) => reqs.filter((r) => r.status === t).length + data.extra[t]
  const list = reqs.filter((r) => r.status === tab)
  const recent = reqs.filter((r) => r.status !== 'PENDING')

  const open = (r: ReviewRequest) => {
    setOpenId(r.id)
    // 실서버: 신청한 기한을 기본값으로 (비우면 기한 없음)
    if (isLive()) setUntil(r.expiresOn ?? '')
    setReason('')
    setError('')
  }

  const decide = async (r: ReviewRequest, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED' && !reason.trim()) return setError('거절할 때는 사유가 필요해요')
    const prev = reqs
    setReqs((rs) =>
      rs.map((x) =>
        x.id === r.id
          ? { ...x, status, handledBy: ME, note: status === 'APPROVED' ? (until ? `${until.slice(5).replace('-', '/')} 만료` : '기한 없음') : reason }
          : x,
      ),
    )
    setOpenId(null)
    setBusy(true)
    try {
      const updated = await whenLive(() =>
        reviewAccessRequest(
          r.id,
          status === 'APPROVED' ? { decision: 'APPROVE', expiresOn: until || null } : { decision: 'REJECT', reason: reason.trim() },
        ),
      )
      if (updated) setReqs((rs) => rs.map((x) => (x.id === r.id ? updated : x)))
      setReason('')
      setError('')
    } catch (e) {
      // 되돌리고 다시 열어 둔다
      setReqs(prev)
      setOpenId(r.id)
      setError(errorText(e, '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={s.card}>
      <div className={a.toolbar}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={(Object.keys(LABEL) as Tab[]).map((t) => ({ value: t, label: `${LABEL[t]} ${count(t)}` }))}
        />
        <span className={a.grow} />
        <span className={a.muted}>관리 역할(member-manage, role-manage 등)은 신청할 수 없어요</span>
      </div>

      <div className={s.thead}>
        <span>신청자</span>
        <span>신청 대상</span>
        <span>사유</span>
        <span>사용 기한</span>
        <span>관련 프로젝트</span>
        <span />
      </div>
      {list.length === 0 && <Empty>{LABEL[tab]} 상태인 신청이 없어요.</Empty>}
      {list.map((r) => {
        const isOpen = openId === r.id && r.status === 'PENDING'
        return (
          <div key={r.id} className={isOpen ? `${s.req} ${s.reqOpen}` : s.req}>
            <div className={s.row}>
              <span className={s.who}>
                <Avatar name={r.who} size={30} />
                <span>
                  <strong>{r.who}</strong>
                  <small>{r.ago}</small>
                </span>
              </span>
              <span>
                <StateBadge tone="info">{r.target}</StateBadge>
              </span>
              <span className={s.reason}>{r.reason || r.note}</span>
              <span>{r.period}</span>
              <span className={s.project}>{r.project}</span>
              <span>
                {r.status === 'PENDING' &&
                  !isOpen &&
                  (r.canReview ? (
                    <Button variant="secondary" onClick={() => open(r)} disabled={busy}>
                      검토
                    </Button>
                  ) : (
                    // role-manage 는 프로젝트 신청을 보기만 한다 (승인은 그 프로젝트 관리자)
                    <span className={a.muted}>승인: {r.approverLabel}</span>
                  ))}
              </span>
            </div>
            {isOpen && (
              <div className={s.decide}>
                <label className={s.until}>
                  <Calendar size={16} /> 사용 기한
                  <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </label>
                <input
                  className={error ? `${s.reasonInput} ${s.invalid}` : s.reasonInput}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setError('')
                  }}
                  placeholder={error || '거절할 때는 사유가 필요해요'}
                />
                <Button variant="secondary" icon={X} onClick={() => decide(r, 'REJECTED')} disabled={busy}>
                  거절
                </Button>
                <Button icon={Check} onClick={() => decide(r, 'APPROVED')} disabled={busy}>
                  승인
                </Button>
              </div>
            )}
            {isOpen && error && reason && <p className={a.err}>{error}</p>}
          </div>
        )
      })}

      <div className={a.muted}>최근 처리</div>
      {recent.map((r) => (
        <div key={r.id} className={s.recent}>
          <Avatar name={r.who} size={26} />
          <strong>{r.who}</strong>
          <StateBadge tone="info">{r.target}</StateBadge>
          <span className={`${a.state} ${TONE[r.status]}`}>{LABEL[r.status]}</span>
          <span className={s.note}>{r.note}</span>
          <span className={a.muted}>처리 · {r.handledBy}</span>
        </div>
      ))}
    </Card>
  )
}
