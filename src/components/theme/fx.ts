// 테마 오브젝트들이 같이 쓰는 작은 도구
//   - emitFx / onFx   : 오브젝트가 캔버스(MouseEffects · ShootingStars)에 알갱이를 그려 달라고 부탁한다 (불꽃 · 연기 · zzz · 별똥별)
//   - tick            : 움직이는 오브젝트들이 같이 쓰는 그리기 고리 하나 (requestAnimationFrame). 구독이 없으면 멈춘다
//   - pointer         : 마지막 마우스 자리 (창 하나에 듣개 하나)
//   - hitImage        : 마우스 자리가 그림의 보이는 부분(투명하지 않은 곳)인지, 그 위를 카드 · 메뉴가 덮고 있지 않은지 · 버튼 위가 아닌지
// 테마 층은 모두 눌리지 않으므로(pointer-events: none) 마우스 자리를 직접 본다.

/* ---------- 캔버스에 그려 달라는 부탁 ---------- */
export type FxKind =
  | 'sparks' // 반짝이 불꽃이 사방으로 튄다
  | 'puffs' // 로켓 연기 (dx, dy 쪽으로 뿜는다)
  | 'zzz' // 잠꼬대 z 가 떠오른다
  | 'bubbles' // 바다: 방울이 한 움큼 떠오른다
  | 'meteors' // 별똥별 여러 개 (ShootingStars 가 그린다)
export type Fx = { kind: FxKind; x: number; y: number; n?: number; dx?: number; dy?: number }
const FX_EVENT = 'iturtle-theme-fx'

export function emitFx(fx: Fx) {
  window.dispatchEvent(new CustomEvent<Fx>(FX_EVENT, { detail: fx }))
}
export function onFx(fn: (fx: Fx) => void) {
  const h = (e: Event) => fn((e as CustomEvent<Fx>).detail)
  window.addEventListener(FX_EVENT, h)
  return () => window.removeEventListener(FX_EVENT, h)
}

/* ---------- 마우스 자리 ---------- */
export const pointer = { x: -9999, y: -9999, seen: false }
let pointerUsers = 0
const onMove = (e: PointerEvent) => {
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.seen = true
}
const onLeave = () => {
  pointer.seen = false
  pointer.x = pointer.y = -9999
}
/** pointer 를 채우는 듣개를 단다. 돌려준 함수로 뗀다 (마지막 사용자가 떼면 듣개도 뗀다) */
export function trackPointer() {
  if (pointerUsers++ === 0) {
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
  }
  return () => {
    if (--pointerUsers === 0) {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }
}

/* ---------- 같이 쓰는 그리기 고리 ---------- */
/** dt = 지난 장면부터 흐른 초 (탭을 오래 숨겼다 돌아와도 0.05 를 넘지 않는다). false 를 돌려주면 구독이 끝난다 */
type TickFn = (dt: number, now: number) => boolean | void
const subs = new Set<TickFn>()
let raf = 0
let last = 0
const loop = (now: number) => {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  for (const f of subs) if (f(dt, now) === false) subs.delete(f)
  raf = subs.size ? requestAnimationFrame(loop) : 0
}
/** 매 장면 부를 함수를 단다. 돌려준 함수로 뗀다. 숨긴 탭에서는 브라우저가 알아서 멈춘다 */
export function tick(f: TickFn) {
  subs.add(f)
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }
  return () => {
    subs.delete(f)
  }
}

/* ---------- 그림 위인지 보기 ---------- */
const MASK_W = 64 // 투명도 지도를 이 너비로 줄여 둔다
const masks = new Map<string, { w: number; h: number; a: Uint8ClampedArray } | null>()
/** 그림의 투명도 지도 (처음 한 번 만든다). 아직 못 만들었으면 null → 사각형으로 본다 */
function maskOf(img: HTMLImageElement) {
  const key = img.currentSrc || img.src
  if (masks.has(key)) return masks.get(key)!
  if (!img.complete || !img.naturalWidth) return null
  try {
    const w = MASK_W
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * MASK_W))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('no 2d')
    ctx.drawImage(img, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h).data
    const a = new Uint8ClampedArray(w * h)
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]
    masks.set(key, { w, h, a })
  } catch {
    masks.set(key, null)
  }
  return masks.get(key)!
}

/** 눌리는 화면 요소: 이것 위에서는 테마 오브젝트가 반응하지 않는다 */
const UI = 'a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[role=menuitem],[contenteditable=""],[contenteditable=true]'
const painted = (e: Element) => {
  const cs = getComputedStyle(e)
  if (cs.backgroundImage !== 'none') return true
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const p = m[1].split(/[\s,/]+/).filter(Boolean)
  return p.length < 4 || parseFloat(p[3]) > 0.3
}
/**
 * (x, y) 에서 그림 el 이 덮여 있는지.
 * 1) 그림을 잠깐 눌리게(pointer-events: auto) 해 두고 브라우저에 맨 위 요소를 물으면 쌓임 순서(z-index)까지 따진 답이 나온다.
 *    그림이 맨 위면 덮이지 않은 것 — 단, 누를 때(click) 바로 아래가 버튼 · 링크면 반응하지 않는다 (클릭은 버튼으로 간다). 마우스를 올리기만 할 때는 반응한다.
 * 2) 다른 요소가 위에 있어도, 그것이 바탕 없는 글자 줄 같은 투명한 상자면 그림이 보이므로 덮이지 않은 것으로 본다.
 *    그 요소에서 그림을 품은 부모까지 올라가며 바탕이 칠해진 것(카드 · 메뉴 칸)이 있으면 덮인 것.
 */
export function coveredAt(el: HTMLElement, x: number, y: number, click: boolean) {
  const prev = el.style.pointerEvents
  el.style.pointerEvents = 'auto'
  const top = document.elementFromPoint(x, y)
  el.style.pointerEvents = prev
  const under = document.elementFromPoint(x, y)
  if (!under || (click && under.closest(UI))) return true
  if (top === el) return false
  for (let e: Element | null = under; e && !e.contains(el); e = e.parentElement) if (painted(e)) return true
  return false
}

/**
 * (x, y) 가 그림의 보이는 부분 위이고 덮여 있지 않은지.
 * click: 누를 때인지 (버튼 · 링크 위면 반응하지 않는다). pad: 투명한 가장자리라도 이만큼(px) 안쪽이면 맞은 것으로 본다 (작은 그림을 누르기 쉽게)
 */
export function hitImage(img: HTMLImageElement | null, x: number, y: number, click: boolean, pad = 4) {
  if (!img) return false
  const r = img.getBoundingClientRect()
  if (r.width === 0 || x < r.left || x > r.right || y < r.top || y > r.bottom) return false
  const m = maskOf(img)
  if (m) {
    const near = (px: number, py: number) => {
      const i = Math.floor(((px - r.left) / r.width) * m.w)
      const j = Math.floor(((py - r.top) / r.height) * m.h)
      return i >= 0 && j >= 0 && i < m.w && j < m.h && m.a[j * m.w + i] > 40
    }
    if (!near(x, y) && !near(x - pad, y) && !near(x + pad, y) && !near(x, y - pad) && !near(x, y + pad)) return false
  }
  return !coveredAt(img, x, y, click)
}
