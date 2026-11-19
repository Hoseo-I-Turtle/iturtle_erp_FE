import { useMemo, useState } from 'react'
import { Archive, Calendar, ChevronRight, Ellipsis, GitBranch, Info, Kanban, ListChecks, Lock, LockOpen, RefreshCw, Search, Settings, Shield, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, ListItem, Loadable, Modal, Segmented, Select } from '../../components/ui'
import { presets } from '../../mocks/admin'
import { whenLive } from '../../api/useResource'
import {
  accountAction,
  departMember,
  errorText,
  isLive,
  patchMember,
  reapplyPresets,
  resetPassword,
  saveMemberRoles,
  todayKst,
  typeCode,
  useAdminMemberDetail,
  useAdminMembers,
  useHandover,
  type AdminDetail,
  type AdminMembersData,
  type AdminRow,
} from '../../api/admin'
import { RoleChip } from './RoleChip'
import a from './admin.module.css'
import s from './AdminMembersPage.module.css'

type Filter = 'ACTIVE' | 'GRADUATED' | 'DISABLED' | 'LOCKED'
type Selected = AdminRow & Partial<AdminDetail>

export function AdminMembersPage() {
  const res = useAdminMembers()
  return (
    <Loadable resource={res} label="구성원 목록">
      {(d) => <AdminMembersView data={d} />}
    </Loadable>
  )
}

