import { useState } from 'react'
import { Check, Mail, Shield, TriangleAlert } from 'lucide-react'
import { Avatar, Button, Card, Chip, Select } from '../../../components/ui'
import { violatedRules, type AdminMembersData, type AdminRow, type RoleConflictRule } from '../../../api/admin'
import { RoleChip } from '../RoleChip'
import type { SelectedMember } from './types'
import a from '../admin.module.css'
import s from './MemberDetailCard.module.css'

const ROLE_GROUPS = ['FEATURE', 'SERVICE', 'ADMIN'] as const

type Props = {
  member: SelectedMember
  /** 지금 고치는 중인 역할 (저장 전) */
  roles: string[]
  allRoles: AdminMembersData['roles']
  presets: AdminMembersData['presets']
  presetPick: string
  onPresetPick: (id: string) => void
  err: string
  dirty: boolean
  onMemberType: (v: AdminRow['memberType']) => void
  onToggleRole: (code: string) => void
  onApplyPreset: () => void
  onSaveRoles: () => void
  /** 같이 가질 수 없는 역할 규칙 (공통코드 ROLE_CONFLICT) */
  conflictRules?: RoleConflictRule[]
  /** Cloudflare 가입 이메일 저장 (ERP-37). 성공하면 true */
  onSaveEmail: (email: string) => Promise<boolean>
}

/** 고른 구성원: 구분 · 로그인 상태 · 적용 프리셋 · 역할 고르기 */
export function MemberDetailCard({
  member: sel,
  roles,
  allRoles,
  presets,
  presetPick,
  onPresetPick,
  err,
  dirty,
  onMemberType,
  onToggleRole,
  onApplyPreset,
  onSaveRoles,
  conflictRules = [],
  onSaveEmail,
}: Props) {
  // 지금 보이는 역할(저장된 것 또는 고치는 중)이 어기는 규칙. 저장된 것이면 경고만, 고치는 중이면 저장을 막는다 (서버도 M043 으로 막음)
  const violated = violatedRules(roles, conflictRules)
  return (
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
            onChange={onMemberType}
          />
        </dd>
        <dt>Cloudflare 이메일</dt>
        <dd>
          <EmailEditor key={sel.memberId} email={sel.email ?? ''} onSave={onSaveEmail} />
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
      {ROLE_GROUPS.map((g) => (
        <div key={g}>
          <div className={a.groupLabel}>
            {g === 'FEATURE' ? '기능' : g === 'SERVICE' ? (
              <>
                서비스 · <b>Vault · Jenkins</b> 읽기/쓰기는 프로젝트에서 줘요
              </>
            ) : '관리'}
          </div>
          <div className={a.roles}>
            {allRoles
              .filter((r) => r.group === g)
              .map((r) => (
                <RoleChip key={r.code} code={r.code} on={roles.includes(r.code)} onToggle={() => onToggleRole(r.code)} title={r.desc} />
              ))}
          </div>
        </div>
      ))}
      {violated.length > 0 && (
        <div className={s.conflict} role="alert">
          <TriangleAlert size={16} />
          <div>
            <strong>같이 가질 수 없는 역할: {violated.map((r) => `${r.roleA} · ${r.roleB}`).join(', ')}</strong>
            <small>
              {violated[0].reason}.{' '}
              {dirty ? '이대로는 저장할 수 없어요 — 하나를 빼 주세요.' : '자동으로 빼지 않아요. 하나를 빼고 저장해 주세요.'}
            </small>
          </div>
        </div>
      )}
      {err && <p className={a.err}>{err}</p>}
      <div className={s.detailActions}>
        {presets.length > 0 && (
          <Select value={presetPick} width={140} label="적용할 프리셋" options={presets.map((p) => ({ value: p.id, label: p.name }))} onChange={onPresetPick} />
        )}
        <Button variant="tint" icon={Shield} onClick={onApplyPreset} disabled={presets.length === 0}>
          프리셋 적용
        </Button>
        <Button onClick={onSaveRoles} disabled={!dirty || violated.length > 0}>
          역할 저장
        </Button>
      </div>
    </Card>
  )
}

/** Cloudflare 가입 이메일 (ERP-37): 바꾸면 30초 안에 Cloudflare 접속 허용 목록에 반영된다. 있던 것은 비울 수 없다 (M044) */
function EmailEditor({ email, onSave }: { email: string; onSave: (email: string) => Promise<boolean> }) {
  const [value, setValue] = useState(email)
  const [saving, setSaving] = useState(false)
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
  const changed = value.trim() !== email
  const save = async () => {
    if (!valid || !changed) return
    setSaving(true)
    await onSave(value.trim())
    setSaving(false)
  }
  return (
    <span className={s.emailRow}>
      <Mail size={14} />
      <input
        className={email ? s.emailInput : `${s.emailInput} ${s.emailMissing}`}
        type="email"
        value={value}
        maxLength={254}
        placeholder="없음 — 넣어야 Cloudflare 로 접속할 수 있어요"
        aria-label="Cloudflare 가입 이메일"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void save()}
      />
      {changed && (
        <Button variant="secondary" icon={Check} onClick={save} disabled={!valid || saving}>
          저장
        </Button>
      )}
    </span>
  )
}
