import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button, Chip, Loadable, Note } from '../../../components/ui'
import { confirmReport, useGithubActivity, useReportView, type ReportView } from '../../../api/content'
import { ApiError } from '../../../api/client'
import { whenLive } from '../../../api/useResource'
import { useMe } from '../../../api/members'
import { GithubBox } from './GithubBox'
import { AdditionalProjectActivity } from './ProjectActivity'
import { SectionCard } from './SectionCard'
import { SectionComments } from './SectionComments'
import s from '../WeeklyReportPage.module.css'

/**
 * 남의 보고 한 장 (구성원별 보고에서 펼침): 프로젝트 칸(+ 그 주 작업 · GitHub 활동, ERP-39) · 공통 메모 · 확인 버튼 · 칸 코멘트.
 * 확인은 report-review — 자기 보고면 버튼을 막고 이유를 보여 준다 (P245, 자기 승인 막기).
 */
export function ReportViewPanel({ reportId }: { reportId: number }) {
  const report = useReportView(reportId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setError('')
    setBusy(true)
    try {
      const next = await whenLive(() => confirmReport(reportId))
      report.setData((r) => next ?? { ...r, status: 'CONFIRMED', canConfirm: false })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '확인하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Loadable resource={report} label="보고">
      {(r) => <ReportBody r={r} busy={busy} error={error} onConfirm={confirm} />}
    </Loadable>
  )
}

/** 읽어 온 보고 — 작성자 · 주를 알아야 GitHub 활동(WR-6)을 부를 수 있어 따로 둔다 */
function ReportBody({ r, busy, error, onConfirm }: { r: ReportView; busy: boolean; error: string; onConfirm: () => void }) {
  const me = useMe().data
  const gh = useGithubActivity(r.weekStartOn, r.memberId)
  const github = gh.loading || gh.error ? undefined : gh.data
  return (
    <div className={s.reportView}>
      {r.sections.map((x) => (
        <SectionCard key={x.projectKey} section={x} report={r} github={github} editable={false} readOnly>
          {r.status !== 'DRAFT' && (
            <SectionComments reportId={r.reportId} projectKey={x.projectKey} meName={me?.name ?? '나'} canWrite={r.canComment} />
          )}
        </SectionCard>
      ))}
      <AdditionalProjectActivity report={r} github={github} readOnly />
      {r.hiddenSectionCount > 0 && <Note icon={Lock}>볼 수 없는 프로젝트의 칸 {r.hiddenSectionCount}개는 내용을 숨겼어요.</Note>}
      {r.note && (
        <div className={s.field}>
          <span>공통 메모</span>
          <p className={s.readonly}>{r.note}</p>
        </div>
      )}
      <Loadable resource={gh} label="GitHub 활동">
        {(g) => <GithubBox g={g} />}
      </Loadable>
      <div className={s.reviewBar}>
        {r.status === 'CONFIRMED' ? (
          <Chip tone="brand" icon={Check}>
            확인함{r.confirmedBy ? ` · ${r.confirmedBy}` : ''}
          </Chip>
        ) : r.canConfirm ? (
          <Button icon={Check} onClick={onConfirm} disabled={busy}>
            확인하기
          </Button>
        ) : r.confirmBlockedReason ? (
          <small className={s.blocked}>
            <Lock size={14} /> {r.confirmBlockedReason}
          </small>
        ) : null}
      </div>
      {error && <p className={s.error}>{error}</p>}
    </div>
  )
}
