import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, UserMinus } from 'lucide-react'
import { Avatar, Button, Card, Empty } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import {
  addProjectMember,
  changeMemberRole,
  errText,
  useCreateOptions,
  type ProjectSettings,
  type SettingsMember,
} from '../../../api/projectSettings'
import { removeMemberWithHandover } from '../../../api/projectLinks'
import { MEMBER_TYPE_NAME, type MemberType } from '../../../mocks/members'
import { RemoveMemberDialog } from './RemoveMemberDialog'
import s from './panels.module.css'

type Props = { settings: ProjectSettings; onChange: (p: Partial<ProjectSettings>) => void; onReload: () => void }

const ROLE_NAME = { MANAGER: '프로젝트 관리자', MEMBER: '참여자', FORMER: '이전 참여자' } as const
const typeName = (t: string) => MEMBER_TYPE_NAME[t as MemberType] ?? t

/** 설정 › 참여자 (P-6 더하기 · P-7 역할 · P-8 빼기). 관리자는 최소 1명 (P010) */
export function MembersPanel({ settings, onChange, onReload }: Props) {
  const options = useCreateOptions()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [showFormer, setShowFormer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [removing, setRemoving] = useState<SettingsMember | null>(null)
  const active = settings.members.filter((m) => m.role !== 'FORMER')
  const former = settings.members.filter((m) => m.role === 'FORMER')
  const readOnly = settings.status === 'ARCHIVED' || !settings.canManage
  const managers = active.filter((m) => m.role === 'MANAGER').length

  const activeIds = new Set(active.map((m) => m.memberId))
  const candidates = (options.data?.members ?? []).filter((m) => !activeIds.has(m.memberId) && (!q || m.name.includes(q))).slice(0, 10)

  const patchMember = (memberId: number, p: Partial<SettingsMember>) =>
    onChange({ members: settings.members.map((m) => (m.memberId === memberId ? { ...m, ...p } : m)) })

  const run = (memberId: number, call: () => Promise<unknown>, local: () => void) => {
    setBusy(memberId)
    setError(null)
    whenLive(call)
      .then((r) => (r === undefined ? local() : onReload()))
      .catch((e: unknown) => setError(errText(e, '바꾸지 못했어요.')))
      .finally(() => setBusy(null))
  }

  const role = (m: SettingsMember, r: 'MANAGER' | 'MEMBER') =>
    run(m.memberId, () => changeMemberRole(settings.projectKey, m.memberId, r), () => patchMember(m.memberId, { role: r }))
  /** 확인 창에서 고른 사람에게 끝나지 않은 담당 작업을 넘기고 뺀다 (없으면 담당 없음) */
  const remove = (m: SettingsMember, tasks: { taskKey: string; title: string; status: string }[], handoverTo: number | null) =>
    run(
      m.memberId,
      () => removeMemberWithHandover(settings.projectKey, m.memberId, tasks, handoverTo).then((r) => (setRemoving(null), r)),
      () => {
        setRemoving(null)
        patchMember(m.memberId, { role: 'FORMER', leftAt: new Date().toISOString().slice(0, 10) })
      },
    )
  const add = (memberId: number, name: string, memberType: string) =>
    run(memberId, () => addProjectMember(settings.projectKey, memberId, 'MEMBER'), () =>
      onChange({
        members: [
          ...settings.members.filter((m) => m.memberId !== memberId),
          { memberId, name, memberType, role: 'MEMBER', joinedAt: new Date().toISOString().slice(0, 10), leftAt: null },
        ],
      }),
    )

  return (
    <Card className={s.card}>
      <header className={s.headRow}>
        <div className={s.head}>
          <h2>참여자 {active.length}명</h2>
          <p>역할을 바꾸거나 뺄 수 있어요. 프로젝트 관리자는 최소 1명 있어야 해요.</p>
        </div>
        {!readOnly && (
          <Button icon={Plus} onClick={() => setAdding(!adding)}>
            참여자 추가
          </Button>
        )}
      </header>

      {adding && (
        <div className={s.addBox}>
          <span className={s.input}>
            <input value={q} placeholder="이름으로 찾기" onChange={(e) => setQ(e.target.value)} autoFocus />
          </span>
          <div className={s.chips}>
            {candidates.map((m) => (
              <button key={m.memberId} type="button" className={s.candidate} disabled={busy === m.memberId} onClick={() => add(m.memberId, m.name, m.memberType)}>
                <Plus size={14} /> {m.name} <small>{typeName(m.memberType)}</small>
              </button>
            ))}
            {candidates.length === 0 && <span className={s.hint}>더할 수 있는 재실 구성원이 없어요</span>}
          </div>
        </div>
      )}

      {error && <p className={s.failText}>{error}</p>}

      <table className={s.table}>
        <thead>
          <tr>
            <th>이름</th>
            <th>구분</th>
            <th>역할</th>
            <th>참여일</th>
            <th aria-label="메뉴" />
          </tr>
        </thead>
        <tbody>
          {active.map((m) => {
            const lastManager = m.role === 'MANAGER' && managers <= 1
            return (
              <tr key={m.memberId}>
                <td>
                  <span className={s.who}>
                    <Avatar name={m.name} size={28} /> {m.name}
                  </span>
                </td>
                <td className={s.muted}>{typeName(m.memberType)}</td>
                <td>
                  {readOnly ? (
                    ROLE_NAME[m.role]
                  ) : (
                    <select
                      className={s.select}
                      value={m.role}
                      disabled={busy === m.memberId || lastManager}
                      title={lastManager ? '마지막 프로젝트 관리자예요' : undefined}
                      onChange={(e) => role(m, e.target.value as 'MANAGER' | 'MEMBER')}
                    >
                      <option value="MANAGER">프로젝트 관리자</option>
                      <option value="MEMBER">참여자</option>
                    </select>
                  )}
                </td>
                <td className={s.muted}>{m.joinedAt.replace(/-/g, '.')}</td>
                <td className={s.right}>
                  {!readOnly && (
                    <button type="button" className={s.iconBtn} disabled={busy === m.memberId || lastManager} onClick={() => setRemoving(m)} aria-label={`${m.name} 빼기`} title="빼기 — 끝나지 않은 담당 작업은 고른 사람에게 넘겨요">
                      <UserMinus size={16} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {active.length === 0 && <Empty>참여자가 없어요.</Empty>}

      {removing && (
        <RemoveMemberDialog
          projectKey={settings.projectKey}
          member={removing}
          active={active.map((m) => ({ memberId: m.memberId, name: m.name }))}
          busy={busy === removing.memberId}
          onCancel={() => setRemoving(null)}
          onConfirm={(p, to) => remove(removing, p.openTasks, to)}
        />
      )}

      {former.length > 0 && (
        <div className={s.former}>
          <button type="button" className={s.fold} onClick={() => setShowFormer(!showFormer)}>
            {showFormer ? <ChevronDown size={16} /> : <ChevronRight size={16} />} 나간 참여자 {former.length}명
          </button>
          {showFormer && (
            <ul className={s.formerList}>
              {former.map((m) => (
                <li key={m.memberId}>
                  <Avatar name={m.name} size={24} /> {m.name}
                  <span className={s.muted}>
                    {typeName(m.memberType)} · {m.joinedAt.replace(/-/g, '.')} – {(m.leftAt ?? '').replace(/-/g, '.')}
                  </span>
                  {!readOnly && (
                    <Button variant="ghost" onClick={() => add(m.memberId, m.name, m.memberType)} disabled={busy === m.memberId}>
                      다시 참여
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
