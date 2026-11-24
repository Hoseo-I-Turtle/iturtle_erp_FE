import { useEffect, useRef } from 'react'
import type { LoadMoreState } from '../../api/useLoadMore'
import s from './LoadMore.module.css'

/**
 * 무한 스크롤의 끝 표시 — 목록 맨 아래에 둔다. 화면에 들어오면 다음 페이지를 부른다.
 * 실패하면 저절로 다시 부르지 않고 "다시 시도" 버튼을 보여 준다.
 */
export function LoadMore({ more }: { more: LoadMoreState }) {
  const ref = useRef<HTMLDivElement>(null)
  const { hasNext, loadingMore, error, loadMore } = more

  useEffect(() => {
    const el = ref.current
    if (!el || !hasNext || loadingMore || error) return
    // loadMore 는 목록이 바뀔 때마다 새로 만들어진다 → 다시 지켜보기 시작하고, 끝 표시가 아직 화면 안이면 바로 이어서 부른다
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNext, loadingMore, error, loadMore])

  if (!hasNext) return null
  return (
    <div ref={ref} className={s.more} aria-live="polite">
      {error ? (
        <>
          <span className={s.err}>{error}</span>
          <button type="button" className={s.retry} onClick={loadMore}>
            다시 시도
          </button>
        </>
      ) : (
        <span>불러오는 중…</span>
      )}
    </div>
  )
}
