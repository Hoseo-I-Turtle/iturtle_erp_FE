import { Link } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'
import { Button, Switch } from '../../../components/ui'
import { PASSWORD_PATH } from '../../../api/client'
import type { ProfileData } from '../../../api/admin'
import s from '../ProfilePage.module.css'

type Form = ProfileData['form']

type Props = {
  data: ProfileData
  form: Form
  onChange: (f: Form) => void
  emailOk: boolean
  phoneOk: boolean
  dirty: boolean
  saving: boolean
  saveError: string
  onSave: () => void
}

/** 바꿀 수 없는 정보 · 내가 바꿀 수 있는 정보 · 저장 */
export function ProfileForm({ data, form, onChange, emailOk, phoneOk, dirty, saving, saveError, onSave }: Props) {
  return (
    <>
      <div className={s.label}>바꿀 수 없는 정보</div>
      <div className={s.three}>
        <ReadOnly label="구성원 번호" value={data.memberNo} />
        <ReadOnly label="로그인 ID" value={data.loginId} />
        <ReadOnly label="이름" value={data.name} hint="이름 · 구분은 관리자가 바꿔요" />
      </div>

      <div className={s.label}>내가 바꿀 수 있는 정보</div>
      <div className={s.two}>
        <label className={s.field}>
          Cloudflare 가입 이메일
          <input className={emailOk ? s.input : `${s.input} ${s.invalid}`} value={form.email} onChange={(e) => onChange({ ...form, email: e.target.value })} />
          <small className={emailOk ? s.hint : s.err}>
            {emailOk
              ? '연구실 Cloudflare 접속 허용 목록에 쓰여요. 바꿀 수는 있지만 비울 수는 없어요'
              : form.email
                ? '이메일 형식을 확인해 주세요'
                : 'Cloudflare 가입 이메일은 비울 수 없어요'}
          </small>
        </label>
        <label className={s.field}>
          연락처 (선택)
          <input className={phoneOk ? s.input : `${s.input} ${s.invalid}`} value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} />
          <span className={s.switchRow}>
            <Switch checked={form.phonePublic} onChange={(v) => onChange({ ...form, phonePublic: v })} label="연락처 공개" />
            <small className={s.hint}>연락처 공개 (끄면 contact-view 역할만 봐요)</small>
          </span>
        </label>
      </div>
      <label className={s.field}>
        소개
        <input className={s.input} maxLength={200} value={form.intro} onChange={(e) => onChange({ ...form, intro: e.target.value })} />
        <small className={s.hint}>{form.intro.length} / 200자 · 구성원 목록 카드에 보여요</small>
      </label>

      <div className={s.bottom}>
        <Link to={PASSWORD_PATH} className={s.pwLink}>
          <Lock size={16} /> 비밀번호 바꾸기
        </Link>
        {saveError && <small className={s.err}>{saveError}</small>}
        <Button icon={Check} onClick={onSave} disabled={!dirty || !emailOk || !phoneOk || saving}>
          {dirty ? '저장' : '저장됨'}
        </Button>
      </div>
    </>
  )
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <label className={s.field}>
      {label}
      <input className={`${s.input} ${s.readonly}`} value={value} readOnly />
      {hint && <small className={s.hint}>{hint}</small>}
    </label>
  )
}
