import type { KeyboardEvent, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { BellMenu } from './BellMenu'
import { NewMenu } from './NewMenu'
import { useGoSearch } from '../pages/search/useGoSearch'
import s from './layout.module.css'

type Props = {
  title: string
  subtitle?: string
  /** 오른쪽 버튼 교체. 없으면 "새로 만들기" 메뉴, null 이면 버튼 없음 */
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: Props) {
  const goSearch = useGoSearch()
  // 한글 조합 중의 Enter 는 글자를 확정하는 것이라 검색하지 않는다
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    void goSearch(e.currentTarget.value)
  }
  return (
    <header className={s.header}>
      <div className={s.headerTitle}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <label className={s.search}>
        <Search size={18} strokeWidth={2} />
        <input type="search" placeholder="공지, 작업, 자료, 구성원 검색" aria-label="통합 검색" enterKeyHint="search" onKeyDown={onKeyDown} />
      </label>
      <BellMenu />
      {action === undefined ? <NewMenu /> : action}
    </header>
  )
}
