# 프론트가 부르는 API 목록

실서버 모드에서 프론트가 부르는 API 입니다. 경로는 `/api/v1` 아래이고, 따로 적은 것만 서버 루트입니다.
기준은 `docs/api/` 명세이며 **아직 실제 백엔드에서 호출해 보지 않았습니다.** 확인할 곳은 코드의 `명세 확인 필요` 주석에 있습니다.

- 호출 코드 위치: `src/api/client.ts`(공통), `members.ts`, `communication.ts`, `projects.ts`, `content.ts`, `admin.ts`
- 서로 다른 경로 기준 약 80개 (명세 전체 148개). 나머지는 디자인이 없는 기능용 → `docs/missing-screens.md`

## 로그인 · 계정

| 메서드 | 경로 | 쓰는 곳 |
|---|---|---|
| POST | `/login` (서버 루트, 폼 로그인) | 로그인 |
| PATCH | `/auth/password` | 비밀번호 변경 |
| POST | `/public/v1/signup-applications` (서버 루트) | 가입 신청 |
| GET · PATCH | `/members/me` | 로그인 확인, 내 프로필 (다른 화면들도 "나"를 알 때 GET) |
| PUT · DELETE | `/members/{id}/photo` + `POST /files/uploads`, `/files/uploads/{id}/complete` | 프로필 사진 |
| GET | `/auth/service-access/me` | 내 서비스 권한 |
| GET · PUT | `/notifications/settings` | 알림 받기 설정 |
| GET · DELETE | `/github/accounts/{id}`, 이동 `/github/link/start` | GitHub 연결 · 해제 |

## 홈 · 공지 · 캘린더 · 모임 날짜 · 알림

| 메서드 | 경로 | 쓰는 곳 |
|---|---|---|
| GET | `/notices`, `/notices/{id}` | 홈, 공지 상세, 다른 공지 |
| PUT | `/notices/{id}/poll/my-vote` | 투표 |
| GET · POST | `/comments` (`targetType=NOTICE`) | 공지 댓글 |
| GET | `/meeting-polls`, `/meeting-polls/{id}` | 홈, 모임 날짜 |
| PUT | `/meeting-polls/{id}/my-response` | 내 가능 시간 저장 |
| POST | `/meeting-polls/{id}/remind`, `/meeting-polls/{id}/confirm` | 알림 다시 보내기, 확정 |
| GET | `/calendar-events` | 홈 이번 주 일정, 캘린더, 모임 날짜(내 일정), 프로젝트 개요 |
| GET · PUT | `/calendar-settings/me` | 캘린더 보기 설정 |
| GET | `/tasks` (`mine`, `awaitingMyReview`, 기한 범위) | 홈 내 작업, 캘린더 기한 |
| GET | `/milestones` | 캘린더, 프로젝트 개요 |
| GET | `/weekly-reports/me/{주 시작일}` | 홈 "주간 보고 안 냄" |
| GET | `/projects` (`mine`) | 홈 내 프로젝트 |
| GET | `/sso/apps` | 홈 서비스 바로 가기 |
| GET | `/notifications`, `/notifications/unread-count` | 알림 화면, 헤더 종 (1분마다 확인) |
| POST | `/notifications/read` | 읽음 · 모두 읽음 |

## 프로젝트 · 작업

| 메서드 | 경로 | 쓰는 곳 |
|---|---|---|
| GET | `/projects` | 프로젝트 목록 |
| GET | `/projects/{key}` | 프로젝트 헤더, 개요, 보드, 작업 상세 |
| GET | `/projects/{key}/links`, `/links/status`, `/activities`, `/milestones` | 프로젝트 개요 |
| GET | `/tasks?projectKey=` | 칸반 보드, 개요 기한 |
| POST | `/tasks/{key}/transition` | 보드 이동, 작업 상세 상태 변경 · 반려 |
| GET · PATCH | `/tasks/{key}` | 작업 상세, 보드 순서 |
| PATCH | `/tasks/{key}/checklist-items/{id}` | 체크리스트 |
| PUT · DELETE | `/tasks/{key}/watch` | 구독 |
| GET · POST | `/comments` (`targetType=TASK`) | 작업 댓글 |
| GET · PATCH · PUT · POST | `/projects/{key}/service-access`, `/{서비스}`, `/members`, `/{서비스}/sync` | 서비스 권한 설정 |
| POST | `/projects/{key}/vault-path-requests` | Vault 경로 묶기 신청 |

