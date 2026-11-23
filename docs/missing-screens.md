# 디자인이 없는 화면 목록

Penpot `02`~`05 Screens` 에 디자인이 없어 프론트에서 "준비 중"으로 막아 두었던 화면 · 동작입니다.
Penpot `06 Screens · 추가` 에 디자인을 추가한 뒤 코드로 구현했습니다 (2026-11-24, 목업 모드 기준).
디자인에는 있지만 API 명세에 없는 항목은 코드에 `명세 확인 필요` 주석으로 남겼습니다.

상태: `대기` → `디자인 완료` → `구현 완료`

## 1. 메뉴 · 링크는 있는데 막혀 있는 화면

| # | 화면 | 주소 | 들어가는 곳 | 관련 API | 상태 |
|---|------|------|------------|---------|------|
| 1 | 공지 목록 | `/notices` | 사이드바 "공지사항" (지금은 공지 상세로 바로 보냄) | `GET /notices` | 구현 완료 |
| 2 | 작업 목록 | `/projects/:key/tasks` | 프로젝트 탭, 홈 "내 작업 · 모두 보기" | `GET /tasks?projectKey=` | 구현 완료 |
| 3 | 마일스톤 | `/projects/:key/milestones` | 프로젝트 탭, 개요 "마일스톤 · 전체" | `GET /milestones?projectKey=` | 구현 완료 |
| 4 | 프로젝트 자료 | `/projects/:key/files` | 프로젝트 탭 | `GET /documents?projectKey=` | 구현 완료 |
| 5 | 자료 상세 | `/library/:id` | 자료실 글 제목, 고정 자료 | `GET /documents/{id}` | 구현 완료 |
| 6 | 프로젝트 설정 나머지 탭 | `/projects/:key/settings` | 설정 왼쪽 메뉴: 일반 · 참여자 · 라벨 · 연동 서비스 · 보관 · 삭제 | `docs/api/30-project.md` | 구현 완료 |

## 2. 버튼은 있는데 열리는 화면이 없는 것

| # | 화면 / 창 | 버튼 위치 | 상태 |
|---|----------|----------|------|
| 7 | 공지 쓰기 · 수정 | 공지 헤더 "공지 쓰기", 공지 상세 연필 | 구현 완료 |
| 8 | 작업 만들기 | 프로젝트 헤더 "작업 만들기", 보드 열의 + | 구현 완료 |
| 9 | 일정 추가 | 캘린더 헤더 "일정 추가" | 구현 완료 |
| 10 | 회의록 쓰기 · 회의록 목록 | 프로젝트 회의록 헤더 "회의록 쓰기", "다른 회의록 · 전체", 캘린더 "이 날 회의록 만들기" | 구현 완료 |
| 11 | 자료 올리기 | 자료실 헤더 "자료 올리기" | 구현 완료 |
| 12 | 프로젝트 만들기 | 프로젝트 목록 헤더 | 구현 완료 |
| 13 | 마일스톤 만들기 | 마일스톤 탭 헤더 | 구현 완료 |
| 14 | 검색 결과 | 모든 화면 헤더의 검색창 | 구현 완료 |
| 15 | 새로 만들기 메뉴 | 홈 등 헤더 "새로 만들기" (무엇을 만들지 고르는 메뉴) | 구현 완료 |
| 16 | 구성원 추가 | 관리 · 구성원 헤더 | 구현 완료 |
| 17 | 코드 그룹 · 행 추가 | 관리 · 공통코드 | 구현 완료 |
| 18 | 회의록 수정 이력 보기 | 회의록 오른쪽 "수정 이력 · 보기" | 구현 완료 |
| 19 | 스레드 글 수정 · 삭제 | 스레드 글 "고치기", 더 보기 | 구현 완료 |

## 3. API 명세에서 "디자인 추가 필요"로 적힌 것

API 는 있는데 화면이 없던 것입니다 (`docs/api/README.md` 2장 마지막 줄 · 3.4). 모두 Penpot `06 Screens · 추가` 에 있습니다.

