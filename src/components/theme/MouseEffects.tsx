// 마우스에 반응하는 효과 — 화면 맨 위에 눌리지 않는 캔버스 한 장을 깔고 테마마다 다른 것을 그린다.
//   바다       : 마우스가 지나간 자리에서 방울이 떠오른다
//   크리스마스 : 마우스가 지나간 자리와 하늘(배경)에서 눈이 떨어져, 그 아래 카드 윗변(data-snow-ledge)과 화면 바닥에 쌓인다.
//                쌓인 눈으로 눈덩이를 굴리고(경사면에서는 저절로 굴러 내려간다), 눈덩이 둘을 합치면 눈사람이 된다.
//                높은 데서 떨어진 눈덩이는 부서지고, 눈사람은 마우스를 바라보고 · 누르면 흔들리고 · 끌어 옮길 수 있고 · 높은 데서 떨어지면 흩어진다
//   우주       : 마우스 주변에서 별빛이 반짝인다. 본문 뒤 밤하늘에는 별똥별이 떨어진다 (ShootingStars)
// 오브젝트를 만졌을 때의 불꽃 · 로켓 연기 · zzz · 방울도 여기서 그린다 (Playful · SeaLife 가 fx.ts 의 emitFx 로 부탁한다).
//   다크       : 없음 (깔끔하게 쓰는 테마)
// 설정 › 테마의 "마우스 효과" 스위치로 끈다. 기기의 "움직임 줄이기"가 켜져 있으면 그리지 않는다.
// 틀의 색 · 장식 오브젝트와는 따로 돈다 (lib/theme.ts 의 data-effects).
import { useEffect, useRef } from 'react'
import { prefersReducedMotion, useTheme, type ThemeId } from '../../lib/theme'
import { onFx, type Fx } from './fx'
import { ShootingStars } from './ShootingStars'
import styles from './MouseEffects.module.css'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  /** puff = 로켓 연기 (커지며 옅어진다), z = 잠꼬대 글자 */
  kind: 'bubble' | 'snow' | 'spark' | 'puff' | 'z'
  hue?: string
  sky?: boolean
  snowDepth?: number
  /** 부서진 눈덩이 조각: 중력을 받는다 */
  g?: number
}

/* ---------- 쌓이는 눈 (크리스마스) ---------- */
const BIN = 3 // 쌓인 눈 높이를 이 너비(px)마다 하나씩 둔다
const PILE_MAX = 14 // 한 자리에 쌓이는 최대 높이(px)
const MELT_AFTER_MS = 15000 // 마지막으로 눈이 내린 뒤 이만큼 지나면 녹기 시작
const MELT_PER_FRAME = 0.012
const ROLL_MIN_DEPTH = 6 // 이만큼 쌓인 곳을 누르고 끌어야 눈덩이가 생긴다
const BALL_START_R = 4
const BALL_MAX_R = 26
const SNOWMAN_MIN_R = 10 // 이 크기 이상인 눈덩이 둘을 합치면 눈사람
const SLOPE_G = 0.45 // 경사면에서 눈덩이를 끌어내리는 힘
const ROLL_FRICTION = 0.93
const ROLL_STOP_SLOPE = 0.18 // 이보다 완만하고 느리면 멈춘다 (울퉁불퉁한 눈 위에서 끝없이 구르지 않게)
const SKY_EVERY = 3 // 이 프레임마다 하늘에서 눈송이 하나 (배경 눈도 쌓인다)
const SKY_DEPOSIT = 0.9 // 하늘 눈은 마우스 눈보다 조금 덜 쌓인다
/** 눈덩이: 놓인 자리(ledge)와 그 자리 왼쪽부터의 x. 들고 있을 때는 화면 좌표(hx, hy) */
type Ball = { ledge: Ledge | null; x: number; r: number; held: boolean; hx: number; hy: number; vx: number; vy: number; rolling: boolean; spin: number }
/** 눈사람: 아래부터 눈덩이 반지름 */
type Snowman = {
  ledge: Ledge | null
  x: number
  parts: number[]
  /** 흔들림(라디안)과 그 속도: 누르거나 착지하면 흔들린다 */
  wob: number
  wobV: number
  /** 들고 있거나 떨어지는 중이면 화면 좌표(밑바닥 가운데) */
  held: boolean
  hx: number
  hy: number
  vy: number
}
const BALL_BREAK_V = 9 // 이 속도(px/프레임) 이상으로 떨어지면 눈덩이가 부서진다 (≈ 80px 넘게 떨어졌을 때)
const SNOWMAN_BREAK_V = 11 // 눈사람은 이 속도 이상이면 눈덩이로 흩어진다
const CHUNK_G = 0.28
const POWDER_RELEASE_ACCELERATION = 9
const POWDER_SLIDE_ACCELERATION = 2.5
const POWDER_FRICTION = 0.88
const BODY_RELEASE_ACCELERATION = 7
const BALL_SLIDE_ACCELERATION = 2.5

/** 눈이 쌓이는 자리 하나: 카드 윗변(el) 또는 화면 바닥(el = null). 높이는 그 자리 왼쪽부터 BIN 간격 */
/** cover: 이 자리 위를 다른 것(메뉴 · 팝오버 · 알림 · 붙은 막대 등)이 덮고 있는 칸 (COVER_STEP 간격, 1 = 덮임) */
type Ledge = {
  el: Element | null
  h: number[]
  cover?: Uint8Array
  powder?: { looseness: number; drift: number }
}

/* ---------- 덮인 자리 (크리스마스) ----------
 * 캔버스는 본문 위에 깔려 있어, 그냥 두면 카드 위에 뜬 메뉴 · 팝오버 · 창 위로 눈 줄이 그어진다.
 * - 창(모달) · 서랍처럼 화면을 막으로 덮는 것이 열리면: 캔버스를 본문 아래로 내린다 → 쌓인 눈도 어두운 막 아래에 깔린다.
 *   그동안은 쌓이지도 녹지도 않고, 눈덩이 · 눈사람도 만질 수 없다 (닫으면 그대로 다시 보인다).
 * - 막 없이 뜨는 것(메뉴 · 팝오버 · 알림)은: 카드 윗변 위를 무엇이 덮고 있는지 몇 칸마다 짚어 보고, 덮인 칸은 그리지도 쌓지도 않는다.
 * 짚어 보는 일은 화면이 바뀔 때(MutationObserver) · 스크롤 · 크기 바꿈 · 가끔(COVER_EVERY_MS)만 한다 — 장면마다 하지 않는다.
 */
const COVER_STEP = 16
const COVER_MIN_MS = 200 // 덮인 자리를 이보다 자주 다시 짚지 않는다
const COVER_EVERY_MS = 1500 // 화면 변화 없이도 이만큼마다 다시 짚는다 (마우스를 올리면 뜨는 메뉴 등)
const MODAL_SEL = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], dialog[open]'

const isFixed = (el: Element) => getComputedStyle(el).position === 'fixed'

/** 화면을 거의 다 덮는 고정 막(창 뒤 막 · 서랍 뒤 막)에 속한 요소면 그 막 */
function fullCover(el: Element | null, w: number, h: number) {
  for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    if (!isFixed(e)) continue
    const r = e.getBoundingClientRect()
    return r.width >= w * 0.9 && r.height >= h * 0.9 ? e : null
  }
  return null
}

