# Iturtle Frontend

연구실 운영 포털(공지 · 일정 · 프로젝트 · 주간 보고 · 관리)의 프론트엔드입니다.
디자인은 Penpot `랩실` 파일의 `02`~`06 Screens` 페이지를 기준으로 구현했습니다.

## 기술

React 19 · TypeScript · Vite · React Router · CSS Modules · lucide-react · marked + DOMPurify(Markdown) · mermaid(다이어그램)

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
```

> Windows 의 Git Bash 에서 `npm run` 이 `node` 를 못 찾으면 PowerShell 에서 실행하세요.

## 목업 / 실서버

처음 접속하면 데이터 출처를 고르는 화면(`/start`)이 나옵니다. 사이드바 아래에서 언제든 바꿀 수 있어요.

- **목업 데이터**: 서버 없이 `src/mocks/` 의 데이터로 모든 화면이 동작합니다. 새로 고침하면 처음 상태로 돌아갑니다.
- **실서버**: ERP 백엔드 API(`docs/api/`)를 부릅니다. 개발 서버가 `/api` · `/login` · `/logout` · `/public` 요청을 백엔드로 넘깁니다.
  백엔드 주소는 `.env.example` 을 `.env.local` 로 복사해 `BACKEND_URL` 을 바꾸세요 (기본 `http://localhost:8080`).

## 폴더

```
src/
  api/          실서버 API 클라이언트 · 화면별 데이터 훅 (응답 → 화면 모양 변환)
  components/   공용 UI (ui/), Markdown · mermaid (markdown/)
  layouts/      사이드바 · 헤더 · 프로젝트/관리 탭 · 로그인 레이아웃
  lib/          날짜 · 목업/실서버 모드 · 알림 저장소
  mocks/        목업 데이터 (필드 이름은 API 명세를 따름)
  pages/        화면 (home, notices, calendar, library, members, projects, reports, admin, account, start)
  styles/       디자인 토큰 (Penpot 디자인 시스템과 1:1)
docs/api/       API 명세
```

## 상태

- `02`~`05 Screens` 의 화면 29개와 `06 Screens · 추가` 의 화면 37개 구현 완료 (목업 모드에서 동작 확인).
- 실서버 연결은 명세 기준으로 작성했으며, 실제 백엔드와 맞춰 보는 작업이 남아 있습니다. 코드에서 `명세 확인 필요` 주석을 찾으면 확인할 곳이 나옵니다.
- 나중에 디자인을 더한 화면 목록과 주소는 [docs/missing-screens.md](docs/missing-screens.md) 에 있습니다.
