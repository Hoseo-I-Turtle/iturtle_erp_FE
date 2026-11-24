import { Link } from 'react-router-dom'
import { Calendar, ClipboardList, Megaphone, SquareCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Chip, Loadable, SectionHead } from '../../../components/ui'
import type { Resource } from '../../../api/useResource'
import type { MustCheck, MustCheckKind } from '../../../mocks/home'
import { ThemeObjects } from '../../../components/theme/ThemeObjects'
import s from '../HomePage.module.css'

const KIND_ICON: Record<MustCheckKind, LucideIcon> = {
  notice: Megaphone,
  vote: SquareCheck,
  'schedule-poll': Calendar,
  report: ClipboardList,
}

/** 꼭 확인할 것 (필독 공지 · 투표 · 모임 날짜 · 보고) */
export function MustCheckSection({ mustCheck }: { mustCheck: Resource<MustCheck[]> }) {
  return (
    <section className={s.mustCheck}>
      <ThemeObjects slot="hero" />
      <SectionHead
        icon={TriangleAlert}
        title="꼭 확인할 것"
        extra={mustCheck.data && <Chip tone="count">{mustCheck.data.length}</Chip>}
        onDark
      />
      <Loadable resource={mustCheck} label="꼭 확인할 것">
        {(items) =>
          items.length === 0 ? (
            <p className={s.mustEmpty}>지금 꼭 확인할 것이 없어요.</p>
          ) : (
          <ul className={s.list}>
            {items.map((m) => {
              const Icon = KIND_ICON[m.kind]
              return (
                <li key={m.id} className={s.mustItem}>
                  <Icon size={20} strokeWidth={2} className={s.mustIcon} />
                  <Chip tone="brand">{m.label}</Chip>
                  <div className={s.rowText}>
                    <div className={s.mustTitle}>{m.title}</div>
                    <div className={s.mustMeta}>{m.meta}</div>
                  </div>
                  <Link to={m.to} className={s.mustAction}>
                    {m.action}
                  </Link>
                </li>
              )
            })}
          </ul>
          )
        }
      </Loadable>
    </section>
  )
}
