import { List } from 'lucide-react'
import { Avatar, Card, Select } from '../../../components/ui'
import type { AccessOverride, AccessState, CustomRole, ServiceAccessView } from '../../../api/projects'
import { JENKINS, opts, VAULT } from './levels'
import s from '../ProjectSettingsPage.module.css'

type Props = {
  members: ServiceAccessView['members']
  customRoles: CustomRole[]
  state: AccessState
  onChange: (name: string, o: AccessOverride) => void
}

/** 구성원별 개별 수준 (기본값과 다르면 강조) */
export function MemberOverridesCard({ members, customRoles, state, onChange }: Props) {
  return (
    <Card>
      <h2 className={s.h}>
        <List size={20} /> 구성원별
      </h2>
      <div className={s.table}>
        <div className={s.thead}>
          <span>구성원</span>
          <span>프로젝트 역할</span>
          <span>Vault</span>
          <span>Jenkins</span>
        </div>
        {members.map((m) => {
          const o: AccessOverride = state.members[m.name] ?? { vault: 'DEFAULT', jenkins: 'DEFAULT' }
          // 프로젝트 역할이 있으면 그 역할의 수준이 기본값 (ERP-27)
          const custom0 = m.role === 'MEMBER' ? customRoles.find((r) => r.roleId === m.customRoleId) : undefined
          const def = custom0 ? { vault: custom0.vault, jenkins: custom0.jenkins } : state.roles[m.role]
          const custom = o.vault !== 'DEFAULT' || o.jenkins !== 'DEFAULT'
          const set = (patch: Partial<AccessOverride>) => onChange(m.name, { ...o, ...patch })
          return (
            <div key={m.memberId ?? m.name} className={custom ? `${s.trow} ${s.custom}` : s.trow}>
              <span className={s.who}>
                <Avatar name={m.name} size={24} /> {m.name}
              </span>
              <span className={s.muted}>
                {m.role === 'MANAGER' ? '프로젝트 관리자' : (custom0?.name ?? '참여자')}
                {m.note && ` · ${m.note}`}
              </span>
              <Select
                value={o.vault}
                width={130}
                label={`${m.name} Vault`}
                options={[{ value: 'DEFAULT', label: `기본값 (${VAULT[def.vault]})` }, ...opts(VAULT).map((x) => ({ ...x, label: `${x.label} (개별)` }))]}
                onChange={(v) => set({ vault: v })}
              />
              <Select
                value={o.jenkins}
                width={130}
                label={`${m.name} Jenkins`}
                options={[{ value: 'DEFAULT', label: `기본값 (${JENKINS[def.jenkins]})` }, ...opts(JENKINS).map((x) => ({ ...x, label: `${x.label} (개별)` }))]}
                onChange={(v) => set({ jenkins: v })}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
