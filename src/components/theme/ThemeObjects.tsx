// 그림 파일로 된 테마 오브젝트 — 화면의 정해진 자리(slot)에 놓는다.
// 틀(카드 · 사이드바)의 색과는 따로이고, 묶음(오브젝트 1 · 오브젝트 2)마다 켜고 끌 수 있다 (lib/theme.ts).
//
//   <ThemeObjects slot="hero" />  처럼 그 자리의 부모 안에 넣는다. 부모는 position: relative 여야 한다.
//   모두 눌리지 않는다 (pointer-events: none).
//
// 새 묶음을 더할 때: 그림을 src/assets/themes/<테마>/ 에 넣고, 아래 PLACEMENTS 에 set 번호와 자리를 적는다.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTheme, type ThemeId } from '../../lib/theme'
import s from './ThemeObjects.module.css'

export type ObjectSlot =
  | 'header' // 본문 맨 위 (전구 줄 · 리본 · 매달린 장식)
  | 'page' // 화면 전체에 흩뿌리는 것 (반짝이). 본문 뒤
  | 'sidebar' // 사이드바 안
  | 'hero' // 홈 "꼭 확인할 것" 카드
  | 'tasks' // 홈 "내 작업" 카드
  | 'schedule' // 홈 "이번 주 일정" 카드
  | 'notices' // 홈 "최근 공지" 카드

type Placement = {
  /** 오브젝트 묶음 번호 (0 = 오브젝트 1) */
  set: number
  slot: ObjectSlot
  src: string
  style: CSSProperties
  /** 좁은 화면에서 숨길지 (글자를 가릴 수 있는 큰 그림) */
  wideOnly?: boolean
  /** 낮은 화면에서 숨길지 (사이드바 메뉴와 겹칠 수 있는 그림) */
  tallOnly?: boolean
  /** 마우스가 닿으면 매달린 것처럼 좌우로 흔들릴 각도(도). 없으면 흔들리지 않는다 */
  sway?: number
}

/** 테마별 그림 묶음. pixel 이면 픽셀 그림이라 늘려도 뭉개지지 않게 그린다 */
type ThemeObjectSet = { pixel?: boolean; /** 그림 둘레로 빛이 번지게 할지 */ glow?: boolean; items: Placement[] }

/* ---------- 크리스마스: 그림 파일 (theme-refs/christmas/christmas-home-v2.png 의 자리를 따름) ---------- */
const X = import.meta.glob<string>('../../assets/themes/christmas/*.png', { eager: true, import: 'default' })
const SPARKLE_FILES = import.meta.glob<string>('../../assets/themes/christmas/sparkles/*.png', { eager: true, import: 'default' })
/**
 * sparkles 폴더의 40조각 중 실제 반짝이 · 눈송이 · 별만 쓴다.
 * 나머지 28조각은 참고 이미지에서 같이 잘려 나온 화면 아이콘(달력 · 확성기 · 톱니 등)과 전구 줄 조각이라 뺐다.
 */
const SMALL = [3, 5, 6, 9, 13, 25, 28, 30, 32, 33] // 눈송이 · 반짝이
const STARS = [1, 2] // 큰 금색 별 (한 번씩만)
const sparkle = (n: number) => SPARKLE_FILES[`../../assets/themes/christmas/sparkles/sparkle_${String(n).padStart(2, '0')}.png`]
/** 작은 것들을 돌려 가며 34개 + 별 2개 */
const SPARKLES = [...Array.from({ length: 34 }, (_, i) => sparkle(SMALL[i % SMALL.length])), ...STARS.map(sparkle)]
const x = (name: string) => X[`../../assets/themes/christmas/${name}.png`]

/** 반짝이를 흩뿌릴 자리: 늘 같은 자리에 나오게 번호로 계산한다 (새로 고쳐도 같은 모양) */
const scatter = (i: number, seed: number) => {
  const r = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233 + seed) * 43758.5453
    return v - Math.floor(v)
  }
  return { left: `${(r(1) * 96 + 2).toFixed(2)}%`, top: `${(r(2) * 94 + 3).toFixed(2)}%`, opacity: 0.55 + r(3) * 0.45, transform: `scale(${(0.6 + r(4) * 0.5).toFixed(2)})` }
}