/** 창(모달)이 열려 있는지: 표시된 모달 요소, 또는 화면 다섯 곳이 모두 같은 고정 막에 덮여 있으면 */
function modalOpen(w: number, h: number) {
  for (const el of document.querySelectorAll(MODAL_SEL)) if (el.getClientRects().length > 0) return true
  let cover: Element | null = null
  for (const [fx, fy] of [[0.5, 0.5], [0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) {
    const c = fullCover(document.elementFromPoint(w * fx, h * fy), w, h)
    if (!c || (cover && c !== cover)) return false
    cover = c
  }
  return true
}

/** from 에서 위로 올라가며 container 를 품은 조상에 닿기 전에 떠 있는 요소(absolute · fixed · sticky)가 있는지 */
function floatsOver(from: Element, container: Element | null) {
  for (let e: Element | null = from; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    if (container && e.contains(container)) return false
    const p = getComputedStyle(e).position
    if (p === 'absolute' || p === 'fixed' || p === 'sticky') return true
  }
  return false
}

/** 카드 윗변(또는 화면 바닥)의 가로 x 자리가 다른 것에 덮여 있는지 */
function coveredAt(el: Element | null, x: number, top: number, h: number) {
  if (!el) {
    // 화면 바닥: 고정된 것(알림 등)이 바닥을 덮고 있으면
    for (let e = document.elementFromPoint(x, h - 2); e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (isFixed(e)) return true
    return false
  }
  // 카드 윗변 바로 안쪽이 그 카드가 아니면 무언가 카드 위에 떠 있다
  const yIn = top + 8
  if (yIn >= 0 && yIn < h) {
    const a = document.elementFromPoint(x, yIn)
    if (a && !el.contains(a)) return true
  }
  // 쌓인 눈이 그려질 윗변 바로 위를 떠 있는 것(메뉴 아랫부분 등)이 덮고 있으면
  const yUp = top - 6
  if (yUp >= 0 && yUp < h) {
    const b = document.elementFromPoint(x, yUp)
    if (b && !b.contains(el) && floatsOver(b, el)) return true
  }
  return false
}

/** 쌓인 눈의 i 번째 칸(BIN)이 덮여 있는지 */
const binCovered = (l: Ledge, i: number) => !!l.cover?.[Math.floor((i * BIN) / COVER_STEP)]

type Radius = [x: number, y: number]
type LedgeRect = {
  ledge: Ledge
  left: number
  top: number
  width: number
  leftRadius: Radius
  rightRadius: Radius
  clip?: { left: number; top: number; right: number; bottom: number }
}

type CardSnow = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  positioned: boolean
}

const SNOW_PAD_TOP = BALL_MAX_R * 6
const SNOW_PAD_BOTTOM = BALL_MAX_R + 6

function removeCardSnow(el: HTMLElement, snow: CardSnow) {
  snow.canvas.remove()
  if (snow.positioned) el.classList.remove(styles.snowAnchor)
}

function cornerRadius(value: string, width: number, height: number): Radius {
  const [x, y = x] = value.split(' ')
  const px = (part: string, basis: number) =>
    (parseFloat(part) || 0) * (part.endsWith('%') ? basis / 100 : 1)
  return [px(x, width), px(y, height)]
}

function ledgeTop(r: LedgeRect, x: number) {
  const [rx, ry] = x < r.leftRadius[0] ? r.leftRadius : r.rightRadius
  const edge = x < r.leftRadius[0] ? x : r.width - x
  if (rx === 0 || edge >= rx) return r.top
  const t = 1 - Math.max(0, edge) / rx
  return r.top + ry * (1 - Math.sqrt(1 - t * t))
}

const binCount = (r: LedgeRect) => Math.ceil(r.width / BIN)
const binCenter = (r: LedgeRect, i: number) => (i * BIN + Math.min((i + 1) * BIN, r.width)) / 2
const binAt = (r: LedgeRect, x: number) => Math.min(binCount(r) - 1, Math.floor(x / BIN))
const snowTop = (r: LedgeRect, x: number) => ledgeTop(r, x) - (r.ledge.h[binAt(r, x)] ?? 0)

// 접선이 너무 가파른 곳에서는 눈이 머물지 않고 가장자리 너머로 떨어진다.
function holdsSnow(r: LedgeRect, i: number) {
  const x = binCenter(r, i)
  return Math.abs(ledgeTop(r, x - 0.5) - ledgeTop(r, x + 0.5)) <= 0.9
}

/** 지금 화면에 보이는 카드 윗변 + 화면 바닥 */
type CardShape = Pick<LedgeRect, 'leftRadius' | 'rightRadius'> & {
  scrollports: HTMLElement[]
  width: number
  height: number
  measuredAt: number
}

function ledgeRects(ledges: Map<Element | null, Ledge>, shapes: WeakMap<Element, CardShape>, w: number, h: number, now: number) {
  const out: LedgeRect[] = []
  const portRects = new Map<HTMLElement, DOMRect>()
  for (const el of document.querySelectorAll<HTMLElement>('[data-snow-ledge]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 40 || r.height === 0 || r.bottom < 0 || r.top > h) continue
    let l = ledges.get(el)
    if (!l) ledges.set(el, (l = { el, h: [] }))
    let shape = shapes.get(el)
    if (!shape || shape.width !== r.width || shape.height !== r.height || now - shape.measuredAt > 120) {
      const style = getComputedStyle(el)
      const tl = cornerRadius(style.borderTopLeftRadius, r.width, r.height)
      const tr = cornerRadius(style.borderTopRightRadius, r.width, r.height)
      const bl = cornerRadius(style.borderBottomLeftRadius, r.width, r.height)
      const br = cornerRadius(style.borderBottomRightRadius, r.width, r.height)
      const scale = Math.min(1, r.width / (tl[0] + tr[0]), r.width / (bl[0] + br[0]),
        r.height / (tl[1] + bl[1]), r.height / (tr[1] + br[1]))
      const scrollports: HTMLElement[] = []
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent)
        if (parentStyle.overflowX !== 'visible' || parentStyle.overflowY !== 'visible') scrollports.push(parent)
      }
      shape = { width: r.width, height: r.height, measuredAt: now, scrollports,
        leftRadius: [tl[0] * scale, tl[1] * scale], rightRadius: [tr[0] * scale, tr[1] * scale] }
      shapes.set(el, shape)
    }
    const clip = { left: 0, top: 0, right: w, bottom: h }
    for (const port of shape.scrollports) {
      let bounds = portRects.get(port)
      if (!bounds) {
        bounds = port.getBoundingClientRect()
        portRects.set(port, bounds)
      }
      const left = bounds.left + port.clientLeft
      const top = bounds.top + port.clientTop
      clip.left = Math.max(clip.left, left)
      clip.top = Math.max(clip.top, top)
      clip.right = Math.min(clip.right, left + port.clientWidth)
      clip.bottom = Math.min(clip.bottom, top + port.clientHeight)
    }
    if (r.right < clip.left || r.left > clip.right || r.bottom < clip.top || r.top > clip.bottom) continue
    out.push({ ledge: l, left: r.left, top: r.top, width: r.width,
      leftRadius: shape.leftRadius, rightRadius: shape.rightRadius, clip })
  }
  let floor = ledges.get(null)
  if (!floor) ledges.set(null, (floor = { el: null, h: [] }))
  out.push({ ledge: floor, left: 0, top: h, width: w, leftRadius: [0, 0], rightRadius: [0, 0] })
  return out
}

function snowSlope(r: LedgeRect, x: number, radius: number) {
  const left = Math.max(0, x - radius * 0.6)
  const right = Math.min(r.width, x + radius * 0.6)
  return (snowTop(r, right) - snowTop(r, left)) / Math.max(1, right - left)
}

function ledgeVisibleAt(r: LedgeRect, x: number, y: number) {
  const c = r.clip
  return !c || (x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)
}

/** 쌓인 눈이 옆보다 너무 높으면 흘러내린다 */
function settle(r: LedgeRect) {
  const hs = r.ledge.h
  for (let i = 0; i < hs.length - 1; i++) {
    if (!holdsSnow(r, i) || !holdsSnow(r, i + 1)) continue
    const d = snowTop(r, binCenter(r, i + 1)) - snowTop(r, binCenter(r, i))
    if (Math.abs(d) > 4) {
      const m = d > 0 ? Math.min(hs[i] ?? 0, d * 0.2) : Math.max(-(hs[i + 1] ?? 0), d * 0.2)
      hs[i] = (hs[i] ?? 0) - m
      hs[i + 1] = (hs[i + 1] ?? 0) + m
    }
  }
}

/** Move depth between bins while loose snow still has support. At an unsupported edge it becomes a particle. */
function slidePowder(r: LedgeRect, elapsed: number, spill: (i: number, depth: number, velocity: number) => boolean) {
  const { h, powder } = r.ledge
  if (!powder) return
  const damping = POWDER_FRICTION ** elapsed
  powder.looseness *= damping
  powder.drift *= damping
  if (powder.looseness < 0.025 && Math.abs(powder.drift) < 0.04) {
    r.ledge.powder = undefined
    return
  }
  const count = binCount(r)
  const change = Array<number>(Math.min(count, h.length + 1)).fill(0)
  for (let i = 0; i < change.length; i++) {
    const depth = h[i] ?? 0
    if (depth < 0.07 || binCovered(r.ledge, i)) continue
    const x = binCenter(r, i)
    const y = snowTop(r, x)
    const left = i > 0 ? snowTop(r, binCenter(r, i - 1)) : y + BIN
    const right = i + 1 < count ? snowTop(r, binCenter(r, i + 1)) : y + BIN
    const slope = Math.max(-1.5, Math.min(1.5, (right - left) / (2 * BIN)))
    const velocity = powder.drift + slope * powder.looseness * 2.4
    if (Math.abs(velocity) < 0.12) continue
    const next = i + Math.sign(velocity)
    const amount = depth * Math.min(0.5, Math.abs(velocity) * elapsed / BIN)
    if (next < 0 || next >= count || !holdsSnow(r, next)) {
      if (spill(i, amount, velocity)) change[i] -= amount
    } else if (!binCovered(r.ledge, next)) {
      const accepted = Math.max(0, Math.min(amount, PILE_MAX - (h[next] ?? 0) - change[next]))
      change[i] -= accepted
      change[next] += accepted
    }
  }
  for (let i = 0; i < change.length; i++) {
    if (change[i]) h[i] = Math.max(0, (h[i] ?? 0) + change[i])
  }
}

const MAX_PARTICLES = 420

/** 테마별로 마우스가 움직일 때 만들 알갱이 */
function spawn(theme: ThemeId, x: number, y: number): Particle[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  if (theme === 'ocean')
    return [{ x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-0.25, 0.25), vy: rnd(-1.4, -0.6), r: rnd(3, 9), life: 0, max: rnd(60, 110), kind: 'bubble' }]
  if (theme === 'christmas')
    return [
      { x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-0.5, 0.5), vy: rnd(0.6, 1.4), r: rnd(1.5, 3.2), life: 0, max: 100000, kind: 'snow' },
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

/** 오브젝트가 부탁한 알갱이 (fx.ts 의 emitFx) */
function spawnFx(fx: Fx): Particle[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  const n = fx.n ?? 8
  const out: Particle[] = []
  for (let i = 0; i < n; i++) {
    if (fx.kind === 'sparks') {
      // 사방으로 튀었다가 느려지며 사라진다
      const a = rnd(0, Math.PI * 2)
      const sp = rnd(1.2, 3.6)
      out.push({ x: fx.x, y: fx.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(3, 7), life: 0, max: rnd(26, 46), kind: 'spark', hue: ['#ffffff', '#c4b5fd', '#fde68a'][i % 3], g: -0.02 })
    } else if (fx.kind === 'puffs') {
      // 뿜는 쪽(dx, dy)으로 퍼져 나가는 연기
      const dx = fx.dx ?? 0
      const dy = fx.dy ?? 1
      const sp = rnd(1.2, 2.6)
      out.push({ x: fx.x + rnd(-4, 4), y: fx.y + rnd(-4, 4), vx: dx * sp + rnd(-0.6, 0.6), vy: dy * sp + rnd(-0.4, 0.4), r: rnd(6, 11), life: 0, max: rnd(34, 56), kind: 'puff', hue: Math.random() < 0.5 ? '233,229,245' : '196,181,253' })
    } else if (fx.kind === 'zzz') {
      // z 가 하나씩 엇갈려 떠오르며 커진다 (처음 몇 장면은 안 보이게 life 를 음수로)
      out.push({ x: fx.x + i * 6, y: fx.y, vx: 0.25, vy: -0.55, r: 11 + i * 3, life: -i * 14, max: 70, kind: 'z' })
    } else if (fx.kind === 'bubbles') {
      out.push({ x: fx.x + rnd(-14, 14), y: fx.y + rnd(-8, 8), vx: rnd(-0.3, 0.3), vy: rnd(-1.8, -0.7), r: rnd(2.5, 8), life: 0, max: rnd(60, 110), kind: 'bubble' })
    }
  }
  return out
}

/**
 * 눈덩이가 지나간 자리의 눈을 깎는다: 바닥에 닿는 너비(반지름의 0.7배 양쪽) 안의 칸마다, 움직인 거리만큼 눈을 걷어 낸다.
 * 걷어 낸 눈만큼 눈덩이가 커진다 (넓이로 더해서 크기가 너무 빨리 늘지 않게). 돌려준 값 = 새 반지름
 */
function eatSnow(hs: number[], x: number, r: number, dist: number) {
  const from = Math.floor((x - r * 0.7) / BIN)
  const to = Math.floor((x + r * 0.7) / BIN)
  const bite = Math.min(0.35, 0.05 + Math.abs(dist) * 0.06) // 이번에 걷어 낼 비율
  let took = 0
  for (let i = from; i <= to; i++) {
    const v = hs[i] ?? 0
    if (v <= 0) continue
    const t = v * bite
    hs[i] = v - t
    took += t
  }
  return r >= BALL_MAX_R ? r : Math.min(BALL_MAX_R, Math.sqrt(r * r + took * BIN * 0.45))
}

/** 눈덩이: 흰 원 + 아래쪽 그늘 + 굴린 결(회전) */
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#d6e2ef')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.shadowColor = 'rgba(60,80,110,0.35)'
  ctx.shadowBlur = 4
  ctx.fill()
  ctx.shadowBlur = 0
  if (r > 6) {
    ctx.strokeStyle = 'rgba(170,190,215,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, r * 0.6, spin, spin + 1.2)
    ctx.stroke()
  }
}
/** 눈사람 머리: 숯 눈 · 당근 코 · 입 */
function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lx = 0, ly = 0) {
  // 눈동자는 마우스 쪽을 본다 (lx, ly: -1 ~ 1)
  ctx.fillStyle = '#1f2328'
  for (const dx of [-0.35, 0.35]) {
    ctx.beginPath()
    ctx.arc(x + dx * r + lx * r * 0.07, y - r * 0.15 + ly * r * 0.07, Math.max(1.2, r * 0.11), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#f08a24'
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.02)
  ctx.lineTo(x + r * 0.55, y + r * 0.12)
  ctx.lineTo(x, y + r * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1f2328'
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath()
    ctx.arc(x + k * r * 0.14, y + r * 0.45 - Math.abs(k) * r * -0.04, Math.max(0.8, r * 0.05), 0, Math.PI * 2)
    ctx.fill()
  }
}
/** 눈사람 몸통 단추 */
function drawButtons(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#1f2328'
  for (const dy of [-0.35, 0, 0.35]) {
    ctx.beginPath()
    ctx.arc(x, y + dy * r, Math.max(1, r * 0.08), 0, Math.PI * 2)
    ctx.fill()
  }
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
    const ledges = new Map<Element | null, Ledge>()
    let lastSnowAt = 0
    let rects: ReturnType<typeof ledgeRects> = []
    const shapes = new WeakMap<Element, CardShape>()
    const cardSnow = new Map<HTMLElement, CardSnow>()
    const frameContexts = new Map<Ledge, CanvasRenderingContext2D>()
    let previousFrameAt = 0
    let previousRects: LedgeRect[] = []
    let scrolled = false
    let ledgeVelocity = new Map<Ledge, { x: number; y: number; scroll: boolean }>()
    const balls: Ball[] = []
    let skyTick = 0
    const snowmen: Snowman[] = []
    let grab: Ball | null = null
    let lastPX = 0
    const rectOf = (l: Ledge | null) => rects.find((r) => r.ledge === l)

    // 붙어 있는 눈은 카드의 DOM 층에서 그린다. 브라우저가 스크롤을 합성할 때도 카드와 함께 움직인다.
    const attachedContext = (r: LedgeRect | undefined) => {
      const el = r?.ledge.el
      if (!r || !(el instanceof HTMLElement)) return ctx
      const already = frameContexts.get(r.ledge)
      if (already) return already
      let snow = cardSnow.get(el)
      if (!snow) {
        const style = getComputedStyle(el)
        // 카드 자체가 잘라내는 경우에는 기존 화면 층에서 그린다.
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return ctx
        const layer = document.createElement('canvas')
        const local = layer.getContext('2d')
        if (!local) return ctx
        const positioned = style.position === 'static'
        if (positioned) el.classList.add(styles.snowAnchor)
        layer.className = styles.cardSnow
        layer.setAttribute('aria-hidden', 'true')
        el.append(layer)
        snow = { canvas: layer, ctx: local, positioned }
        cardSnow.set(el, snow)
      }
      if (snow.positioned && !el.classList.contains(styles.snowAnchor)) el.classList.add(styles.snowAnchor)
      const layer = snow.canvas
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // The rectangle is in viewport coordinates. Convert the drawing back into card coordinates.
      const sx = r.width / Math.max(1, el.offsetWidth)
      const shape = shapes.get(el)
      const sy = (shape?.height ?? el.offsetHeight) / Math.max(1, el.offsetHeight)
      // 카드 옆이나 아래로 캔버스 영역이 튀어나오면 스크롤바가 생겨 카드 좌표가 다시 움직인다.
      const width = el.clientWidth
      const height = SNOW_PAD_TOP + Math.min(el.clientHeight, SNOW_PAD_BOTTOM + Math.ceil(Math.max(r.leftRadius[1], r.rightRadius[1]) / sy))
      const top = -SNOW_PAD_TOP - el.clientTop
      if (layer.style.top !== `${top}px`) layer.style.top = `${top}px`
      if (layer.style.height !== `${height}px`) layer.style.height = `${height}px`
      if (layer.width !== Math.ceil(width * dpr)) layer.width = Math.ceil(width * dpr)
      if (layer.height !== Math.ceil(height * dpr)) layer.height = Math.ceil(height * dpr)
      snow.ctx.setTransform(dpr / sx, 0, 0, dpr / sy,
        dpr * (-el.clientLeft - r.left / sx), dpr * (SNOW_PAD_TOP - r.top / sy))
      frameContexts.set(r.ledge, snow.ctx)
      return snow.ctx
    }

    // 창(모달)이 열려 있는지 · 덮인 자리. 화면이 바뀔 때만 다시 본다 (위의 "덮인 자리" 설명)
    let modal = false
    let modalSince = 0
    let coverAt = 0
    let coverDirty = true
    const computeCover = () => {
      for (const r of rects) {
        const n = Math.ceil(r.width / COVER_STEP)
        const c = new Uint8Array(n)
        for (let k = 0; k < n; k++) {
          // 실제 곡선 아래에서 가려진 곳을 확인한다
          const x = r.left + Math.min(r.width - 1, k * COVER_STEP + COVER_STEP / 2)
          if (x < 0 || x >= w) continue
          c[k] = coveredAt(r.ledge.el, x, ledgeTop(r, x - r.left), h) ? 1 : 0
        }
        r.ledge.cover = c
      }
    }
    const setModal = (next: boolean) => {
      if (next === modal) return
      modal = next
      const now = performance.now()
      if (next) {
        modalSince = now
        // 들고 있던 눈덩이 · 눈사람은 놓는다
        if (grab || grabMan) up()
      } else {
        lastSnowAt += now - modalSince // 창이 열려 있던 동안은 녹지 않은 셈
        coverDirty = true
      }
      // 창이 열리면 캔버스를 본문(z-index 1) 아래로: 쌓인 눈 · 내리는 눈이 창 뒤 어두운 막 아래에 깔린다
      canvas.style.zIndex = next ? '0' : '60'
    }
    let checkTimer = 0
    let checkTimer2 = 0
    const check = () => {
      setModal(modalOpen(w, h))
      coverDirty = true
      if (!raf) raf = requestAnimationFrame(frame)
    }
    // 화면이 바뀌면 조금 뒤에 다시 본다 (나타나는 움직임이 끝난 뒤에 한 번 더)
    const observer = new MutationObserver(() => {
      if (active !== 'christmas') return
      clearTimeout(checkTimer)
      clearTimeout(checkTimer2)
      checkTimer = window.setTimeout(check, 50)
      checkTimer2 = window.setTimeout(check, 400)
    })
    /** 쌓인 눈 칸이 지금 보이는지 (창이 열려 있으면 캔버스가 본문 아래라 가릴 필요가 없다) */
    const hiddenBin = (l: Ledge, i: number) => !modal && binCovered(l, i)
    /** 덮인 자리에 놓인 눈덩이 · 눈사람은 그리지도 만지지도 않는다 */
    const ballHidden = (b: Ball) => !b.held && !!b.ledge && hiddenBin(b.ledge, Math.floor(b.x / BIN))
    const manHidden = (m: Snowman) => !m.held && !!m.ledge && hiddenBin(m.ledge, Math.floor(m.x / BIN))
    /** 화면 좌표 아래에서 가장 가까운 눈 쌓인 표면 (높이 포함) */
    const surfaceBelow = (x: number, y: number) => {
      let best: { r: (typeof rects)[number]; top: number } | null = null
      for (const r of rects) {
        if (x < r.left || x > r.left + r.width) continue
        const top = snowTop(r, x - r.left)
        if (ledgeVisibleAt(r, x, top) && top >= y - 2 && (!best || top < best.top)) best = { r, top }
      }
      return best
    }
    const ballPos = (b: Ball) => {
      if (b.held || !b.ledge) return { x: b.hx, y: b.hy }
      const r = rectOf(b.ledge)
      if (!r) return null
      return { x: r.left + b.x, y: snowTop(r, b.x) - b.r }
    }
    /** 눈덩이가 부서진다: 크기만큼 눈 조각이 튀어 흩어지고, 내려앉은 조각은 다시 쌓인다 */
    const shatter = (x: number, y: number, r: number) => {
      const n = Math.min(40, Math.round(r * 1.6))
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI - Math.PI // 위쪽 반원으로
        const sp = 1 + Math.random() * 3
        particles.push({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5, r: 1.4 + Math.random() * 2, life: 0, max: 100000, kind: 'snow', g: CHUNK_G })
      }
    }
    /** 눈사람 밑바닥 가운데(화면 좌표) */
    const manBase = (m: Snowman) => {
      if (m.held || !m.ledge) return { x: m.hx, y: m.hy }
      const r = rectOf(m.ledge)
      if (!r) return null
      return { x: r.left + m.x, y: snowTop(r, m.x) }
    }
    /** 눈사람 각 눈덩이의 가운데 (흔들림 반영) */
    const manParts = (m: Snowman) => {
      const base = manBase(m)
      if (!base) return null
      const out: { x: number; y: number; r: number }[] = []
      let up = 0
      for (const pr of m.parts) {
        up += pr
        out.push({ x: base.x + Math.sin(m.wob) * up, y: base.y - Math.cos(m.wob) * up, r: pr })
        up += pr * 0.7
      }
      return out
    }
    let grabMan: { m: Snowman; sx: number; sy: number; moved: boolean; ox: number; oy: number } | null = null

    const down = (e: PointerEvent) => {
      if (active !== 'christmas' || e.button !== 0 || modal) return
      rects = ledgeRects(ledges, shapes, w, h, performance.now())
      // 0) 눈사람을 누른다 (끌면 옮기고, 그냥 떼면 흔들린다)
      for (const m of snowmen) {
        const ps = manParts(m)
        const base = manBase(m)
        if (!ps || !base || manHidden(m)) continue
        if (ps.some((q) => Math.hypot(e.clientX - q.x, e.clientY - q.y) <= q.r + 2)) {
          grabMan = { m, sx: e.clientX, sy: e.clientY, moved: false, ox: e.clientX - base.x, oy: e.clientY - base.y }
          e.preventDefault()
          if (!raf) raf = requestAnimationFrame(frame)
          return
        }
      }
      // 1) 눈덩이를 집는다
      for (const b of balls) {
        const p = ballPos(b)
        if (p && !ballHidden(b) && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= b.r + 3) {
          b.held = true
          b.hx = p.x
          b.hy = p.y
          b.vx = 0
          b.rolling = false
          grab = b
          lastPX = e.clientX
          e.preventDefault()
          return
        }
      }
      // 2) 충분히 쌓인 눈 위를 누르면 새 눈덩이를 굴리기 시작한다
      for (const r of rects) {
        if (e.clientX < r.left || e.clientX > r.left + r.width) continue
        const x = e.clientX - r.left
        const i = binAt(r, x)
        const top = ledgeTop(r, x)
        const depth = r.ledge.h[i] ?? 0
        if (depth >= ROLL_MIN_DEPTH && !hiddenBin(r.ledge, i) && e.clientY >= top - depth - 6 && e.clientY <= top + 4) {
          const b: Ball = { ledge: r.ledge, x: e.clientX - r.left, r: BALL_START_R, held: false, hx: 0, hy: 0, vx: 0, vy: 0, rolling: true, spin: 0 }
          balls.push(b)
          grab = b
          lastPX = e.clientX
          e.preventDefault()
          if (!raf) raf = requestAnimationFrame(frame)
          return
        }
      }
    }
    let dragV = 0
    const drag = (e: PointerEvent) => {
      if (grabMan) {
        const g = grabMan
        if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 4) {
          const base = manBase(g.m)
          if (!base) return
          g.m.hx = base.x
          g.m.hy = base.y
          g.moved = true
          g.m.held = true
          g.m.ledge = null
        }
        if (g.moved) {
          const dxm = e.clientX - g.ox - g.m.hx
          g.m.hx = e.clientX - g.ox
          g.m.hy = e.clientY - g.oy
          g.m.wobV += dxm * 0.004 // 끌면 몸이 기운다
        }
        if (!raf) raf = requestAnimationFrame(frame)
        return
      }
      if (!grab) return
      const dx = e.clientX - lastPX
      lastPX = e.clientX
      dragV = dragV * 0.6 + dx * 0.4
      if (grab.rolling && grab.ledge) {
        // 굴리기: 그 자리 위를 따라 움직이며 지나간 눈을 먹고 커진다
        const r = rectOf(grab.ledge)
        if (!r) return
        grab.x = Math.max(grab.r, Math.min(r.width - grab.r, e.clientX - r.left))
        grab.spin += dx / Math.max(grab.r, 1)
        if (dx !== 0) grab.r = eatSnow(grab.ledge.h, grab.x, grab.r, dx)
      } else {
        grab.hx = e.clientX
        grab.hy = e.clientY
      }
      lastSnowAt = performance.now()
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const up = () => {
      if (grabMan) {
        const g = grabMan
        grabMan = null
        if (!g.moved) {
          // 눌렀다 뗌: 흔들린다
          g.m.wobV += (Math.random() < 0.5 ? -1 : 1) * 0.12
        } else {
          g.m.held = false
          g.m.vy = 0
        }
        if (!raf) raf = requestAnimationFrame(frame)
        return
      }
      const b = grab
      grab = null
      if (!b) return
      if (b.rolling) {
        // 굴리던 힘을 이어 받아 계속 구른다 (경사면이면 저절로)
        b.rolling = false
        b.vx = Math.max(-8, Math.min(8, dragV))
        dragV = 0
        if (!raf) raf = requestAnimationFrame(frame)
        return
      }
      // 놓은 자리: 다른 눈덩이 · 눈사람과 겹치면 합친다, 아니면 아래로 떨어진다
      b.held = false
      if (b.r >= SNOWMAN_MIN_R) {
        for (const o of balls) {
          if (o === b || o.r < SNOWMAN_MIN_R) continue
          const p = ballPos(o)
          if (p && o.ledge && Math.hypot(b.hx - p.x, b.hy - p.y) < b.r + o.r) {
            const parts = [o.r, b.r].sort((a, c) => c - a)
            snowmen.push({ ledge: o.ledge, x: o.x, parts, wob: 0, wobV: 0.06, held: false, hx: 0, hy: 0, vy: 0 })
            balls.splice(balls.indexOf(o), 1)
            balls.splice(balls.indexOf(b), 1)
            if (!raf) raf = requestAnimationFrame(frame)
            return
          }
        }
        for (const m of snowmen) {
          const r = m.ledge && rectOf(m.ledge)
          if (!r || !m.ledge || m.parts.length >= 3) continue
          const baseY = snowTop(r, m.x)
          const topY = baseY - m.parts.reduce((a, c) => a + c * 2 * 0.85, 0)
          if (Math.abs(b.hx - (r.left + m.x)) < b.r + m.parts[m.parts.length - 1] && Math.abs(b.hy - topY) < b.r * 2 + 10) {
            m.parts.push(b.r)
            m.parts.sort((a, c) => c - a)
            balls.splice(balls.indexOf(b), 1)
            if (!raf) raf = requestAnimationFrame(frame)
            return
          }
        }
      }
      b.ledge = null
      b.vy = 0
      b.vx = Math.max(-6, Math.min(6, dragV * 0.5))
      dragV = 0
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const mouse = { x: -999, y: -999, seen: false }
    let lastSpawn = 0
    const move = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.seen = true
      // 너무 많이 만들지 않게 간격을 둔다. 크리스마스는 눈을 조금 더 (20ms 마다 2번)
      const now = performance.now()
      const christmas = active === 'christmas'
      // 창이 열려 있으면 마우스 눈을 만들지 않는다 (창 위에서 눈이 생기지 않게)
      if (christmas && modal) return
      if (now - lastSpawn > (christmas ? 20 : 35) && particles.length < MAX_PARTICLES) {
        lastSpawn = now
        for (let k = 0; k < (christmas ? 2 : 1); k++) particles.push(...spawn(active, mouse.x, mouse.y))
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

      const now = performance.now()
      const piling = active === 'christmas'
      if (piling) {
        frameContexts.clear()
        for (const [el, snow] of cardSnow) {
          if (!el.isConnected) {
            removeCardSnow(el, snow)
            cardSnow.delete(el)
            ledges.delete(el)
          } else {
            snow.ctx.resetTransform()
            snow.ctx.clearRect(0, 0, snow.canvas.width, snow.canvas.height)
          }
        }
        const before = previousRects
        const dt = now - previousFrameAt
        previousFrameAt = now
        rects = ledgeRects(ledges, shapes, w, h, now)
        previousRects = rects
        const current = new Map(rects.map((r) => [r.ledge, r]))
        for (const [el, l] of ledges) {
          if (!(el instanceof HTMLElement)) continue
          if (!el.isConnected) ledges.delete(el)
          const snow = cardSnow.get(el)
          if (snow && !current.has(l)) {
            removeCardSnow(el, snow)
            cardSnow.delete(el)
          }
        }
        const elapsed = Math.max(0.25, dt / (1000 / 60))
        const nextVelocity = new Map<Ledge, { x: number; y: number; scroll: boolean }>()
        for (const previous of before) {
          const el = previous.ledge.el
          if (!el?.isConnected || modal || dt <= 0 || dt > 60) continue
          const r = current.get(previous.ledge)
          const position = r ?? el.getBoundingClientRect()
          const dx = position.left - previous.left
          const dy = position.top - previous.top
          if (Math.abs(position.width - previous.width) > 1 || Math.abs(dx) > w * 0.5 || Math.abs(dy) > h * 0.5) continue
          const vx = dx / elapsed
          const vy = dy / elapsed
          const prior = ledgeVelocity.get(previous.ledge)
          if ((vx !== 0 || vy !== 0) && r) nextVelocity.set(r.ledge, { x: vx, y: vy, scroll: scrolled })
          coverDirty ||= dx !== 0 || dy !== 0
          const ax = (vx - (prior?.x ?? 0)) / elapsed
          const ay = (vy - (prior?.y ?? 0)) / elapsed
          const inheritedVelocity = Math.max(-9, Math.min(9, prior?.y ?? 0))
          const strongest = Math.max(Math.abs(ax), Math.abs(ay))
          const releases = (scrolled || prior?.scroll) && ay > BODY_RELEASE_ACCELERATION
          if (strongest > BALL_SLIDE_ACCELERATION || releases) {
            for (const b of balls) {
              if (b.ledge !== previous.ledge || b.held || b === grab || ballHidden(b)) continue
              if (releases) {
                b.hx = previous.left + b.x
                b.hy = snowTop(previous, b.x) - b.r
                b.vx = Math.max(-12, Math.min(12, b.vx + (prior?.x ?? 0)))
                b.vy = inheritedVelocity
                b.ledge = null
              } else if (r) {
                const slope = snowSlope(r, b.x, b.r)
                const impulse = -ax * 0.24 + Math.max(-1, Math.min(1, slope)) * Math.abs(ay) * 0.3
                b.vx = Math.max(-9, Math.min(9, b.vx + impulse))
              }
            }
          }
          if (releases) {
            for (const m of snowmen) {
              if (m.ledge !== previous.ledge || m.held || m === grabMan?.m || manHidden(m)) continue
              m.hx = previous.left + m.x
              m.hy = snowTop(previous, m.x)
              m.vy = inheritedVelocity
              m.ledge = null
            }
          }
          if (r && r.ledge.h.length && strongest > POWDER_SLIDE_ACCELERATION) {
            const powder = r.ledge.powder ??= { looseness: 0, drift: 0 }
            powder.looseness = Math.min(1, powder.looseness + (strongest - POWDER_SLIDE_ACCELERATION) / 10)
            powder.drift = Math.max(-2.5, Math.min(2.5, powder.drift - ax * 0.18))
          }
          // A rapidly dropping support leaves some powder airborne. The rest slides in card coordinates.
          if (ay > POWDER_RELEASE_ACCELERATION) {
            const hs = previous.ledge.h
            const fraction = Math.min(0.32, (ay - POWDER_RELEASE_ACCELERATION) / 45)
            for (let i = 0; i < hs.length && particles.length < MAX_PARTICLES; i++) {
              const depth = hs[i] ?? 0
              if (depth < 0.7 || binCovered(previous.ledge, i)) continue
              const x = previous.left + binCenter(previous, i)
              const y = snowTop(previous, x - previous.left)
              if (!ledgeVisibleAt(previous, x, y)) continue
              const amount = depth * fraction
              hs[i] = depth - amount
              particles.push({ x, y: y - 1, vx: Math.max(-6, Math.min(6, prior?.x ?? 0)),
                vy: inheritedVelocity, r: Math.min(3, 1 + amount * 0.45),
                life: 8, max: 100000, kind: 'snow', g: CHUNK_G, snowDepth: amount })
            }
          }
        }
        ledgeVelocity = nextVelocity
        if (!modal) {
          for (const r of rects) {
            slidePowder(r, Math.min(2, elapsed), (i, depth, velocity) => {
              if (particles.length >= MAX_PARTICLES) return false
              const localX = binCenter(r, i)
              const x = r.left + localX
              const y = snowTop(r, localX)
              if (!ledgeVisibleAt(r, x, y)) return false
              const support = ledgeVelocity.get(r.ledge)
              const vx = Math.sign(velocity) * Math.max(1.3, Math.abs(velocity)) + (support?.x ?? 0)
              particles.push({ x: x + Math.sign(velocity) * (BIN / 2), y: y - 0.5, vx, vy: Math.max(-9, Math.min(9, support?.y ?? 0)),
                r: Math.min(3, 1 + depth * 0.45), life: 8, max: 100000, kind: 'snow', g: CHUNK_G, snowDepth: depth })
              return true
            })
          }
        }
        scrolled = false
        if (rects.length !== before.length || rects.some((r) => !r.ledge.cover)) coverDirty = true
      }
      if (piling && !modal && (coverDirty ? now - coverAt > COVER_MIN_MS : now - coverAt > COVER_EVERY_MS)) {
        computeCover()
        coverAt = now
        coverDirty = false
      }
      // 하늘에서 내리는 눈 (배경 눈): 화면 위에서 생겨 떨어지고, 마우스 눈처럼 쌓인다
      if (piling && ++skyTick % SKY_EVERY === 0 && particles.length < MAX_PARTICLES && document.visibilityState === 'visible') {
        particles.push({ x: Math.random() * w, y: -6, vx: (Math.random() - 0.5) * 0.4, vy: 0.5 + Math.random() * 0.7, r: 1.2 + Math.random() * 1.6, life: 0, max: 100000, kind: 'snow', sky: true })
      }
      particles = particles.filter((p) => p.life < p.max && p.y < h + 20)
      for (const p of particles) {
        // 떨어지는 눈: 아래에 있는 카드 윗변(또는 화면 바닥)에 닿으면 그 자리에 쌓인다
        // 창이 열려 있으면 쌓이지 않고 그대로 지나간다. 덮인 칸에도 쌓이지 않는다
        if (piling && !modal && p.kind === 'snow') {
          const nx = p.x + p.vx
          const ny = p.y + p.vy + (p.g ?? 0)
          let hit: { r: LedgeRect; i: number; y: number } | undefined
          for (const r of rects) {
            const x = nx - r.left
            if (x < 0 || x > r.width) continue
            const i = binAt(r, x)
            if (binCovered(r.ledge, i)) continue
            const y = snowTop(r, x)
            if (ledgeVisibleAt(r, nx, y) && p.y <= y && ny >= y && (!hit || y < hit.y)) hit = { r, i, y }
          }
          if (hit && !holdsSnow(hit.r, hit.i)) {
            // 가파른 모서리에 닿은 눈은 바깥쪽으로 미끄러진다.
            const x = binCenter(hit.r, hit.i)
            p.vx = x < hit.r.leftRadius[0] ? -1.3 : 1.3
            p.vy = 0.8
            p.g = CHUNK_G
            p.y = hit.y - 1
          } else if (hit) {
            const { r, i } = hit
            const amt = p.snowDepth ?? p.r * (p.sky ? SKY_DEPOSIT : 1)
            for (let k = -1; k <= 1; k++) {
              const j = i + k
              if (j < 0 || j >= binCount(r) || !holdsSnow(r, j) || binCovered(r.ledge, j)) continue
              r.ledge.h[j] = Math.min(PILE_MAX, (r.ledge.h[j] ?? 0) + amt * (k === 0 ? 0.5 : 0.25))
            }
            p.life = p.max
            if (!p.sky) lastSnowAt = now
          }
          if (p.life >= p.max) continue
        }
        p.life++
        if (p.life <= 0) continue // 아직 나올 차례가 아니다 (zzz)
        p.x += p.vx + (p.kind === 'bubble' ? Math.sin((p.life + p.r * 10) / 14) * 0.4 : p.kind === 'z' ? Math.sin(p.life / 9) * 0.5 : 0)
        if (p.g) p.vy += p.g
        if (p.kind === 'spark' && p.g) {
          // 오브젝트에서 튄 불꽃은 점점 느려진다
          p.vx *= 0.94
          p.vy *= 0.94
        }
        if (p.kind === 'puff') {
          p.vx *= 0.95
          p.vy *= 0.95
          p.r += 0.35
        }
        p.y += p.vy
        const t = p.life / p.max
        const alpha = p.kind === 'snow' && piling ? Math.min(1, p.life / 8) : t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
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
        } else if (p.kind === 'puff') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
          g.addColorStop(0, `rgba(${p.hue},${0.75 * alpha})`)
          g.addColorStop(0.5, `rgba(${p.hue},${0.35 * alpha})`)
          g.addColorStop(1, `rgba(${p.hue},0)`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.kind === 'z') {
          ctx.font = `700 ${Math.round(p.r + t * 6)}px system-ui, sans-serif`
          ctx.fillStyle = `rgba(233,229,245,${0.95 * alpha})`
          ctx.shadowColor = 'rgba(139,92,246,0.9)'
          ctx.shadowBlur = 8
          ctx.fillText('z', p.x, p.y)
          ctx.shadowBlur = 0
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

      // 쌓인 눈 그리기 (오래 가만히 있으면 녹는다)
      let snowLeft = false
      if (piling) {
        // 창이 열려 있는 동안은 녹지 않는다
        const melting = !modal && now - lastSnowAt > MELT_AFTER_MS
        for (const r of rects) {
          const hs = r.ledge.h
          if (hs.length === 0) continue
          hs.length = Math.min(hs.length, binCount(r))
          if (!modal) {
            for (let i = 0; i < hs.length; i++) if (!holdsSnow(r, i)) hs[i] = 0
            settle(r)
          }
          let any = false
          for (let i = 0; i < hs.length; i++) {
            if (melting && hs[i]) hs[i] = Math.max(0, hs[i] - MELT_PER_FRAME)
            if ((hs[i] ?? 0) > 0.05) any = true
          }
          // 덮이지 않은 칸끼리 이어 그린다 (덮인 칸에서 끊는다)
          const ctx = attachedContext(r)
          ctx.beginPath()
          let start = -1
          for (let i = 0; i <= hs.length; i++) {
            const show = (hs[i] ?? 0) > 0.05 && !hiddenBin(r.ledge, i)
            if (show) {
              if (start < 0) {
                start = i
                ctx.moveTo(r.left + i * BIN, ledgeTop(r, i * BIN))
              }
              const x = binCenter(r, i)
              ctx.lineTo(r.left + x, snowTop(r, x))
            } else if (start >= 0) {
              const end = Math.min(i * BIN, r.width)
              ctx.lineTo(r.left + end, ledgeTop(r, end))
              for (let j = i - 1; j >= start; j--) {
                const x = binCenter(r, j)
                ctx.lineTo(r.left + x, ledgeTop(r, x))
              }
              ctx.closePath()
              start = -1
            }
          }
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.shadowColor = 'rgba(120,150,190,0.45)'
          ctx.shadowBlur = 3
          ctx.fill()
          ctx.shadowBlur = 0
          if (any) snowLeft = true
          else hs.length = 0
        }
      }

      // 눈덩이 · 눈사람
      let moving = false
      if (piling) {
        for (const b of balls) {
          // 놓은 눈덩이(또는 가장자리에서 굴러 떨어진 눈덩이)는 아래 표면까지 떨어진다
          if (!b.held && !b.ledge) {
            b.vy = Math.min(b.vy + 0.5, 14)
            const ny = b.hy + b.vy
            b.hx += b.vx
            const sfc = surfaceBelow(b.hx, b.hy + b.r)
            if (sfc && ny + b.r >= sfc.top) {
              if (b.vy >= BALL_BREAK_V) {
                // 높은 데서 떨어졌다: 부서진다
                shatter(b.hx, sfc.top - b.r * 0.5, b.r)
                b.r = 0
                continue
              }
              b.ledge = sfc.r.ledge
              b.vx = Math.max(-9, Math.min(9, b.vx - (ledgeVelocity.get(b.ledge)?.x ?? 0)))
              b.x = Math.max(0, Math.min(sfc.r.width, b.hx - sfc.r.left))
              b.vy = 0
            } else if (ny > h + 60) {
              b.r = 0
            } else {
              b.hy = ny
              moving = true
            }
          }
          // 표면 위의 눈덩이: 쌓인 눈의 경사를 따라 굴러 내려가고, 구르며 눈을 먹고 커진다. 가장자리를 넘으면 떨어진다
          if (!b.held && b.ledge && !b.rolling) {
            const r = rectOf(b.ledge)
            if (r) {
              const hs = b.ledge.h
              const slope = snowSlope(r, b.x, b.r)
              b.vx = (b.vx + slope * SLOPE_G) * ROLL_FRICTION
              if (Math.abs(b.vx) < 0.35 && Math.abs(slope) < ROLL_STOP_SLOPE) b.vx = 0
              if (b.vx !== 0) {
                b.x += b.vx
                b.spin += b.vx / Math.max(b.r, 1)
                // 구른 자리의 눈을 먹는다 (지나간 자리는 눈이 줄어든다)
                b.r = eatSnow(hs, b.x, b.r, b.vx)
                moving = true
                if (b.x < 0 || b.x > r.width) {
                  // 가장자리를 넘었다: 떨어진다
                  b.hx = r.left + b.x
                  b.hy = ledgeTop(r, Math.max(0, Math.min(r.width, b.x))) - b.r
                  const support = ledgeVelocity.get(b.ledge)
                  b.vx += support?.x ?? 0
                  b.vy = Math.max(-9, Math.min(9, (support?.y ?? 0) - 1))
                  b.ledge = null
                }
              }
            }
          }
          const p = ballPos(b)
          if (!p || b.r <= 0 || ballHidden(b)) continue
          const r = rectOf(b.ledge)
          const overhang = r && (p.x - b.r < r.left || p.x + b.r > r.left + r.width)
          drawBall(b.held || overhang ? ctx : attachedContext(r), p.x, p.y, b.r, b.spin)
        }
        for (let i = balls.length - 1; i >= 0; i--) if (balls[i].r <= 0) balls.splice(i, 1)
        for (let mi = snowmen.length - 1; mi >= 0; mi--) {
          const m = snowmen[mi]
          // 놓은 눈사람은 아래 표면까지 떨어진다. 너무 빨리 떨어지면 눈덩이로 흩어진다
          if (!m.held && !m.ledge) {
            m.vy = Math.min(m.vy + 0.5, 16)
            const sfc = surfaceBelow(m.hx, m.hy)
            if (sfc && m.hy + m.vy >= sfc.top) {
              if (m.vy >= SNOWMAN_BREAK_V) {
                let up = 0
                for (const pr of m.parts) {
                  up += pr
                  balls.push({ ledge: null, x: 0, r: pr, held: false, hx: m.hx + (Math.random() - 0.5) * pr, hy: sfc.top - up, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 2, rolling: false, spin: 0 })
                  up += pr * 0.7
                }
                shatter(m.hx, sfc.top, 6)
                snowmen.splice(mi, 1)
                continue
              }
              m.ledge = sfc.r.ledge
              m.x = Math.max(0, Math.min(sfc.r.width, m.hx - sfc.r.left))
              m.wobV += (Math.random() < 0.5 ? -1 : 1) * m.vy * 0.01 // 착지하며 흔들린다
              m.vy = 0
            } else if (m.hy > h + 120) {
              snowmen.splice(mi, 1)
              continue
            } else {
              m.hy += m.vy
            }
            moving = true
          }
          // 흔들림: 바로 서려는 힘 + 감쇠
          if (m.wob !== 0 || m.wobV !== 0) {
            m.wobV += -m.wob * 0.08
            m.wobV *= 0.92
            m.wob += m.wobV
            if (Math.abs(m.wob) < 0.002 && Math.abs(m.wobV) < 0.002) {
              m.wob = 0
              m.wobV = 0
            } else moving = true
          }
          const ps = manParts(m)
          if (!ps || manHidden(m)) continue
          const r = rectOf(m.ledge)
          const overhang = r && ps.some((p) => p.x - p.r < r.left || p.x + p.r > r.left + r.width)
          const ctxForMan = m.held || overhang ? ctx : attachedContext(r)
          ps.forEach((q, k) => {
            drawBall(ctxForMan, q.x, q.y, q.r, 0)
            if (k === ps.length - 1) {
              // 머리: 마우스를 바라본다
              const d = Math.hypot(mouse.x - q.x, mouse.y - q.y) || 1
              const look = mouse.seen ? Math.min(1, d / 80) : 0
              drawFace(ctxForMan, q.x, q.y, q.r, ((mouse.x - q.x) / d) * look, ((mouse.y - q.y) / d) * look)
            } else if (k === ps.length - 2) drawButtons(ctxForMan, q.x, q.y, q.r)
          })
        }
        if (grabMan) moving = true
        if (grab) moving = true
      }

      // 그릴 것이 남아 있을 때만 다음 장면을 예약한다 (가만히 있으면 쉰다)
      if (particles.length > 0 || snowLeft || moving || piling) raf = requestAnimationFrame(frame)
    }

    const scroll = () => {
      if (active !== 'christmas') return
      scrolled = true
      coverDirty = true
      if (!raf) raf = requestAnimationFrame(frame)
    }
    // 크리스마스는 하늘 눈이 마우스 없이도 내리므로 바로 그리기 시작한다
    if (active === 'christmas') {
      raf = requestAnimationFrame(frame)
      // 창 · 메뉴가 뜨고 닫히는 것을 본다 (React 가 그리는 본문 · 몸통 아래에 붙는 것 모두)
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal', 'role', 'class', 'hidden'] })
      check()
    }
    const onResize = () => {
      resize()
      previousFrameAt = 0
      ledgeVelocity.clear()
      coverDirty = true
    }
    // 오브젝트를 만졌을 때 부탁받은 알갱이
    const offFx = onFx((fx) => {
      if (fx.kind === 'meteors' || particles.length >= MAX_PARTICLES) return
      particles.push(...spawnFx(fx))
      if (!raf) raf = requestAnimationFrame(frame)
    })
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', drag, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('scroll', scroll, { passive: true, capture: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', drag)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('scroll', scroll, { capture: true })
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      for (const [el, snow] of cardSnow) removeCardSnow(el, snow)
      clearTimeout(checkTimer)
      clearTimeout(checkTimer2)
      canvas.style.zIndex = '60'
      document.removeEventListener('pointerleave', leave)
      offFx()
      if (raf) cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, w, h)
    }
  }, [on, active])

  if (!on) return null
  return (
    <>
      {active === 'space' && <ShootingStars />}
      <canvas ref={ref} aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 60, pointerEvents: 'none' }} />
    </>
  )
}
