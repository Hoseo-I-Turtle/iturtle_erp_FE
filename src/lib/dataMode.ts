// 목업 / 실서버 선택
// - 운영 빌드(import.meta.env.PROD)는 실서버만 쓴다. 시작 화면(/start) · 사이드바의 모드 바꾸기가 없다
// - 개발 서버에서는 고른 모드를 메모리에만 둔다 → 새로고침하면 시작 화면(/start)으로 돌아간다
//   단, 폼 로그인 · 로그아웃처럼 백엔드가 페이지를 다시 여는 이동은 keepModeAcrossReload() 로 모드를 한 번 넘긴다
// - 지난번에 고른 모드 · API 주소는 브라우저에 남겨 시작 화면에서 미리 골라 둔다 (개발 서버만)
export type DataMode = 'mock' | 'live'

/** 운영 빌드면 true. 모드를 고르는 화면 · 버튼을 감춘다 */
export const IS_PROD = import.meta.env.PROD
/** 목업 / 실서버를 바꿀 수 있는지 (개발 서버만) */
export const MODE_SWITCHABLE = !IS_PROD

const LAST_MODE_KEY = 'iturtle.lastDataMode'
const BASE_KEY = 'iturtle.apiBase'
const RELOAD_MODE_KEY = 'iturtle.reloadMode'

/** 기본 API 주소: .env 의 VITE_API_BASE_URL, 없으면 같은 서버의 /api/v1 */
export const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

const local = () => localStorage
const session = () => sessionStorage

function read(key: string, storage: () => Storage = local) {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null, storage: () => Storage = local) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    /* 사생활 보호 모드 등에서는 저장하지 못해도 이번 접속 동안만 쓰면 된다 */
  }
}

/** 직전 페이지가 넘겨 준 모드 (한 번 읽으면 지운다) */
function takeReloadMode(): DataMode | null {
  const v = read(RELOAD_MODE_KEY, session)
  write(RELOAD_MODE_KEY, null, session)
  return v === 'live' || v === 'mock' ? v : null
}

// 예전 버전이 남긴 "계속 기억" 값은 지운다
if (!IS_PROD) write('iturtle.dataMode', null)

let currentMode: DataMode | null = IS_PROD ? 'live' : takeReloadMode()

/** 지금 쓰는 모드. 운영 빌드는 늘 live, 개발 서버는 새로고침 직후 null */
export function getDataMode(): DataMode | null {
  return IS_PROD ? 'live' : currentMode
}
/** 시작 화면에서 미리 골라 둘 지난번 모드 */
export function getLastDataMode(): DataMode {
  return read(LAST_MODE_KEY) === 'live' ? 'live' : 'mock'
}
/** API 주소. 운영 빌드는 바꿀 수 없다 (같은 호스트의 /api/v1 — nginx 가 백엔드로 넘긴다) */
export function getApiBase() {
  if (IS_PROD) return DEFAULT_API_BASE
  return read(BASE_KEY) ?? DEFAULT_API_BASE
}
export function setDataMode(mode: DataMode, apiBase?: string) {
  if (IS_PROD) return
  currentMode = mode
  write(LAST_MODE_KEY, mode)
  if (apiBase !== undefined) write(BASE_KEY, apiBase)
}
export function clearDataMode() {
  if (IS_PROD) return
  currentMode = null
}

/**
 * 페이지를 통째로 다시 여는 이동(폼 로그인 · 로그아웃 · GitHub 연결 · 멈췄던 SSO 로그인 이어 가기) 직전에 부른다.
 * 개발 서버에서 다음 페이지가 시작 화면으로 튕기지 않도록 지금 모드를 한 번만 넘긴다. 운영 빌드에서는 할 일이 없다.
 */
export function keepModeAcrossReload() {
  if (IS_PROD || !currentMode) return
  write(RELOAD_MODE_KEY, currentMode, session)
}

/** 실서버 연결 확인: 응답이 오기만 하면(401 포함) 서버가 살아 있다고 본다 */
export async function pingServer(base: string): Promise<{ ok: boolean; message: string }> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/members/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (res.status === 401) return { ok: true, message: '연결됨 · 로그인이 필요해요' }
    // 403 A001: 임시 비밀번호로 로그인한 세션
    if (res.status === 403) return { ok: true, message: '연결됨 · 비밀번호를 바꿔야 해요' }
    if (res.ok) return { ok: true, message: '연결됨 · 이미 로그인되어 있어요' }
    return { ok: true, message: `연결됨 · 응답 ${res.status}` }
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return { ok: false, message: aborted ? '5초 안에 응답이 없어요' : '서버에 닿지 못했어요 (주소 · CORS · 네트워크 확인)' }
  } finally {
    window.clearTimeout(timer)
  }
}
