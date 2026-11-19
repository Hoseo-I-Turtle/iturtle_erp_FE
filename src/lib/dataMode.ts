// 목업 / 실서버 선택 — 브라우저(localStorage)에 기억한다
export type DataMode = 'mock' | 'live'

const MODE_KEY = 'iturtle.dataMode'
const BASE_KEY = 'iturtle.apiBase'

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

export function getDataMode(): DataMode | null {
  const v = read(MODE_KEY)
  return v === 'mock' || v === 'live' ? v : null
}
export function getApiBase() {
  return read(BASE_KEY) ?? DEFAULT_API_BASE
}
export function setDataMode(mode: DataMode, apiBase?: string) {
  write(MODE_KEY, mode)
  if (apiBase !== undefined) write(BASE_KEY, apiBase)
}
export function clearDataMode() {
  write(MODE_KEY, null)
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
