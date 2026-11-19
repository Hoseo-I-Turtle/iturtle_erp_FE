import type { Minute } from '../../../mocks/minutes'
import { SECTIONS } from './sections'
import s from '../MinutesPage.module.css'

/** 안건 · 논의 · 결정 (보기만 — 고치기는 쓰기 화면). 비어 있는 칸은 뺀다 */
export function MinuteSections({ m }: { m: Minute }) {
  const filled = SECTIONS.filter(({ key: k }) => m[k].length > 0)
  if (filled.length === 0) return <p className={s.emptySections}>아직 적은 내용이 없어요.</p>
  return (
    <>
      {filled.map(({ key: k, label }) => (
        <section key={k} className={s.section}>
          <h3>{label}</h3>
          <ul>
            {m[k].map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
