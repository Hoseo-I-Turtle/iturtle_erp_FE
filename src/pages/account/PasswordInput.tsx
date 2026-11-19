import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import s from './auth.module.css'

type Props = {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  autoComplete?: string
  placeholder?: string
}

/** 자물쇠 아이콘 + 보기/숨기기 버튼이 있는 비밀번호 입력 */
export function PasswordInput({ value, onChange, invalid, autoComplete, placeholder }: Props) {
  const [show, setShow] = useState(false)
  return (
    <span className={invalid ? `${s.inputWrap} ${s.invalid}` : s.inputWrap}>
      <Lock size={18} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
      />
      <button type="button" className={s.eye} onClick={() => setShow(!show)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}
