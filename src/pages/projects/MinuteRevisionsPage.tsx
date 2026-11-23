import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, ChevronLeft, Clock, Info, MapPin, Users } from 'lucide-react'
import { Avatar, Card, Chip, Columns, Loadable, Note, SectionHead } from '../../components/ui'
import { useMinuteRevisions, type RevisionSnapshot } from '../../api/minutes'
import s from './MinuteRevisionsPage.module.css'

const SECTIONS: { key: 'agenda' | 'discussion' | 'decisions' | 'actions'; label: string }[] = [
  { key: 'agenda', label: '안건' },
  { key: 'discussion', label: '논의' },
  { key: 'decisions', label: '결정 사항' },
  { key: 'actions', label: '할 일' },
]

/** 고른 버전의 줄과 바로 앞 버전을 견줘 더한 줄 · 뺀 줄을 표시한다 */
function diff(cur: string[], prev: string[] | null) {
  if (!prev) return cur.map((text) => ({ text, kind: 'same' as const }))
  return [
    ...cur.map((text) => ({ text, kind: prev.includes(text) ? ('same' as const) : ('add' as const) })),
    ...prev.filter((text) => !cur.includes(text)).map((text) => ({ text, kind: 'del' as const })),
  ]
}

/** 회의록 수정 이력 (Penpot 06 · 회의록 수정 이력) — MM-6, MM-7 */
export function MinuteRevisionsPage() {
  const { key, minuteId } = useParams()
  const [version, setVersion] = useState<number | null>(null)
  const res = useMinuteRevisions(Number(minuteId), version)
  const back = `/projects/${key}/minutes/${minuteId}`

  return (
    <Loadable resource={res} label="수정 이력">
      {(v) => {
        const snap: RevisionSnapshot = v.snapshot
        const rev = v.revisions.find((r) => r.version === v.version)
        return (
          <Columns
            sideWidth={380}
            main={
              <Card className={s.card}>
                <Link to={back} className={s.back}>
                  <ChevronLeft size={16} />
                  {snap.title}로 돌아가기
                </Link>
                <div className={s.head}>
                  <h2>
                    {snap.title}
                    <Chip tone="muted">버전 {v.version}</Chip>
                    {v.version === v.latest ? <Chip tone="positive">지금 버전</Chip> : <Chip tone="warning" icon={Clock}>지난 버전 · 읽기만</Chip>}
                  </h2>
                  {rev && (
                    <p>
                      {rev.editor} 이 {rev.when} 에 저장 · {rev.summary}
                    </p>
                  )}
                </div>
                <div className={s.meta}>
                  <span>
                    <Calendar size={14} />
                    {snap.when}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {snap.place}
                  </span>
                  <span>
                    <Users size={14} />
                    {snap.attendees.join(' · ') || '참석자 없음'}
                  </span>
                </div>
                {SECTIONS.map(({ key: k, label }) => {
                  const lines = diff(snap[k], v.previous ? v.previous[k] : null)
                  return (
                    <section key={k} className={s.section}>
                      <h3>{label}</h3>
                      {lines.length === 0 && <p className={s.none}>적은 내용이 없어요</p>}
                      {lines.map((l) => (
                        <p key={l.kind + l.text} className={l.kind === 'add' ? s.add : l.kind === 'del' ? s.del : undefined}>
                          <b>{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : '·'}</b>
                          <span>{l.text}</span>
                        </p>
                      ))}
                    </section>
                  )
                })}
                <Note icon={Info}>
                  {v.previous
                    ? `초록은 이 버전에서 더한 줄, 빨강은 뺀 줄이에요 (바로 앞 버전 ${v.version - 1} 과 비교).`
                    : '처음 쓴 버전이라 비교할 앞 버전이 없어요.'}{' '}
                  지난 버전으로 되돌리는 기능은 없어요. 필요한 내용은 복사해서 지금 회의록에 붙여 넣어 주세요.
                </Note>
              </Card>
            }
            side={
              <Card>
                <SectionHead icon={Clock} title="수정 이력" extra={<b className={s.count}>{v.revisions.length}</b>} />
                {v.revisions.map((r) => {
                  const on = r.version === v.version
                  return (
                    <button key={r.version} type="button" className={on ? `${s.rev} ${s.revOn}` : s.rev} aria-pressed={on} onClick={() => setVersion(r.version)}>
                      <i>v{r.version}</i>
                      <span>
                        <strong>
                          {r.summary}
                          {r.version === v.latest && <Chip tone="positive">지금</Chip>}
                        </strong>
                        <small>
                          <Avatar name={r.editor} size={16} />
                          {r.editor} · {r.when}
                        </small>
                      </span>
                      {!on && <em>보기</em>}
                    </button>
                  )
                })}
                <p className={s.hint}>저장할 때마다 한 버전씩 남아요. 누가 무엇을 바꿨는지는 요약으로 보여요.</p>
              </Card>
            }
          />
        )
      }}
    </Loadable>
  )
}
