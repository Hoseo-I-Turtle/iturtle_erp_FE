import type { ReportFields, ReportSectionView } from '../../../api/content'

export const FIELDS: { key: keyof ReportFields; label: string }[] = [
  { key: 'done', label: '이번 주 한 일' },
  { key: 'next', label: '다음 주 계획' },
  { key: 'issues', label: '이슈 · 도움 필요' },
]

/** 칸이 제출할 수 있게 찼는지 (한 일 · 계획). 진행 중이 아닌 남은 칸(detached)은 필수가 아니다 */
export const sectionReady = (x: ReportSectionView) => x.detached || (x.fields.done.trim() !== '' && x.fields.next.trim() !== '')

export const STATE_LABEL = { SUBMITTED: '제출', LATE: '늦은 제출', MISSING: '미제출' } as const

export type SubmissionState = keyof typeof STATE_LABEL
