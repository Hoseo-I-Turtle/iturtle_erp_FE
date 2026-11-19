import { List } from 'lucide-react'
import { Avatar, Card, Select } from '../../../components/ui'
import type { AccessOverride, AccessState, ServiceAccessView } from '../../../api/projects'
import { JENKINS, opts, VAULT } from './levels'
import s from '../ProjectSettingsPage.module.css'

type Props = {
  members: ServiceAccessView['members']
  state: AccessState
  onChange: (name: string, o: AccessOverride) => void
}

/** 구성원별 개별 수준 (기본값과 다르면 강조) */
export function MemberOverridesCard({ members, state, onChange }: Props) {
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
          const def = state.roles[m.role]
          const custom = o.vault !== 'DEFAULT' || o.jenkins !== 'DEFAULT'
          const set = (patch: Partial<AccessOverride>) => onChange(m.name, { ...o, ...patch })
          return (
            <div key={m.memberId ?? m.name} className={custom ? `${s.trow} ${s.custom}` : s.trow}>
              <span className={s.who}>
                <Avatar name={m.name} size={24} /> {m.name}
              </span>
              <span className={s.muted}>
                {m.role === 'MANAGER' ? '프로젝트 관리자' : '참여자'}
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
