import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Info, X } from 'lucide-react'
import { Button } from '../../components/ui'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode, keepModeAcrossReload } from '../../lib/dataMode'
import { api, ApiError, logout } from '../../api/client'
import { fetchMe } from '../../api/members'
import { PasswordInput } from './PasswordInput'
import s from './auth.module.css'

/** 목업의 내 로그인 ID */
const MOCK_LOGIN_ID = 'minseo'

/** 백엔드 CredentialPolicyService: 10~64자(코드 포인트), UTF-8 72바이트 이하, 로그인 ID 와 다름(대소문자 무시) */
const lengthOk = (v: string) => {
  const n = [...v].length
  return n >= 10 && n <= 64 && new TextEncoder().encode(v).length <= 72
}

type Who = { forced: boolean; loginId: string | null }

/**
 * 비밀번호 변경 (백엔드 경로 /account/password — 임시 비밀번호로 로그인하면 백엔드가 여기로 보낸다).
 * 실서버: 내 정보(GET /members/me)가 403 A001 이면 임시 비밀번호 상태(강제), 200 이면 스스로 들어온 것.
 * 바꾸면 응답의 redirectUrl 로 간다 — 비밀번호 변경 때문에 멈췄던 SSO 로그인이 있으면 그 인가 주소, 없으면 /.
 */
export function PasswordChangePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const live = getDataMode() === 'live'
  const [who, setWho] = useState<Who>(() =>
    live ? { forced: true, loginId: null } : { forced: Boolean((location.state as { forced?: boolean } | null)?.forced), loginId: MOCK_LOGIN_ID },
  )
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!live) return
    let alive = true
    fetchMe()
      .then((me) => alive && setWho({ forced: me.passwordChangeRequired, loginId: me.loginId }))
      .catch((e) => {
        // A001 = 임시 비밀번호 상태라 다른 API 가 막혀 있다. 로그인 ID 는 서버가 확인한다
        if (alive && e instanceof ApiError && e.code === 'A001') setWho({ forced: true, loginId: null })
      })
    return () => {
      alive = false
    }
  }, [live])

  const rules: { label: string; ok: boolean | null }[] = [
    { label: '10자 이상 64자 이하', ok: next.length > 0 ? lengthOk(next) : null },
    {
      label: who.loginId ? '로그인 ID 와 다름' : '로그인 ID 와 다름 (서버가 확인해요)',
      ok: next.length > 0 && who.loginId ? next.toLowerCase() !== who.loginId.toLowerCase() : null,
    },
    { label: '현재 비밀번호와 다름', ok: next.length > 0 ? next !== current : null },
  ]
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = current.length > 0 && rules.every((r) => r.ok !== false) && lengthOk(next) && confirm === next

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setServerError('')
    try {
      if (live) {
        const res = await api<{ redirectUrl: string | null }>('/auth/password', {
          method: 'PATCH',
          body: { currentPassword: current, newPassword: next },
        })
        const to = res?.redirectUrl
        if (to && to !== '/') {
          // 멈췄던 SSO 로그인(/oauth2/authorize?…)을 브라우저가 이어 간다
          keepModeAcrossReload()
          window.location.assign(to)
          return
        }
      }
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : '서버에 닿지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = () => {
    if (live) void logout()
    else navigate('/login?logout', { replace: true })
  }

  return (
    <AuthLayout>
      <h1 className={s.title}>비밀번호 변경</h1>
      {who.forced ? (
        <div className={`${s.banner} ${s.bInfo}`}>
          <Info size={18} /> 임시 비밀번호로 로그인했어요. 새 비밀번호로 바꾼 뒤 이용할 수 있어요.
        </div>
      ) : (
        <div className={`${s.banner} ${s.bInfo}`}>
          <Info size={18} /> 바꾸면 Vault · Jenkins · Penpot 도 다음 로그인부터 새 비밀번호를 써요.
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <label className={s.field}>
          {who.forced ? '임시 비밀번호' : '현재 비밀번호'}
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
        </label>
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
          {busy ? '바꾸는 중…' : '변경'}
        </Button>
      </form>
      <p className={s.hint}>문장처럼 길게 만들면 기억하기 쉽고 안전해요. 대소문자 · 특수문자를 꼭 섞지 않아도 돼요.</p>
      <p className={s.hint}>
        {who.forced ? (
          <>
            나중에 할게요 ·{' '}
            <button type="button" className={s.link} onClick={signOut}>
              로그아웃
            </button>
          </>
        ) : (
          <Link to="/profile" className={s.link}>
            내 프로필로 돌아가기
          </Link>
        )}
      </p>
    </AuthLayout>
  )
}
