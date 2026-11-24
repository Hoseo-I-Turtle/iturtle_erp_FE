import { Checkbox, Button, Select, Switch } from '../../../components/ui'
import type { PresetsData, PresetView } from '../../../api/admin'
import a from '../admin.module.css'
import s from '../PresetsPage.module.css'

type FieldsProps = { draft: PresetView; isNew: boolean; onChange: (d: PresetView) => void }

/** 머리(이름 · 사용 안 함) · 이름 · 설명 · 기본 구분 */
export function PresetFields({ draft, isNew, onChange }: FieldsProps) {
  return (
    <>
      <div className={s.head}>
        {isNew ? (
          <h2 className={a.h2}>새 프리셋</h2>
        ) : (
          <>
            <h2 className={a.h2}>{draft.name}</h2>
            <Button variant="secondary" onClick={() => onChange({ ...draft, active: !draft.active })}>
              {draft.active ? '사용 안 함' : '다시 사용'}
            </Button>
          </>
        )}
      </div>
      <div className={s.fields}>
        {isNew && (
          <label className={a.field}>
            이름
            <input className={a.input} maxLength={30} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
          </label>
        )}
        <label className={a.field}>
          설명
          <input className={a.input} value={draft.desc} onChange={(e) => onChange({ ...draft, desc: e.target.value })} />
        </label>
        <label className={a.field}>
          기본 구분
          <Select
            value={draft.defaultFor ?? ''}
            label="기본 구분"
            options={[
              { value: '', label: '없음' },
              { value: '교수', label: '교수' },
              { value: '학생', label: '학생' },
              { value: '인턴', label: '인턴' },
            ]}
            onChange={(v) => onChange({ ...draft, defaultFor: v || null })}
          />
        </label>
      </div>
    </>
  )
}

type RolesProps = { roles: PresetsData['roles']; draft: PresetView; saved: PresetView; onToggle: (code: string) => void }

/** 역할 고르기 (기능 · 서비스 · 관리), 새로 더한 역할은 강조 */
export function PresetRoleGrid({ roles, draft, saved, onToggle }: RolesProps) {
  return (
    <>
      {(['FEATURE', 'SERVICE', 'ADMIN'] as const).map((g) => (
        <section key={g}>
          <div className={s.groupTitle}>
            {g === 'FEATURE' ? '기능' : g === 'SERVICE' ? '서비스 · VAULT · JENKINS 읽기/쓰기는 프로젝트에서 줘요' : '관리'}
          </div>
          <div className={s.grid}>
            {roles.filter((r) => r.group === g).map((r) => {
              const on = draft.roles.includes(r.code)
              const isAdded = on && !saved.roles.includes(r.code)
              return (
                <div key={r.code} className={[s.roleBox, on && s.roleOn, isAdded && s.roleNew].filter(Boolean).join(' ')}>
                  <Checkbox checked={on} onChange={() => onToggle(r.code)}>
                    <span className={s.roleText}>
                      <strong>{r.code}</strong>
                      <small>{r.desc}</small>
                    </span>
                  </Checkbox>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

type PropagateProps = {
  propagate: boolean
  onPropagate: (v: boolean) => void
  applied: { loading: boolean; error: string | null }
  preview: string[]
}

/** 적용한 구성원에게도 반영 · 미리보기 */
export function PropagateBox({ propagate, onPropagate, applied, preview }: PropagateProps) {
  return (
    <div className={s.propagate}>
      <div className={s.propTop}>
        <Switch checked={propagate} onChange={onPropagate} label="적용한 구성원에게도 반영" />
        이 프리셋을 적용한 구성원에게도 반영
      </div>
      {propagate && (
        <small>
          {applied.loading
            ? '미리보기 · 적용한 구성원을 불러오는 중이에요'
            : applied.error
              ? `미리보기 · ${applied.error}`
              : preview.length > 0
                ? `미리보기 · ${preview.length}명(${preview.join(', ')})의 역할이 이 프리셋 역할로 바뀌어요 (프리셋에 없는 역할은 빠져요)`
                : '미리보기 · 바뀌는 구성원이 없어요'}
        </small>
      )}
    </div>
  )
}
