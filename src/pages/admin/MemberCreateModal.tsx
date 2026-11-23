import { useState } from 'react'
import { Calendar, Check, Copy, Info, Lock, Mail, Phone } from 'lucide-react'
import { Button, Field, FormError, FormRow, Modal, Select, TextInput, ToggleChip } from '../../components/ui'
import { todayKst, useLoginIdCheck, usePresetsAdmin } from '../../api/admin'
import { createMember, type MemberDraft } from '../../api/adminOps'
import { errorText } from '../../api/content'
import { getDataMode } from '../../lib/dataMode'
import { adminMembers } from '../../mocks/admin'
import s from './ops.module.css'

const TYPES: [MemberDraft['memberType'], string][] = [
  ['PROFESSOR', '교수'],
  ['STUDENT', '학생'],
  ['INTERN', '인턴'],
]
const LOGIN_RE = /^[a-z][a-z0-9._-]{3,29}$/
const NO_RE = /^[A-Z0-9]{1,20}$/

/** 구성원 추가 (Penpot 06 · 구성원 추가) — 3-1, 3-2 */
export function MemberCreateModal({ onClose }: { onClose: () => void }) {
  const isLive = getDataMode() === 'live'
  const presets = usePresetsAdmin()
  const [f, setF] = useState<MemberDraft>({ name: '', loginId: '', memberNo: '', memberType: 'STUDENT', joinedOn: todayKst(), email: '', phone: '', presetId: '' })
  const [pickedPreset, setPickedPreset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ loginId: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof MemberDraft>(k: K, v: MemberDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  const formatOk = LOGIN_RE.test(f.loginId)
  const check = useLoginIdCheck(formatOk ? f.loginId : '')
  // 목업은 목업 구성원과 겹치는지만 본다
  const taken = isLive ? check.data?.available === false : adminMembers.some((m) => m.loginId === f.loginId)
  const idOk = formatOk && !taken && (!isLive || check.data?.available === true)

  // 구분을 고르면 그 구분의 기본 프리셋을 미리 고른다 (직접 고른 뒤에는 그대로 둔다)
  const active = (presets.data?.presets ?? []).filter((p) => p.active)
  const typeLabel = TYPES.find(([t]) => t === f.memberType)![1]
  const presetId = pickedPreset ? f.presetId : (active.find((p) => p.defaultFor === typeLabel)?.id ?? '')
  const preset = active.find((p) => p.id === presetId)

  const submit = async () => {
    if (!f.name.trim()) return setError('이름을 적어 주세요.')
    if (!formatOk) return setError('아이디는 영문 소문자로 시작하는 4~30자예요 (소문자 · 숫자 · . _ -).')
    if (taken) return setError('이미 쓰고 있는 아이디예요.')
    if (!NO_RE.test(f.memberNo)) return setError('구성원 번호는 영문 대문자 · 숫자 1~20자예요 (예: 20231234, I2026003).')
    if (!f.joinedOn) return setError('입실일을 정해 주세요.')
    setBusy(true)
    setError(null)
    try {
      const password = await createMember({ ...f, name: f.name.trim(), presetId }, isLive, preset?.roles ?? [])
      setDone({ loginId: f.loginId, password })
    } catch (e) {
      setError(errorText(e, '구성원을 만들지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <Modal title="구성원을 추가했어요" width={560} onClose={onClose} footer={<div className={s.foot}><span /><Button icon={Check} onClick={onClose}>확인</Button></div>}>
        <div className={s.password}>
          <strong>
            <Lock size={16} />
            {done.loginId} 의 임시 비밀번호
          </strong>
          <div>
            <code>{done.password}</code>
            <Button
              variant="tint"
              icon={Copy}
              onClick={async () => {
                await navigator.clipboard?.writeText(done.password)
                setCopied(true)
              }}
            >
              {copied ? '복사함' : '복사'}
            </Button>
          </div>
          <small>이 값은 지금 한 번만 보여요. 본인에게 직접 전해 주세요. 첫 로그인 때 새 비밀번호로 바꾸게 돼요.</small>
        </div>
      </Modal>
    )

  return (
    <Modal
      title="구성원 추가"
      width={720}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span>
            <Info size={14} />
            만들면 임시 비밀번호를 한 번 보여 줘요
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy}>
            {busy ? '만드는 중…' : '구성원 추가'}
          </Button>
        </div>
      }
    >
      <FormRow>
        <Field label="이름" required>
          <TextInput value={f.name} onChange={(v) => set('name', v.slice(0, 30))} placeholder="홍길동" autoFocus />
        </Field>
        <Field label="아이디" required help="로그인 · Vault · Jenkins · Penpot 계정 이름으로 쓰여요. 만든 뒤에는 바꿀 수 없어요">
          <TextInput
            value={f.loginId}
            onChange={(v) => set('loginId', v.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30))}
            placeholder="gildong"
            invalid={f.loginId.length > 0 && (!formatOk || !!taken)}
            trailing={
              !f.loginId ? undefined : idOk || (!isLive && formatOk && !taken) ? (
                <span className={s.ok}>
                  <Check size={12} />
                  사용할 수 있어요
                </span>
              ) : taken ? (
                <span className={s.bad}>이미 쓰는 아이디</span>
              ) : !formatOk ? (
                <span className={s.bad}>형식이 맞지 않아요</span>
              ) : undefined
            }
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="구분" required>
          <div className={s.pills}>
            {TYPES.map(([t, label]) => (
              <ToggleChip key={t} on={f.memberType === t} check onClick={() => set('memberType', t)}>
                {label}
              </ToggleChip>
            ))}
          </div>
        </Field>
        <Field label="구성원 번호" required help="학번 · 교번. 인턴은 I + 연도 + 순번 (예: I2026003)">
          <TextInput value={f.memberNo} onChange={(v) => set('memberNo', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))} placeholder="20231234" />
        </Field>
        <Field label="입실일" required>
          <TextInput type="date" icon={Calendar} value={f.joinedOn} onChange={(v) => set('joinedOn', v)} aria-label="입실일" />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="이메일">
          <TextInput type="email" icon={Mail} value={f.email} onChange={(v) => set('email', v)} placeholder="name@hoseo.edu" />
        </Field>
        <Field label="전화">
          <TextInput icon={Phone} value={f.phone} onChange={(v) => set('phone', v)} placeholder="010-0000-0000" />
        </Field>
      </FormRow>
      <Field label="권한 프리셋" help={preset ? `역할 ${preset.roles.length}개: ${preset.roles.join(', ')}` : 'ERP 역할 · 서비스 권한을 한 번에 줘요. 고르지 않으면 역할 없이 만들어요'}>
        <Select
          block
          value={presetId}
          options={[{ value: '', label: '프리셋 없이' }, ...active.map((p) => ({ value: p.id, label: p.defaultFor ? `${p.name} (${p.defaultFor} 기본)` : p.name }))]}
          onChange={(v) => {
            setPickedPreset(true)
            set('presetId', v)
          }}
          label="권한 프리셋"
        />
      </Field>
      {/* 명세 확인 필요: 디자인의 "처음 비밀번호 직접 입력" · "초대 메일 보내기"는 3-1 에 없다. 서버가 임시 비밀번호를 만들어 한 번 보여 준다 */}
      <FormError>{error ?? presets.error}</FormError>
    </Modal>
  )
}
