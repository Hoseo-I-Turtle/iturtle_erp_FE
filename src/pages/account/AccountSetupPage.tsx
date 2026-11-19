import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { Button } from '../../components/ui'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode } from '../../lib/dataMode'
import { api, ApiError } from '../../api/client'
import { PasswordInput } from './PasswordInput'
import s from './auth.module.css'

/** 백엔드 CredentialPolicyService: 10~64자(코드 포인트), UTF-8 72바이트 이하, 로그인 ID 와 다름(대소문자 무시) */
const lengthOk = (v: string) => {
  const n = [...v].length
  return n >= 10 && n <= 64 && new TextEncoder().encode(v).length <= 72
}

type Target = { loginId: string; name: string; expiresAt: string | null }

/** 메일 링크의 #token= (fragment 라 서버 · 프록시 접속 기록에 남지 않는다) */
const tokenFromHash = () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? ''

const expiresText = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}까지`
}

/**
 * 초대 메일 링크로 처음 비밀번호 정하기 (/account/setup#token=…, IV-1 · IV-2). 로그인 없이 연다.
 * 링크를 확인하고(누구의 링크인지 · 만료), 새 비밀번호를 정하면 바로 로그인할 수 있다.
 */
export function AccountSetupPage() {
  const live = getDataMode() === 'live'
  const navigate = useNavigate()
  const [token] = useState(tokenFromHash)
  // 목업은 링크 확인 없이 보여 준다
  const [target, setTarget] = useState<Target | null>(() =>
    live ? null : { loginId: 'daeun', name: '정다은', expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() },
  )
  const [linkError, setLinkError] = useState(() => (token ? '' : '링크가 올바르지 않아요. 메일의 링크를 그대로 눌러 들어와 주세요.'))
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token || !live) return
    let alive = true
    api<Target>('/public/v1/member-invitations/verify', { method: 'POST', root: true, body: { token } })
      .then((t) => alive && setTarget(t))
      .catch((e) => alive && setLinkError(e instanceof ApiError ? e.message : '서버에 닿지 못했어요. 연구실 망(WARP)이 켜져 있는지 봐 주세요.'))
    return () => {
      alive = false
    }
  }, [live, token])

  const rules: { label: string; ok: boolean | null }[] = [
    { label: '10자 이상 64자 이하', ok: next.length > 0 ? lengthOk(next) : null },
    { label: '로그인 ID 와 다름', ok: next.length > 0 && target ? next.toLowerCase() !== target.loginId.toLowerCase() : null },
  ]
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = Boolean(target) && rules.every((r) => r.ok !== false) && lengthOk(next) && confirm === next

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setServerError('')
    try {
      if (live) {
        await api<Target>('/public/v1/member-invitations/accept', { method: 'POST', root: true, body: { token, password: next } })
      }
      setDone(true)
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : '서버에 닿지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className={s.title}>비밀번호를 정했어요</h1>
        <div className={`${s.banner} ${s.bInfo}`}>
          <CircleCheck size={18} />
          <span>
            이제 아이디 <strong>{target?.loginId}</strong> 와 새 비밀번호로 로그인할 수 있어요.
          </span>
        </div>
        <Button className={s.submit} onClick={() => navigate('/login', { replace: true })}>
          로그인하러 가기
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className={s.title}>처음 비밀번호 정하기</h1>
      {linkError ? (
        <>
          <div className={`${s.banner} ${s.bError}`}>
            <TriangleAlert size={18} />
            <span>{linkError}</span>
          </div>
          <p className={s.hint}>
            링크가 만료됐거나 바뀌었으면 관리자에게 초대 메일을 다시 보내 달라고 해 주세요. 이미 비밀번호를 정했다면{' '}
            <Link to="/login" className={s.link}>
              로그인
            </Link>
            하면 돼요.
          </p>
        </>
      ) : !target ? (
        <p className={s.hint}>링크를 확인하는 중…</p>
      ) : (
        <>
          <div className={`${s.banner} ${s.bInfo}`}>
            <Info size={18} />
            <span>
              {target.name} 님, 연구실 ERP 아이디는 <strong>{target.loginId}</strong> 예요. 링크는 {expiresText(target.expiresAt)} 한 번만 쓸 수 있어요.
            </span>
          </div>
          <form onSubmit={submit} style={{ display: 'contents' }}>
            <label className={s.field}>
              새 비밀번호
              <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
            </label>
            <ul className={s.rules}>
              {rules.map((r) => (
                <li key={r.label} className={r.ok === null ? undefined : r.ok ? s.ruleOk : s.ruleBad}>
                  {r.ok === false ? <X size={14} /> : <Check size={14} />} {r.label}
                </li>
              ))}
            </ul>
            <label className={s.field}>
              새 비밀번호 확인
              <PasswordInput value={confirm} onChange={setConfirm} invalid={mismatch} autoComplete="new-password" />
              {mismatch && <span className={s.errText}>새 비밀번호와 같지 않아요</span>}
            </label>
            {serverError && <p className={s.errText}>{serverError}</p>}
            <Button type="submit" className={s.submit} disabled={!valid || busy}>
              {busy ? '정하는 중…' : '비밀번호 정하기'}
            </Button>
          </form>
          <p className={s.hint}>문장처럼 길게 만들면 기억하기 쉽고 안전해요. Vault · Jenkins · Penpot 도 이 비밀번호로 로그인해요.</p>
        </>
      )}
    </AuthLayout>
  )
}
