import { useState } from 'react'
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { Button, Card, Select } from '../../../components/ui'
import type { AccessState, CustomRole, JenkinsLevel, VaultLevel } from '../../../api/projects'
import { JENKINS, opts, VAULT } from './levels'
import s from '../ProjectSettingsPage.module.css'

type Roles = AccessState['roles']
const NAME_MAX = 20
const MAX_ROLES = 20

type Props = {
  roles: Roles
  onChange: <R extends keyof Roles>(role: R, level: Roles[R]) => void
  /** 프로젝트 역할 (ERP-27): 바꾸면 바로 저장한다 (P-17a ~ c) */
  customRoles: CustomRole[]
  onCreate: (name: string, vault: VaultLevel, jenkins: JenkinsLevel) => Promise<boolean>
  onUpdate: (roleId: number, patch: { name?: string; vault?: VaultLevel; jenkins?: JenkinsLevel }) => void
  onDelete: (roleId: number) => void
  busy: boolean
  error: string | null
}

/**
 * 역할별 수준. PM · 참여자(기본 역할)는 아래 "저장"으로, 프로젝트 역할은 바꾸는 즉시 저장한다.
 * 프로젝트 역할은 참여자와 같은 권한에 Vault · Jenkins 수준만 다르다 (설정 › 참여자에서 사람마다 고름).
 */
export function RoleDefaultsCard({ roles, onChange, customRoles, onCreate, onUpdate, onDelete, busy, error }: Props) {
  const [name, setName] = useState('')
  const [vault, setVault] = useState<VaultLevel>('READ')
  const [jenkins, setJenkins] = useState<JenkinsLevel>('BUILD')
  const [renaming, setRenaming] = useState<{ roleId: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const clean = name.trim()
  const taken = (n: string, except?: number) =>
    ['pm', '참여자'].includes(n.toLowerCase()) || customRoles.some((r) => r.roleId !== except && r.name.toLowerCase() === n.toLowerCase())

  const create = () => {
    if (!clean || taken(clean)) return
    void onCreate(clean, vault, jenkins).then((ok) => ok && setName(''))
  }
  const rename = () => {
    if (!renaming) return
    const next = renaming.name.trim()
    const before = customRoles.find((r) => r.roleId === renaming.roleId)
    setRenaming(null)
    if (next && before && next !== before.name && !taken(next, renaming.roleId)) onUpdate(renaming.roleId, { name: next })
  }

  return (
    <Card>
      <h2 className={s.h}>
        <Users size={20} /> 역할별 수준
      </h2>
      <p className={s.muted}>PM · 참여자는 기본 역할이에요. 역할을 더 만들면 참여자와 같은 권한에 Vault · Jenkins 수준만 다르게 줄 수 있어요.</p>

      {(['MANAGER', 'MEMBER'] as const).map((r) => (
        <div key={r} className={s.roleRow}>
          <span className={s.roleName}>
            {r === 'MANAGER' ? '프로젝트 관리자' : '참여자'} <small className={s.muted}>기본</small>
          </span>
          <span className={s.svcLabel}>Vault</span>
          <Select value={roles[r].vault} options={opts(VAULT)} width={130} label="Vault 기본 수준" onChange={(v) => onChange(r, { ...roles[r], vault: v })} />
          <span className={s.svcLabel}>Jenkins</span>
          <Select
            value={roles[r].jenkins}
            options={opts(JENKINS)}
            width={130}
            label="Jenkins 기본 수준"
            onChange={(v) => onChange(r, { ...roles[r], jenkins: v })}
          />
          <span className={s.roleTools} />
        </div>
      ))}

      {customRoles.map((r) => (
        <div key={r.roleId} className={s.roleRow}>
          <span className={s.roleName}>
            {renaming?.roleId === r.roleId ? (
              <input
                className={s.roleInput}
                value={renaming.name}
                maxLength={NAME_MAX}
                autoFocus
                aria-label={`${r.name} 새 이름`}
                onChange={(e) => setRenaming({ roleId: r.roleId, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) rename()
                  if (e.key === 'Escape') setRenaming(null)
                }}
                onBlur={rename}
              />
            ) : (
              <>
                {r.name} <small className={s.muted}>{r.memberCount}명</small>
              </>
            )}
          </span>
          <span className={s.svcLabel}>Vault</span>
          <Select value={r.vault} options={opts(VAULT)} width={130} label={`${r.name} Vault 수준`} onChange={(v) => onUpdate(r.roleId, { vault: v })} />
          <span className={s.svcLabel}>Jenkins</span>
          <Select
            value={r.jenkins}
            options={opts(JENKINS)}
            width={130}
            label={`${r.name} Jenkins 수준`}
            onChange={(v) => onUpdate(r.roleId, { jenkins: v })}
          />
          <span className={s.roleTools}>
            {deleting === r.roleId ? (
              <>
                <Button
                  variant="secondary"
                  icon={Trash2}
                  onClick={() => {
                    setDeleting(null)
                    onDelete(r.roleId)
                  }}
                  disabled={busy}
                >
                  지우기 확인
                </Button>
                <Button variant="icon" icon={X} aria-label="지우기 취소" onClick={() => setDeleting(null)} />
              </>
            ) : (
              <>
                <Button
                  variant="icon"
                  icon={Pencil}
                  aria-label={`${r.name} 이름 바꾸기`}
                  onClick={() => setRenaming({ roleId: r.roleId, name: r.name })}
                  disabled={busy}
                />
                <Button
                  variant="icon"
                  icon={Trash2}
                  aria-label={r.memberCount > 0 ? `${r.name} 지우기 — ${r.memberCount}명은 기본 참여자로 돌아가요` : `${r.name} 지우기`}
                  onClick={() => setDeleting(r.roleId)}
                  disabled={busy}
                />
              </>
            )}
          </span>
        </div>
      ))}

      <div className={s.roleRow}>
        <span className={s.roleName}>
          <input
            className={s.roleInput}
            value={name}
            maxLength={NAME_MAX}
            placeholder="새 역할 이름 (예: 인프라)"
            aria-label="새 역할 이름"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && create()}
          />
        </span>
        <span className={s.svcLabel}>Vault</span>
        <Select value={vault} options={opts(VAULT)} width={130} label="새 역할 Vault 수준" onChange={setVault} />
        <span className={s.svcLabel}>Jenkins</span>
        <Select value={jenkins} options={opts(JENKINS)} width={130} label="새 역할 Jenkins 수준" onChange={setJenkins} />
        <span className={s.roleTools}>
          <Button icon={Plus} onClick={create} disabled={busy || !clean || taken(clean) || customRoles.length >= MAX_ROLES}>
            역할 추가
          </Button>
        </span>
      </div>
      {clean && taken(clean) && <p className={s.fail}>같은 이름의 역할이 있어요 (PM · 참여자도 쓸 수 없어요)</p>}
      {customRoles.length >= MAX_ROLES && <p className={s.muted}>역할은 {MAX_ROLES}개까지 만들 수 있어요</p>}
      {error && <p className={s.fail}>{error}</p>}
    </Card>
  )
}
