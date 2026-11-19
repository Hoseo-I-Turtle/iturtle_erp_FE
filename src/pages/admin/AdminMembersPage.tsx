import { useEffect, useMemo, useState } from 'react'
import { Empty, Loadable } from '../../components/ui'
import { whenLive } from '../../api/useResource'
import {
  accountAction,
  applyPreset,
  errorText,
  isLive,
  onMembersChanged,
  patchMember,
  resetPassword,
  saveMemberRoles,
  typeCode,
  useAdminMemberDetail,
  useAdminMembers,
  type AdminMembersData,
  type AdminRow,
} from '../../api/admin'
import { AccountActionsCard } from './members/AccountActionsCard'
import { GraduateModal } from './members/GraduateModal'
import { MemberDetailCard } from './members/MemberDetailCard'
import { MemberTable, type MemberFilter } from './members/MemberTable'
import type { SelectedMember } from './members/types'
import a from './admin.module.css'

export function AdminMembersPage() {
  const res = useAdminMembers()
  // 구성원 추가 모달이 만들면 다시 불러온다
  useEffect(() => onMembersChanged(res.reload), [res.reload])
  return (
    <Loadable resource={res} label="구성원 목록">
      {(d) => <AdminMembersView data={d} />}
    </Loadable>
  )
}

