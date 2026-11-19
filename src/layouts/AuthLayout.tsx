import type { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import s from './AuthLayout.module.css'

/** 로그인 · 비밀번호 변경: 왼쪽 그라디언트 + 로고, 오른쪽 카드 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={s.page}>
      <aside className={s.brand}>
        <span className={s.mark}>
          <FlaskConical size={32} />
        </span>
        Iturtle
      </aside>
      <main className={s.main}>
        <div className={s.card}>{children}</div>
      </main>
    </div>
  )
}
