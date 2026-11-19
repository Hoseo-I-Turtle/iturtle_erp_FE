import { Users } from 'lucide-react'
import { Card, Select } from '../../../components/ui'
import type { AccessState } from '../../../api/projects'
import { JENKINS, opts, VAULT } from './levels'
import s from '../ProjectSettingsPage.module.css'

type Roles = AccessState['roles']

/** 역할별 기본 수준 (프로젝트 관리자 · 참여자) */
export function RoleDefaultsCard({ roles, onChange }: { roles: Roles; onChange: <R extends keyof Roles>(role: R, level: Roles[R]) => void }) {
  return (
    <Card>
      <h2 className={s.h}>
        <Users size={20} /> 역할별 기본 수준
      </h2>
      {(['MANAGER', 'MEMBER'] as const).map((r) => (
        <div key={r} className={s.roleRow}>
          <span className={s.roleName}>{r === 'MANAGER' ? '프로젝트 관리자' : '참여자'}</span>
          <span className={s.svcLabel}>Vault</span>
          <Select
            value={roles[r].vault}
            options={opts(VAULT)}
            width={130}
            label="Vault 기본 수준"
            onChange={(v) => onChange(r, { ...roles[r], vault: v })}
          />
          <span className={s.svcLabel}>Jenkins</span>
          <Select
            value={roles[r].jenkins}
            options={opts(JENKINS)}
            width={130}
            label="Jenkins 기본 수준"
            onChange={(v) => onChange(r, { ...roles[r], jenkins: v })}
          />
        </div>
      ))}
    </Card>
  )
}
