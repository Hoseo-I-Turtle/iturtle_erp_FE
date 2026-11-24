// 우주 테마: 만지면 반응하는 오브젝트 (은하 · 성운은 ThemeObjects 가 CSS 로 돌린다)
//   지구       : 마우스가 닿으면 흔들리고, 누르면 한 바퀴 돈다
//   위성       : 끌어서 던질 수 있다. 놓으면 제자리를 축으로 빙 돌며 돌아온다 · 가만히 있을 때는 둥실 뜬다
//   로켓       : 누르면 부르르 떨다 연기를 뿜으며 날아가고, 잠시 뒤 위에서 내려와 다시 앉는다
//   혜성       : 누르면 꼬리 반대쪽으로 쏜살같이 날아갔다가 잠시 뒤 다시 나타난다
//   망원경     : 마우스가 닿으면 살짝 기울고, 누르면 하늘에 별똥별이 쏟아진다
//   잠든 거북이 : 숨 쉬듯 오르내리고, 마우스가 닿으면 움찔 깨며 z 가 떠오른다
//   인사 거북이 : 마우스가 닿으면 손을 흔든다
//   반짝이     : 마우스가 닿으면 반짝 커지고, 누르면 불꽃이 튄다
// 테마 층은 눌리지 않으므로 창에 단 듣개로 마우스 자리를 직접 본다(fx.ts 의 hitImage).
// 화면의 버튼 · 카드가 덮고 있는 자리에서는 반응하지 않는다. 페이지 클릭을 막는 것은 위성을 집을 때(pointerdown)뿐이다.
import { useEffect, useRef, type CSSProperties } from 'react'
import { emitFx, hitImage, tick, trackPointer } from './fx'
import s from './ThemeObjects.module.css'

export type PlayKind = 'earth' | 'satellite' | 'rocket' | 'comet' | 'telescope' | 'turtleSleep' | 'turtleHello' | 'sparkles'

/** 가만히 있을 때 도는 CSS 움직임 */
const IDLE: Partial<Record<PlayKind, string>> = { satellite: s.idleFloat, turtleSleep: s.idleBreathe }
/** 흔들 때 축: 그림 안의 자리 */
const ORIGIN: Partial<Record<PlayKind, string>> = { turtleHello: '50% 92%', telescope: '50% 96%', turtleSleep: '50% 100%' }

const HOVER_GAP_MS = 50 // 마우스가 닿았는지 이 간격으로만 본다
const DRAG_START_PX = 5 // 이만큼 움직여야 끌기로 본다 (덜 움직이면 누른 것)

