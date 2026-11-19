import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 실서버 모드에서 쓸 ERP 백엔드 주소. .env.local 에 BACKEND_URL=http://... 로 바꾼다.
  const target = env.BACKEND_URL || 'http://localhost:8080'

  // 세션 쿠키 · XSRF 쿠키를 쓰려면 프론트와 백엔드가 같은 주소여야 해서 개발 서버가 대신 전달한다.
  // /login 은 프론트 화면이기도 하므로, 브라우저가 페이지로 열 때(HTML 요청)는 프론트가 응답한다.
  const proxy = {
    target,
    changeOrigin: true,
    bypass: (req: { method?: string; headers: Record<string, string | string[] | undefined> }) => {
      const accept = String(req.headers.accept ?? '')
      return req.method === 'GET' && accept.includes('text/html') ? '/index.html' : undefined
    },
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': proxy,
        '/login': proxy,
        '/logout': proxy,
        '/public': proxy,
      },
    },
  }
})
