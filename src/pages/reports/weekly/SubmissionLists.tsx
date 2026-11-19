import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Avatar } from '../../../components/ui'
import type { Submission } from '../../../mocks/reports'
import { STATE_LABEL } from './constants'
import { ReportViewPanel } from './ReportViewPanel'
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

/** 구성원별 보고 탭: 요약이 있는 보고만. 누르면 보고를 펼쳐 칸 · 확인 · 칸 코멘트 */
export function MemberReportList({ list }: { list: Submission[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ul className={s.memberReports}>
      {list
        .filter((x) => x.summary)
        .map((x) => (
          <li key={x.name} className={s.memberReport}>
            <button
              type="button"
              className={s.memberReportRow}
              onClick={() => x.reportId && setOpen(open === x.reportId ? null : x.reportId)}
              aria-expanded={open === x.reportId}
            >
              {open === x.reportId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Avatar name={x.name} size={28} />
              <div>
                <strong>{x.name}</strong>
                {x.projectKeys && x.projectKeys.length > 0 && <small className={s.sectionKey}>{x.projectKeys.join(' · ')}</small>}
                <p>{x.summary}</p>
              </div>
              <span className={`${s.state} ${s[x.state]}`}>{STATE_LABEL[x.state]}</span>
            </button>
            {open === x.reportId && x.reportId && <ReportViewPanel reportId={x.reportId} />}
          </li>
        ))}
    </ul>
  )
}
