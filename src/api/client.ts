// 실서버 API 클라이언트 — 규칙은 docs/api/README.md
// - 세션 쿠키(JSESSIONID) 로그인, 바꾸는 요청은 XSRF-TOKEN 쿠키 값을 X-XSRF-TOKEN 헤더로
// - 응답은 { success, data, error } 로 감싸져 온다
import { getApiBase } from '../lib/dataMode'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Envelope<T> = {
  success: boolean
  data: T
  error: { status: number; code: string; message: string } | null
}

/** /api/v1 앞의 서버 루트 (폼 로그인 · 공개 API 용) */
export function serverRoot() {
  return getApiBase().replace(/\/api\/v\d+\/?$/, '')
}

function readXsrf() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/** 세션이 끊겼거나 비밀번호를 바꿔야 할 때 해당 화면으로 보낸다 */
function handleAuthError(e: ApiError) {
  if (e.code === 'C002' && !location.pathname.startsWith('/login')) location.assign('/login?expired')
  if (e.code === 'A001' && location.pathname !== '/password') location.assign('/password')
}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string | number | boolean | undefined>; root?: boolean }

export async function api<T>(path: string, { method = 'GET', body, query, root }: Options = {}): Promise<T> {
  const base = root ? serverRoot() : getApiBase().replace(/\/$/, '')
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
    : ''
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = readXsrf()
    if (token) headers['X-XSRF-TOKEN'] = token
  }

  const res = await fetch(base + path + qs, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json?.success) {
    const err = new ApiError(res.status, json?.error?.code ?? `HTTP${res.status}`, json?.error?.message ?? `요청이 실패했어요 (${res.status})`)
    handleAuthError(err)
    throw err
  }
  return json.data
}

/**
 * 기존 백엔드의 폼 로그인 (/login).
 * CSRF 쿠키가 아직 없으면 먼저 로그인 화면을 한 번 불러 쿠키를 받는다.
 */
export async function formLogin(username: string, password: string) {
  const root = serverRoot()
  if (!readXsrf()) await fetch(`${root}/login`, { credentials: 'include' }).catch(() => undefined)
  const token = readXsrf()
  const res = await fetch(`${root}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(token ? { 'X-XSRF-TOKEN': token } : {}),
    },
    body: new URLSearchParams({ username, password, ...(token ? { _csrf: token } : {}) }),
  })
  // 폼 로그인은 성공 · 실패 모두 리다이렉트한다. 따라간 최종 주소로 판단한다.
  if (res.url.includes('error') || res.status >= 400) throw new ApiError(401, 'LOGIN_FAILED', '아이디 또는 비밀번호가 올바르지 않습니다.')
  // 실제로 세션이 생겼는지 내 정보로 한 번 더 확인
  return api<{ passwordChangeRequired?: boolean }>('/members/me').catch((e: ApiError) => {
    if (e.code === 'A001') return { passwordChangeRequired: true }
    throw e
  })
}
