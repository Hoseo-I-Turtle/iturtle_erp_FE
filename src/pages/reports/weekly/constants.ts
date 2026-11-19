import type { ReportFields } from '../../../api/content'

export const FIELDS: { key: keyof ReportFields; label: string }[] = [
  { key: 'done', label: '이번 주 한 일' },
  { key: 'next', label: '다음 주 계획' },
  { key: 'issues', label: '이슈 · 도움 필요' },
]

export const STATE_LABEL = { SUBMITTED: '제출', LATE: '늦은 제출', MISSING: '미제출' } as const

export type SubmissionState = keyof typeof STATE_LABEL
