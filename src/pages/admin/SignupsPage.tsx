import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Card, Loadable } from '../../components/ui'
import { adminMembers, type SignupRequest } from '../../mocks/admin'
import { whenLive } from '../../api/useResource'
import { errorText, isLive, reviewSignup, todayKst, useLoginIdCheck, useSignups, type SignupsData } from '../../api/admin'
import { ApproveForm } from './signups/ApproveForm'
import { SignupInfo } from './signups/SignupInfo'
import { SignupList } from './signups/SignupList'
import type { SignupTab } from './signups/status'
import a from './admin.module.css'
import s from './SignupsPage.module.css'

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
  const [tab, setTab] = useState<SignupTab>('PENDING')
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
  const count = (t: SignupTab) => reqs.filter((r) => r.status === t).length + data.extra[t]

  // 백엔드 CredentialPolicyService 와 같은 규칙 (영문 소문자로 시작, 소문자 · 숫자 · . _ - 4~30자)
  const localValid = /^[a-z][a-z0-9._-]{3,29}$/.test(loginId)
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

  const decide = async (status: SignupTab) => {
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
                // 비우면 서버가 "인턴 기본" 을 적용한다. roleCodes 는 프리셋 밖에 더 줄 역할만 (지금 화면에는 없음)
                presetIds: p ? [Number(p.id)] : [],
                roleCodes: [],
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
      <SignupList
        tab={tab}
        onTab={(t) => {
          setTab(t)
          const next = reqs.find((r) => r.status === t)
          if (next) choose(next)
        }}
        count={count}
        list={list}
        selectedId={sel?.id}
        onChoose={choose}
      />

      {sel && (
        <Card className={s.detail}>
          <SignupInfo sel={sel} />

          {done ? (
            <div className={s.done}>
              <Check size={18} /> {done.name} 계정을 만들었어요. 임시 비밀번호 <code>{done.pw}</code> — 지금 한 번만 보여요.
            </div>
          ) : sel.status === 'PENDING' ? (
            <ApproveForm
              presets={presets}
              loginId={loginId}
              onLoginId={setLoginId}
              checking={checking}
              taken={!!taken}
              valid={valid}
              joinDate={joinDate}
              onJoinDate={setJoinDate}
              preset={preset}
              onPreset={setPreset}
              rejectReason={rejectReason}
              onRejectReason={setRejectReason}
              err={err}
              busy={busy}
              onReject={() => decide('REJECTED')}
              onApprove={() => decide('APPROVED')}
            />
          ) : null}
        </Card>
      )}
    </div>
  )
}
