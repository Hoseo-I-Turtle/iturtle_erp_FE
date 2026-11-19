import { Archive, ChevronRight, LockOpen, RefreshCw, Settings, X } from 'lucide-react'
import { Card, ListItem } from '../../../components/ui'
import { isLive } from '../../../api/admin'
import type { SelectedMember } from './types'
import a from '../admin.module.css'
import s from './AccountActionsCard.module.css'

type Props = {
  member: SelectedMember
  /** 방금 발급한 임시 비밀번호 (한 번만 보여 준다) */
  tempPw: string | null
  onIssueTempPw: () => void
  onUnlock: () => void
  onGraduate: () => void
  onToggleEnabled: () => void
}

/** 계정 조치: 임시 비밀번호 · 잠금 해제 · 졸업/퇴실 · 비활성화 */
export function AccountActionsCard({ member: sel, tempPw, onIssueTempPw, onUnlock, onGraduate, onToggleEnabled }: Props) {
  return (
    <Card>
      <h3 className={a.h3}>
        <Settings size={20} /> 계정 조치
      </h3>
      {tempPw && (
        <div className={s.tempPw}>
          임시 비밀번호 <code>{tempPw}</code>
          <small>지금 한 번만 보여요. 본인에게 직접 전달해 주세요.</small>
        </div>
      )}
      <ListItem
        leading={<RefreshCw size={18} />}
        title="임시 비밀번호 재발급"
        meta="화면에 한 번만 보여요 · 잠금도 풀려요"
        trailing={<ChevronRight size={16} />}
        onClick={onIssueTempPw}
      />
      {sel.state === 'LOCKED' && (
        <ListItem
          leading={<LockOpen size={18} />}
          title="잠금 해제"
          meta={`로그인 실패 ${sel.failCount}회로 잠겼어요`}
          trailing={<ChevronRight size={16} />}
          onClick={onUnlock}
        />
      )}
      {/* 실서버: 이미 졸업 · 퇴실한 사람은 처리할 수 없다 (M018) */}
      {(!sel.graduated || !isLive()) && (
        <ListItem
          leading={<Archive size={18} className={s.red} />}
          title={<span className={s.red}>졸업 · 퇴실 처리</span>}
          meta="서비스 역할 회수 · 담당 작업 넘기기"
          trailing={<ChevronRight size={16} />}
          onClick={onGraduate}
        />
      )}
      <ListItem
        leading={<X size={18} className={s.red} />}
        title={<span className={s.red}>{sel.state === 'DISABLED' ? '다시 활성화' : '비활성화 (일시 정지)'}</span>}
        meta="상태는 재실 그대로"
        trailing={<ChevronRight size={16} />}
        onClick={onToggleEnabled}
      />
    </Card>
  )
}
