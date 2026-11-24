// 우주 테마: 별똥별 — 화면 뒤(본문 카드 뒤) 밤하늘에 몇 초마다 하나씩 떨어진다.
// 출발 자리 · 각도 · 빠르기는 그때그때 다르고, 가끔 더 밝고 긴 것이 떨어진다.
// 망원경을 누르면(Playful → emitFx 'meteors') 한꺼번에 여러 개가 쏟아진다.
// 탭을 숨기면 새로 만들지 않고, 떨어지는 것이 없으면 그리기를 멈춘다 (가만히 있을 때 CPU 를 쓰지 않는다).
import { useEffect, useRef } from 'react'
import { onFx } from './fx'
import s from './ThemeObjects.module.css'

type Meteor = { x: number; y: number; vx: number; vy: number; len: number; life: number; max: number; bright: boolean; delay: number }

const EVERY_MIN_MS = 3500 // 다음 별똥별까지 최소 · 최대 간격
const EVERY_MAX_MS = 9000
const BRIGHT_CHANCE = 0.15 // 밝은 별똥별이 나올 확률

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** 별똥별 하나: 대개 오른쪽 위에서 왼쪽 아래로, 셋에 하나는 반대로. top = 출발 높이의 아래 끝 (화면 높이 비율) */
function makeMeteor(w: number, h: number, bright: boolean, delay = 0, top = 0.45): Meteor {
  const leftward = Math.random() < 0.7
  const ang = rnd(22, 42) * (Math.PI / 180) // 수평에서 아래로 기운 각도
  const speed = bright ? rnd(13, 17) : rnd(8, 13) // px/장면
  return {
    x: leftward ? rnd(w * 0.25, w * 1.05) : rnd(-w * 0.05, w * 0.75),
    y: rnd(-20, h * top),
    vx: Math.cos(ang) * speed * (leftward ? -1 : 1),
    vy: Math.sin(ang) * speed,
    len: bright ? rnd(170, 240) : rnd(70, 140),
    life: 0,
    max: bright ? rnd(70, 95) : rnd(45, 70),
    bright,
    delay,
  }
}

export function ShootingStars() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let w = 0
    let h = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let meteors: Meteor[] = []
    let raf = 0
    const frame = () => {
      raf = 0
      ctx.clearRect(0, 0, w, h)
      meteors = meteors.filter((m) => m.life < m.max && m.x > -m.len - 50 && m.x < w + m.len + 50 && m.y < h + m.len)
      for (const m of meteors) {
        if (m.delay > 0) {
          m.delay--
          continue
        }
        m.life++
        m.x += m.vx
        m.y += m.vy
        const t = m.life / m.max
        // 처음엔 빨리 밝아지고, 끝 30% 동안 사그라든다
        const a = Math.min(1, t / 0.12) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1)
        const sp = Math.hypot(m.vx, m.vy)
        const tx = m.x - (m.vx / sp) * m.len * Math.min(1, t * 2.5)
        const ty = m.y - (m.vy / sp) * m.len * Math.min(1, t * 2.5)
        // 꼬리: 머리에서 흰빛 → 보랏빛 → 투명
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty)
        g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`)
        g.addColorStop(0.25, `rgba(221,214,254,${0.55 * a})`)
        g.addColorStop(1, 'rgba(139,92,246,0)')
        ctx.strokeStyle = g
        ctx.lineCap = 'round'
        ctx.lineWidth = m.bright ? 2.6 : 1.5
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(tx, ty)
        ctx.stroke()
        // 머리: 밝은 점 + 번지는 빛
        const hr = m.bright ? 9 : 5
        const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, hr)
        hg.addColorStop(0, `rgba(255,255,255,${a})`)
        hg.addColorStop(0.35, `rgba(233,229,245,${0.6 * a})`)
        hg.addColorStop(1, 'rgba(167,139,250,0)')
        ctx.fillStyle = hg
        ctx.beginPath()
        ctx.arc(m.x, m.y, hr, 0, Math.PI * 2)
        ctx.fill()
      }
      if (meteors.length > 0) raf = requestAnimationFrame(frame)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    // 몇 초마다 하나 (숨긴 탭에서는 건너뛴다)
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible' && w > 0) {
          meteors.push(makeMeteor(w, h, Math.random() < BRIGHT_CHANCE))
          kick()
        }
        schedule()
      }, rnd(EVERY_MIN_MS, EVERY_MAX_MS))
    }
    schedule()

    // 망원경: 여러 개가 조금씩 엇갈려 쏟아진다
    const off = onFx((fx) => {
      if (fx.kind !== 'meteors' || document.visibilityState !== 'visible') return
      const n = fx.n ?? 5
      // 카드 뒤에 가려지지 않게 화면 아래쪽까지 고루 흩는다
      for (let i = 0; i < n; i++) meteors.push(makeMeteor(w, h, i === 0, i * 7 + Math.floor(Math.random() * 5), 0.85))
      kick()
    })

    window.addEventListener('resize', resize)
    return () => {
      clearTimeout(timer)
      if (raf) cancelAnimationFrame(raf)
      off()
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className={s.meteors} aria-hidden />
}
