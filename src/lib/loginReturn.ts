// 로그인 뒤 원래 보던 화면으로 돌아가기
// 백엔드 폼 로그인은 성공하면 "멈춰 둔 요청"(백엔드가 직접 받은 화면 요청, 예: Vault 에서 시작한 /oauth2/authorize)으로,
// 없으면 / 로 보낸다 (LoginSuccessHandler). 프론트 화면은 정적 파일이라 백엔드가 멈춰 두지 못하므로,
// API 가 401 을 줘서 로그인 화면으로 보낼 때 보던 주소를 여기 적어 두고, 로그인 뒤 / 에 도착하면 그리로 바꿔 끼운다.
// SSO 로 이어 가는 경우는 백엔드가 / 가 아닌 인가 주소로 보내므로 여기 값을 쓰지 않는다.
const RETURN_KEY = 'iturtle.returnTo'
const SUBMITTED_KEY = 'iturtle.loginSubmitted'
/** 적어 둔 주소를 쓸 수 있는 시간. 로그인 화면에 오래 머문 뒤에는 / 로 둔다 */
const MAX_AGE_MS = 30 * 60 * 1000

function get(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function set(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    /* 저장하지 못하면 로그인 뒤 홈으로 간다 */
  }
}

/** 로그인 화면으로 보내기 직전에 지금 주소를 적어 둔다 */
export function rememberReturnTo(path: string) {
  if (path === '/' || path.startsWith('/login') || path.startsWith('/account/password') || path.startsWith('/start')) return
  set(RETURN_KEY, JSON.stringify({ path, at: Date.now() }))
}

/** 로그인 폼을 내기 직전에 부른다 */
export function markLoginSubmitted() {
  set(SUBMITTED_KEY, '1')
}

/**
 * 앱을 처음 그리기 전에 한 번 부른다. 방금 로그인해서 / 에 도착했고 적어 둔 주소가 있으면 주소창을 그 주소로 바꾼다.
 * 라우터를 만들기 전에 불러야 라우터가 바꾼 주소로 시작한다.
 */
export function applyLoginReturn() {
  const submitted = get(SUBMITTED_KEY) === '1'
  set(SUBMITTED_KEY, null)
  if (!submitted) return
  // 로그인 화면으로 돌아왔으면(실패) 적어 둔 주소는 다음 시도를 위해 남긴다
  if (location.pathname.startsWith('/login')) return
  const raw = get(RETURN_KEY)
  set(RETURN_KEY, null)
  if (location.pathname !== '/' || location.search || !raw) return
  try {
    const { path, at } = JSON.parse(raw) as { path: string; at: number }
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && Date.now() - at < MAX_AGE_MS) {
      history.replaceState(null, '', path)
    }
  } catch {
    /* 망가진 값은 버린다 */
  }
}
