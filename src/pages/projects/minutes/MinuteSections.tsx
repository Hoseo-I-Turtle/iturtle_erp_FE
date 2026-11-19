import type { Minute } from '../../../mocks/minutes'
import { SECTIONS, type MinuteDraft } from './sections'
import s from '../MinutesPage.module.css'

type Props = { m: Minute; editing: boolean; draft: MinuteDraft; onDraft: (d: MinuteDraft) => void }

/** 안건 · 논의 · 결정: 보기는 목록, 고칠 때는 한 줄에 하나씩 */
export function MinuteSections({ m, editing, draft, onDraft }: Props) {
  return (
    <>
      {SECTIONS.map(({ key: k, label }) => (
        <section key={k} className={s.section}>
          <h3>{label}</h3>
          {editing ? (
            <textarea
              className={s.textarea}
              value={draft[k]}
              rows={Math.max(3, draft[k].split('\n').length + 1)}
              onChange={(e) => onDraft({ ...draft, [k]: e.target.value })}
              placeholder="한 줄에 하나씩"
            />
          ) : (
            <ul>
              {m[k].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}
