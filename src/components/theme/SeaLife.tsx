// 바다 테마: 헤엄치는 생물 — 원래 놓인 자리에서 출발해 그 자리(slot) 안을 돌아다닌다.
//   물고기 · 물고기 떼 : 물결치듯 오르내리며 가로질러 헤엄치고, 끝에 닿으면 몸을 돌린다.
//                        마우스가 다가오면 반대쪽으로 흩어졌다가 천천히 제 길로 돌아온다
//   고래 · 거북이      : 느릿하게 미끄러지듯 오간다 (거북이는 마우스를 조금 피한다)
//   해파리             : 몸을 오므렸다 펴며 오르내린다 (오므릴 때 올라간다)
//   불가사리           : 아주 천천히 기어가며 돈다
// 누르면 그 자리에서 방울이 떠오른다 (페이지 클릭은 막지 않는다).
// 그리기 고리는 fx.ts 의 tick 하나를 같이 쓰고, 숨긴 탭에서는 브라우저가 멈춘다.
import { useEffect, useRef, type CSSProperties } from 'react'
import { emitFx, hitImage, pointer, tick, trackPointer } from './fx'

export type SwimKind = 'fish' | 'school' | 'whale' | 'turtle' | 'jelly' | 'star'

type Cfg = {
  /** 앞으로 가는 빠르기(px/초). 해파리는 위아래 */
  speed: number
  /** 물결치는 폭(px) · 빠르기(라디안/초) */
  amp: number
  wave: number
  /** 이 거리(px) 안으로 마우스가 오면 피한다 (0 = 안 피함) */
  flee: number
  /** 원래 자리에서 양옆으로 이만큼(px)까지만 다닌다 (없으면 자리 끝까지) */
  roam?: number
  /** 그림이 오른쪽을 보고 있는지 (고래). 아니면 왼쪽 */
  right?: boolean
}
const CFG: Record<SwimKind, Cfg> = {
  fish: { speed: 34, amp: 5, wave: 2.4, flee: 110 },
  school: { speed: 26, amp: 7, wave: 1.5, flee: 150 },
  whale: { speed: 13, amp: 5, wave: 0.55, flee: 0, right: true },
  turtle: { speed: 11, amp: 4, wave: 0.7, flee: 90 },
  jelly: { speed: 9, amp: 6, wave: 0.5, flee: 80, roam: 46 },
  star: { speed: 0, amp: 0, wave: 0, flee: 0 },
}
const PAD = 6 // 자리 끝에서 이만큼 떨어져 돈다
const FLEE_PUSH = 1100 // 마우스를 피해 밀려나는 힘 (px/초²)
const FLEE_MAX = 110 // 피해서 길에서 벗어나는 최대 거리(px)

