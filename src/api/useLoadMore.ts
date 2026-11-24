// 무한 스크롤 (정책 ERP-P32): 첫 페이지는 useResource 로 받고, 목록 끝에 닿으면 다음 page 를 불러 이어 붙인다.
//
//   const board = useThreadBoard(key)                       // 첫 페이지 (data 에 page · hasNext 가 들어 있다)
//   const more = useLoadMore(board, board.data?.hasNext, (d) => fetchMoreThreads(key, d))
//   ...목록 끝에 <LoadMore more={more} />
//
// 다음을 보려고 size 를 키워 처음부터 다시 부르지 않는다. 늘 page + 1 만 부른다.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from './client'
import type { Resource } from './useResource'

export type LoadMoreState = {
  hasNext: boolean
  loadingMore: boolean
  error: string | null
  loadMore: () => void
}

/**
 * @param resource 첫 페이지를 가진 리소스
 * @param hasNext  다음 페이지가 있는지 (목업 모드는 늘 false 로 준다)
 * @param more     지금 데이터를 받아 다음 페이지를 부르고, "최신 데이터에 이어 붙이는 함수"를 돌려준다.
 *                 부르는 사이에 목록이 처음부터 다시 불려 왔으면(page 가 달라짐) 그 함수가 붙이지 않고 그대로 돌려줘야 한다
 */
export function useLoadMore<T>(resource: Resource<T>, hasNext: boolean | undefined, more: (data: T) => Promise<(current: T) => T>): LoadMoreState {
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const moreRef = useRef(more)
  useLayoutEffect(() => {
    moreRef.current = more
  })

  const { data, setData } = resource
  const loadMore = useCallback(() => {
    if (data === undefined || !hasNext || busy.current) return
    busy.current = true
    setLoadingMore(true)
    setError(null)
    moreRef
      .current(data)
      .then((merge) => setData(merge))
      .catch((e) => setError(e instanceof ApiError ? e.message : '다음 목록을 불러오지 못했어요.'))
      .finally(() => {
        busy.current = false
        setLoadingMore(false)
      })
  }, [data, hasNext, setData])

  return { hasNext: !!hasNext, loadingMore, error, loadMore }
}

/** 어디까지 받았는지 — 무한 스크롤하는 목록 데이터에 넣는다 */
export type Paged = { page: number; hasNext: boolean }
/** PageResponse → Paged */
export const pagedOf = (p: { page: number; hasNext: boolean }): Paged => ({ page: p.page, hasNext: p.hasNext })
/** 다음 페이지를 한 번도 부르지 않는 목록 (목업) */
export const NOT_PAGED: Paged = { page: 0, hasNext: false }

/**
 * 다음 페이지를 받은 뒤의 "이어 붙이는 함수"를 만든다.
 * 부르는 사이에 목록이 처음부터 다시 불려 왔으면(page 가 달라짐) 붙이지 않는다.
 * @param from  다음 페이지를 부를 때의 데이터
 * @param merge 최신 데이터에 새 페이지를 붙이는 함수
 */
export const mergeNext =
  <T extends Paged>(from: T, merge: (current: T) => T) =>
  (current: T): T =>
    current.page === from.page ? merge(current) : current

/** 기존 목록 뒤에 새 항목을 붙인다. 이미 있는 id 는 거른다 (무한 스크롤 중 새 글이 들어와 한 칸씩 밀린 경우) */
export function appendUnique<T>(prev: T[], next: T[], id: (item: T) => string | number): T[] {
  const seen = new Set(prev.map(id))
  return [...prev, ...next.filter((item) => !seen.has(id(item)))]
}
