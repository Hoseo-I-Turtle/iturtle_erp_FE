import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Info, Users } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, Loadable, Note, SectionHead } from '../../components/ui'
import { reportWeeks, useProjectWeek, type ProjectWeekRow } from '../../api/content'
import { useProjectHeader } from '../../api/projects'
import { useMe } from '../../api/members'
import { FIELDS } from '../reports/weekly/constants'
import { SectionComments } from '../reports/weekly/SectionComments'
import { tagsFor, useMemberTagMap } from '../../api/memberTags'
import { MemberTags } from './common'
import s from '../reports/WeeklyReportPage.module.css'

const STATE: Record<ProjectWeekRow['state'], { label: string; tone: 'brand' | 'tint' | 'warning' | 'muted' }> = {
  CONFIRMED: { label: '확인함', tone: 'brand' },
  SUBMITTED: { label: '제출', tone: 'tint' },
  LATE: { label: '늦은 제출', tone: 'warning' },
  MISSING: { label: '미제출', tone: 'muted' },
}

/**
 * 프로젝트의 주간 보고 (WR-8, 2026-11-20): 그 주 참여자의 제출 상태와 각자 쓴 이 프로젝트 칸.
 * 프로젝트 관리자 · report-review 는 칸에 코멘트를 단다 (확인은 주간 보고 화면에서 report-review 만).
 */
export function ProjectReportsPage() {
  const { key } = useParams()
  const tagMap = useMemberTagMap(key)
  const [weeks] = useState(reportWeeks)
  const [idx, setIdx] = useState(weeks.length - 1)
  const week = weeks[idx]
  const data = useProjectWeek(key, week.weekStartOn)
  const project = useProjectHeader(key).data
  const me = useMe().data
  // 목업(roles null)은 따지지 않는다. 서버가 다시 확인한다 (WeeklyReportCommentPolicy)
  const canComment = me?.roles == null || me.roles.includes('report-review') || project?.myRole === 'MANAGER'

  return (
    <Card className={s.main}>
      <div className={s.top}>
        <SectionHead icon={Users} title={`${week.label} 주간 보고`} />
        <span className={s.grow} />
        <span className={s.hint}>{week.range}</span>
        <Button variant="icon" icon={ChevronLeft} aria-label="이전 주" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} />
        <Button variant="icon" icon={ChevronRight} aria-label="다음 주" onClick={() => setIdx(Math.min(weeks.length - 1, idx + 1))} disabled={idx === weeks.length - 1} />
      </div>
      <Loadable resource={data} label="프로젝트 주간 보고">
        {(d) => (
          <>
            {!d.target && <Note icon={Info}>진행 중인 프로젝트가 아니라 이번 주 주간 보고 대상이 아니에요. 제출된 칸만 보여요.</Note>}
            <p className={s.hint}>
              제출 {d.counts.submitted} · 늦은 제출 {d.counts.late} · 미제출 {d.counts.missing} — 참여자 가운데 주간 보고를 쓰는 사람(report-write)만 세요.
            </p>
            {d.rows.length === 0 && <Empty>이 주에 보고를 쓸 참여자가 없어요.</Empty>}
            {d.rows.map((r) => (
              <section key={r.memberId} className={s.section}>
                <div className={s.sectionHead}>
                  <Avatar name={r.name} size={26} />
                  <strong>{r.name}</strong>
                  <span className={s.sectionKey}>{r.role === 'MANAGER' ? '프로젝트 관리자' : '참여자'}</span>
                  <MemberTags tags={tagsFor(tagMap.data, r.memberId, r.name)} />
                  <span className={s.grow} />
                  <Chip tone={STATE[r.state].tone}>{STATE[r.state].label}</Chip>
                </div>
                {r.section && (
                  <div className={s.sectionBody}>
                    {FIELDS.map(({ key: field, label }) => (
                      <div key={field} className={s.field}>
                        <span>{label}</span>
                        <p className={s.readonly}>{r.section![field] || '—'}</p>
                      </div>
                    ))}
                    {r.reportId && key && (
                      <SectionComments reportId={r.reportId} projectKey={key.toUpperCase()} meName={me?.name ?? '나'} canWrite={canComment} />
                    )}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </Loadable>
    </Card>
  )
}