/** 번호로 늘 같은 값 (0~1) — 새로 고쳐도 같은 자리 · 같은 방향에서 출발 */
const seeded = (i: number, n: number) => {
  const v = Math.sin(i * 91.17 + n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

/** roam: 원래 자리에서 양옆(해파리는 위아래)으로 이만큼(px)까지만 다닌다 — 카드 글자 위에 놓인 것은 좁게 둔다 */
export function Swimmer({ src, kind, seed, roam, className, style }: { src: string; kind: SwimKind; seed: number; roam?: number; className: string; style: CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (!img) return
    const c = { ...CFG[kind], roam: roam ?? CFG[kind].roam }
    const untrack = trackPointer()
    // 다닐 수 있는 범위 (원래 자리에서 벗어날 수 있는 거리)
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    let slot: DOMRect | null = null
    let measuredAt = -1e9
    const measure = (now: number) => {
      measuredAt = now
      const parent = img.offsetParent as HTMLElement | null
      if (!parent) return
      slot = parent.getBoundingClientRect()
      const l = img.offsetLeft
      const t = img.offsetTop
      const w = img.offsetWidth
      const h = img.offsetHeight
      minX = Math.min(0, -l + PAD)
      maxX = Math.max(0, parent.clientWidth - l - w - PAD)
      minY = Math.min(0, -t + PAD)
      maxY = Math.max(0, parent.clientHeight - t - h - PAD)
      if (c.roam) {
        minX = Math.max(minX, -c.roam)
        maxX = Math.min(maxX, c.roam)
        minY = Math.max(minY, -c.roam)
        maxY = Math.min(maxY, c.roam)
      }
    }

    let x = 0 // 길 위의 자리 (원래 자리 기준)
    let y = 0
    let dir = seeded(seed, 1) < 0.5 ? -1 : 1 // -1 = 왼쪽으로, 1 = 오른쪽으로
    let face = dir // 몸 돌리는 중간값 (-1 ~ 1)
    let t = seeded(seed, 2) * 100
    let fx = 0 // 마우스를 피해 벗어난 만큼
    let fy = 0
    let fvx = 0
    let fvy = 0
    let boost = 0 // 놀라서 빨라진 정도 (0 ~ 1)

    const step = (dt: number, now: number) => {
      if (now - measuredAt > 1000) measure(now)
      t += dt

      // 마우스를 피한다: 가까울수록 세게 밀려나고, 그쪽에서 몸을 돌려 달아난다
      if (c.flee && pointer.seen && slot) {
        const cx = slot.left + img.offsetLeft + img.offsetWidth / 2 + x + fx
        const cy = slot.top + img.offsetTop + img.offsetHeight / 2 + y + fy
        const dx = cx - pointer.x
        const dy = cy - pointer.y
        const d = Math.hypot(dx, dy)
        if (d < c.flee && d > 0.1) {
          const k = (1 - d / c.flee) * FLEE_PUSH * dt
          fvx += (dx / d) * k
          fvy += (dy / d) * k
          if (kind !== 'jelly' && Math.abs(dx) > 4) dir = dx > 0 ? 1 : -1
          boost = Math.min(1, boost + dt * 4)
        }
      }
      // 다시 무리로: 벗어난 만큼 천천히 제 길로 돌아온다
      fvx += (-1.6 * fx - 2.2 * fvx) * dt
      fvy += (-1.6 * fy - 2.2 * fvy) * dt
      fx = Math.max(-FLEE_MAX, Math.min(FLEE_MAX, fx + fvx * dt))
      fy = Math.max(-FLEE_MAX, Math.min(FLEE_MAX, fy + fvy * dt))
      boost = Math.max(0, boost - dt * 0.6)

      let rot = 0
      let sx = 1
      let sy = 1
      if (kind === 'jelly') {
        // 오므렸다(pulse > 0) 펴며, 오므릴 때 위로 쭉 올라간다. 위 · 아래 끝에 닿으면 방향을 바꾼다
        const pulse = Math.sin(t * 2.6)
        sx = 1 + pulse * 0.07
        sy = 1 - pulse * 0.07
        const up = dir < 0
        const v = up ? c.speed * (0.3 + Math.max(0, pulse) * 2.2) : c.speed * 0.55
        y += (up ? -v : v) * dt
        if (y < minY) {
          y = minY
          dir = 1
        } else if (y > maxY) {
          y = maxY
          dir = -1
        }
        x = Math.sin(t * c.wave) * c.amp
        rot = Math.sin(t * c.wave * 1.3) * 4
      } else if (kind === 'star') {
        // 불가사리: 제자리 근처를 아주 천천히 기어가며 돈다
        x = Math.sin(t * 0.16) * 12
        y = Math.sin(t * 0.11) * 2
        rot = Math.sin(t * 0.13) * 22
      } else {
        const speed = c.speed * (1 + boost * 1.8)
        x += dir * speed * dt
        // 끝에 닿으면 몸을 돌린다
        if (x + fx < minX && dir < 0) dir = 1
        else if (x + fx > maxX && dir > 0) dir = -1
        x = Math.max(minX - FLEE_MAX, Math.min(maxX + FLEE_MAX, x))
        y = Math.sin(t * c.wave) * c.amp
        // 오르내리는 쪽으로 머리를 살짝 든다 (내려갈 때 앞쪽이 숙여진다)
        rot = Math.cos(t * c.wave) * c.amp * c.wave * (kind === 'whale' ? 1.6 : 0.5) * dir
        // 몸 돌리기: 그림을 납작하게 접었다 반대로 편다 (0.5초쯤)
        face += Math.max(-dt * 4, Math.min(dt * 4, dir - face))
        sx = c.right ? face : -face
        if (Math.abs(sx) < 0.08) sx = sx < 0 ? -0.08 : 0.08
      }
      img.style.transform = `translate(${(x + fx).toFixed(1)}px, ${(y + fy).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
    }
    const stop = tick(step)

    // 누르면 방울이 떠오른다 (클릭은 그대로 아래 화면으로 간다)
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !hitImage(img, e.clientX, e.clientY, true)) return
      emitFx({ kind: 'bubbles', x: e.clientX, y: e.clientY, n: kind === 'whale' ? 14 : 7 })
      boost = 1
    }
    window.addEventListener('pointerdown', down, { passive: true })
    return () => {
      stop()
      untrack()
      window.removeEventListener('pointerdown', down)
      img.style.transform = ''
    }
  }, [kind, seed, roam])

  return <img ref={ref} src={src} alt="" draggable={false} className={className} style={{ ...style, willChange: 'transform' }} />
}
