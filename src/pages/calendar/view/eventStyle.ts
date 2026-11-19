import { KIND_META, LAYER_META, type CalEvent } from '../../../mocks/calendar'

/** 일정 칩 색 — 공용은 종류 색, 나머지는 레이어 색 */
export function chipStyle(e: CalEvent) {
  if (e.layer === 'public') {
    const c = KIND_META[e.kind].color
    return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }
  }
  if (e.layer === 'personal') return { background: 'rgba(128,170,211,0.35)', color: 'var(--brand-500)' }
  if (e.layer === 'member') return { background: '#eef2f6', color: 'var(--text-disabled)' }
  return { background: '#eef2f6', color: 'var(--text-muted)' }
}
export function barColor(e: CalEvent) {
  return e.layer === 'public' ? KIND_META[e.kind].color : LAYER_META[e.layer].color
}
export function eventMeta(e: CalEvent) {
  return [
    e.time ?? '하루 종일',
    LAYER_META[e.layer].short,
    e.place,
    e.attendees && `참석 ${e.attendees}명`,
    e.note,
  ]
    .filter(Boolean)
    .join(' · ')
}
