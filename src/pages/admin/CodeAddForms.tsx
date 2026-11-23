// 공통코드 그룹 · 행 추가 (Penpot 06 · 관리 · 공통코드 · 그룹 · 행 추가)
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, FormError, Switch, TextInput } from '../../components/ui'
import { createCodeGroup, createCodeRow, type CodeRowDraft } from '../../api/adminOps'
import { errorText } from '../../api/content'
import { getDataMode } from '../../lib/dataMode'
import s from './ops.module.css'

const CODE_RE = /^[A-Z][A-Z0-9_]{1,49}$/

/** 그룹 추가: 왼쪽 그룹 목록 위에 펼쳐진다 */
export function CodeGroupForm({ existing, onClose, onCreated }: { existing: string[]; onClose: () => void; onCreated: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!CODE_RE.test(code)) return setError('그룹 코드는 영문 대문자로 시작하고 대문자 · 숫자 · _ 만 쓸 수 있어요.')
    if (existing.includes(code)) return setError('이미 있는 그룹이에요.')
    if (!name.trim()) return setError('그룹 이름을 적어 주세요.')
    setBusy(true)
    setError(null)
    try {
      await createCodeGroup(code, name.trim(), getDataMode() === 'live')
      onCreated(code)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className={s.addForm}>
      <TextInput value={code} onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 50))} placeholder="MINUTE_TEMPLATE" autoFocus />
      <small>영문 대문자 · 숫자 · _ 만. 만든 뒤에는 못 바꿔요</small>
      <TextInput value={name} onChange={(v) => setName(v.slice(0, 50))} placeholder="그룹 이름 (예: 회의록 양식)" />
      <FormError>{error}</FormError>
      <div className={s.addActions}>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button icon={Check} disabled={busy} onClick={submit}>
          만들기
        </Button>
      </div>
    </div>
  )
}

/** 행 추가: 상세 코드 표 아래에 펼쳐진다. columns 는 그 그룹의 ref1 · ref2 · ref4 칸 이름 */
export function CodeRowForm({ group, columns, existing, onClose }: { group: string; columns: [string, string, string, string]; existing: string[]; onClose: () => void }) {
  const [d, setD] = useState<CodeRowDraft>({ code: '', name: '', ref1: '', ref2: '', ref4: '', sortOrder: '', enabled: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CodeRowDraft>(k: K, v: CodeRowDraft[K]) => setD((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!d.code.trim()) return setError('코드를 적어 주세요.')
    if (existing.includes(d.code.trim())) return setError('이 그룹에 이미 있는 코드예요.')
    if (!d.name.trim()) return setError('표시 이름을 적어 주세요.')
    setBusy(true)
    setError(null)
    try {
      await createCodeRow(group, { ...d, code: d.code.trim(), name: d.name.trim() }, getDataMode() === 'live')
      onClose()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className={s.addForm}>
      <div className={s.addRow}>
        <TextInput value={d.code} onChange={(v) => set('code', v.replace(/\s/g, '').slice(0, 50))} placeholder="코드" autoFocus />
        <TextInput value={d.name} onChange={(v) => set('name', v.slice(0, 50))} placeholder="표시 이름" />
        <TextInput value={d.sortOrder} onChange={(v) => set('sortOrder', v.replace(/\D/g, '').slice(0, 3))} placeholder="순서" />
      </div>
      <div className={s.addRow}>
        <TextInput value={d.ref1} onChange={(v) => set('ref1', v)} placeholder={columns[0]} />
        <TextInput value={d.ref2} onChange={(v) => set('ref2', v)} placeholder={`${columns[1]} · 쉼표로 여러 개`} />
        <TextInput value={d.ref4} onChange={(v) => set('ref4', v)} placeholder={columns[2]} />
      </div>
      <FormError>{error}</FormError>
      <div className={s.addActions}>
        <span>코드는 저장한 뒤 바꿀 수 없어요. 쓰지 않게 되면 지우지 말고 "사용"을 꺼 주세요</span>
        <Switch checked={d.enabled} onChange={(v) => set('enabled', v)} label="사용" />
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button icon={Check} disabled={busy} onClick={submit}>
          저장
        </Button>
      </div>
    </div>
  )
}
