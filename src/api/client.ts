// 실서버 API 클라이언트 — 규칙은 docs/api/README.md 1.2 · 1.3 · 1.7 · 1.8
// - 세션 쿠키(JSESSIONID) 로그인, 바꾸는 요청은 XSRF-TOKEN 쿠키 값을 X-XSRF-TOKEN 헤더로
// - 응답은 ApiBaseResponse { success, data, error } 로 감싸져 온다
// - 로그인 · 로그아웃은 JSON API 가 아니라 Spring Security 폼 처리(POST /login, POST /logout)라서
//   브라우저가 진짜 폼을 내고 백엔드의 리다이렉트를 그대로 따라가게 한다 (submitBackendForm)
import { getApiBase, keepModeAcrossReload } from '../lib/dataMode'
import { rememberReturnTo } from '../lib/loginReturn'

export class ApiError extends Error {
  status: number
  code: string
  /** C001 입력 검증 실패일 때 필드별 사유 */
  errors: { field: string; reason: string }[] | null
  constructor(status: number, code: string, message: string, errors: { field: string; reason: string }[] | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.errors = errors
  }
}

/** common-code ApiBaseResponse / ErrorResponse */
type Envelope<T> = {
  success: boolean
  data: T
  error: {
    status: number
    code: string
    message: string
    errors?: { field: string; reason: string }[] | null
    traceId?: string
  } | null
}

/** 백엔드가 쓰는 화면 경로 (AuthPaths.LOGIN_PAGE, PasswordChangeRequiredFilter.PASSWORD_PAGE) */
export const LOGIN_PATH = '/login'
export const PASSWORD_PATH = '/account/password'

/** /api/v1 앞의 서버 루트 (폼 로그인 · 로그아웃 · 공개 API 용) */
export function serverRoot() {
  return getApiBase().replace(/\/api\/v\d+\/?$/, '')
}

function readXsrf() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/** 이번 페이지에서 로그인된 응답을 한 번이라도 받았는지. 받은 뒤의 401 은 세션이 끊긴 것(?expired)으로 본다 */
let hadSession = false

/** 세션이 없거나 비밀번호를 바꿔야 할 때 백엔드가 쓰는 화면으로 보낸다 */
function handleAuthError(e: ApiError) {
  const here = location.pathname
  if (e.code === 'C002' && !here.startsWith(LOGIN_PATH)) {
    rememberReturnTo(here + location.search)
    keepModeAcrossReload()
    location.assign(hadSession ? `${LOGIN_PATH}?expired` : LOGIN_PATH)
  }
  if (e.code === 'A001' && here !== PASSWORD_PATH) {
    keepModeAcrossReload()
    location.assign(PASSWORD_PATH)
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  /** true 면 /api/v1 이 아니라 서버 루트 기준 (예: /public/v1/...) */
  root?: boolean
}

export async function api<T>(path: string, { method = 'GET', body, query, root }: Options = {}): Promise<T> {
  const base = root ? serverRoot() : getApiBase().replace(/\/$/, '')
  const params = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const token = readXsrf() ?? (await ensureXsrfToken())
    if (token) headers['X-XSRF-TOKEN'] = token
  }

  const res = await fetch(base + path + (params ? `?${params}` : ''), {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json?.success) {
    const err = new ApiError(
      res.status,
      json?.error?.code ?? `HTTP${res.status}`,
      json?.error?.message ?? `요청이 실패했어요 (${res.status})`,
      json?.error?.errors ?? null,
    )
    handleAuthError(err)
    throw err
  }
  hadSession = true
  return json.data
}

/**
 * XSRF-TOKEN 쿠키가 없으면 받아 온다. 백엔드는 모든 응답에 이 쿠키를 내려 준다(common-code CsrfCookieFilter).
 * 로그인 화면(GET /login)은 운영에서 프론트(nginx)가 주므로, 늘 백엔드로 가는 /api 를 한 번 부른다 (로그인 전이면 401 이어도 쿠키는 온다).
 */
export async function ensureXsrfToken(): Promise<string | null> {
  const have = readXsrf()
  if (have) return have
  await fetch(`${getApiBase().replace(/\/$/, '')}/members/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }).catch(() => undefined)
  return readXsrf()
}

/**
 * 폼 숨은 필드(_csrf)에 넣을 값. 백엔드는 csrf.spa() 라서 헤더는 쿠키 값 그대로 받지만,
 * 폼 파라미터는 Spring 의 XorCsrfTokenRequestAttributeHandler 방식(무작위 바이트 + 토큰 XOR, Base64 URL)으로 가려진 값만 받는다.
 */
export function maskCsrfToken(token: string) {
  const tokenBytes = new TextEncoder().encode(token)
  const random = crypto.getRandomValues(new Uint8Array(tokenBytes.length))
  const combined = new Uint8Array(tokenBytes.length * 2)
  combined.set(random)
  for (let i = 0; i < tokenBytes.length; i++) combined[tokenBytes.length + i] = random[i] ^ tokenBytes[i]
  let bin = ''
  combined.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_')
}

/** CSRF 토큰을 채운 뒤 폼을 브라우저가 직접 낸다. 백엔드의 리다이렉트(멈췄던 SSO 요청 등)를 브라우저가 그대로 따라간다 */
export async function submitBackendForm(form: HTMLFormElement) {
  const token = await ensureXsrfToken()
  let field = form.querySelector<HTMLInputElement>('input[name="_csrf"]')
  if (!field) {
    field = document.createElement('input')
    field.type = 'hidden'
    field.name = '_csrf'
    form.appendChild(field)
  }
  field.value = token ? maskCsrfToken(token) : ''
  keepModeAcrossReload()
  // form.submit() 은 onSubmit 을 다시 부르지 않는다
  form.submit()
}

/** 폼 로그인 주소 (POST, 파라미터 loginId · password · _csrf) — AuthSecurityConfig.LOGIN_ID_PARAMETER */
export const loginAction = () => `${serverRoot()}${LOGIN_PATH}`

/**
 * 로그아웃 (POST /logout). 끝나면 백엔드가 /login?logout 으로 보낸다.
 * CSRF 가 켜져 있어 GET 으로는 로그아웃되지 않는다.
 */
export async function logout() {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = `${serverRoot()}/logout`
  form.style.display = 'none'
  document.body.appendChild(form)
  await submitBackendForm(form)
}
