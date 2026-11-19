import { Check, X } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { CodeColumn } from '../../../api/admin'
import type { CodeDraft } from './draft'
import a from '../admin.module.css'
import s from '../CodesPage.module.css'

type Props = { columns: CodeColumn[]; draft: CodeDraft; onDraft: (d: CodeDraft) => void; busy: boolean; onCancel: () => void; onAdd: () => void }

/** 행 추가: 상세 코드 · 표시 이름 · 쓰는 참조 칸 */
export function CodeAddForm({ columns, draft, onDraft, busy, onCancel, onAdd }: Props) {
  return (
    <div className={s.addForm}>
      <label className={a.field}>
        상세 코드
        <input className={a.input} maxLength={50} value={draft.code} onChange={(e) => onDraft({ ...draft, code: e.target.value })} />
      </label>
      <label className={a.field}>
        표시 이름
        <input className={a.input} maxLength={255} value={draft.name} onChange={(e) => onDraft({ ...draft, name: e.target.value })} />
      </label>
      {columns.map((c) => (
        <label key={c.index} className={a.field}>
          {c.label}
          <input
            className={a.input}
            maxLength={255}
            value={draft.refs[c.index]}
            onChange={(e) => onDraft({ ...draft, refs: draft.refs.map((v, i) => (i === c.index ? e.target.value : v)) })}
          />
        </label>
      ))}
      <Button variant="secondary" icon={X} onClick={onCancel}>
        취소
      </Button>
      <Button icon={Check} onClick={onAdd} disabled={busy}>
        더하기
      </Button>
    </div>
  )
}