| # | 화면 (Penpot 보드 이름) | 관련 API | 상태 |
|---|------------------------|---------|------|
| 20 | 내 작업 | `GET /tasks?mine=true`, `GET /tasks?awaitingMyReview=true` | 구현 완료 |
| 21 | 프로젝트 설정 · 권한 신청 | `GET /auth/access-requests?scope=REVIEW&projectKey=`, `POST /auth/access-requests/{id}/review` | 구현 완료 |
| 22 | 권한 신청하기 | `GET /auth/service-access/me`, `POST /auth/access-requests`, `GET /auth/access-requests?scope=MINE`, `PATCH /auth/access-requests/{id}` | 구현 완료 |
| 23 | 모임 날짜 만들기 | `POST /meeting-polls`, `GET /meeting-polls` | 구현 완료 |
| 24 | 자료실 · 지운 자료 | `GET /documents?deleted=true`, `POST /documents/{id}/restore` | 구현 완료 |
| 25 | 관리 · Vault 경로 묶기 | `GET /vault-path-requests`, `POST /vault-path-requests/{id}/review` | 구현 완료 |
| 26 | 관리 · 연동 상태 | `GET /projects/service-access`, `GET /backoffice/job-runs` | 구현 완료 |
| 27 | 관리 · 파일 사용량 | `GET /files/usage` | 구현 완료 |

- 관리 화면 탭에 "연동 상태" · "파일" 두 개가 늘었습니다 (26 · 27 보드 기준).
- 프로젝트 설정 왼쪽 메뉴에 "연동 서비스" · "권한 신청" 이 늘었습니다 (6 · 21 보드 기준). 먼저 만든 설정 보드(일반 · 참여자 · 라벨 · 보관 · 삭제)의 메뉴에는 아직 없습니다.

## 진행 순서

사이드바에서 바로 들어가는 것 → 프로젝트 기본 흐름 → 나머지 순으로 합니다.
Penpot 페이지 `06 Screens · 추가` 에 `Screen · 이름` 보드로 만들고, 기존 화면의 사이드바 · 헤더 · 카드 스타일을 그대로 씁니다.
`01 Screens-아이디어스케치` 의 공지사항 · 글쓰기 · 글 상세 · 회의록 시안을 참고합니다.

1. 공지 목록
2. 공지 쓰기
3. 작업 목록
4. 작업 만들기
5. 마일스톤 (목록 · 만들기)
6. 회의록 목록 · 쓰기
7. 자료 상세 · 자료 올리기 · 프로젝트 자료
8. 일정 추가
9. 프로젝트 만들기 · 설정 나머지 탭
10. 검색 결과 · 새로 만들기 메뉴
11. 관리: 구성원 추가 · 코드 추가
12. 회의록 수정 이력 · 스레드 수정/삭제

## 구현하면서 생긴 주소

| 화면 | 주소 |
|------|------|
| 내 작업 | `/tasks` |
| 검색 결과 | `/search?q=` |
| 권한 신청하기 | `/access-requests` |
| 모임 날짜 만들기 | `/calendar/polls/new` |
| 지운 자료 | `/library/deleted` |
| 일정표 | `/projects/:key/timeline` |
| 회의록 쓰기 · 상세 · 수정 이력 | `/projects/:key/minutes/new` · `/minutes/:minuteId` · `/minutes/:minuteId/revisions` |
| 관리 · 연동 상태 · 파일 | `/admin/ops` · `/admin/files` |

Vault 경로 묶기는 관리 · 권한 신청(`/admin/role-requests`) 안의 탭이고, 프로젝트 설정의 탭(일반 · 참여자 · 라벨 · 연동 서비스 · 권한 신청 · 보관 · 삭제)은 `/projects/:key/settings` 안에서 바뀝니다.
만들기 창(공지 · 작업 · 마일스톤 · 일정 · 자료 · 프로젝트 · 구성원)은 주소 없이 그 화면 위에 뜹니다.
