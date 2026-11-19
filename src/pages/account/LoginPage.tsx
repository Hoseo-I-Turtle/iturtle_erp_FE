import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, RefreshCw, TriangleAlert, User } from 'lucide-react'
import { Button } from '../../components/ui'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode } from '../../lib/dataMode'
import { markLoginSubmitted } from '../../lib/loginReturn'
import { loginAction, PASSWORD_PATH, submitBackendForm } from '../../api/client'
import { PasswordInput } from './PasswordInput'
import s from './auth.module.css'

/**
 * 주소 파라미터에 따라 카드 위에 안내 하나만 보여 준다. 백엔드가 붙여 보내는 값:
 * ?error (LoginFailureHandler) · ?logout (로그아웃, SSO 로그아웃) · ?expired (관리자가 끊은 세션 / 프론트가 본 401)
 */
function StateBanner({ params }: { params: URLSearchParams }) {
  if (params.has('error'))
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
        <RefreshCw size={18} /> 로그인이 끊겼어요. 다시 로그인해 주세요.
      </div>
    )
  return null
}

/**
 * 로그인. 실서버는 진짜 HTML 폼(POST /login, loginId · password · _csrf)을 브라우저가 직접 낸다.
 * 그래야 백엔드의 리다이렉트를 브라우저가 따라간다:
 * 성공 → 멈춰 둔 요청(예: Vault · Jenkins · Penpot · MCP 의 /oauth2/authorize) 또는 /,
 * 임시 비밀번호 → /account/password, 실패 → /login?error.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const live = getDataMode() === 'live'

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!loginId || !password || busy) return
    setBusy(true)
    if (live) {
      markLoginSubmitted()
      try {
        await submitBackendForm(e.currentTarget)
      } catch {
        setBusy(false)
      }
      // 페이지가 바뀌므로 busy 는 그대로 둔다
      return
    }
    // 목업: 비밀번호가 'temp' 로 시작하면 임시 비밀번호로 로그인한 것으로 본다
    navigate(password.startsWith('temp') ? PASSWORD_PATH : '/', { replace: true, state: { forced: password.startsWith('temp') } })
  }

  return (
    <AuthLayout>
      <h1 className={s.title}>로그인</h1>
      <p className={s.sub}>연구실 계정으로 로그인하세요</p>
      <StateBanner params={params} />
      <form method="post" action={loginAction()} onSubmit={submit} style={{ display: 'contents' }}>
        <label className={s.field}>
          로그인 ID
          <span className={params.has('error') ? `${s.inputWrap} ${s.invalid}` : s.inputWrap}>
            <User size={18} />
            {/* 파라미터 이름은 AuthSecurityConfig.LOGIN_ID_PARAMETER (loginId) */}
            <input name="loginId" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" required autoFocus />
          </span>
        </label>
        <label className={s.field}>
          비밀번호
          <PasswordInput name="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        </label>
        <input type="hidden" name="_csrf" defaultValue="" />
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
      {!live && <p className={s.hint}>목업 모드: 아무 값으로나 로그인돼요. 비밀번호를 temp 로 시작하면 비밀번호 변경 화면으로 가요.</p>}
    </AuthLayout>
  )
}
