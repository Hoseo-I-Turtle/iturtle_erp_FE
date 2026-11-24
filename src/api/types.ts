// 명세 공통 타입 (docs/api/README.md 1.3 · 1.4)

/** common-code PageResponse. page 는 0 부터 */
export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

/** 백엔드 MemberType · MemberStatus (member 모듈 enums) */
export type MemberTypeCode = 'PROFESSOR' | 'STUDENT' | 'INTERN'
export type MemberStatusCode = 'ACTIVE' | 'ON_LEAVE' | 'GRADUATED' | 'LEFT'

/** MemberRefResponse */
export type MemberRef = {
  memberId: number
  name: string
  memberType: MemberTypeCode
  status: MemberStatusCode
  photoUrl: string | null
}

export type TaskRef = { taskKey: string; title: string; status: string }

/** 목록 API 의 최대 size (NFR-PER-03) */
export const MAX_PAGE_SIZE = 100

/**
 * 페이지를 끝까지 이어 받는다 (화면이 전체를 한 번에 그릴 때). 너무 많아지지 않게 maxPages 에서 멈춘다.
 * @param fetchPage page 번호(0부터)를 받아 그 페이지를 돌려주는 함수
 */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<PageResponse<T>>, maxPages = 10): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(page)
    all.push(...res.content)
    if (!res.hasNext) break
  }
  return all
}

/**
 * 응답이 { 덧붙인 값, page: PageResponse } 처럼 감싸여 올 때 페이지를 끝까지 이어 받는다 (화면이 전체를 한 번에 다뤄야 할 때 — 정책 ERP-P32 의 예외).
 * @returns first: 첫 응답(개수 같은 덧붙인 값을 읽는다), content: 모든 페이지의 항목
 */
export async function fetchEveryPage<R, T>(
  fetchPage: (page: number) => Promise<R>,
  pageOf: (response: R) => PageResponse<T>,
  maxPages = 10,
): Promise<{ first: R; content: T[] }> {
  const first = await fetchPage(0)
  const content = [...pageOf(first).content]
  for (let page = 1, more = pageOf(first).hasNext; more && page < maxPages; page++) {
    const next = pageOf(await fetchPage(page))
    content.push(...next.content)
    more = next.hasNext
  }
  return { first, content }
}

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
