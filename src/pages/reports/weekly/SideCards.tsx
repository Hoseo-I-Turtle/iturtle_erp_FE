import { Check, MessageCircle, Users } from 'lucide-react'
import { Avatar, Card, Empty, Loadable, SectionHead } from '../../../components/ui'
import type { Resource } from '../../../api/useResource'
import type { LastWeek } from '../../../api/content'
import type { Submission } from '../../../mocks/reports'
import { STATE_LABEL, type SubmissionState } from './constants'
import s from '../WeeklyReportPage.module.css'

/** 오른쪽: 그 주 제출 비율 막대 · 아직 안 낸 사람 */
export function SubmissionSummaryCard({ weekLabel, submissions }: { weekLabel: string; submissions: Submission[] }) {
  const total = submissions.length
  const count = (st: SubmissionState) => submissions.filter((x) => x.state === st).length
  return (
    <Card>
      <SectionHead icon={Users} title={`${weekLabel} 제출 현황`} />
      <div className={s.bar}>
        <i style={{ width: `${total ? (count('SUBMITTED') / total) * 100 : 0}%`, background: 'var(--status-positive)' }} />
        <i style={{ width: `${total ? (count('LATE') / total) * 100 : 0}%`, background: 'var(--status-warning-text)' }} />
      </div>
      <div className={s.counts}>
        <span className={s.cOk}>제출 {count('SUBMITTED')}</span>
        <span className={s.cLate}>늦은 제출 {count('LATE')}</span>
        <span>미제출 {count('MISSING')}</span>
      </div>
      <ul className={s.notYet}>
        {submissions
          .filter((x) => x.state !== 'SUBMITTED')
          .map((x) => (
            <li key={x.name}>
              <Avatar name={x.name} size={26} />
              <span>{x.name}</span>
              <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
            </li>
          ))}
      </ul>
      <p className={s.hint}>모든 구성원이 서로의 보고를 볼 수 있어요.</p>
    </Card>
  )
}

/** 오른쪽: 지난 주 내 보고에 달린 코멘트 */
export function LastWeekCommentCard({ last }: { last: Resource<LastWeek> }) {
  return (
    <Card>
      <SectionHead icon={MessageCircle} title="지난 주 보고 코멘트" />
      <Loadable resource={last} label="지난 주 코멘트">
        {(l) =>
          l.comment ? (
            <div className={s.comment}>
              <Avatar name={l.comment.author} size={28} colorIndex={3} />
              <div>
                <div className={s.commentHead}>
                  <strong>{l.comment.author}</strong>
                  {l.comment.confirmed && (
                    <span className={s.confirmed}>
                      <Check size={12} /> 확인함
                    </span>
                  )}
                </div>
                <p>{l.comment.body}</p>
              </div>
            </div>
          ) : (
            <Empty>지난 주 보고에 코멘트가 없어요.</Empty>
          )
        }
      </Loadable>
    </Card>
  )
}
