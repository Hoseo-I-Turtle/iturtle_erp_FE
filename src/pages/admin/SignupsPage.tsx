import { useEffect, useState } from 'react'
import { Calendar, Check, Info, X } from 'lucide-react'
import { Avatar, Button, Card, Empty, Loadable, Segmented, Select } from '../../components/ui'
import { adminMembers, type SignupRequest } from '../../mocks/admin'
import { whenLive } from '../../api/useResource'
import { errorText, isLive, reviewSignup, todayKst, useLoginIdCheck, useSignups, type SignupsData } from '../../api/admin'
import a from './admin.module.css'
import s from './SignupsPage.module.css'

type Tab = SignupRequest['status']
const STATUS_LABEL: Record<Tab, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절' }
const randomPw = () => Math.random().toString(36).slice(2, 10) + '#7'

export function SignupsPage() {
  const res = useSignups()
  return (
    <Loadable resource={res} label="가입 신청">
      {(d) => <SignupsView data={d} />}
    </Loadable>
  )
}

function SignupsView({ data }: { data: SignupsData }) {
  const { presets } = data
  const [reqs, setReqs] = useState(data.requests)
  const [tab, setTab] = useState<Tab>('PENDING')
  const first = data.requests.find((r) => r.status === 'PENDING')
  const [id, setId] = useState(() => (isLive() ? (first?.id ?? 0) : 1))
  const [loginId, setLoginId] = useState(() => (isLive() ? (first ? (first.idTaken ? `${first.wantedId}2` : first.wantedId) : '') : 'haneul'))
  const [joinDate, setJoinDate] = useState(() => (isLive() ? todayKst() : '2026-11-18'))
  const [preset, setPreset] = useState(() => (first ? `${first.type} 기본` : '인턴 기본'))
  const [rejectReason, setRejectReason] = useState('')
  const [done, setDone] = useState<{ name: string; pw: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // 실서버: 로그인 ID 를 칠 때마다 부르지 않도록 잠깐 기다렸다 확인한다 (3-2)
  const [checkId, setCheckId] = useState(loginId)
  useEffect(() => {
    const t = window.setTimeout(() => setCheckId(loginId), 300)
    return () => window.clearTimeout(t)
  }, [loginId])
  const check = useLoginIdCheck(checkId)

  const list = reqs.filter((r) => r.status === tab)
  const sel = reqs.find((r) => r.id === id) ?? list[0]
  const count = (t: Tab) => reqs.filter((r) => r.status === t).length + data.extra[t]

  const localValid = /^[a-z][a-z0-9._]{2,19}$/.test(loginId)
  const result = checkId === loginId ? check.data : null
  const taken = isLive()
    ? !!result && !result.available
    : adminMembers.some((m) => m.loginId === loginId) || (sel?.idTaken && loginId === sel.wantedId)
  const valid = result ? result.valid : localValid
  // 실서버에서 확인 중이면 승인을 잠깐 막는다
  const checking = isLive() && !!loginId && (checkId !== loginId || check.loading)

  const choose = (r: SignupRequest) => {
    setId(r.id)
    setLoginId(r.idTaken ? `${r.wantedId}2` : r.wantedId)
    setPreset(`${r.type} 기본`)
    setRejectReason('')
    setDone(null)
    setErr('')
  }

  const decide = async (status: Tab) => {
    const target = sel
    if (!target) return
    if (status === 'REJECTED' && isLive() && !rejectReason.trim()) return setErr('거절할 때는 사유를 적어 주세요.')
    const p = presets.find((x) => x.name === preset)
    setBusy(true)
    setErr('')
    try {
      const r = await whenLive(() =>
        reviewSignup(
          target.id,
          status === 'REJECTED'
            ? { decision: 'REJECT', reason: rejectReason.trim() }
            : {
                decision: 'APPROVE',
                loginId,
                studentNumber: null, // 비우면 신청서 학번, 없으면 다음 인턴 번호
                joinedOn: joinDate,
                presetIds: p ? [Number(p.id)] : [],
                roleCodes: p?.roles ?? [],
              },
        ),
      )
      setReqs((rs) => rs.map((x) => (x.id === target.id ? (r?.request ?? { ...x, status }) : x)))
      if (status === 'APPROVED') setDone({ name: target.name, pw: r ? (r.temporaryPassword ?? '') : randomPw() })
    } catch (e) {
      setErr(errorText(e, '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={a.layoutList}>
      <Card>
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t)
            const next = reqs.find((r) => r.status === t)
            if (next) choose(next)
          }}
          options={(['PENDING', 'APPROVED', 'REJECTED'] as Tab[]).map((t) => ({ value: t, label: `${STATUS_LABEL[t]} ${count(t)}` }))}
        />
        {list.length === 0 && <Empty>신청이 없어요.</Empty>}
        {list.map((r) => (
          <button key={r.id} type="button" className={r.id === sel?.id ? `${a.pick} ${a.pickOn}` : a.pick} onClick={() => choose(r)}>
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

      {sel && (
        <Card className={s.detail}>
          <div className={s.head}>
            <Avatar name={sel.name} size={48} />
            <div>
              <h2>{sel.name}</h2>
              <small>공개 사이트 · {sel.appliedAt} 신청</small>
            </div>
            <span className={`${a.state} ${sel.status === 'PENDING' ? a.warn : sel.status === 'APPROVED' ? a.ok : a.off}`}>
              {STATUS_LABEL[sel.status]}
            </span>
          </div>
          <dl className={a.kv}>
            <dt>구분</dt>
            <dd>
              <span className={`${a.state} ${a.info}`}>{sel.type}</span>
            </dd>
            <dt>학번 (있으면)</dt>
            <dd>{sel.studentNo ?? '(입력 안 함)'}</dd>
            <dt>희망 로그인 ID</dt>
            <dd>{sel.wantedId}</dd>
            <dt>이메일</dt>
            <dd>{sel.email ?? '(입력 안 함)'}</dd>
            <dt>연락처</dt>
            <dd>{sel.phone}</dd>
            <dt>개인정보 동의</dt>
            <dd>
              <span className={`${a.state} ${a.ok}`}>
                <Check size={12} /> 동의함
              </span>
            </dd>
          </dl>
          <div className={a.muted}>신청 사유</div>
          <p>{sel.reason}</p>

          {done ? (
            <div className={s.done}>
              <Check size={18} /> {done.name} 계정을 만들었어요. 임시 비밀번호 <code>{done.pw}</code> — 지금 한 번만 보여요.
            </div>
          ) : sel.status === 'PENDING' ? (
            <>
              <div className={a.muted}>승인 설정</div>
              <div className={s.approve}>
                <label className={a.field}>
                  로그인 ID
                  <span className={s.idInput}>
                    <input value={loginId} onChange={(e) => setLoginId(e.target.value.toLowerCase())} />
                    {loginId &&
                      (checking ? (
                        <span className={`${a.state} ${a.info}`}>확인 중</span>
                      ) : taken ? (
                        <span className={`${a.state} ${a.bad}`}>사용 중</span>
                      ) : !valid ? (
                        <span className={`${a.state} ${a.warn}`}>형식 확인</span>
                      ) : (
                        <span className={`${a.state} ${a.ok}`}>
                          <Check size={12} /> 사용 가능
                        </span>
                      ))}
                  </span>
                </label>
                <label className={a.field}>
                  입실일
                  <span className={s.idInput}>
                    <Calendar size={16} />
                    <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
                  </span>
                </label>
                <label className={a.field}>
                  권한 프리셋
                  <Select value={preset} label="권한 프리셋" options={presets.map((p) => ({ value: p.name, label: p.name }))} onChange={setPreset} />
                </label>
                <label className={a.field}>
                  거절 사유 (거절할 때)
                  <input className={a.input} maxLength={500} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                </label>
              </div>
              {err && <p className={a.err}>{err}</p>}
              <div className={s.foot}>
                <span className={s.hint}>
                  <Info size={14} /> 승인하면 임시 비밀번호가 한 번만 보여요. 신청자에게 직접 전달해 주세요.
                </span>
                <Button variant="secondary" icon={X} onClick={() => decide('REJECTED')} disabled={busy}>
                  거절
                </Button>
                <Button icon={Check} onClick={() => decide('APPROVED')} disabled={busy || checking || taken || !valid}>
                  승인하고 계정 만들기
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}
