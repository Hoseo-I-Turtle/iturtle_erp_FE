import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Info, X } from 'lucide-react'
import { Button } from '../../components/ui'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getDataMode } from '../../lib/dataMode'
import { api, ApiError } from '../../api/client'
import { PasswordInput } from './PasswordInput'
import s from './auth.module.css'

const LOGIN_ID = 'minseo'

export function PasswordChangePage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  const rules = [
    { label: '10자 이상 64자 이하', ok: next.length >= 10 && next.length <= 64 },
    { label: '로그인 ID 와 다름', ok: next.length > 0 && next !== LOGIN_ID },
    { label: '현재 비밀번호와 다름', ok: next.length > 0 && next !== current },
  ]
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = current.length > 0 && rules.every((r) => r.ok) && confirm === next

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setServerError('')
    try {
      if (getDataMode() === 'live') {
        await api('/auth/password', { method: 'PATCH', body: { currentPassword: current, newPassword: next } })
      }
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : '서버에 닿지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className={s.title}>비밀번호 변경</h1>
      <div className={`${s.banner} ${s.bInfo}`}>
        <Info size={18} /> 임시 비밀번호로 로그인했어요. 새 비밀번호로 바꾼 뒤 이용할 수 있어요.
      </div>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <label className={s.field}>
          현재 비밀번호
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
        </label>
        <label className={s.field}>
          새 비밀번호
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </label>
        <ul className={s.rules}>
          {rules.map((r) => (
            <li key={r.label} className={next ? (r.ok ? s.ruleOk : s.ruleBad) : undefined}>
              {next && !r.ok ? <X size={14} /> : <Check size={14} />} {r.label}
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
        나중에 할게요 ·{' '}
        <Link to="/login?logout" className={s.link}>
          로그아웃
        </Link>
      </p>
    </AuthLayout>
  )
}