## 스레드 · 회의록 · 주간 보고 · 자료실

| 메서드 | 경로 | 쓰는 곳 |
|---|---|---|
| GET · POST | `/projects/{key}/threads` | 스레드 목록, 새 글 |
| PATCH | `/projects/{key}/threads/{id}` | 고정 · 해제 |
| PUT | `/projects/{key}/threads/pinned-order` | 고정 순서 |
| GET · POST | `/comments` (`targetType=PROJECT_THREAD`) | 답글 |
| GET | `/meeting-minutes`, `/meeting-minutes/{id}`, `/meeting-minutes/{id}/revisions` | 회의록, 다른 회의록, 수정 이력 |
| PUT | `/meeting-minutes/{id}` | 회의록 저장 (409 충돌 처리) |
| POST | `/meeting-minutes/{id}/actions/convert-to-tasks` | 할 일 → 작업 |
| GET · PUT | `/weekly-reports/me/{주 시작일}` | 내 보고 (자동 저장) |
| PATCH | `/weekly-reports/{id}` | 제출 |
| GET | `/weekly-reports` | 제출 현황, 구성원별 보고 |
| GET · POST | `/weekly-reports/github-activity`, `/weekly-reports/github-activity/refresh` | GitHub 활동 |
| GET | `/comments` (`targetType=WEEKLY_REPORT`) | 지난 주 코멘트 |
| GET | `/documents`, `/documents/tags` | 자료실 |

## 구성원 · 관리

| 메서드 | 경로 | 쓰는 곳 |
|---|---|---|
| GET | `/members`, `/members/{id}` | 구성원 화면, 관리 · 구성원 |
| GET | `/projects?memberId=`, `/github/accounts/{id}` | 구성원 카드 |
| GET | `/members/roles` | 관리 · 구성원, 프리셋 |
| PATCH | `/members/{id}` | 구분 변경 |
| PUT | `/members/{id}/roles` | 역할 저장 |
| POST | `/members/{id}/preset-applications` | 프리셋 적용 |
| POST | `/members/{id}/disable` · `enable` · `unlock` · `reset-password` | 계정 조치 |
| GET · POST | `/projects/handover`, `/members/{id}/departures` | 졸업 처리 |
| GET · POST · PATCH | `/role-presets`, `/role-presets/{id}` | 권한 프리셋 |
| GET · POST | `/signup-applications`, `/signup-applications/{id}/review`, `GET /members/identifier-check` | 가입 신청 승인 · 거절 |
| GET · POST | `/auth/access-requests`, `/auth/access-requests/{id}/review` | 권한 신청 승인 · 거절 |
| GET | `/audit-logs`, `/audit-logs/export` | 감사 로그, CSV |
| GET · PUT · POST | `/backoffice/common-codes`, `…/{id}/details`, `…/details/{code}`, `…/cache/evict` | 공통코드 (`/api/v1` 아래인지 서버 루트인지 확인 필요 — `src/api/admin.ts` 의 `CODES_AT_ROOT`) |
| POST | `/sso/clients/{id}/secret` | client secret 발급 |
| GET · POST | `/github/accounts`, `/github/webhook-deliveries`, `/github/link-reminders`, `/github/org-sync` | 관리 · GitHub |

## 백엔드와 맞춰 볼 것

- 공통코드 API 경로(`/api/v1` 아래인지 서버 루트인지)와 필드 이름
- `GET /sso/apps` 응답 모양 (명세에 없음)
- 자료 목록 응답에 파일 ID 가 없음 → 내려받기 버튼이 실서버에서 동작 안 함
- 폼 로그인(`/login`)의 필드 이름(`username` · `password`)과 CSRF 처리
