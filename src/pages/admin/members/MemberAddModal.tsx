import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Info, Link2, Lock, Mail, MailCheck, Plus, Send, Shield, X } from 'lucide-react'
import { Button, Modal } from '../../../components/ui'
import {
  checkIdentifiers,
  createMember,
  errorText,
  notifyMembersChanged,
  useAddMemberPresets,
  useInvitationPolicy,
  type IdentifierCheck,
  type NewMember,
} from '../../../api/admin'
import f from '../../../components/form/form.module.css'
import s from './MemberAddModal.module.css'

type MemberType = NewMember['memberType']
const TYPES: { value: MemberType; label: string }[] = [
  { value: 'PROFESSOR', label: '교수' },
  { value: 'STUDENT', label: '학생' },
  { value: 'INTERN', label: '인턴' },
]
const TYPE_LABEL: Record<MemberType, string> = { PROFESSOR: '교수', STUDENT: '학생', INTERN: '인턴' }
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 입력이 멈춘 뒤 확인 (300ms) */
function useIdCheck(loginId: string, studentNumber: string) {
  const [check, setCheck] = useState<IdentifierCheck | null>(null)
  useEffect(() => {
    if (!loginId && !studentNumber) return
    let alive = true
    const t = window.setTimeout(() => {
      checkIdentifiers({ loginId, studentNumber })
        .then((r) => alive && setCheck(r))
        .catch(() => alive && setCheck(null))
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [loginId, studentNumber])
  return check
}

/**
 * 구성원 추가 (Penpot 06 "구성원 추가", 3-1). 두 가지 중 하나:
 * - 처음 비밀번호: 서버가 만들고 이 화면에서 한 번만 보여 준다. 첫 로그인 때 새 비밀번호로 바꾸게 한다 (/account/password).
 * - 초대 메일: 24시간 일회용 링크(/account/setup#token=…)를 메일로 보낸다. 메일 설정이 꺼져 있으면(3-9) 고를 수 없다.
 */
export function MemberAddModal({ onClose }: { onClose: () => void }) {
  const presets = useAddMemberPresets().data ?? []
  const policy = useInvitationPolicy().data
  const mailEnabled = policy?.mailEnabled ?? false
  const [invite, setInvite] = useState(false)
  const [name, setName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [memberType, setMemberType] = useState<MemberType>('STUDENT')
  const [joinedOn, setJoinedOn] = useState(today())
  /** undefined 면 구분의 기본 프리셋을 따른다, null 이면 프리셋 없이 */
  const [presetPick, setPresetPick] = useState<string | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ loginId: string; password: string | null; invited: boolean; email: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const check = useIdCheck(loginId.trim(), studentNumber.trim())

  // 프리셋을 직접 고르지 않았으면 구분의 기본 프리셋 (구분을 바꾸면 다시 기본으로)
  const presetId = presetPick === undefined ? (presets.find((p) => p.defaultFor === TYPE_LABEL[memberType])?.id ?? null) : presetPick
  const preset = presets.find((p) => p.id === presetId) ?? null
  // 인턴은 번호를 비워 두면 서버가 제안한 다음 인턴 번호를 쓴다
  const suggested = memberType === 'INTERN' ? (check?.suggestedInternNumber ?? '') : ''
  const number = studentNumber.trim() || suggested
  const idState = loginId.trim() && check?.loginId ? check.loginId : null
  const noState = studentNumber.trim() && check?.studentNumber ? check.studentNumber : null

  const problems = useMemo(() => {
    const list: string[] = []
    if (!name.trim()) list.push('이름')
    if (!/^[a-z][a-z0-9._-]{3,29}$/.test(loginId.trim())) list.push('아이디')
    if (!/^[A-Z0-9]{1,20}$/.test(number)) list.push('구성원 번호')
    // WARP 가입 이메일은 필수 (ERP-35)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) list.push('WARP 가입 이메일')
    if (phone.trim() && !/^[0-9-]{9,20}$/.test(phone.trim())) list.push('연락처')
    if (!joinedOn) list.push('입실일')
    return list
  }, [name, loginId, number, email, phone, joinedOn])

  const submit = async () => {
    setError(null)
    if (problems.length) return setError(`${problems.join(' · ')} 을(를) 확인해 주세요.`)
    if (idState && !idState.available) return setError('이미 쓰는 아이디예요.')
    if (noState && !noState.available) return setError('이미 쓰는 구성원 번호예요.')
    setSaving(true)
    try {
      const r = await createMember({
        studentNumber: number,
        loginId: loginId.trim(),
        name: name.trim(),
        memberType,
        joinedOn,
        email: email.trim() || null,
        phone: phone.trim() || null,
        presetIds: preset ? [Number(preset.id)].filter((n) => Number.isFinite(n)) : [],
        roleCodes: preset ? preset.roles : [],
        sendInvitation: invite && mailEnabled,
      })
      setDone({ loginId: r.loginId, password: r.temporaryPassword, invited: r.invitationSent, email: email.trim() })
      notifyMembersChanged()
    } catch (e) {
      setError(errorText(e, '구성원을 만들지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  if (done?.invited) {
    return (
      <Modal
        title="초대 메일을 보냈어요"
        onClose={onClose}
        width={560}
        footer={
          <Button icon={Check} onClick={onClose}>
            닫기
          </Button>
        }
      >
        <div className={f.form}>
          <p className={s.lead}>
            <strong>{name}</strong> 님({done.email})에게 비밀번호를 정하는 링크를 보냈어요. 링크에서 비밀번호를 정하면 바로 로그인할 수 있어요.
          </p>
          <div className={s.secret}>
            <span>아이디</span>
            <code>{done.loginId}</code>
          </div>
          <p className={f.hint}>
            <MailCheck size={12} /> 링크는 {policy?.ttlHours ?? 24}시간 동안 한 번만 쓸 수 있어요. 메일이 안 왔으면 구성원 상세의 "초대 메일 다시 보내기"로 새 링크를 보내요.
          </p>
        </div>
      </Modal>
    )
  }

  if (done && done.password) {
    const password = done.password
    return (
      <Modal
        title="구성원을 만들었어요"
        onClose={onClose}
        width={560}
        footer={
          <Button icon={Check} onClick={onClose}>
            닫기
          </Button>
        }
      >
        <div className={f.form}>
          <p className={s.lead}>
            <strong>{name}</strong> 님에게 아래 아이디와 처음 비밀번호를 직접 전해 주세요. 첫 로그인 때 새 비밀번호로 바꾸게 돼요.
          </p>
          <div className={s.secret}>
            <span>아이디</span>
            <code>{done.loginId}</code>
          </div>
          <div className={s.secret}>
            <span>처음 비밀번호</span>
            <code>{password}</code>
            <Button variant="secondary" icon={copied === 'pw' ? Check : Copy} onClick={() => void copy('pw', password)}>
              {copied === 'pw' ? '복사함' : '복사'}
            </Button>
          </div>
          <p className={f.hint}>
            <Lock size={12} /> 이 비밀번호는 이 화면에서만 보여요. 잃어버리면 구성원 상세의 "비밀번호 재발급"으로 새로 만들어요.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="구성원 추가"
      onClose={onClose}
      width={720}
      footer={
        <>
          {error ? (
            <span className={f.footError}>{error}</span>
          ) : (
            <span className={f.footNote}>
              <Info size={14} />
              서비스 계정(Vault · Jenkins · Penpot)은 만든 뒤 1분 안에 맞춰져요
            </span>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={() => void submit()} disabled={saving}>
            {saving ? '만드는 중…' : '구성원 추가'}
          </Button>
        </>
      }
    >
      <div className={f.form}>
        <div className={f.row2}>
          <label className={f.field}>
            <span className={f.label}>
              이름<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="정다은" />
            </span>
          </label>
          <label className={f.field}>
            <span className={f.label}>
              아이디<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <input value={loginId} maxLength={30} onChange={(e) => setLoginId(e.target.value.toLowerCase())} placeholder="daeun" />
              {idState &&
                (idState.valid && idState.available ? (
                  <span className={f.ok}>
                    <Check size={12} /> 사용할 수 있어요
                  </span>
                ) : (
                  <span className={s.no}>
                    <X size={12} /> {idState.valid ? '이미 있어요' : '형식이 달라요'}
                  </span>
                ))}
            </span>
            <span className={f.hint}>로그인 · Vault · Jenkins · Penpot 계정 이름으로 쓰여요 (영문 소문자로 시작, 4~30자)</span>
          </label>
        </div>

        <div className={f.row2}>
          <label className={f.field}>
            <span className={f.label}>
              구성원 번호<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <input value={studentNumber} maxLength={20} onChange={(e) => setStudentNumber(e.target.value.toUpperCase())} placeholder={suggested ? `비우면 ${suggested}` : '학번 · 교번'} />
              {noState && !noState.available && (
                <span className={s.no}>
                  <X size={12} /> 이미 있어요
                </span>
              )}
            </span>
          </label>
          <label className={f.field}>
            <span className={f.label}>
              입실일<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
            </span>
          </label>
        </div>

        <div className={f.row2}>
          <label className={f.field}>
            <span className={f.label}>
              Cloudflare WARP 가입 이메일<span className={f.req}>*</span>
            </span>
            <span className={f.input}>
              <Mail size={18} />
              <input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="daeun@hoseo.edu" />
            </span>
            <span className={f.hint}>
              연구실 사설망(WARP)에 가입할 때 쓰는 이메일이에요. WARP 접속 허용 목록에 들어가고{invite ? ', 초대 메일도 이 주소로 보내요' : ', 알림 · 비밀번호 재설정에도 쓰여요'}
            </span>
          </label>
          <label className={f.field}>
            <span className={f.label}>연락처</span>
            <span className={f.input}>
              <input value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </span>
          </label>
        </div>

        <div className={f.row2}>
          <div className={f.field}>
            <span className={f.label}>
              구분<span className={f.req}>*</span>
            </span>
            <div className={f.pills} role="radiogroup" aria-label="구분">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={memberType === t.value}
                  className={memberType === t.value ? `${f.pill} ${f.pillOn}` : f.pill}
                  onClick={() => {
                    setMemberType(t.value)
                    setPresetPick(undefined)
                  }}
                >
                  {memberType === t.value && <Check size={14} />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <label className={f.field}>
            <span className={f.label}>권한 프리셋</span>
            <span className={f.input}>
              <Shield size={18} />
              <select value={presetId ?? ''} onChange={(e) => setPresetPick(e.target.value || null)}>
                <option value="">프리셋 없이 (역할 없음)</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </span>
            <span className={f.hint}>{preset ? `ERP 역할 ${preset.roles.length}개를 한 번에 줘요` : '역할은 만든 뒤 상세에서 줄 수 있어요'}</span>
          </label>
        </div>

        <div className={f.row2} role="radiogroup" aria-label="계정 전달 방법">
          <button
            type="button"
            role="radio"
            aria-checked={!invite}
            className={!invite ? `${f.option} ${f.optionOn} ${s.choice}` : `${f.option} ${s.choice}`}
            onClick={() => setInvite(false)}
          >
            <Lock size={18} className={s.optIcon} />
            <span className={f.optionText}>
              <strong>처음 비밀번호 · 자동 생성</strong>
              <span>만들면 한 번만 보여 줘요. 직접 전해 주면 첫 로그인 때 새 비밀번호로 바꾸게 해요.</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={invite}
            disabled={!mailEnabled}
            className={invite ? `${f.option} ${f.optionOn} ${s.choice}` : `${f.option} ${s.choice}`}
            onClick={() => mailEnabled && setInvite(true)}
          >
            <Send size={18} className={s.optIcon} />
            <span className={f.optionText}>
              <strong>초대 메일 보내기 ({policy?.ttlHours ?? 24}시간 링크)</strong>
              <span>
                {mailEnabled
                  ? '메일의 링크에서 본인이 비밀번호를 정해요. 이메일이 필요해요.'
                  : '메일 설정이 없어 지금은 쓸 수 없어요 — 처음 비밀번호를 보여 줘요.'}
              </span>
            </span>
          </button>
        </div>

        <div className={s.signup}>
          <Link2 size={16} />
          <span>본인이 직접 가입하게 하려면</span>
          <button type="button" onClick={() => void copy('link', `${window.location.origin}/signup`)}>
            {copied === 'link' ? '복사했어요' : '가입 신청 링크 복사'}
          </button>
          <small>· 신청은 "가입 신청"에서 승인해요</small>
        </div>
      </div>
    </Modal>
  )
}

/** 관리 · 구성원 탭 머리의 "구성원 추가" 버튼 + 모달 */
export function MemberAddButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && <MemberAddModal onClose={() => setOpen(false)} />}
    </>
  )
}
