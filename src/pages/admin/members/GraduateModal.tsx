import { useState } from 'react'
import { Archive, Calendar, GitBranch, Info, Kanban, ListChecks, Shield, X } from 'lucide-react'
import { Avatar, Button, Chip, Loadable, Modal, Segmented, Select } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import { departMember, errorText, isLive, todayKst, useHandover } from '../../../api/admin'
import type { SelectedMember } from './types'
import a from '../admin.module.css'
import s from './GraduateModal.module.css'

type GraduateProps = { member: SelectedMember; others: string[]; onClose: () => void; onDone: (revoked?: string[]) => void }
/** 졸업 · 퇴실 처리: 회수할 역할 · 참여 프로젝트 관리자 넘기기 · 담당 작업 넘기기 */
export function GraduateModal({ member, others, onClose, onDone }: GraduateProps) {
  // 회수할 역할 · 참여 프로젝트 · 담당 작업은 P-9a 인수인계 확인으로 불러온다
  const handover = useHandover(member, others)
  const [kind, setKind] = useState<'GRADUATE' | 'LEAVE'>('GRADUATE')
  const [date, setDate] = useState(() => (isLive() ? todayKst() : '2027-02-20'))
  const [assignees, setAssignees] = useState<Record<string, string>>({})
  const [managers, setManagers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const label = kind === 'GRADUATE' ? '졸업' : '퇴실'
  const assigneeOf = (t: { key: string; initial: string }) => assignees[t.key] ?? t.initial

  const submit = async () => {
    const v = handover.data
    if (!v) return
    const missing = v.projects.filter((p) => p.lastManager && !managers[p.key])
    if (isLive() && missing.length > 0) return setErr(`${missing.map((p) => p.key).join(', ')} 의 새 프로젝트 관리자를 골라 주세요.`)
    setBusy(true)
    setErr('')
    try {
      const revoked = await whenLive(() =>
        departMember(member.memberId, {
          kind: kind === 'GRADUATE' ? 'GRADUATED' : 'LEFT',
          departedOn: date,
          taskReassignments: v.tasks.map((t) => ({ taskKey: t.key, assigneeMemberId: assigneeOf(t) ? Number(assigneeOf(t)) : null })),
          projectManagerHandovers: v.projects
            .filter((p) => p.lastManager)
            .map((p) => ({ projectKey: p.key, newManagerMemberId: Number(managers[p.key]) })),
        }),
      )
      onDone(revoked)
    } catch (e) {
      setErr(errorText(e, '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      width={760}
      title={
        <span className={s.modalTitle}>
          <Avatar name={member.name} size={44} />
          <span>
            {member.name} 졸업 · 퇴실 처리
            <small>처리하면 ERP · Vault · Jenkins · Penpot 어디에도 로그인할 수 없어요.</small>
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          {err ? (
            <span className={`${s.footHint} ${a.err}`}>{err}</span>
          ) : (
            <span className={s.footHint}>
              <Info size={14} /> 나중에 재실로 되돌리면 회수한 역할을 다시 줄 수 있어요
            </span>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Archive} className={a.danger} onClick={submit} disabled={busy || !handover.data}>
            {label} 처리
          </Button>
        </>
      }
    >
      <div className={s.modalRow}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'GRADUATE', label: '졸업' },
            { value: 'LEAVE', label: '퇴실' },
          ]}
        />
        <label className={s.dateInput}>
          <Calendar size={16} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <Loadable resource={handover} label="인수인계 확인">
        {(v) => (
          <>
            <h3 className={s.secTitle}>
              <Shield size={18} /> 회수할 역할 <small>서비스 역할 · 프로젝트 서비스 권한</small>
            </h3>
            <div className={a.roles}>
              {v.revoke.length === 0 && <span className={a.muted}>회수할 서비스 권한이 없어요</span>}
              {v.revoke.map((r) => (
                <span key={r} className={`${a.state} ${a.bad}`}>
                  <X size={12} /> {r}
                </span>
              ))}
            </div>
            <p className={a.muted}>프로젝트 권한은 이전 참여자가 되면서 함께 사라져요</p>

            <h3 className={s.secTitle}>
              <Kanban size={18} /> 참여 프로젝트 <small>이전 참여자로 바뀌어요</small>
            </h3>
            <div className={a.roles}>
              {v.projects.length === 0 && <span className={a.muted}>참여 중인 프로젝트가 없어요</span>}
              {v.projects.map((p) => (
                <Chip key={p.key} tone="tint">
                  {p.label}
                </Chip>
              ))}
            </div>
            {v.projects
              .filter((p) => p.lastManager)
              .map((p) => (
                <div key={p.key} className={s.handover}>
                  <span className={s.taskKey}>{p.key}</span>
                  <span className={a.grow}>마지막 프로젝트 관리자예요. 새 관리자를 골라 주세요</span>
                  <Select
                    value={managers[p.key] ?? ''}
                    width={160}
                    label={`${p.key} 새 프로젝트 관리자`}
                    options={[{ value: '', label: '고르기' }, ...p.candidates]}
                    onChange={(val) => setManagers({ ...managers, [p.key]: val })}
                  />
                </div>
              ))}

            <h3 className={s.secTitle}>
              <ListChecks size={18} /> 끝나지 않은 담당 작업 {v.tasks.length} <small>새 담당자를 고르거나 비워 둘 수 있어요</small>
            </h3>
            {v.tasks.map((t) => (
              <div key={t.key} className={s.handover}>
                <span className={s.taskKey}>{t.key}</span>
                <span className={a.grow}>{t.title}</span>
                <Select
                  value={assigneeOf(t)}
                  width={160}
                  label={`${t.key} 새 담당자`}
                  options={[{ value: '', label: '담당자 없음' }, ...t.candidates]}
                  onChange={(val) => setAssignees({ ...assignees, [t.key]: val })}
                />
              </div>
            ))}
            {v.github && (
              <div className={s.github}>
                <GitBranch size={16} /> 처리한 뒤 GitHub 조직에서 @{v.github} 를 뺍니다. 실패하면 관리 화면에서 다시 시도할 수 있어요.
              </div>
            )}
          </>
        )}
      </Loadable>
    </Modal>
  )
}