/** 그림을 떼어 화면 맨 위(고정 층)에 띄운 복사본. 카드 · 머리글의 잘림(overflow) 밖으로 날아갈 수 있게 */
type Flyer = { el: HTMLImageElement; home: DOMRect }
function liftOff(img: HTMLImageElement): Flyer {
  const r = img.getBoundingClientRect()
  const cs = getComputedStyle(img)
  const el = img.cloneNode() as HTMLImageElement
  el.removeAttribute('class')
  el.removeAttribute('style')
  Object.assign(el.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: '0',
    zIndex: '59', // 마우스 효과 캔버스(60) 바로 아래
    pointerEvents: 'none',
    filter: cs.filter,
    willChange: 'transform',
    userSelect: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(el)
  img.style.visibility = 'hidden'
  return { el, home: r }
}
/** 복사본을 (dx, dy) 만큼 옮겨 그린다. 그동안 화면이 스크롤되면 원래 자리를 따라간다 */
function place(f: Flyer, img: HTMLImageElement, dx: number, dy: number, extra = '') {
  const r = img.getBoundingClientRect()
  f.el.style.transform = `translate(${(dx + r.left - f.home.left).toFixed(1)}px, ${(dy + r.top - f.home.top).toFixed(1)}px) ${extra}`
}
function land(f: Flyer | null, img: HTMLImageElement | null) {
  f?.el.remove()
  if (img) img.style.visibility = ''
}

export function Playful({ src, kind, className, style }: { src: string; kind: PlayKind; className: string; style: CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (!img) return
    const untrack = trackPointer()
    let anim: Animation | null = null
    /** 그림을 잠깐 움직인다 (이미 움직이는 중이면 force 일 때만 새로) */
    const play = (kf: Keyframe[], ms: number, opt: { force?: boolean; easing?: string; add?: boolean } = {}) => {
      if (!opt.force && anim?.playState === 'running') return
      anim?.cancel()
      anim = img.animate(kf, { duration: ms, easing: opt.easing ?? 'ease-in-out', composite: opt.add ? 'add' : 'replace' })
    }
    const at = (fx: number, fy: number) => {
      const r = img.getBoundingClientRect()
      return { x: r.left + r.width * fx, y: r.top + r.height * fy }
    }

    let flyer: Flyer | null = null
    let stopFly: (() => void) | null = null
    let timer = 0
    const busy = () => flyer !== null || timer !== 0

    /* ----- 마우스가 닿았을 때 ----- */
    const enter = () => {
      if (busy()) return
      if (kind === 'earth') play([{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0)' }], 1300)
      else if (kind === 'turtleHello')
        play([0, 9, -6, 9, -6, 5, 0].map((d) => ({ transform: `rotate(${d}deg)` })), 1500)
      else if (kind === 'turtleSleep') {
        play([0, -10, 0, -5, 0].map((y) => ({ transform: `translateY(${y}px)` })), 900, { add: true, easing: 'ease-out' })
        const p = at(0.62, 0.16)
        emitFx({ kind: 'zzz', x: p.x, y: p.y, n: 3 })
      } else if (kind === 'telescope') play([0, -5, 3, -1, 0].map((d) => ({ transform: `rotate(${d}deg)` })), 1100)
      else if (kind === 'sparkles')
        play([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.3) rotate(12deg)' }, { transform: 'scale(1) rotate(0)' }], 700, { easing: 'ease-out' })
      else if (kind === 'comet') play([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(0,0)' }], 800)
      else if (kind === 'rocket') play([0, -2, 2, -2, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })), 400)
    }

    /* ----- 눌렀을 때 ----- */
    const tap = (x: number, y: number) => {
      if (kind === 'earth') {
        play([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], 2200, { force: true, easing: 'cubic-bezier(.2,.75,.25,1)' })
        emitFx({ kind: 'sparks', x, y, n: 10 })
      } else if (kind === 'turtleHello') {
        play([0, 12, -8, 12, -8, 0].map((d) => ({ transform: `rotate(${d}deg)` })), 1200, { force: true })
        emitFx({ kind: 'sparks', x, y, n: 8 })
      } else if (kind === 'turtleSleep') {
        play([0, -16, 0, -6, 0].map((y) => ({ transform: `translateY(${y}px)` })), 800, { force: true, add: true, easing: 'ease-out' })
        const p = at(0.62, 0.16)
        emitFx({ kind: 'zzz', x: p.x, y: p.y, n: 5 })
      } else if (kind === 'sparkles') {
        play([{ transform: 'scale(1)' }, { transform: 'scale(1.45) rotate(20deg)' }, { transform: 'scale(1)' }], 600, { force: true, easing: 'ease-out' })
        const p = at(0.5, 0.5)
        emitFx({ kind: 'sparks', x: p.x, y: p.y, n: 22 })
      } else if (kind === 'telescope') {
        play([{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,3px)' }, { transform: 'translate(0,0)' }], 300, { force: true })
        const p = at(0.82, 0.12) // 렌즈
        emitFx({ kind: 'sparks', x: p.x, y: p.y, n: 8 })
        emitFx({ kind: 'meteors', x: p.x, y: p.y, n: 6 })
      } else if (kind === 'rocket') launch()
      else if (kind === 'comet') streak()
    }

    /* ----- 로켓: 떨다가 날아가고, 잠시 뒤 내려와 앉는다 ----- */
    const ROCKET_DIR = { x: 0.32, y: -0.95 } // 그림 속 로켓 머리 쪽
    const launch = () => {
      if (busy()) return
      play([0, -3, 3, -3, 3, -2, 2, 0].map((x) => ({ transform: `translate(${x}px, ${Math.abs(x) * 0.3}px)` })), 450, { force: true })
      timer = window.setTimeout(() => {
        timer = 0
        anim?.cancel()
        const f = (flyer = liftOff(img))
        let v = 40
        let d = 0
        let puffT = 0
        stopFly = tick((dt) => {
          v += 1500 * dt
          d += v * dt
          place(f, img, ROCKET_DIR.x * d, ROCKET_DIR.y * d)
          puffT += dt
          if (puffT > 0.035) {
            puffT = 0
            const r = f.el.getBoundingClientRect()
            emitFx({ kind: 'puffs', x: r.left + r.width * 0.42, y: r.top + r.height * 0.6, n: 2, dx: -ROCKET_DIR.x, dy: -ROCKET_DIR.y })
          }
          if (f.el.getBoundingClientRect().bottom < -40) {
            f.el.style.visibility = 'hidden'
            timer = window.setTimeout(comeBack, 3500)
            return false
          }
        })
      }, 450)
    }
    const comeBack = () => {
      timer = 0
      const f = flyer
      if (!f) return
      const from = -(img.getBoundingClientRect().bottom + 60)
      f.el.style.visibility = ''
      let t = 0
      const T = 1.9
      let puffT = 0
      stopFly = tick((dt) => {
        t = Math.min(T, t + dt)
        const k = 1 - Math.pow(1 - t / T, 3) // 점점 느려지며 내려앉는다
        place(f, img, 0, from * (1 - k))
        puffT += dt
        if (puffT > 0.06 && t < T * 0.95) {
          puffT = 0
          const r = f.el.getBoundingClientRect()
          emitFx({ kind: 'puffs', x: r.left + r.width * 0.42, y: r.top + r.height * 0.6, n: 1, dx: -ROCKET_DIR.x * 0.5, dy: 0.6 })
        }
        if (t >= T) {
          land(f, img)
          flyer = null
          play([0, 3, 0].map((y) => ({ transform: `translateY(${y}px)` })), 300, { force: true })
          return false
        }
      })
    }

    /* ----- 혜성: 머리 쪽으로 쏜살같이 날아가 사라졌다 다시 나타난다 ----- */
    const COMET_DIR = { x: -0.85, y: 0.53 } // 꼬리 → 머리
    const streak = () => {
      if (busy()) return
      anim?.cancel()
      const f = (flyer = liftOff(img))
      let v = 200
      let d = 0
      let t = 0
      stopFly = tick((dt) => {
        t += dt
        v += 2600 * dt
        d += v * dt
        place(f, img, COMET_DIR.x * d, COMET_DIR.y * d)
        f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, t - 0.25) / 0.6))
        if (t > 0.9) {
          land(f, img)
          flyer = null
          img.style.visibility = 'hidden'
          timer = window.setTimeout(() => {
            timer = 0
            img.style.visibility = ''
            play([{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }], 900, { force: true, easing: 'ease-out' })
          }, 2600)
          return false
        }
      })
    }

    /* ----- 위성: 끌어 던지면 제자리를 축으로 돌며 돌아온다 ----- */
    let drag: { sx: number; sy: number; moved: boolean; dx: number; dy: number; vx: number; vy: number; at: number } | null = null
    const orbitHome = (f: Flyer, ox: number, oy: number, vx0: number, vy0: number) => {
      let x = ox
      let y = oy
      // 던진 힘 + 제자리를 축으로 도는 옆 방향 속도 (곧장 오지 않고 빙 돌아온다)
      let vx = vx0 * 0.6 - oy * 1.4
      let vy = vy0 * 0.6 + ox * 1.4
      const K = 8 // 제자리로 끌어당기는 힘
      const C = 2.4 // 감쇠 (4~5초 안에 돌아온다)
      stopFly = tick((dt) => {
        vx += (-K * x - C * vx) * dt
        vy += (-K * y - C * vy) * dt
        x += vx * dt
        y += vy * dt
        place(f, img, x, y, `rotate(${Math.max(-25, Math.min(25, vx * 0.04)).toFixed(2)}deg)`)
        if (Math.hypot(x, y) < 1.5 && Math.hypot(vx, vy) < 10) {
          land(f, img)
          flyer = null
          return false
        }
      })
    }

    let lastHover = 0
    let inside = false
    const move = (e: PointerEvent) => {
      if (drag) {
        const d = drag
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_START_PX) {
          d.moved = true
          stopFly?.()
          if (!flyer) flyer = liftOff(img)
          anim?.cancel()
        }
        if (d.moved && flyer) {
          const now = performance.now()
          const ndx = e.clientX - d.sx
          const ndy = e.clientY - d.sy
          const k = Math.max(1, now - d.at) / 1000
          d.vx = d.vx * 0.5 + ((ndx - d.dx) / k) * 0.5
          d.vy = d.vy * 0.5 + ((ndy - d.dy) / k) * 0.5
          d.dx = ndx
          d.dy = ndy
          d.at = now
          place(flyer, img, ndx, ndy, `rotate(${Math.max(-20, Math.min(20, d.vx * 0.01)).toFixed(2)}deg)`)
        }
        return
      }
      const now = performance.now()
      if (now - lastHover < HOVER_GAP_MS) return
      lastHover = now
      const was = inside
      inside = hitImage(img, e.clientX, e.clientY, false)
      if (inside && !was) enter()
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (busy() && kind !== 'satellite')) return
      if (kind === 'satellite' && flyer) return // 돌아오는 중
      if (!hitImage(img, e.clientX, e.clientY, true)) return
      if (kind === 'satellite') {
        e.preventDefault() // 끄는 동안 글자가 선택되지 않게
        drag = { sx: e.clientX, sy: e.clientY, moved: false, dx: 0, dy: 0, vx: 0, vy: 0, at: performance.now() }
        return
      }
      tap(e.clientX, e.clientY)
    }
    const up = (e: PointerEvent) => {
      const d = drag
      if (!d) return
      drag = null
      if (!d.moved || !flyer) {
        play([0, -18, 12, -6, 0].map((r) => ({ transform: `rotate(${r}deg)` })), 1000, { force: true })
        emitFx({ kind: 'sparks', x: e.clientX, y: e.clientY, n: 8 })
        return
      }
      // 오래 멈췄다 놓으면 던진 힘이 없다
      const still = performance.now() - d.at > 120
      orbitHome(flyer, d.dx, d.dy, still ? 0 : d.vx, still ? 0 : d.vy)
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      untrack()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      stopFly?.()
      clearTimeout(timer)
      anim?.cancel()
      land(flyer, img)
    }
  }, [kind])

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      className={`${className} ${IDLE[kind] ?? ''}`}
      style={{ ...style, transformOrigin: ORIGIN[kind] ?? style.transformOrigin }}
    />
  )
}