const CHRISTMAS: Placement[] = [
  // --- 본문 맨 위: 전구 줄 두 개 + 가운데 리본 + 매달린 장식. 마우스가 닿으면 흔들린다
  // 전구 줄에 그려진 끈과 장식이 어긋나지 않게, 모두 원본 크기(px)로 두고 왼쪽 5% 지점부터 px 로 놓는다
  // 전구 줄은 한 장 (리본 뒤로 줄이 이어진다 — 두 장으로 나누면 리본 양옆에 틈 · 잘린 전구가 보였다)
  { set: 0, slot: 'header', src: x('ornament_garland_lights'), style: { left: 'calc(5% + 0px)', top: 0, width: 1132 } },
  { set: 0, slot: 'header', src: x('ornament_bow'), style: { left: 'calc(5% + 507px)', top: -2, width: 146 }, sway: 5 },
  { set: 0, slot: 'header', src: x('ornament_ball_red'), style: { left: 'calc(5% + 199px)', top: 40, width: 39 }, sway: 16, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_sock'), style: { left: 'calc(5% + 266px)', top: 40, width: 52 }, sway: 14, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_snowflake'), style: { left: 'calc(5% + 342px)', top: 40, width: 58 }, sway: 14, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_star'), style: { left: 'calc(5% + 419px)', top: 40, width: 53 }, sway: 16, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_candy_cane'), style: { left: 'calc(5% + 719px)', top: 40, width: 37 }, sway: 16, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_gift'), style: { left: 'calc(5% + 778px)', top: 40, width: 62 }, sway: 14, wideOnly: true },
  { set: 0, slot: 'header', src: x('ornament_ball_right'), style: { left: 'calc(5% + 858px)', top: 40, width: 48 }, sway: 16, wideOnly: true },

  // --- "꼭 확인할 것" 카드: 위아래 눈 + 우표 (트리 그림은 쓰지 않는다)
  { set: 0, slot: 'hero', src: x('snowbank_hero_top'), style: { left: 0, top: -20, width: '100%', height: 36, clipPath: 'inset(0 12% 0 8%)' } } /* 양 끝에 같이 그려진 테이프 조각은 잘라 낸다 */,
  { set: 0, slot: 'hero', src: x('snowbank_hero_bottom'), style: { left: 0, bottom: -6, width: '100%', height: 38 } },
  { set: 0, slot: 'hero', src: x('stamp_tree'), style: { right: -24, top: '46%', width: 62 }, wideOnly: true },

  // --- "내 작업" 카드: 선물 더미와 등불
  { set: 0, slot: 'tasks', src: x('gift_pile_card_lantern'), style: { right: '15%', bottom: -6, width: 'min(360px, 34%)' }, wideOnly: true },

  // --- 사이드바: 선물 더미 (쌓인 눈은 아래에서 CSS 로 그린다)
  { set: 0, slot: 'sidebar', src: x('gift_pile_sidebar'), style: { right: 18, bottom: 168, width: 150 }, tallOnly: true },

  // --- 사이드바: 메뉴 글자를 피해 양옆 가장자리에 눈송이 · 반짝이
  { set: 0, slot: 'sidebar', src: sparkle(3), style: { right: 10, top: 58, width: 20, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(30), style: { right: 40, top: 96, width: 12, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(5), style: { right: 12, top: 240, width: 18, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(28), style: { right: 30, top: 296, width: 14, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(32), style: { left: 4, top: 322, width: 12, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(6), style: { right: 10, top: 398, width: 18, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(13), style: { right: 34, top: 452, width: 14, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(33), style: { left: 5, top: 478, width: 12, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(9), style: { right: 12, top: 552, width: 18, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(25), style: { right: 32, top: 606, width: 14, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(30), style: { left: 4, top: 632, width: 12, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(28), style: { right: 14, top: 700, width: 14, opacity: 0.8, imageRendering: 'auto' } },
  { set: 0, slot: 'sidebar', src: sparkle(5), style: { left: 6, top: 180, width: 14, opacity: 0.8, imageRendering: 'auto' } },

  // --- 화면 곳곳의 반짝이 · 눈송이 · 별 (본문 뒤)
  ...SPARKLES.map((src, i): Placement => ({ set: 0, slot: 'page', src, style: scatter(i, 7) })),
]

/* ---------- 바다: 그림 파일 (theme-refs/ocean/ocean-home.png 의 자리를 따름) ---------- */
const O = import.meta.glob<string>('../../assets/themes/ocean/**/*.png', { eager: true, import: 'default' })
const o = (name: string) => O[`../../assets/themes/ocean/${name}.png`]

const OCEAN: Placement[] = [
  // --- 본문 맨 위: 고래 · 물고기 떼 · 방울
  { set: 0, slot: 'header', src: o('whale'), style: { left: '20.4%', top: 4, width: 211 } },
  { set: 0, slot: 'header', src: o('fish/fish_school_top'), style: { left: '37%', top: 52, width: 150 }, wideOnly: true },
  { set: 0, slot: 'header', src: o('bubbles/bubble_top_1'), style: { left: '34.6%', top: 36, width: 26 } },
  { set: 0, slot: 'header', src: o('bubbles/bubble_top_2'), style: { left: '20.2%', top: 70, width: 18 } },

  // --- "꼭 확인할 것" 카드: 해파리 · 산호 · 방울
  { set: 0, slot: 'hero', src: o('jellyfish'), style: { right: '12%', top: 10, width: 34 }, wideOnly: true },
  { set: 0, slot: 'hero', src: o('coral_card_blue'), style: { right: '15%', bottom: 4, width: 80 }, wideOnly: true },
  { set: 0, slot: 'hero', src: o('bubbles/bubble_card_1'), style: { right: '24.5%', bottom: 26, width: 18 }, wideOnly: true },

  // --- "내 작업" 카드: 거북이 · 작은 물고기
  { set: 0, slot: 'tasks', src: o('sea_turtle'), style: { right: '22.4%', top: 56, width: 110 }, wideOnly: true },
  { set: 0, slot: 'tasks', src: o('fish/fish_card_small'), style: { right: '34%', bottom: 26, width: 48 }, wideOnly: true },

  // --- "최근 공지" 카드: 오른쪽 아래 산호와 불가사리
  { set: 0, slot: 'notices', src: o('coral_bottom_right'), style: { right: 0, bottom: 0, width: 114 } },
  { set: 0, slot: 'notices', src: o('starfish'), style: { right: 56, bottom: 2, width: 62 } },

  // --- 사이드바: 메뉴 옆 물고기, 아래쪽 해초 · 산호
  { set: 0, slot: 'sidebar', src: o('fish/fish_sidebar_1'), style: { right: 56, top: 236, width: 64 } },
  { set: 0, slot: 'sidebar', src: o('fish/fish_sidebar_2'), style: { right: 46, top: 492, width: 64 } },
  // 이 조각은 위쪽에 메뉴 글자가 같이 잘려 있어 아래 60% 만 보여 준다
  { set: 0, slot: 'sidebar', src: o('seaweed_sidebar_left'), style: { left: 0, bottom: 150, width: 120, clipPath: 'inset(40% 0 0 0)' }, tallOnly: true },
  { set: 0, slot: 'sidebar', src: o('seaweed_sidebar_right'), style: { right: 0, bottom: 176, width: 52 }, tallOnly: true },
  { set: 0, slot: 'sidebar', src: o('coral_pink_sidebar'), style: { right: 40, bottom: 150, width: 74 }, tallOnly: true },
  { set: 0, slot: 'sidebar', src: o('seaweed_bottom_left'), style: { left: 0, bottom: 0, width: 70 } },
  { set: 0, slot: 'sidebar', src: o('seaweed_bottom_right'), style: { right: 0, bottom: 0, width: 56 } },
]

/* ---------- 우주: 그림 파일 (Penpot "14 Theme · 우주" 의 "Screen · 홈 · 오브젝트 A + 거북이" 자리를 따름) ---------- */
// 카드 안 자리는 Penpot 의 카드 너비(왼쪽 900 · 오른쪽 360px) 기준으로 잰 값이다.
const SP = import.meta.glob<string>('../../assets/themes/space/*.png', { eager: true, import: 'default' })
const sp = (name: string) => SP[`../../assets/themes/space/${name}.png`]

const SPACE: Placement[] = [
  // --- 본문 맨 위: 성운 · 지구 · 위성 (카드 뒤)
  { set: 0, slot: 'header', src: sp('nebula'), style: { left: 376, top: -40, width: 560 } },
  { set: 0, slot: 'header', src: sp('earth'), style: { left: 436, top: -150, width: 250 } },
  { set: 0, slot: 'header', src: sp('satellite'), style: { left: 276, top: 22, width: 130 }, wideOnly: true },
  // --- 화면 아래: 은하 (본문 뒤)
  { set: 0, slot: 'page', src: sp('galaxy'), style: { left: 36, bottom: -18, width: 330 } },
  // --- "꼭 확인할 것" 카드: 혜성
  { set: 0, slot: 'hero', src: sp('comet'), style: { right: '16.9%', top: 15, width: 190 }, wideOnly: true },
  // --- "내 작업" 카드: 로켓
  { set: 0, slot: 'tasks', src: sp('rocket'), style: { right: '24.9%', top: 48, width: 105 }, wideOnly: true },
  // --- "이번 주 일정" 카드: 반짝이
  { set: 0, slot: 'schedule', src: sp('sparkles'), style: { right: 106, bottom: 4, width: 46 } },
  // --- "최근 공지" 카드: 잠든 거북이
  { set: 0, slot: 'notices', src: sp('turtle_sleep_glow'), style: { right: 21, bottom: 0, width: 124 } },
  // --- 사이드바: 망원경 · 인사하는 거북이 · 반짝이
  { set: 0, slot: 'sidebar', src: sp('telescope'), style: { left: 112, bottom: 128, width: 130 }, tallOnly: true },
  { set: 0, slot: 'sidebar', src: sp('turtle_hello_glow'), style: { left: 12, bottom: 120, width: 104 }, tallOnly: true },
  { set: 0, slot: 'sidebar', src: sp('sparkles'), style: { left: 196, bottom: 460, width: 44 }, tallOnly: true },
]

/** 우주: 화면 곳곳에서 제각각 깜빡이는 별 (본문 뒤). 여섯 개에 하나는 큰 네 갈래 별 */
const TWINKLES = Array.from({ length: 54 }, (_, i) => {
  const { left, top, transform } = scatter(i, 23)
  return { left, top, transform, big: i % 6 === 0, delay: -((i * 0.73) % 5), dur: 2.2 + (i % 5) * 0.7 }
})

const SETS: Partial<Record<ThemeId, ThemeObjectSet>> = {
  christmas: { pixel: true, items: CHRISTMAS },
  ocean: { items: OCEAN },
  space: { glow: true, items: SPACE },
}

/**
 * 마우스가 닿으면 위쪽을 축으로 좌우로 흔들리다 멈추는 그림.
 * 그림은 본문 뒤에 깔려 눌리지 않으므로, 마우스 자리가 그림 안인지 직접 본다.
 */
function Swaying({ p }: { p: Placement }) {
  const ref = useRef<HTMLImageElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (on) return
    const move = (e: MouseEvent) => {
      const r = ref.current?.getBoundingClientRect()
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) setOn(true)
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [on])
  return (
    <img
      ref={ref}
      src={p.src}
      alt=""
      draggable={false}
      className={`${s.sway} ${on ? s.swaying : ''} ${p.wideOnly ? s.wideOnly : ''}`}
      style={{ ...p.style, '--sway': `${p.sway}deg` } as CSSProperties}
      onAnimationEnd={() => setOn(false)}
    />
  )
}

/** 물결 한 줄: 같은 모양이 두 번 이어진 그림을 옆으로 천천히 밀어 끊김 없이 흐르게 한다 */
const WAVE_TOP = 'M0 0H1200V30Q1050 60 900 30T600 30T300 30T0 30Z'
const WAVE_BOTTOM = 'M0 60H1200V30Q1050 0 900 30T600 30T300 30T0 30Z'
function Wave({ d, className }: { d: string; className: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 60" preserveAspectRatio="none">
      <path d={d} />
    </svg>
  )
}

/** 바다 테마 카드 안의 꿀렁이는 물결 (카드 내용 뒤). light 는 밝은 카드용 */
function CardWaves({ light }: { light?: boolean }) {
  return (
    <div className={`${s.waves} ${light ? s.wavesLight : ''}`} aria-hidden>
      <Wave d={WAVE_TOP} className={`${s.wave} ${s.waveTopBack}`} />
      <Wave d={WAVE_TOP} className={`${s.wave} ${s.waveTop}`} />
      <Wave d={WAVE_BOTTOM} className={`${s.wave} ${s.waveBottomBack}`} />
      <Wave d={WAVE_BOTTOM} className={`${s.wave} ${s.waveBottom}`} />
    </div>
  )
}

/** 그 자리에 놓을 오브젝트를 그린다 (켜진 묶음만) */
export function ThemeObjects({ slot }: { slot: ObjectSlot }) {
  const { active, objects, effects } = useTheme()
  const set = SETS[active]
  const items = (set?.items ?? []).filter((p) => p.slot === slot && objects[p.set])
  if (items.length === 0) return null
  return (
    <>
    {active === 'ocean' && (slot === 'hero' || slot === 'tasks') && <CardWaves light={slot === 'tasks'} />}
    <div className={`${s.slot} ${s[slot]} ${set?.pixel ? s.pixel : ''} ${set?.glow ? s.glow : ''}`} aria-hidden data-theme-objects={slot}>
      {items.map((p, i) =>
        p.sway && effects ? (
          <Swaying key={i} p={p} />
        ) : (
          <img key={i} src={p.src} alt="" draggable={false} className={`${p.wideOnly ? s.wideOnly : ''} ${p.tallOnly ? s.tallOnly : ''}`} style={p.style} />
        ),
      )}
      {/* 우주: 깜빡이는 별 */}
      {slot === 'page' &&
        active === 'space' &&
        TWINKLES.map((t, i) => (
          <span key={`star${i}`} className={`${s.star} ${t.big ? s.starBig : ''}`} style={{ left: t.left, top: t.top, transform: t.transform, animationDelay: `${t.delay}s`, animationDuration: `${t.dur}s` }} />
        ))}
      {/* 사이드바 맨 아래 쌓인 눈 */}
      {slot === 'sidebar' && active === 'christmas' && <span className={s.snow} />}
      {/* 가만히 있어도 내리는 눈 (두 겹) */}
      {slot === 'page' && active === 'christmas' && (
        <>
          <span className={`${s.snowfall} ${s.snowfallFar}`} />
          <span className={s.snowfall} />
        </>
      )}
    </div>
    </>
  )
}
