import { Avatar } from '../../../components/ui'
import type { Submission } from '../../../mocks/reports'
import { STATE_LABEL } from './constants'
import s from '../WeeklyReportPage.module.css'

/** 제출 현황 탭: 이름 · 제출 상태 */
export function SubmissionStatusList({ list }: { list: Submission[] }) {
  return (
    <ul className={s.statusList}>
      {list.map((x) => (
        <li key={x.name}>
          <Avatar name={x.name} size={28} />
          <strong>{x.name}</strong>
          <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
        </li>
      ))}
    </ul>
  )
}

/** 구성원별 보고 탭: 요약이 있는 보고만 */
export function MemberReportList({ list }: { list: Submission[] }) {
  return (
    <ul className={s.memberReports}>
      {list
        .filter((x) => x.summary)
        .map((x) => (
          <li key={x.name}>
            <Avatar name={x.name} size={28} />
            <div>
              <strong>{x.name}</strong>
              <p>{x.summary}</p>
            </div>
            <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
          </li>
        ))}
    </ul>
  )
}
