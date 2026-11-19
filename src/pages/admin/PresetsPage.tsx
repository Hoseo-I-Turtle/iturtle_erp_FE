import { useState } from 'react'
import { Check, Plus, Shield } from 'lucide-react'
import { Button, Card, Checkbox, Loadable, Select, Switch } from '../../components/ui'
import { missingPenpot } from '../../mocks/admin'
import { whenLive } from '../../api/useResource'
import {
  createPreset,
  errorText,
  isLive,
  presetBody,
  updatePreset,
  usePresetMembers,
  usePresetsAdmin,
  type PresetsData,
  type PresetView,
} from '../../api/admin'
import a from './admin.module.css'
import s from './PresetsPage.module.css'

const NEW_ID = 'new'
const BLANK: PresetView = { id: NEW_ID, name: '', desc: '', defaultFor: null, roles: [], applied: [], active: true, appliedCount: 0 }

export function PresetsPage() {
  const res = usePresetsAdmin()
  return (
    <Loadable resource={res} label="권한 프리셋">
      {(d) => <PresetsView data={d} />}
    </Loadable>
  )
}

function PresetsView({ data }: { data: PresetsData }) {
  const ROLES = data.roles
  const [presets, setPresets] = useState(data.presets)
  const [id, setId] = useState(() => (isLive() ? (data.presets[0]?.id ?? NEW_ID) : 'student'))
  const saved = id === NEW_ID ? BLANK : (presets.find((p) => p.id === id) ?? presets[0] ?? BLANK)
  const [draft, setDraft] = useState<PresetView>(saved)
  const [propagate, setPropagate] = useState(true)
  const [err, setErr] = useState('')
  const isNew = draft.id === NEW_ID
  // 반영 미리보기: 이 프리셋을 적용한 구성원과 그 역할 (GET /members?presetId=)
  const applied = usePresetMembers(saved)

  const pick = (p: PresetView) => {
    setId(p.id)
    setDraft(p)
    setErr('')
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const added = draft.roles.filter((r) => !saved.roles.includes(r))
  // 더해진 역할이 아직 없는 적용 구성원 (미리보기)
  const affected = propagate ? (applied.data ?? []).filter((m) => added.some((r) => !m.roles.includes(r))) : []
  const preview = added.length === 0 && saved.id === 'student' && !dirty ? missingPenpot : affected.map((m) => m.name)

  const toggle = (code: string) =>
    setDraft({ ...draft, roles: draft.roles.includes(code) ? draft.roles.filter((r) => r !== code) : [...draft.roles, code] })

  const save = async () => {
    setErr('')
    if (isNew) {
      try {
        const created = (await whenLive(() => createPreset(presetBody(draft, null)))) ?? { ...draft, id: `local-${presets.length + 1}` }
        setPresets((ps) => [...ps, created])
        pick(created)
      } catch (e) {
        setErr(errorText(e))
      }
      return
    }
    const prev = presets
    const body = presetBody(draft, saved)
    // 사용 안 함으로 바꾸면서 반영할 수는 없다 (M016)
    if (propagate && draft.active && affected.length > 0) body.propagateToMemberIds = affected.map((m) => m.memberId)
    setPresets((ps) => ps.map((p) => (p.id === draft.id ? draft : p)))
    try {
      const updated = await whenLive(() => updatePreset(draft.id, body))
      if (updated) {
        setPresets((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))
        setDraft(updated)
        if (body.propagateToMemberIds) applied.reload()
      }
    } catch (e) {
      setErr(errorText(e))
      setPresets(prev)
    }
  }

  return (
    <div className={a.layoutNarrow}>
      <div className={a.col} style={{ gap: 12 }}>
        {presets.map((p) => (
          <button key={p.id} type="button" className={p.id === id ? `${s.preset} ${s.presetOn}` : s.preset} onClick={() => pick(p)}>
            <span className={s.presetTop}>
              <Shield size={18} />
              <strong>{p.name}</strong>
              {p.defaultFor && <span className={s.default}>{p.defaultFor} 기본값</span>}
            </span>
            <small>
              역할 {p.roles.length}개 · 적용한 구성원 {p.appliedCount}명{!p.active && ' · 사용 안 함'}
            </small>
          </button>
        ))}
        <Button variant="tint" icon={Plus} onClick={() => pick(BLANK)}>
          새 프리셋
        </Button>
        <p className={a.muted}>프리셋은 템플릿이에요. 고쳐도 이미 적용한 구성원은 자동으로 바뀌지 않아요.</p>
      </div>

      <Card className={s.editor}>
        <div className={s.head}>
          {isNew ? (
            <h2 className={a.h2}>새 프리셋</h2>
          ) : (
            <>
              <h2 className={a.h2}>{draft.name}</h2>
              <Button variant="secondary" onClick={() => setDraft({ ...draft, active: !draft.active })}>
                {draft.active ? '사용 안 함' : '다시 사용'}
              </Button>
            </>
          )}
        </div>
        <div className={s.fields}>
          {isNew && (
            <label className={a.field}>
              이름
              <input className={a.input} maxLength={30} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
          )}
          <label className={a.field}>
            설명
            <input className={a.input} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
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
              onChange={(v) => setDraft({ ...draft, defaultFor: v || null })}
            />
          </label>
        </div>

        {(['FEATURE', 'SERVICE', 'ADMIN'] as const).map((g) => (
          <section key={g}>
            <div className={s.groupTitle}>
              {g === 'FEATURE' ? '기능' : g === 'SERVICE' ? '서비스 · VAULT · JENKINS 읽기/쓰기는 프로젝트에서 줘요' : '관리'}
            </div>
            <div className={s.grid}>
              {ROLES.filter((r) => r.group === g).map((r) => {
                const on = draft.roles.includes(r.code)
                const isAdded = on && !saved.roles.includes(r.code)
                return (
                  <div key={r.code} className={[s.roleBox, on && s.roleOn, isAdded && s.roleNew].filter(Boolean).join(' ')}>
                    <Checkbox checked={on} onChange={() => toggle(r.code)}>
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

        {!isNew && (
          <div className={s.propagate}>
            <div className={s.propTop}>
              <Switch checked={propagate} onChange={setPropagate} label="적용한 구성원에게도 반영" />
              이 프리셋을 적용한 구성원에게도 반영
            </div>
            {propagate && (
              <small>
                {applied.loading
                  ? '미리보기 · 적용한 구성원을 불러오는 중이에요'
                  : applied.error
                    ? `미리보기 · ${applied.error}`
                    : preview.length > 0
                      ? `미리보기 · 아직 ${added[0] ?? 'penpot-member'} 가 없는 ${preview.length}명(${preview.join(', ')})에게 더해져요`
                      : '미리보기 · 바뀌는 구성원이 없어요'}
              </small>
            )}
          </div>
        )}
        {err && <p className={a.err}>{err}</p>}
        <div className={a.actions}>
          <Button variant="secondary" onClick={() => setDraft(saved)} disabled={!dirty}>
            취소
          </Button>
          <Button icon={Check} disabled={!dirty || (isNew && (!draft.name.trim() || draft.roles.length === 0))} onClick={save}>
            {isNew ? '만들기' : `저장${propagate && affected.length > 0 ? ` · ${affected.length}명에게 반영` : ''}`}
          </Button>
        </div>
      </Card>
    </div>
  )
}
