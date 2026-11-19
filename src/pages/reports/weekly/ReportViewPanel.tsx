import { useState } from 'react'
import { Check, FolderKanban, Lock } from 'lucide-react'
import { Button, Chip, Loadable, Note } from '../../../components/ui'
import { confirmReport, useReportView } from '../../../api/content'
import { ApiError } from '../../../api/client'
import { whenLive } from '../../../api/useResource'
import { useMe } from '../../../api/members'
import { FIELDS } from './constants'
import { SectionComments } from './SectionComments'
import s from '../WeeklyReportPage.module.css'

/**
 * 남의 보고 한 장 (구성원별 보고에서 펼침): 프로젝트 칸 · 공통 메모 · 확인 버튼 · 칸 코멘트.
 * 확인은 report-review — 자기 보고면 버튼을 막고 이유를 보여 준다 (P245, 자기 승인 막기).
 */
export function ReportViewPanel({ reportId }: { reportId: number }) {
  const report = useReportView(reportId)
  const me = useMe().data
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
      {(r) => (
        <div className={s.reportView}>
          {r.sections.map((x) => (
            <section key={x.projectKey} className={s.section}>
              <div className={s.sectionHead}>
                <FolderKanban size={16} />
                <strong>{x.projectName}</strong>
                <span className={s.sectionKey}>{x.projectKey}</span>
                {x.detached && <Chip tone="muted">진행 중 아님</Chip>}
              </div>
              <div className={s.sectionBody}>
                {FIELDS.map(({ key, label }) => (
                  <div key={key} className={s.field}>
                    <span>{label}</span>
                    <p className={s.readonly}>{x.fields[key] || '—'}</p>
                  </div>
                ))}
                {r.status !== 'DRAFT' && (
                  <SectionComments reportId={r.reportId} projectKey={x.projectKey} meName={me?.name ?? '나'} canWrite={r.canComment} />
                )}
              </div>
            </section>
          ))}
          {r.hiddenSectionCount > 0 && (
            <Note icon={Lock}>볼 수 없는 프로젝트의 칸 {r.hiddenSectionCount}개는 내용을 숨겼어요.</Note>
          )}
          {r.note && (
            <div className={s.field}>
              <span>공통 메모</span>
              <p className={s.readonly}>{r.note}</p>
            </div>
          )}
          <div className={s.reviewBar}>
            {r.status === 'CONFIRMED' ? (
              <Chip tone="brand" icon={Check}>
                확인함{r.confirmedBy ? ` · ${r.confirmedBy}` : ''}
              </Chip>
            ) : r.canConfirm ? (
              <Button icon={Check} onClick={confirm} disabled={busy}>
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
      )}
    </Loadable>
  )
}
