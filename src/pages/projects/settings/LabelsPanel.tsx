import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, Card, Empty } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import {
  createLabel,
  deleteLabel,
  errText,
  updateLabel,
  type LabelInput,
  type ProjectSettings,
  type SettingsLabel,
} from '../../../api/projectSettings'
import s from './panels.module.css'

type Props = { settings: ProjectSettings; onChange: (p: Partial<ProjectSettings>) => void }

/** 고를 수 있는 색 (디자인 토큰에 맞춘 8가지) */
const COLORS = ['#E5484D', '#F5A524', '#34C27A', '#3F6593', '#1B3554', '#80AAD3', '#8E4EC6', '#5B86B6']
const EMPTY: LabelInput = { name: '', color: COLORS[3], description: '' }

/** 설정 › 라벨 (P-24 ~ P-27). 라벨을 지우면 붙어 있던 작업에서도 빠진다 */
export function LabelsPanel({ settings, onChange }: Props) {
  const [draft, setDraft] = useState<LabelInput>(EMPTY)
  const [editing, setEditing] = useState<number | null>(null)
  const [edit, setEdit] = useState<LabelInput>(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const readOnly = settings.status === 'ARCHIVED' || !settings.canManage
  const labels = settings.labels
  const setLabels = (next: SettingsLabel[]) => onChange({ labels: [...next].sort((a, b) => a.name.localeCompare(b.name)) })

  const go = <T,>(call: () => Promise<T>, done: (r: T | undefined) => void) => {
    setBusy(true)
    setError(null)
    whenLive(call)
      .then(done)
      .catch((e: unknown) => setError(errText(e, '저장하지 못했어요.')))
      .finally(() => setBusy(false))
  }

  const add = () =>
    go(
      () => createLabel(settings.projectKey, draft),
      (r) => {
        setLabels([...labels, r ?? { labelId: Date.now(), name: draft.name.trim(), color: draft.color, description: draft.description.trim() || null, taskCount: 0 }])
        setDraft(EMPTY)
      },
    )
  const save = (l: SettingsLabel) =>
    go(
      () => updateLabel(settings.projectKey, l.labelId, edit),
      (r) => {
        setLabels(labels.map((x) => (x.labelId === l.labelId ? (r ?? { ...x, name: edit.name.trim(), color: edit.color, description: edit.description.trim() || null }) : x)))
        setEditing(null)
      },
    )
  const remove = (l: SettingsLabel) =>
    go(
      () => deleteLabel(settings.projectKey, l.labelId),
      () => {
        setLabels(labels.filter((x) => x.labelId !== l.labelId))
        setConfirmDelete(null)
      },
    )

  return (
    <Card className={s.card}>
      <header className={s.head}>
        <h2>라벨 {labels.length}개</h2>
        <p>작업에 붙이는 라벨이에요. 지우면 붙어 있던 작업에서도 빠져요.</p>
      </header>

      {error && <p className={s.failText}>{error}</p>}

      <ul className={s.labelList}>
        {labels.map((l) =>
          editing === l.labelId ? (
            <li key={l.labelId} className={`${s.labelRow} ${s.labelEditing}`}>
              <LabelForm value={edit} onChange={setEdit} />
              <Button icon={Check} onClick={() => save(l)} disabled={busy || !edit.name.trim()}>
                저장
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                취소
              </Button>
            </li>
          ) : (
            <li key={l.labelId} className={s.labelRow}>
              <span className={s.dot} style={{ background: l.color }} />
              <span className={s.labelText}>
                <strong>{l.name}</strong>
                {l.description && <small>{l.description}</small>}
              </span>
              <span className={s.muted}>작업 {l.taskCount}개</span>
              {!readOnly &&
                (confirmDelete === l.labelId ? (
                  <span className={s.confirm}>
                    <span className={s.failText}>{l.taskCount > 0 ? `작업 ${l.taskCount}개에서 빠져요.` : ''} 지울까요?</span>
                    <Button variant="secondary" onClick={() => remove(l)} disabled={busy}>
                      지우기
                    </Button>
                    <button type="button" className={s.iconBtn} onClick={() => setConfirmDelete(null)} aria-label="취소">
                      <X size={16} />
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className={s.iconBtn}
                      onClick={() => {
                        setEditing(l.labelId)
                        setEdit({ name: l.name, color: l.color, description: l.description ?? '' })
                      }}
                      aria-label={`${l.name} 고치기`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button type="button" className={s.iconBtn} onClick={() => setConfirmDelete(l.labelId)} aria-label={`${l.name} 지우기`}>
                      <Trash2 size={16} />
                    </button>
                  </>
                ))}
            </li>
          ),
        )}
      </ul>
      {labels.length === 0 && <Empty>라벨이 없어요.</Empty>}

      {!readOnly && (
        <div className={s.labelNew}>
          <span className={s.label}>새 라벨</span>
          <div className={s.labelRow}>
            <LabelForm value={draft} onChange={setDraft} />
            <Button icon={Plus} onClick={add} disabled={busy || !draft.name.trim()}>
              추가
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function LabelForm({ value, onChange }: { value: LabelInput; onChange: (v: LabelInput) => void }) {
  return (
    <>
      <span className={s.colors} role="radiogroup" aria-label="색">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.color.toUpperCase() === c}
            aria-label={c}
            className={value.color.toUpperCase() === c ? `${s.swatch} ${s.swatchOn}` : s.swatch}
            style={{ background: c }}
            onClick={() => onChange({ ...value, color: c })}
          />
        ))}
      </span>
      <span className={`${s.input} ${s.labelName}`}>
        <input value={value.name} maxLength={30} placeholder="이름" onChange={(e) => onChange({ ...value, name: e.target.value })} aria-label="라벨 이름" />
      </span>
      <span className={s.input}>
        <input value={value.description} maxLength={200} placeholder="설명 (선택)" onChange={(e) => onChange({ ...value, description: e.target.value })} aria-label="라벨 설명" />
      </span>
    </>
  )
}
