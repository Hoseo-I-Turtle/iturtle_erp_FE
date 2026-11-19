import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Lock, RefreshCw, TriangleAlert, User } from 'lucide-react'
import { Button } from '../../components/ui'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode } from '../../lib/dataMode'
import { formLogin } from '../../api/client'
import { PasswordInput } from './PasswordInput'
import s from './auth.module.css'

const SERVICE_NAME: Record<string, string> = { vault: 'Vault', jenkins: 'Jenkins', penpot: 'Penpot' }

/** 주소 파라미터에 따라 카드 위에 안내 하나만 보여 준다 */
function StateBanner({ params, error }: { params: URLSearchParams; error: boolean }) {
  if (error || params.has('error'))
    return (
      <div className={`${s.banner} ${s.bError}`} role="alert">
        <TriangleAlert size={18} /> 아이디 또는 비밀번호가 올바르지 않습니다.
      </div>
    )
  if (params.has('logout'))
    return (
      <div className={`${s.banner} ${s.bInfo}`}>
        <Check size={18} /> 로그아웃되었습니다. 연결된 서비스에서도 로그아웃됐어요.
      </div>
    )
  if (params.has('expired'))
    return (
      <div className={`${s.banner} ${s.bWarn}`}>
        <RefreshCw size={18} /> 계정 정보가 바뀌어 로그아웃되었습니다. 다시 로그인해 주세요.
      </div>
    )
  const denied = params.get('denied')
  if (denied)
    return (
      <div className={`${s.banner} ${s.bWarn}`}>
        <Lock size={18} /> {SERVICE_NAME[denied] ?? denied} 에 들어갈 권한이 없어요. 관리 &gt; 권한 신청에서 신청할 수 있어요.
      </div>
    )
  return null
}

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!loginId || !password) return setError(true)
    setBusy(true)
    setError(false)
    try {
      if (getDataMode() === 'live') {
        const me = await formLogin(loginId, password)
        navigate(me.passwordChangeRequired ? '/password' : '/', { replace: true })
      } else {
        // 목업: 비밀번호가 'temp' 로 시작하면 임시 비밀번호로 로그인한 것으로 본다
        navigate(password.startsWith('temp') ? '/password' : '/', { replace: true })
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className={s.title}>로그인</h1>
      <p className={s.sub}>연구실 계정으로 로그인하세요</p>
      <StateBanner params={params} error={error} />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <label className={s.field}>
          로그인 ID
          <span className={error ? `${s.inputWrap} ${s.invalid}` : s.inputWrap}>
            <User size={18} />
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoFocus />
          </span>
        </label>
        <label className={s.field}>
          비밀번호
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <Button type="submit" className={s.submit} disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </Button>
      </form>
      <p className={s.hint}>비밀번호를 5번 연속 틀리면 5분 동안 로그인할 수 없어요.</p>
      <hr className={s.divider} />
      <Link to="/signup" className={s.link}>
        계정이 없나요? 가입 신청하기 <ChevronRight size={16} />
      </Link>
      <p className={s.hint}>비밀번호를 잊었다면 관리자에게 임시 비밀번호를 받으세요.</p>
      {getDataMode() !== 'live' && <p className={s.hint}>목업 모드: 아무 값으로나 로그인돼요. 비밀번호를 temp 로 시작하면 비밀번호 변경 화면으로 가요.</p>}
    </AuthLayout>
  )
}
