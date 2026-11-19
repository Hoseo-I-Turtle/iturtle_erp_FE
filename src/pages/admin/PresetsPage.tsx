import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Card, Loadable } from '../../components/ui'
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
import { PresetFields, PresetRoleGrid, PropagateBox } from './presets/PresetEditorParts'
import { PresetList } from './presets/PresetList'
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
  const preview = !isLive() && added.length === 0 && saved.id === 'student' && !dirty ? missingPenpot : affected.map((m) => m.name)

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
      <PresetList presets={presets} selectedId={id} onPick={pick} onNew={() => pick(BLANK)} />

      <Card className={s.editor}>
        <PresetFields draft={draft} isNew={isNew} onChange={setDraft} />
        <PresetRoleGrid roles={ROLES} draft={draft} saved={saved} onToggle={toggle} />
        {!isNew && <PropagateBox propagate={propagate} onPropagate={setPropagate} applied={applied} preview={preview} added={added} />}
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
