import { Check } from 'lucide-react'
import { Avatar } from '../../../components/ui'
import type { SignupRequest } from '../../../mocks/admin'
import { STATUS_LABEL } from './status'
import a from '../admin.module.css'
import s from '../SignupsPage.module.css'

/** 신청서 내용: 이름 · 상태 · 구분 · 학번 · 희망 ID · 연락처 · 동의 · 사유 */
export function SignupInfo({ sel }: { sel: SignupRequest }) {
  return (
    <>
      <div className={s.head}>
        <Avatar name={sel.name} size={48} />
        <div>
          <h2>{sel.name}</h2>
          <small>공개 사이트 · {sel.appliedAt} 신청</small>
        </div>
        <span className={`${a.state} ${sel.status === 'PENDING' ? a.warn : sel.status === 'APPROVED' ? a.ok : a.off}`}>
          {STATUS_LABEL[sel.status]}
        </span>
      </div>
      <dl className={a.kv}>
        <dt>구분</dt>
        <dd>
          <span className={`${a.state} ${a.info}`}>{sel.type}</span>
        </dd>
        <dt>학번 (있으면)</dt>
        <dd>{sel.studentNo ?? '(입력 안 함)'}</dd>
        <dt>희망 로그인 ID</dt>
        <dd>{sel.wantedId}</dd>
        <dt>이메일</dt>
        <dd>{sel.email ?? '(입력 안 함)'}</dd>
        <dt>연락처</dt>
        <dd>{sel.phone}</dd>
        <dt>개인정보 동의</dt>
        <dd>
          <span className={`${a.state} ${a.ok}`}>
            <Check size={12} /> 동의함
          </span>
        </dd>
      </dl>
      <div className={a.muted}>신청 사유</div>
      <p>{sel.reason}</p>
    </>
  )
}
