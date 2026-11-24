// 테마 고르기 — 고른 값은 이 브라우저에 남기고 <html> 에 표시해 둔다.
//   data-theme   : 틀의 색 (styles/themes.css)
//   data-decor   : 오브젝트 묶음이 하나라도 켜져 있는지 (카드 테두리 무늬 같은 CSS 장식이 본다)
//   data-effects : 마우스에 반응하는 효과를 켤지 (components/theme/MouseEffects.tsx)
// 틀의 색 · 오브젝트 묶음(여러 개) · 마우스 효과는 서로 따로 켜고 끈다.
import { useSyncExternalStore } from 'react'

export type ThemeId = 'default' | 'ocean' | 'christmas' | 'space' | 'dark'
/** 'auto' 는 기기 설정(밝게 · 어둡게)을 따라 기본 ↔ 다크 */
export type ThemeChoice = ThemeId | 'auto'

/** 한 테마가 가질 수 있는 오브젝트 묶음 수의 최대 (오브젝트 1 · 오브젝트 2). 테마마다 실제 수는 objectSets 의 길이 */
export const OBJECT_SET_COUNT = 2

export type ThemeInfo = {
  id: ThemeId
  name: string
  desc: string
  /**
   * 오브젝트 묶음마다 한 줄 설명 (묶음이 하나면 한 줄).
   * 그림은 components/theme/ThemeObjects.tsx (그림 파일) · ThemeDecor.tsx (코드로 그린 것) 에 있다.
   */
  objectSets: string[]
  hasEffects: boolean
  /** 아직 만드는 중이라 고르기 화면에서 숨길지 (개발 서버에서는 보인다) */
  hidden?: boolean
  /** 화면 바탕이 짙어서, 카드 밖에 놓인 제목을 밝은 글자로 써야 하는지 */
  darkPage?: boolean
  /** 이 테마에서 쓸 로고 그림 (public 아래 주소). 없으면 기본 거북이 */
  logoMark?: string
  /** 고르기 화면의 미리보기 색: 사이드바 · 화면 바탕 · 카드 · 강조 · 글자 */
  preview: { sidebar: string; page: string; card: string; accent: string; text: string }
}

/** 새 테마는 여기에 한 줄, styles/themes.css 에 값 묶음 하나를 더한다 */
export const THEMES: ThemeInfo[] = [
  { id: 'default', name: '기본', desc: '남색 · 하늘색', objectSets: [], hasEffects: false, preview: { sidebar: '#1b3554', page: '#eef5fb', card: '#ffffff', accent: '#1b3554', text: '#000f22' } },
  { id: 'ocean', name: '바다', desc: '물빛 바탕 · 고래와 산호 · 방울', objectSets: ['고래 · 해파리 · 거북이 · 물고기 · 산호 · 해초 · 방울'], hasEffects: true, preview: { sidebar: '#0c4879', page: '#8fd0f4', card: '#e9f6fe', accent: '#04335e', text: '#04284a' } },
  {
    id: 'christmas',
    name: '크리스마스',
    desc: '빨강 바탕 · 초록 사이드바 · 크림색 카드 · 지팡이 사탕 테두리',
    objectSets: ['전구 줄 · 리본 · 선물 · 눈 · 반짝이'],
    hasEffects: true,
    darkPage: true,
    preview: { sidebar: '#022c1f', page: '#750d11', card: '#fdefe0', accent: '#0a5a3a', text: '#1f120d' },
  },
  {
    id: 'space',
    name: '우주',
    desc: '검은 밤하늘 · 보랏빛 글로우 · 로켓과 우주 거북이',
    objectSets: ['지구 · 성운 · 은하 · 혜성 · 로켓 · 망원경 · 거북이 · 반짝이는 별'],
    hasEffects: true,
    darkPage: true,
    logoMark: '/brand/iturtle-mark-space.png', // 헬멧을 쓴 우주 거북이
    preview: { sidebar: '#060509', page: '#07060c', card: '#0d0b14', accent: '#8b5cf6', text: '#ffffff' },
  },
  { id: 'dark', name: '다크', desc: '짙은 남색 바탕 · 꾸밈 없이 깔끔하게', objectSets: [], hasEffects: false, preview: { sidebar: '#070e18', page: '#0b1522', card: '#132235', accent: '#3b6ea8', text: '#eef4fb' } },
]

export type ThemeState = {
  choice: ThemeChoice
  /** 오브젝트 묶음별 켜짐 여부 (objects[0] = 오브젝트 1) */
  objects: boolean[]
  effects: boolean
}

const KEY = 'iturtle.theme'
const listeners = new Set<() => void>()
const prefersDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
/** 기기에서 "움직임 줄이기"를 켰으면 마우스 효과를 그리지 않는다 */
export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const allOn = () => Array.from({ length: OBJECT_SET_COUNT }, () => true)

function read(): ThemeState {
  const base: ThemeState = { choice: 'default', objects: allOn(), effects: true }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    // 예전 저장 모양: 테마 이름 문자열, 또는 { choice, decor, effects }
    const v = raw.startsWith('{') ? (JSON.parse(raw) as Partial<ThemeState> & { decor?: boolean }) : { choice: raw as ThemeChoice }
    const choice = v.choice === 'auto' || THEMES.some((t) => t.id === v.choice) ? v.choice! : 'default'
    const objects = Array.isArray(v.objects) ? allOn().map((_, i) => v.objects![i] ?? true) : allOn().map(() => v.decor ?? true)
    return { choice, objects, effects: v.effects ?? true }
  } catch {
    return base
  }
}
let state: ThemeState = read()

/** 고른 값 → 실제로 켤 테마 */
export const resolveTheme = (c: ThemeChoice): ThemeId => (c === 'auto' ? (prefersDark() ? 'dark' : 'default') : c)

function apply() {
  const id = resolveTheme(state.choice)
  const root = document.documentElement
  if (id === 'default') delete root.dataset.theme
  else root.dataset.theme = id
  root.dataset.decor = state.objects.some(Boolean) ? 'on' : 'off'
  root.dataset.effects = state.effects ? 'on' : 'off'
}

export function getThemeState() {
  return state
}

export function setThemeState(patch: Partial<ThemeState>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 저장하지 못해도 이번 접속 동안은 적용된다 */
  }
  apply()
  listeners.forEach((l) => l())
}

/** 앱을 그리기 전에 한 번 부른다 (첫 화면이 기본 색으로 깜빡이지 않게) */
export function initTheme() {
  apply()
  // '자동'일 때 기기 설정이 바뀌면 따라간다
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.choice === 'auto') {
      apply()
      listeners.forEach((l) => l())
    }
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** 지금 테마 상태와 바꾸는 함수들 */
export function useTheme() {
  const s = useSyncExternalStore(subscribe, getThemeState)
  const active = resolveTheme(s.choice)
  const info = THEMES.find((t) => t.id === active)!
  return {
    choice: s.choice,
    /** 실제로 켜진 테마 */
    active,
    info,
    /** 오브젝트 묶음별 켜짐 여부 */
    objects: s.objects,
    effects: s.effects,
    setTheme: (choice: ThemeChoice) => setThemeState({ choice }),
    /** index 번째 오브젝트 묶음 켜기 · 끄기 (0 = 오브젝트 1) */
    setObject: (index: number, on: boolean) => setThemeState({ objects: s.objects.map((v, i) => (i === index ? on : v)) }),
    setEffects: (effects: boolean) => setThemeState({ effects }),
  }
}
