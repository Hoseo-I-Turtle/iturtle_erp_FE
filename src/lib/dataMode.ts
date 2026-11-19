// 목업 / 실서버 선택
// - 고른 모드는 메모리에만 둔다 → 새로고침하면 항상 시작 화면(/start)으로 돌아간다
// - 지난번에 고른 모드 · API 주소는 브라우저에 남겨 시작 화면에서 미리 골라 둔다
export type DataMode = 'mock' | 'live'

const LAST_MODE_KEY = 'iturtle.lastDataMode'
const BASE_KEY = 'iturtle.apiBase'
let currentMode: DataMode | null = null

/** 기본 API 주소: .env 의 VITE_API_BASE_URL, 없으면 같은 서버의 /api/v1 */
export const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* 사생활 보호 모드 등에서는 저장하지 못해도 이번 접속 동안만 쓰면 된다 */
  }
}

// 예전 버전이 남긴 "계속 기억" 값은 지운다
write('iturtle.dataMode', null)

/** 지금 쓰는 모드. 새로고침 직후에는 null */
export function getDataMode(): DataMode | null {
  return currentMode
}
/** 시작 화면에서 미리 골라 둘 지난번 모드 */
export function getLastDataMode(): DataMode {
  return read(LAST_MODE_KEY) === 'live' ? 'live' : 'mock'
}
export function getApiBase() {
  return read(BASE_KEY) ?? DEFAULT_API_BASE
}
export function setDataMode(mode: DataMode, apiBase?: string) {
  currentMode = mode
  write(LAST_MODE_KEY, mode)
  if (apiBase !== undefined) write(BASE_KEY, apiBase)
}
export function clearDataMode() {
  currentMode = null
}

/** 실서버 연결 확인: 응답이 오기만 하면(401 포함) 서버가 살아 있다고 본다 */
export async function pingServer(base: string): Promise<{ ok: boolean; message: string }> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/members/me`, { credentials: 'include', signal: ctrl.signal })
    if (res.status === 401 || res.status === 403) return { ok: true, message: '연결됨 · 로그인이 필요해요' }
    if (res.ok) return { ok: true, message: '연결됨 · 이미 로그인되어 있어요' }
    return { ok: true, message: `연결됨 · 응답 ${res.status}` }
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return { ok: false, message: aborted ? '5초 안에 응답이 없어요' : '서버에 닿지 못했어요 (주소 · CORS · 네트워크 확인)' }
  } finally {
    window.clearTimeout(timer)
  }
}
