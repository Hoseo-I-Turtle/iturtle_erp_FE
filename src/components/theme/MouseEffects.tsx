// 마우스에 반응하는 효과 — 화면 맨 위에 눌리지 않는 캔버스 한 장을 깔고 테마마다 다른 것을 그린다.
//   바다       : 마우스가 지나간 자리에서 방울이 떠오른다
//   크리스마스 : 마우스 주변에서 눈과 반짝이가 흩날린다
//   우주       : 마우스 주변에서 별빛이 반짝인다
//   다크       : 없음 (깔끔하게 쓰는 테마)
// 설정 › 테마의 "마우스 효과" 스위치로 끈다. 기기의 "움직임 줄이기"가 켜져 있으면 그리지 않는다.
// 틀의 색 · 장식 오브젝트와는 따로 돈다 (lib/theme.ts 의 data-effects).
import { useEffect, useRef } from 'react'
import { prefersReducedMotion, useTheme, type ThemeId } from '../../lib/theme'

type Particle = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; kind: 'bubble' | 'snow' | 'spark'; hue?: string }

const MAX_PARTICLES = 120

/** 테마별로 마우스가 움직일 때 만들 알갱이 */
function spawn(theme: ThemeId, x: number, y: number): Particle[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  if (theme === 'ocean')
    return [{ x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-0.25, 0.25), vy: rnd(-1.4, -0.6), r: rnd(3, 9), life: 0, max: rnd(60, 110), kind: 'bubble' }]
  if (theme === 'christmas')
    return [
      { x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-0.5, 0.5), vy: rnd(0.4, 1.3), r: rnd(1.5, 3.5), life: 0, max: rnd(50, 90), kind: 'snow' },
      ...(Math.random() < 0.35
        ? [{ x: x + rnd(-18, 18), y: y + rnd(-18, 18), vx: 0, vy: 0, r: rnd(3, 6), life: 0, max: rnd(20, 34), kind: 'spark' as const, hue: Math.random() < 0.5 ? '#ffd24d' : '#ffffff' }]
        : []),
    ]
  if (theme === 'space')
    return Math.random() < 0.6
      ? [{ x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: rnd(-0.15, 0.15), vy: rnd(-0.15, 0.15), r: rnd(2.5, 6), life: 0, max: rnd(24, 44), kind: 'spark', hue: Math.random() < 0.5 ? '#c4b5fd' : '#ffffff' }]
      : []
  return []
}

export function MouseEffects() {
  const { active, effects, info } = useTheme()
  const ref = useRef<HTMLCanvasElement>(null)
  const on = effects && info.hasEffects && !prefersReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!on || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let particles: Particle[] = []
    const mouse = { x: -999, y: -999, seen: false }
    let lastSpawn = 0
    const move = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.seen = true
      // 너무 많이 만들지 않게 35ms 에 한 번
      const now = performance.now()
      if (now - lastSpawn > 35 && particles.length < MAX_PARTICLES) {
        lastSpawn = now
        particles.push(...spawn(active, mouse.x, mouse.y))
      }
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const leave = () => {
      mouse.seen = false
    }

    let raf = 0
    const frame = () => {
      raf = 0
      ctx.clearRect(0, 0, w, h)

      particles = particles.filter((p) => p.life < p.max)
      for (const p of particles) {
        p.life++
        p.x += p.vx + (p.kind === 'bubble' ? Math.sin((p.life + p.r * 10) / 14) * 0.4 : 0)
        p.y += p.vy
        const t = p.life / p.max
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        if (p.kind === 'bubble') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${0.1 * alpha})`
          ctx.fill()
          ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`
          ctx.lineWidth = 1.2
          ctx.stroke()
          // 방울의 반짝이는 점
          ctx.beginPath()
          ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.18, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`
          ctx.fill()
        } else if (p.kind === 'snow') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`
          ctx.fill()
        } else {
          ctx.globalAlpha = alpha
          ctx.strokeStyle = p.hue ?? '#ffffff'
          ctx.lineWidth = 1.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p.x - p.r, p.y)
          ctx.lineTo(p.x + p.r, p.y)
          ctx.moveTo(p.x, p.y - p.r)
          ctx.lineTo(p.x, p.y + p.r)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }

      // 그릴 것이 남아 있을 때만 다음 장면을 예약한다 (가만히 있으면 쉰다)
      if (particles.length > 0) raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('resize', resize)
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('resize', resize)
      document.removeEventListener('pointerleave', leave)
      if (raf) cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, w, h)
    }
  }, [on, active])

  if (!on) return null
  return <canvas ref={ref} aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 60, pointerEvents: 'none' }} />
}
