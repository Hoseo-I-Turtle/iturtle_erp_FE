import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleCheck, Info, Shield } from 'lucide-react'
import { BrandLogo, Button, Checkbox } from '../../components/ui'
import { getDataMode } from '../../lib/dataMode'
import { api, ApiError } from '../../api/client'
import a from './auth.module.css'
import s from './SignupPage.module.css'

const STEPS = [
  { title: '신청', desc: '이 페이지에서 신청서를 내요' },
  { title: '관리자 승인', desc: '입실일 · 권한을 정해 계정을 만들어요' },
  { title: '직접 연락', desc: '승인한 사람이 로그인 ID 와 임시 비밀번호를 알려 드려요' },
  { title: '첫 로그인', desc: '연구실 망(WARP)에서 로그인하고 비밀번호를 바꿔요' },
]

/** 공개 사이트의 인턴 가입 신청 (로그인 없이) */
export function SignupPage() {
  const [f, setF] = useState({ name: '', studentNo: '', loginId: '', email: '', phone: '', reason: '' })
  const [agree, setAgree] = useState(false)
  const [human, setHuman] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  // 백엔드 CredentialPolicyService 의 로그인 ID 규칙: 영문 소문자로 시작, 영문 소문자 · 숫자 · . _ - 4~30자
  const idFormat = /^[a-z][a-z0-9._-]{3,29}$/.test(f.loginId)
  const studentNoOk = !f.studentNo || /^[0-9]{1,20}$/.test(f.studentNo)
  const phoneOk = /^[0-9-]{9,20}$/.test(f.phone)
  const ready = f.name.trim() && idFormat && studentNoOk && phoneOk && f.reason.trim() && agree && human

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setError('')
    if (getDataMode() === 'live') {
      try {
        // 8-1 SignupApplyRequest: studentNumber · desiredLoginId (로그인 · CSRF 없는 공개 경로)
        await api<{ receivedAt: string }>('/public/v1/signup-applications', {
          method: 'POST',
          root: true,
          body: {
            name: f.name.trim(),
            studentNumber: f.studentNo || null,
            desiredLoginId: f.loginId,
            email: f.email.trim(),
            phone: f.phone,
            reason: f.reason,
            privacyAgreed: agree,
          },
        })
      } catch (err) {
        return setError(err instanceof ApiError ? err.message : '서버에 닿지 못했어요.')
      }
    }
    setSent(true)
  }

  return (
    <div className={s.page}>
      <header className={s.top}>
        <Link to="/login" className={s.logo}>
          <BrandLogo height={36} gap={14} />
        </Link>
        <span className={s.badge}>
          <Info size={14} /> 인턴 가입 신청 · 로그인 없이 신청
        </span>
      </header>

      <div className={s.body}>
        <form className={s.card} onSubmit={submit}>
          {sent ? (
            <div className={s.done}>
              <CircleCheck size={48} />
              <h1>신청을 받았어요</h1>
              <p>관리자가 승인하면 {f.phone} 으로 로그인 ID 와 임시 비밀번호를 알려 드려요.</p>
              <Link to="/login" className={a.link}>
                로그인 화면으로
              </Link>
            </div>
          ) : (
            <>
              <h1 className={a.title}>인턴 가입 신청</h1>
              <p className={a.sub}>승인되면 연구실 계정이 만들어져요. 계정 하나로 연구실 포털과 Vault · Jenkins · Penpot 을 써요.</p>
              <label className={a.field}>
                이름
                <input className={s.input} value={f.name} onChange={set('name')} maxLength={30} required />
              </label>
              <div className={s.two}>
                <label className={a.field}>
                  학번 (있으면)
                  <input className={s.input} value={f.studentNo} onChange={set('studentNo')} inputMode="numeric" maxLength={20} aria-invalid={!studentNoOk} />
                </label>
                <label className={a.field}>
                  희망 로그인 ID
                  <span className={s.withBadge}>
                    <input className={s.input} value={f.loginId} onChange={(e) => setF({ ...f, loginId: e.target.value.toLowerCase() })} maxLength={30} required />
                    {/* 바깥에서 계정 ID 를 알아낼 수 없도록 사용 여부는 알려 주지 않고 형식만 본다 (API 명세 S5) */}
                    {f.loginId &&
                      (idFormat ? (
                        <span className={`${s.pill} ${s.pillOk}`}>
                          <Check size={12} /> 형식 맞음
                        </span>
                      ) : (
                        <span className={`${s.pill} ${s.pillBad}`}>영문 소문자로 시작 · 4~30자</span>
                      ))}
                  </span>
                </label>
              </div>
              <div className={s.two}>
                <label className={a.field}>
                  Cloudflare WARP 가입 이메일
                  <input className={s.input} type="email" value={f.email} onChange={set('email')} placeholder="example@hoseo.edu" required />
                  <span className={a.hint}>연구실 사설망(WARP)에 가입할 때 쓸 이메일이에요. 승인되면 이 이메일로 접속할 수 있어요</span>
                </label>
                <label className={a.field}>
                  연락처
                  <input className={s.input} value={f.phone} onChange={set('phone')} placeholder="010-0000-0000" required />
                  <span className={a.hint}>승인 결과를 이 번호로 알려 드려요</span>
                </label>
              </div>
              <label className={a.field}>
                신청 사유
                <textarea
                  className={s.input}
                  rows={4}
                  maxLength={1000}
                  value={f.reason}
                  onChange={set('reason')}
                  placeholder="지도 교수, 참여하고 싶은 프로젝트 등을 적어 주세요 (1000자 이하)"
                  required
                />
              </label>
              <div className={s.agree}>
                <Checkbox checked={agree} onChange={setAgree}>
                  [필수] 개인정보 수집 · 이용에 동의합니다 (이름, 학번, 연락처, 이메일)
                </Checkbox>
                <a href="#privacy" className={a.hint}>
                  자세히
                </a>
              </div>
              <button type="button" className={human ? `${s.captcha} ${s.captchaOk}` : s.captcha} onClick={() => setHuman(true)}>
                {human ? <CircleCheck size={22} /> : <span className={s.captchaBox} />}
                {human ? '사람인지 확인됐어요' : '사람인지 확인하기'}
              </button>
              {error && <p className={a.errText}>{error}</p>}
              <Button type="submit" icon={Check} className={a.submit} disabled={!ready}>
                신청하기
              </Button>
            </>
          )}
        </form>

        <aside className={s.side}>
          <div className={s.steps}>
            <h2>이렇게 진행돼요</h2>
            {STEPS.map((st, i) => (
              <div key={st.title} className={s.step}>
                <span>{i + 1}</span>
                <div>
                  <strong>{st.title}</strong>
                  <small>{st.desc}</small>
                </div>
              </div>
            ))}
          </div>
          <div className={s.note}>
            <Shield size={18} /> 거절됐거나 30일 동안 처리되지 않은 신청서는 90일 뒤 지워져요.
          </div>
        </aside>
      </div>
    </div>
  )
}
