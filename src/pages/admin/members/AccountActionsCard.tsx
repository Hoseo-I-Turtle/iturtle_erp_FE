import { useEffect, useState } from 'react'
import { Archive, ChevronRight, LockOpen, RefreshCw, Send, Settings, X } from 'lucide-react'
import { Card, ListItem } from '../../../components/ui'
import {
  errorText,
  fetchInvitation,
  isLive,
  resendInvitation,
  useInvitationPolicy,
  type InvitationView,
} from '../../../api/admin'
import { dotDate } from '../../../api/types'
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

const INVITATION_TEXT: Record<InvitationView['status'], string> = {
  NONE: '',
  PENDING: '초대 메일을 보내는 중',
  SENT: '초대 메일 보냄',
  FAILED: '초대 메일을 보내지 못했어요',
  EXPIRED: '초대 링크 만료',
  COMPLETED: '초대 링크로 비밀번호를 정함',
}

/** 고른 구성원의 초대 메일 상태 (3-10) — 다시 보내면 새로 읽는다 */
function useInvitation(memberId: number) {
  const [view, setView] = useState<InvitationView | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fetchInvitation(memberId)
      .then((v) => alive && setView(v))
      .catch(() => alive && setView(null))
    return () => {
      alive = false
    }
  }, [memberId, tick])
  return { view, reload: () => setTick((t) => t + 1), setView }
}

/** 계정 조치: 임시 비밀번호 · 초대 메일 · 잠금 해제 · 졸업/퇴실 · 비활성화 */
export function AccountActionsCard({ member: sel, tempPw, onIssueTempPw, onUnlock, onGraduate, onToggleEnabled }: Props) {
  const mailEnabled = useInvitationPolicy().data?.mailEnabled ?? false
  const invitation = useInvitation(sel.memberId)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const status = invitation.view?.status ?? 'NONE'

  const resend = async () => {
    setInviteMsg(null)
    try {
      invitation.setView(await resendInvitation(sel.memberId))
      setInviteMsg('새 링크를 보냈어요. 옛 링크는 더 쓸 수 없어요.')
      // 메일은 서버가 커밋 뒤 보낸다 — 잠시 뒤 상태를 다시 읽는다
      window.setTimeout(invitation.reload, 2500)
    } catch (e) {
      setInviteMsg(errorText(e, '초대 메일을 다시 보내지 못했어요.'))
    }
  }

  const inviteMeta = [
    INVITATION_TEXT[status],
    status === 'SENT' && invitation.view?.expiresAt ? `${dotDate(invitation.view.expiresAt)}까지` : null,
    status === 'FAILED' ? invitation.view?.failureReason : null,
    invitation.view?.email,
  ]
    .filter(Boolean)
    .join(' · ')

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
      {status !== 'NONE' && status !== 'COMPLETED' && (
        <ListItem
          leading={<Send size={18} />}
          title="초대 메일 다시 보내기"
          meta={mailEnabled ? inviteMeta : `${inviteMeta} · 메일 설정이 없어 보낼 수 없어요`}
          trailing={<ChevronRight size={16} />}
          onClick={mailEnabled ? () => void resend() : undefined}
        />
      )}
      {status === 'COMPLETED' && <ListItem leading={<Send size={18} />} title={INVITATION_TEXT.COMPLETED} meta={invitation.view?.email ?? ''} />}
      {inviteMsg && <p className={s.inviteMsg}>{inviteMsg}</p>}
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
