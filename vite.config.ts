import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 실서버 모드에서 쓸 ERP 백엔드 주소. .env.local 에 BACKEND_URL=http://... 로 바꾼다.
  const target = env.BACKEND_URL || 'http://localhost:8080'

  // 세션 쿠키 · XSRF 쿠키를 쓰려면 프론트와 백엔드가 같은 주소여야 해서 개발 서버가 대신 전달한다.
  // 운영 nginx(백엔드 저장소 infra/reverse-proxy/nginx/conf.d/lab.conf.example)와 같은 경로를 넘긴다.
  // /login · /logout 은 프론트 화면이기도 하므로, 브라우저가 페이지로 열 때(GET + HTML 요청)는 프론트가 응답한다.
  // → POST /login (폼 로그인) · POST /logout 만 백엔드로 간다.
  const pageOrBackend = {
    target,
    changeOrigin: true,
    bypass: (req: { method?: string; headers: Record<string, string | string[] | undefined> }) => {
      const accept = String(req.headers.accept ?? '')
      return req.method === 'GET' && accept.includes('text/html') ? '/index.html' : undefined
    },
  }
  // 늘 백엔드로: API · 공개 API, OIDC 인증 서버(/oauth2 · /.well-known · /connect · /userinfo), MCP, 웹훅.
  // /oauth2/authorize 는 브라우저가 페이지로 여는 주소라 HTML 요청이어도 백엔드가 받아야 한다.
  const backend = { target, changeOrigin: true }

  return {
    plugins: [react()],
    server: {
      proxy: {
        // /api 는 페이지 이동(GitHub 연결 시작 GET /api/v1/github/link/start)도 백엔드가 받아야 한다
        '/api': backend,
        '/public': backend,
        '/login': pageOrBackend,
        '/logout': pageOrBackend,
        '/oauth2': backend,
        '/.well-known': backend,
        '/connect': backend,
        '/userinfo': backend,
        '/mcp': backend,
        '/webhooks': backend,
      },
    },
  }
})
