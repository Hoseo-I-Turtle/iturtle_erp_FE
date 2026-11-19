import type { MinuteSection } from '../../../api/content'

/** 회의록 본문 구역 (안건 · 논의 · 결정) */
export const SECTIONS: { key: MinuteSection; label: string }[] = [
  { key: 'agenda', label: '안건' },
  { key: 'discussion', label: '논의 내용' },
  { key: 'decisions', label: '결정 사항' },
]

export type MinuteDraft = Record<MinuteSection, string>
