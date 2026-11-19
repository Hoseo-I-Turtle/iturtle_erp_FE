import { Calendar, Check, Info, X } from 'lucide-react'
import { Button, Select } from '../../../components/ui'
import type { SignupsData } from '../../../api/admin'
import a from '../admin.module.css'
import s from '../SignupsPage.module.css'

type Props = {
  presets: SignupsData['presets']
  loginId: string
  onLoginId: (v: string) => void
  /** 로그인 ID 확인 상태 */
  checking: boolean
  taken: boolean
  valid: boolean
  joinDate: string
  onJoinDate: (v: string) => void
  preset: string
  onPreset: (v: string) => void
  rejectReason: string
  onRejectReason: (v: string) => void
  err: string
  busy: boolean
  onReject: () => void
  onApprove: () => void
}

/** 승인 설정: 로그인 ID(중복 확인) · 입실일 · 권한 프리셋 · 거절 사유 · 승인/거절 */
export function ApproveForm({
  presets,
  loginId,
  onLoginId,
  checking,
  taken,
  valid,
  joinDate,
  onJoinDate,
  preset,
  onPreset,
  rejectReason,
  onRejectReason,
  err,
  busy,
  onReject,
  onApprove,
}: Props) {
  return (
    <>
      <div className={a.muted}>승인 설정</div>
      <div className={s.approve}>
        <label className={a.field}>
          로그인 ID
          <span className={s.idInput}>
            <input value={loginId} onChange={(e) => onLoginId(e.target.value.toLowerCase())} />
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
            <input type="date" value={joinDate} onChange={(e) => onJoinDate(e.target.value)} />
          </span>
        </label>
        <label className={a.field}>
          권한 프리셋
          <Select value={preset} label="권한 프리셋" options={presets.map((p) => ({ value: p.name, label: p.name }))} onChange={onPreset} />
        </label>
        <label className={a.field}>
          거절 사유 (거절할 때)
          <input className={a.input} maxLength={500} value={rejectReason} onChange={(e) => onRejectReason(e.target.value)} />
        </label>
      </div>
      {err && <p className={a.err}>{err}</p>}
      <div className={s.foot}>
        <span className={s.hint}>
          <Info size={14} /> 승인하면 임시 비밀번호가 한 번만 보여요. 신청자에게 직접 전달해 주세요.
        </span>
        <Button variant="secondary" icon={X} onClick={onReject} disabled={busy}>
          거절
        </Button>
        <Button icon={Check} onClick={onApprove} disabled={busy || checking || taken || !valid}>
          승인하고 계정 만들기
        </Button>
      </div>
    </>
  )
}
