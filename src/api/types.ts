// 명세 공통 타입 (docs/api/README.md)
export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export type MemberRef = {
  memberId: number
  name: string
  memberType: 'PROFESSOR' | 'STUDENT' | 'INTERN'
  status: 'ACTIVE' | 'GRADUATED' | 'LEFT'
  photoUrl: string | null
}

export type TaskRef = { taskKey: string; title: string; status: string }

/** '2026-11-17' / ISO 시각 → '2026.11.17' */
export const dotDate = (d: string | null | undefined) => (d ? d.slice(0, 10).replace(/-/g, '.') : '')

/** ISO 시각 → '방금' · 'N분 전' · 'N시간 전' · '어제' · 'M/D' */
export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const min = Math.round((now - t) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}시간 전`
  if (h < 48) return '어제'
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