function AdminMembersView({ data }: { data: AdminMembersData }) {
  const ROLES = data.roles
  const [members, setMembers] = useState(data.members)
  const [filter, setFilter] = useState<Filter>('ACTIVE')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(() => (isLive() ? (data.members[0]?.memberId ?? 0) : 3))
  const [draftRoles, setDraftRoles] = useState<string[] | null>(null)
  const [tempPw, setTempPw] = useState<string | null>(null)
  const [graduating, setGraduating] = useState(false)
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
  const sel: Selected = { ...base, ...(detail.data ?? {}) }
  const roles = draftRoles ?? sel.roles

  /** 목록과 상세를 함께 고친다 (화면에서 바로 반영) */
  const update = (id: number, patch: Partial<Selected>) => {
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
    setErr('')
  }
  const toggleRole = (code: string) => setDraftRoles(roles.includes(code) ? roles.filter((r) => r !== code) : [...roles, code])

  const applyPresets = async () => {
    // 목업: 적용한 프리셋의 역할을 고치는 중인 역할에 더한다 (저장은 "역할 저장")
    if (!isLive()) return setDraftRoles([...new Set([...roles, ...sel.presets.flatMap((n) => presets.find((p) => p.name === n)?.roles ?? [])])])
    const id = sel.memberId
    if (!sel.presetIds?.length) return setErr('적용한 프리셋이 없어요.')
    setErr('')
    try {
      const saved = await reapplyPresets(id, sel.presetIds)
      if (saved) update(id, { roles: saved })
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

  return (
    <div className={a.layout}>
      <Card className={s.tableCard}>
        <div className={a.toolbar}>
          <label className={a.search}>
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · 로그인 ID · 구성원 번호" />
          </label>
          <span className={a.grow} />
          {(
            [
              ['ACTIVE', '재실'],
              ['GRADUATED', '졸업생'],
              ['DISABLED', '비활성'],
              ['LOCKED', '잠김'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={filter === k ? `${a.chipBtn} ${a.chipBtnOn}` : a.chipBtn} onClick={() => setFilter(k)}>
              {label} {counts[k]}
            </button>
          ))}
        </div>

        <div className={s.thead}>
          <span>구성원</span>
          <span>구성원 번호</span>
          <span>구분</span>
          <span>상태</span>
          <span>역할</span>
          <span>마지막 로그인</span>
          <span />
        </div>
        {list.length === 0 && <p className={a.muted}>해당하는 구성원이 없어요.{isLive() ? '' : ' (졸업생 목록은 목업에 없어요)'}</p>}
        {list.map((m) => (
          <button key={m.memberId} type="button" className={m.memberId === sel.memberId ? `${s.row} ${s.rowOn}` : s.row} onClick={() => select(m.memberId)}>
            <span className={s.who}>
              <Avatar name={m.name} size={32} />
              <span>
                <strong>{m.name}</strong>
                <small>{m.loginId}</small>
              </span>
            </span>
            <span>{m.memberNo}</span>
            <span>
              <span className={`${a.state} ${a.info}`}>{m.memberType}</span>
            </span>
            <span>
              {m.graduated ? (
                <span className={`${a.state} ${a.off}`}>졸업</span>
              ) : m.state === 'LOCKED' ? (
                <span className={`${a.state} ${a.bad}`}>
                  <Lock size={12} /> 잠김
                </span>
              ) : m.state === 'DISABLED' ? (
                <span className={`${a.state} ${a.off}`}>비활성</span>
              ) : (
                <span className={`${a.state} ${a.ok}`}>재실</span>
              )}
            </span>
            <span className={s.rolesCell}>
              {m.presets.join(' + ')} · {m.roleCount}개{m.tempPassword && <span className={`${a.state} ${a.warn}`}>임시 비밀번호</span>}
            </span>
            <span className={s.last}>{m.lastLogin}</span>
            <Ellipsis size={18} className={s.more} />
          </button>
        ))}
      </Card>

      <div className={a.col}>
        <Loadable resource={detail} label="구성원 상세">
          {() => (
            <>
              <Card className={s.detail}>
                <div className={s.detailHead}>
                  <Avatar name={sel.name} size={48} />
                  <div>
                    <h2>{sel.name}</h2>
                    <small>
                      {sel.loginId} · {sel.memberNo}
                    </small>
                  </div>
                  <span className={`${a.state} ${sel.state === 'ACTIVE' ? a.ok : sel.state === 'LOCKED' ? a.bad : a.off}`}>
                    {sel.state === 'ACTIVE' ? '재실' : sel.state === 'LOCKED' ? '잠김' : '비활성'}
                  </span>
                </div>
                <dl className={s.props}>
                  <dt>구분</dt>
                  <dd>
                    <Select
                      value={sel.memberType}
                      width={110}
                      label="구분"
                      options={['교수', '학생', '인턴'].map((v) => ({ value: v as AdminRow['memberType'], label: v }))}
                      onChange={(v) => {
                        const id = sel.memberId
                        const prev = sel.memberType
                        update(id, { memberType: v })
                        // 구분만 바꾼다. 권한은 그대로 (MEM-1-08)
                        run(
                          () => patchMember(id, { memberType: typeCode(v) }),
                          () => update(id, { memberType: prev }),
                        )
                      }}
                    />
                  </dd>
                  <dt>로그인</dt>
                  <dd>
                    {sel.state === 'LOCKED' ? '잠김' : '정상'} · 실패 {sel.failCount}회
                  </dd>
                  <dt>적용 프리셋</dt>
                  <dd className={a.roles}>
                    {sel.presets.map((p) => (
                      <Chip key={p} tone="tint">
                        {p}
                      </Chip>
                    ))}
                  </dd>
                </dl>
                <div className={a.groupLabel}>역할</div>
                {(['FEATURE', 'SERVICE', 'ADMIN'] as const).map((g) => (
                  <div key={g}>
                    <div className={a.groupLabel}>
                      {g === 'FEATURE' ? '기능' : g === 'SERVICE' ? (
                        <>
                          서비스 · <b>Vault · Jenkins</b> 읽기/쓰기는 프로젝트에서 줘요
                        </>
                      ) : '관리'}
                    </div>
                    <div className={a.roles}>
                      {ROLES.filter((r) => r.group === g).map((r) => (
                        <RoleChip key={r.code} code={r.code} on={roles.includes(r.code)} onToggle={() => toggleRole(r.code)} title={r.desc} />
                      ))}
                    </div>
                  </div>
                ))}
                {err && <p className={a.err}>{err}</p>}
                <div className={s.detailActions}>
                  <Button variant="tint" icon={Shield} onClick={applyPresets}>
                    프리셋 적용
                  </Button>
                  <Button onClick={saveRoles} disabled={!draftRoles}>
                    역할 저장
                  </Button>
                </div>
              </Card>

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
                  onClick={issueTempPw}
                />
                {sel.state === 'LOCKED' && (
                  <ListItem
                    leading={<LockOpen size={18} />}
                    title="잠금 해제"
                    meta={`로그인 실패 ${sel.failCount}회로 잠겼어요`}
                    trailing={<ChevronRight size={16} />}
                    onClick={unlock}
                  />
                )}
                {/* 실서버: 이미 졸업 · 퇴실한 사람은 처리할 수 없다 (M018) */}
                {(!sel.graduated || !isLive()) && (
                  <ListItem
                    leading={<Archive size={18} className={s.red} />}
                    title={<span className={s.red}>졸업 · 퇴실 처리</span>}
                    meta="서비스 역할 회수 · 담당 작업 넘기기"
                    trailing={<ChevronRight size={16} />}
                    onClick={() => setGraduating(true)}
                  />
                )}
                <ListItem
                  leading={<X size={18} className={s.red} />}
                  title={<span className={s.red}>{sel.state === 'DISABLED' ? '다시 활성화' : '비활성화 (일시 정지)'}</span>}
                  meta="상태는 재실 그대로"
                  trailing={<ChevronRight size={16} />}
                  onClick={toggleEnabled}
                />
              </Card>
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

type GraduateProps = { member: Selected; others: string[]; onClose: () => void; onDone: (revoked?: string[]) => void }
function GraduateModal({ member, others, onClose, onDone }: GraduateProps) {
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
