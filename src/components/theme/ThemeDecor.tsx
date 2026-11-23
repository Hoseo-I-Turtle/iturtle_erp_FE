// 테마의 장식 오브젝트 — 틀(카드 · 사이드바)의 색과는 따로 그린다.
// "오브젝트 1" 이 꺼져 있으면 아무것도 그리지 않는다. 그림 파일로 된 오브젝트는 ThemeObjects.tsx 가 맡는다.
// 모두 눌리지 않는(pointer-events: none) 층이고, 글자를 가리지 않게 카드 뒤 · 사이드바 메뉴 뒤에 깔린다.
//
// 지금 그림은 코드로 그린 단순한 도형이다. Penpot 에서 제대로 그린 그림이 나오면
// ThemeObjects.tsx 의 PLACEMENTS 에 그림 파일로 옮기면 된다.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { prefersReducedMotion, useTheme, type ThemeId } from '../../lib/theme'
import s from './ThemeDecor.module.css'

type Area = 'page' | 'sidebar'

/* ---------- 바다: 수면에서 내려오는 빛줄기 ---------- */
/**
 * 빛줄기 하나하나: 퍼지는 각도(도, 0 = 바로 아래) · 아래쪽 굵기(px) · 길이(px) · 밝기 · at.
 * 모두 고래 바로 위 한 점에서 부채꼴로 퍼진다.
 * at 은 이 빛줄기가 보이기 시작하는 밝기(0~1). 낮을수록 늘 보이고, 높을수록 마우스가 수면 가까이 가야 나타난다
 */
const BEAMS = [
  { angle: -8, width: 130, height: 400, alpha: 0.65, at: 0 },
  { angle: 24, width: 150, height: 430, alpha: 0.57, at: 0 },
  { angle: -38, width: 140, height: 420, alpha: 0.57, at: 0.05 },
  { angle: 52, width: 160, height: 470, alpha: 0.53, at: 0.1 },
  { angle: 8, width: 70, height: 340, alpha: 0.53, at: 0.3 },
  { angle: -22, width: 80, height: 360, alpha: 0.49, at: 0.35 },
  { angle: 38, width: 90, height: 400, alpha: 0.49, at: 0.4 },
  { angle: -54, width: 110, height: 440, alpha: 0.49, at: 0.5 },
  { angle: 64, width: 120, height: 520, alpha: 0.46, at: 0.55 },
  { angle: -66, width: 100, height: 460, alpha: 0.42, at: 0.65 },
  { angle: 72, width: 110, height: 600, alpha: 0.42, at: 0.7 },
]

/**
 * 마우스에 따라 달라지는 빛: 좌우 위치로 들어오는 각도가 기울고, 수면(화면 위)에 가까울수록 빛줄기가 늘고 진해진다.
 * 설정의 "마우스 효과"가 꺼져 있으면 가만히 있는다.
 */
function OceanRays() {
  const ref = useRef<HTMLDivElement>(null)
  const { effects } = useTheme()
  useEffect(() => {
    const el = ref.current
    if (!el || !effects || prefersReducedMotion()) return
    let frame = 0
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5 // -0.5(왼쪽) ~ 0.5(오른쪽)
        const depth = Math.min(1, Math.max(0, e.clientY / window.innerHeight)) // 0 = 수면
        el.style.setProperty('--ray-turn', `${(-x * 14).toFixed(1)}deg`)
        document.documentElement.style.setProperty('--ray-bright', (1 - depth).toFixed(2))
      })
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      cancelAnimationFrame(frame)
      el.style.removeProperty('--ray-turn')
      document.documentElement.style.removeProperty('--ray-bright')
    }
  }, [effects])
  return (
    <div ref={ref} className={s.rays}>
      <span className={s.surface} />
      {BEAMS.map((b, i) => (
        <span key={i} className={s.beam} style={{ width: b.width, height: b.height, marginLeft: -b.width / 2, '--beam-angle': `${b.angle}deg`, '--beam-alpha': b.alpha, '--beam-at': b.at } as CSSProperties} />
      ))}
    </div>
  )
}

/* ---------- 테마별 장식 ---------- */
const OCEAN: Record<Area, ReactNode> = {
  // 위에서 내려오는 빛줄기 (그림 파일이 아니라 CSS 로 그린다)
  page: <OceanRays />,
  sidebar: null,
}

/** 코드로 그린 장식은 그 테마의 "오브젝트 1" 에 속한다 */
const DECOR: Partial<Record<ThemeId, Record<Area, ReactNode>>> = { ocean: OCEAN }

/** area='page' 는 본문 뒤에 화면 가득, area='sidebar' 는 사이드바 안 아래쪽 */
export function ThemeDecor({ area }: { area: Area }) {
  const { active, objects } = useTheme()
  const d = DECOR[active]
  if (!objects[0] || !d) return null
  return (
    <div className={area === 'page' ? s.page : s.sidebar} aria-hidden>
      {d[area]}
    </div>
  )
}