function AdminMembersView({ data }: { data: AdminMembersData }) {
  const ROLES = data.roles
  const [members, setMembers] = useState(data.members)
  const [filter, setFilter] = useState<MemberFilter>('ACTIVE')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(() => (isLive() ? (data.members[0]?.memberId ?? 0) : 3))
  const [draftRoles, setDraftRoles] = useState<string[] | null>(null)
  const [tempPw, setTempPw] = useState<string | null>(null)
  const [graduating, setGraduating] = useState(false)
  const [presetPick, setPresetPick] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const counts = {
    ACTIVE: members.filter((m) => !m.graduated && m.state !== 'DISABLED').length,
    GRADUATED: data.graduatedTotal,
    DISABLED: members.filter((m) => m.state === 'DISABLED').length,
    LOCKED: members.filter((m) => m.state === 'LOCKED').length,
  }
  const list = useMemo(
    () =>
      members.filter((m) => {
        const byFilter =
          filter === 'ACTIVE' ? !m.graduated && m.state !== 'DISABLED' : filter === 'GRADUATED' ? m.graduated : m.state === filter
        const needle = q.trim()
        return byFilter && (!needle || [m.name, m.loginId, m.memberNo].some((x) => x.includes(needle)))
      }),
    [members, filter, q],
  )
  const base = members.find((m) => m.memberId === selectedId) ?? members[0]
  // 역할 · 프리셋 · GitHub 는 고른 사람마다 상세(2-2)로 불러온다
  const detail = useAdminMemberDetail(base)
  if (!base) return <Empty>구성원이 없어요.</Empty>
  const sel: SelectedMember = { ...base, ...(detail.data ?? {}) }
  const roles = draftRoles ?? sel.roles
  // 적용할 프리셋: 고르지 않았으면 이미 적용한 첫 프리셋 (빠진 역할 채우기)
  const pick = presetPick ?? data.presets.find((p) => sel.presets.includes(p.name))?.id ?? data.presets[0]?.id ?? ''

  /** 목록과 상세를 함께 고친다 (화면에서 바로 반영) */
  const update = (id: number, patch: Partial<SelectedMember>) => {
    const p = patch.roles ? { ...patch, roleCount: patch.roles.length } : patch
    setMembers((ms) => ms.map((m) => (m.memberId === id ? { ...m, ...p } : m)))
    if (id === base.memberId) detail.setData((d) => ({ ...d, ...p }))
  }
  /** 실서버면 저장을 부르고, 실패하면 알리고 되돌린다 */
  const run = async (call: () => Promise<unknown>, revert: () => void) => {
    setErr('')
    try {
      await whenLive(call)
    } catch (e) {
      setErr(errorText(e))
      revert()
    }
  }

  const select = (id: number) => {
    setSelectedId(id)
    setDraftRoles(null)
    setTempPw(null)
    setPresetPick(null)
    setErr('')
  }
  const toggleRole = (code: string) => setDraftRoles(roles.includes(code) ? roles.filter((r) => r !== code) : [...roles, code])

  /** 3-5 프리셋 적용: 프리셋 역할 중 없는 것만 더한다 (이미 가진 역할은 그대로) */
  const applyPresets = async () => {
    const p = data.presets.find((x) => x.id === pick)
    if (!p) return setErr('적용할 프리셋을 골라 주세요.')
    // 목업: 프리셋 역할을 고치는 중인 역할에 더한다 (저장은 "역할 저장")
    if (!isLive()) return setDraftRoles([...new Set([...roles, ...p.roles])])
    const id = sel.memberId
    setErr('')
    try {
      const r = await applyPreset(id, Number(p.id))
      update(id, {
        roles: r.roles,
        presets: sel.presets.includes(p.name) ? sel.presets : [...sel.presets, p.name],
        presetIds: [...new Set([...(sel.presetIds ?? []), Number(p.id)])],
      })
      setDraftRoles(null)
    } catch (e) {
      setErr(errorText(e))
    }
  }

  const saveRoles = async () => {
    const id = sel.memberId
    const prev = sel.roles
    update(id, { roles })
    setDraftRoles(null)
    setErr('')
    try {
      const saved = await whenLive(() => saveMemberRoles(id, roles))
      if (saved) update(id, { roles: saved })
    } catch (e) {
      setErr(errorText(e))
      update(id, { roles: prev })
    }
  }

  const issueTempPw = async () => {
    const id = sel.memberId
    setErr('')
    try {
      const pw = (await whenLive(() => resetPassword(id))) ?? Math.random().toString(36).slice(2, 10) + '!A'
      setTempPw(pw)
      update(id, { state: sel.state === 'LOCKED' ? 'ACTIVE' : sel.state, failCount: 0, tempPassword: true })
    } catch (e) {
      setErr(errorText(e))
    }
  }

  const toggleEnabled = () => {
    const id = sel.memberId
    const prev = sel.state
    const disabling = prev !== 'DISABLED'
    update(id, { state: disabling ? 'DISABLED' : 'ACTIVE' })
    run(
      () => accountAction(id, disabling ? 'disable' : 'enable'),
      () => update(id, { state: prev }),
    )
  }

  const unlock = () => {
    const id = sel.memberId
    const prev = { state: sel.state, failCount: sel.failCount }
    update(id, { state: 'ACTIVE', failCount: 0 })
    run(
      () => accountAction(id, 'unlock'),
      () => update(id, prev),
    )
  }

  // 구분만 바꾼다. 권한은 그대로 (MEM-1-08)
  const changeMemberType = (v: AdminRow['memberType']) => {
    const id = sel.memberId
    const prev = sel.memberType
    update(id, { memberType: v })
    run(
      () => patchMember(id, { memberType: typeCode(v) }),
      () => update(id, { memberType: prev }),
    )
  }

  return (
    <div className={a.layout}>
      <MemberTable
        list={list}
        counts={counts}
        filter={filter}
        onFilter={setFilter}
        q={q}
        onQuery={setQ}
        selectedId={sel.memberId}
        onSelect={select}
      />

      <div className={a.col}>
        <Loadable resource={detail} label="구성원 상세">
          {() => (
            <>
              <MemberDetailCard
                member={sel}
                roles={roles}
                allRoles={ROLES}
                presets={data.presets}
                presetPick={pick}
                onPresetPick={setPresetPick}
                err={err}
                dirty={!!draftRoles}
                onMemberType={changeMemberType}
                onToggleRole={toggleRole}
                onApplyPreset={applyPresets}
                onSaveRoles={saveRoles}
              />
              <AccountActionsCard
                member={sel}
                tempPw={tempPw}
                onIssueTempPw={issueTempPw}
                onUnlock={unlock}
                onGraduate={() => setGraduating(true)}
                onToggleEnabled={toggleEnabled}
              />
            </>
          )}
        </Loadable>
      </div>

      {graduating && (
        <GraduateModal
          member={sel}
          others={members.filter((m) => m.memberId !== sel.memberId && !m.graduated).map((m) => m.name)}
          onClose={() => setGraduating(false)}
          onDone={(revoked) => {
            update(sel.memberId, {
              graduated: true,
              roles: sel.roles.filter((r) => (revoked ? !revoked.includes(r) : r !== 'penpot-member')),
            })
            setGraduating(false)
          }}
        />
      )}
    </div>
  )
}
