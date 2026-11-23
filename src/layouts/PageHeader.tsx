import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BellMenu } from './BellMenu'
import { NewMenu } from './NewMenu'
import s from './layout.module.css'

type Props = {
  title: string
  subtitle?: string
  /** 오른쪽 버튼 교체. null이면 버튼 없음 */
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: Props) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 검색 결과 화면에서는 지금 찾은 말을 그대로 보여 준다
  const [q, setQ] = useState(params.get('q') ?? '')
  return (
    <header className={s.header}>
      <div className={s.headerTitle}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <form
        className={s.search}
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <Search size={18} strokeWidth={2} />
        <input type="search" placeholder="공지, 작업, 자료, 구성원 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="통합 검색" />
      </form>
      <BellMenu />
      {action === undefined ? <NewMenu /> : action}
    </header>
  )
}
