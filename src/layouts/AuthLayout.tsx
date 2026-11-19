import type { ReactNode } from 'react'
import { BrandLogo } from '../components/ui'
import s from './AuthLayout.module.css'

/** 로그인 · 비밀번호 변경: 왼쪽 그라디언트 + 로고, 오른쪽 카드 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <aside className={s.brand}>
        <BrandLogo height={96} gap={34} />
      </aside>
      <main className={s.main}>
        <div className={s.card}>{children}</div>
      </main>
    </div>
  )
}
