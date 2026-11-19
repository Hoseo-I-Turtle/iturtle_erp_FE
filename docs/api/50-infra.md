# 50. 감사 로그 · GitHub API (audit, github)

[README](README.md) 의 공통 규칙(1.7 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙)을 따릅니다. 경로 앞의 `/api/v1` 은 줄여 씁니다.
테이블은 [db/50-infra.md](../db/50-infra.md), 요구사항은 [srs/50-infra.md](../srs/50-infra.md) 입니다.
권한 신청(INF-1)은 [10](10-member.md) 에 있습니다.

## 공통 모양

| 이름 | 모양 | 비고 |
|------|------|------|
| `MemberRef` | `{ memberId, name, memberType, status, photoUrl }` | README 1.4 |
| `PageResponse<T>` | `{ content, page, size, totalElements, totalPages, hasNext }` | common-code |
| `GithubAccount` | `{ memberId, githubUserId, githubLogin, linkedAt, orgStatus, orgTeam, orgError, orgSyncedAt }` | `member_github_accounts`. `org*` 는 본인과 `github-manage` 에게만 (README 1.11 규칙 4) |

## 전제 (README 3장 제안)

- **[R4]** 로그인 성공 · 실패도 `audit_logs` 에 `category = LOGIN` 으로 남는다고 보고 씁니다. 그래서 감사 로그 화면은 `audit_logs` 하나만 읽습니다. `login_histories` 는 잠금 판단용으로 auth 에 그대로 둡니다.
- **[T6]** 알림 종류 `GITHUB_LINK_REQUEST`, `GITHUB_UNLINKED` 가 있다고 보고 씁니다.

---

## API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| AU-1 | GET | `/audit-logs` | `audit-read` | 감사 로그 조회 · 거르기 |
| AU-2 | GET | `/audit-logs/export` | `audit-read` | 같은 조건으로 CSV 내려받기 |
| G-1 | GET | `/github/link/start` | 본인 | GitHub 계정 연결 시작 (GitHub 로 302) |
| G-2 | GET | `/github/link/callback` | 본인 | GitHub 가 돌려보내는 주소 (내 프로필로 302) |
| G-3 | GET | `/github/accounts/{memberId}` | 로그인 | 한 구성원의 GitHub 연결 |
| G-4 | GET | `/github/accounts` | `github-manage` | 구성원별 연결 · 조직 상태, 조직에만 있는 계정 |
| G-5 | DELETE | `/github/accounts/{memberId}` | 본인 | 연결 해제 |
| G-6 | POST | `/github/org-sync` | `github-manage` | 조직 초대 · 제거 (다시 시도 포함) |
| G-7 | POST | `/github/link-reminders` | `github-manage` | 연결 안 한 구성원에게 알림 보내기 |
| G-8 | GET | `/github/webhook-deliveries` | `github-manage` | 웹훅 수신 기록 |
| G-9 | POST | `/webhooks/github` | 공개 (서명) | GitHub 웹훅 받기 — **`/api` 밖, Cloudflare Tunnel 로 이 경로만 공개** |

저장소의 줄 수 제외 패턴(PRJ-4-24)은 프로젝트 연동 서비스 설정([30](30-project.md)), "지금 새로 받기"(INF-3-12)는 주간 보고([32](32-minute-report.md))에 있습니다.

---

## 1. 감사 로그 — INF-2 (화면: 04 · 관리 · 감사 로그)

감사 로그를 **쓰는** HTTP API 는 없습니다. 다른 모듈이 `AuditEvent` 를 내면 커밋된 뒤 따로 저장됩니다 (INF-2-01, 결정 Q20). 고치기 · 지우기 API 도 없습니다 (INF-2-02).

### AU-1. 감사 로그 조회

`GET /api/v1/audit-logs`

| 항목 | 내용 |
|------|------|
| 권한 | `audit-read` (없으면 403, INF-2 수용 기준) |
| 요구사항 | INF-2-03, 04, 06 |
| 테이블 | `audit_logs` (`idx_audit_logs_occurred`, `_actor`, `_target`, `_category`) |
| 감사 로그 · 알림 | 조회는 남기지 않음 (내려받기만 남김) |

구성원 상세의 "이 사람에 대한 감사 로그"(INF-2-04)도 이 API 를 `targetType=MEMBER&targetId=<구성원 번호>` 로 부릅니다.

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `from`, `to` | date | | 기간 (Asia/Seoul 날짜, 끝 포함). 기본 최근 7일. 최대 1년 (보관 기간) |
| `actorMemberId` | number | | 행위자. `0` 이면 시스템 처리만 |
| `actorLoginId` | string | | 행위자 로그인 ID (스냅숏 `actor_login_id` 로 찾음. 로그인 실패처럼 구성원이 없는 행도 찾음) |
| `category` | string | | `MEMBER`, `ROLE`, `SIGNUP`, `OPERATION`, `PROJECT`, `CONTENT`, `EXTERNAL`, `LOGIN` |
| `action` | string | | `AuditAction` 이름 (`ROLE_CHANGED` …) |
| `targetType` | string | | `AuditTargetType` 이름 (`MEMBER`, `PROJECT` …) |
| `targetId` | string | | 대상 값 (구성원 번호, 프로젝트 키, `FILE_POLICY/MAX_ATTACHMENT_MB`) |
| `result` | `SUCCESS` \| `FAILURE` | | |
| `page`, `size` | | | 최신 순 고정 |

**응답** `200 OK` — `PageResponse<AuditLogItem>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `auditLogId` | number | |
| `occurredAt` | string | |
| `actor` | `{ memberId, loginId, name }` \| null | null 이면 "시스템". `name` 은 지금 이름, `loginId` 는 그때 값 |
| `category` | string | 화면의 색 칩 |
| `action` | string | |
| `target` | `{ type, id, label }` | `label` = 그때 표시 이름 스냅숏 |
| `changes` | object \| null | `{ "roles": { "before": [...], "after": [...] } }`. 비밀번호 · secret · 토큰 값은 들어 있지 않음 |
| `summary` | string \| null | 사람이 읽는 한 줄 |
| `result` | `SUCCESS` \| `FAILURE` | |
| `failureReason` | string \| null | |
| `clientIp` | string \| null | |
| `userAgent` | string \| null | 원문. 화면이 "Chrome · Windows" 로 줄여 보여 줌 |

```json
{
  "success": true,
  "data": {
    "content": [
      { "auditLogId": 9012, "occurredAt": "2026-11-17T01:42:00Z",
        "actor": { "memberId": 3, "loginId": "minseo", "name": "김민서" },
        "category": "ROLE", "action": "ROLE_CHANGED",
        "target": { "type": "MEMBER", "id": "20221187", "label": "구성원 20221187 박지훈" },
        "changes": { "roles": { "before": ["report-write", "project-create"], "after": ["report-write", "project-create", "penpot-member"] } },
        "summary": null, "result": "SUCCESS", "failureReason": null,
        "clientIp": "10.8.0.12", "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/131.0" },
      { "auditLogId": 9008, "occurredAt": "2026-11-16T23:55:00Z", "actor": null,
        "category": "LOGIN", "action": "LOGIN_FAILED",
        "target": { "type": "MEMBER", "id": "hyunwoo", "label": "hyunwoo" },
        "changes": null, "summary": "비밀번호 5회 연속 틀림 → 5분 잠금", "result": "FAILURE",
        "failureReason": "LOCKED", "clientIp": "10.8.0.44", "userAgent": "…" }
    ],
    "page": 0, "size": 20, "totalElements": 472, "totalPages": 24, "hasNext": true
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `AU001` | `from` 이 `to` 보다 늦거나, 기간이 1년을 넘음 |

### AU-2. CSV 내려받기

`GET /api/v1/audit-logs/export`

| 항목 | 내용 |
|------|------|
| 권한 | `audit-read` |
| 요구사항 | INF-2-05 |
| 테이블 | `audit_logs` (읽기) + 내려받기 기록 한 줄 쓰기 |
| 감사 로그 · 알림 | `OPERATION` / `AUDIT_EXPORTED`, `changes` 에 거르기 조건과 건수 |

**요청 헤더**

| 헤더 | 값 |
|------|----|
| `Accept` | `text/csv` |

**쿼리 파라미터** — AU-1 과 같음 (`page`, `size` 없음)

**응답** `200 OK`

| 헤더 | 값 |
|------|----|
| `Content-Type` | `text/csv; charset=UTF-8` (엑셀이 한글을 읽도록 BOM 포함) |
| `Content-Disposition` | `attachment; filename="audit-logs-20261111-20261117.csv"` |

```csv
시각(KST),행위자,로그인 ID,분류,사건,대상 종류,대상,대상 이름,바뀐 내용,결과,실패 사유,IP,User-Agent
2026-11-17 10:42:00,김민서,minseo,ROLE,ROLE_CHANGED,MEMBER,20221187,구성원 20221187 박지훈,"{""roles"":{…}}",SUCCESS,,10.8.0.12,Mozilla/5.0 …
```

- 시각은 읽기 쉽게 **KST** 로 씁니다 (API JSON 은 UTC).
- 한 번에 10,000건까지. 넘으면 기간을 줄이게 합니다.

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `AU001` | 기간이 틀림 |
| 400 | `AU002` | 10,000건을 넘음 |

---

## 2. GitHub 연동 — INF-3 (화면: 05 · 내 프로필, 04 · 관리 · GitHub, 02 · 구성원)

### G-1. 연결 시작

`GET /api/v1/github/link/start`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (로그인) |
| 요구사항 | INF-3-01 |
| 테이블 | 없음 (세션에 `state` 저장) |

내 프로필의 "GitHub 연결" 버튼이 이 주소로 **페이지 이동**합니다 (XHR 아님). 브라우저가 WARP 안이라 공개 경로가 필요 없습니다.

**요청 본문** — 없음

**응답** `302 Found`

| 헤더 | 값 |
|------|----|
| `Location` | `https://github.com/login/oauth/authorize?client_id=<App client id>&redirect_uri=https://lab.iturtle.win/api/v1/github/link/callback&state=<무작위 32바이트>` |

**에러** — 이미 연결했으면 302 대신 `409 G001` (JSON). 화면은 버튼을 숨기므로 보통 나오지 않습니다.

### G-2. 연결 콜백

`GET /api/v1/github/link/callback`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (G-1 을 시작한 세션) |
| 요구사항 | INF-3-01, 02, 04, 14 |
| 테이블 | `member_github_accounts`, `github_sync_jobs`(`ORG_INVITE`), `github_commits.member_id`(이전 커밋 잇기, `idx_github_commits_author`) |
| 감사 로그 · 알림 | `EXTERNAL` / `GITHUB_LINKED` |

GitHub 가 브라우저를 이 주소로 돌려보냅니다. 서버는 `code` 로 사용자 토큰을 받아 **사용자 번호 · 아이디만 확인하고 토큰은 버립니다** (저장하지 않음). 연결되면 구분별 팀(공통코드 `GITHUB_ORG_TEAM`)으로 조직 초대 작업을 만듭니다.

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `code` | string | O | GitHub 가 준 값 |
| `state` | string | O | G-1 에서 세션에 넣은 값과 같아야 함 |
| `error` | string | | 사용자가 GitHub 에서 거절하면 `access_denied` |

**응답** `302 Found` — 결과를 내 프로필 화면 주소에 붙여 보냅니다 (브라우저 이동이라 JSON 을 줄 수 없음).

| 결과 | `Location` |
|------|-----------|
| 성공 | `/profile?github=linked` |
| 실패 | `/profile?github=error&code=<에러 코드>` |

**에러** (`code` 값으로 전달)

| 코드 | 언제 |
|------|------|
| `G001` | 이미 연결함 |
| `G002` | 그 GitHub 계정이 다른 구성원에게 연결됨 (INF-3 수용 기준) |
| `G003` | `state` 가 없거나 다름, 10분이 지남, 사용자가 거절함 |
| `G004` | GitHub 에 사용자 확인을 못 함 |

### G-3. 한 구성원의 GitHub 연결

`GET /api/v1/github/accounts/{memberId}`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. `org*` 필드는 본인 · `github-manage` 에게만 (README 1.11 규칙 4) |
| 요구사항 | INF-3-01, MEM-2-05 (구성원 카드의 GitHub 아이디) |
| 테이블 | `member_github_accounts` |

내 프로필과 구성원 카드가 같은 API 를 씁니다 (README 1.11 규칙 1).

**경로 파라미터** — `memberId` (number)

**응답** `200 OK` — `GithubAccount` (연결 안 했으면 `data: null`)

```json
{ "success": true, "data": { "memberId": 3, "githubUserId": 58123901, "githubLogin": "minseo-k",
  "linkedAt": "2026-09-02T04:00:00Z", "orgStatus": "MEMBER", "orgTeam": "students", "orgError": null,
  "orgSyncedAt": "2026-09-02T04:01:10Z" }, "error": null }
```

다른 사람이 볼 때: `{ "memberId": 3, "githubUserId": 58123901, "githubLogin": "minseo-k", "linkedAt": "…" }` (`org*` 없음)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |

### G-4. 구성원별 연결 · 조직 상태 (관리)

`GET /api/v1/github/accounts`

| 항목 | 내용 |
|------|------|
| 권한 | `github-manage` |
| 요구사항 | INF-3-05, 06 |
| 테이블 | `member_github_accounts`, `members`(member query API). 조직 구성원 목록은 GitHub API 로 읽고 5분 캐시 (저장하지 않음, db 50) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `linked` | boolean | | 연결 여부 |
| `orgStatus` | string | | `NONE`, `INVITED`, `MEMBER`, `REMOVE_PENDING`, `REMOVE_FAILED`, `REMOVED` |
| `memberStatus` | string | | 기본 `ACTIVE`. 졸업생의 제거 실패를 보려면 `ALL` |
| `page`, `size` | | | |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `summary` | `{ activeCount, linkedActiveCount, orgMemberCount, needsCleanupCount }` | 화면 위 숫자 (`9 / 10`, `11`, `2`). `orgMemberCount` 는 GitHub 를 못 읽으면 null |
| `orgOnly` | `{ status, accounts: [ { githubLogin, githubUserId } ] }` | **조직에는 있는데 ERP 에 연결된 구성원이 없는 계정** (INF-3-06). `status` = `OK` \| `UNAVAILABLE` |
| `members` | `PageResponse<{ member: MemberRef, account: GithubAccount \| null }>` | 구성원별 상태 |

```json
{
  "success": true,
  "data": {
    "summary": { "activeCount": 10, "linkedActiveCount": 9, "orgMemberCount": 11, "needsCleanupCount": 2 },
    "orgOnly": { "status": "OK", "accounts": [ { "githubLogin": "old-member", "githubUserId": 40112233 } ] },
    "members": { "content": [
      { "member": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "GRADUATED", "photoUrl": null },
        "account": { "memberId": 4, "githubUserId": 51000001, "githubLogin": "jihoon-p", "linkedAt": "…",
                     "orgStatus": "REMOVE_FAILED", "orgTeam": "students", "orgError": "권한 부족 (403)", "orgSyncedAt": "…" } },
      { "member": { "memberId": 12, "name": "문지호", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null }, "account": null }
    ], "page": 0, "size": 20, "totalElements": 12, "totalPages": 1, "hasNext": false }
  },
  "error": null
}
```

`needsCleanupCount` = `orgOnly` 수 + `REMOVE_FAILED` 수.

**에러** — 공통만 (GitHub 장애는 `orgOnly.status = UNAVAILABLE`)

### G-5. 연결 해제

`DELETE /api/v1/github/accounts/{memberId}`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (`memberId` = 나) |
| 요구사항 | INF-3-03 |
| 테이블 | `member_github_accounts`(행 지움), `github_commits.member_id` 는 그대로 (지난 주간 보고 숫자 유지) |
| 감사 로그 · 알림 | `EXTERNAL` / `GITHUB_UNLINKED`. `github-manage` 에게 `GITHUB_UNLINKED` 알림 (조직에서 뺄지 정하게) |

조직에서 **자동으로 빼지 않습니다**. 해제한 계정은 G-4 의 `orgOnly` 에 나타나고, `github-manage` 가 G-6 으로 뺍니다.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | 남의 연결을 해제하려 함 |
| 404 | `G005` | 연결된 계정이 없음 |

### G-6. 조직 초대 · 제거

`POST /api/v1/github/org-sync`

| 항목 | 내용 |
|------|------|
| 권한 | `github-manage` |
| 요구사항 | INF-3-03, 04, 05, 06 |
| 테이블 | `github_sync_jobs`(`ORG_INVITE` \| `ORG_REMOVE`, `payload` 에 `githubLogin`), `member_github_accounts.org_status` |
| 감사 로그 · 알림 | 작업이 끝나면 `EXTERNAL` / `GITHUB_ORG_INVITED` · `GITHUB_ORG_REMOVED` (결과 포함) |

다시 시도("제거 실패" → 다시)와 처음 요청이 같은 API 입니다. GitHub 호출은 작업으로 따로 돌고, 이 API 는 작업만 만듭니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `action` | `INVITE` \| `REMOVE` | O | |
| `memberId` | number | 둘 중 하나 | 연결된 구성원. `INVITE` 는 재실 구성원만 |
| `githubLogin` | string | 둘 중 하나 | `orgOnly` 계정 제거용 (`REMOVE` 만) |

```json
{ "action": "REMOVE", "memberId": 4 }
```
```json
{ "action": "REMOVE", "githubLogin": "old-member" }
```

**응답** `202 Accepted`

```json
{ "success": true, "data": { "jobId": 771, "status": "PENDING" }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `G006` | `memberId` 와 `githubLogin` 이 둘 다 없거나 둘 다 있음, `INVITE` 에 `githubLogin` |
| 404 | `G005` | `memberId` 구성원이 GitHub 를 연결하지 않음 |
| 400 | `G008` | 재실이 아닌 구성원을 초대하려 함 |
| 409 | `G007` | 같은 대상의 조직 작업이 이미 대기 · 실행 중 |

### G-7. 연결 요청 알림 보내기

`POST /api/v1/github/link-reminders`

| 항목 | 내용 |
|------|------|
| 권한 | `github-manage` |
| 요구사항 | 관리 · GitHub 화면 "알림 보내기" (SRS 에 없음, README T6) |
| 테이블 | `notifications` (`GITHUB_LINK_REQUEST`) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `memberIds` | number[] | O | 1~50명. 이미 연결했거나 재실이 아닌 사람은 건너뜀 |

```json
{ "memberIds": [12] }
```

**응답** `200 OK`

```json
{ "success": true, "data": { "sentMemberIds": [12], "skippedMemberIds": [] }, "error": null }
```

**에러** — 공통만

### G-8. 웹훅 수신 기록

`GET /api/v1/github/webhook-deliveries`

| 항목 | 내용 |
|------|------|
| 권한 | `github-manage` |
| 요구사항 | INF-3-12, 15 |
| 테이블 | `github_webhook_deliveries` (30일), `scheduled_job_runs`(다시 훑기 `github-rescan` 의 마지막 실행, backoffice query API) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `event` | string | | `push`, `installation`, `installation_repositories`, `organization` |
| `status` | string | | `RECEIVED`, `PROCESSED`, `FAILED`, `REJECTED_SIGNATURE` |
| `page`, `size` | | | 최신 순 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `lastReceivedAt` | string \| null | 마지막으로 서명이 맞은 수신 |
| `stale` | boolean | 마지막 수신이 24시간보다 오래됨 → 화면 경고 (INF-3-15) |
| `lastRescan` | `{ startedAt, status }` \| null | 하루 한 번 다시 훑기 ("마지막 05:00") |
| `deliveries` | `PageResponse<{ deliveryId, event, repositoryFullName, status, error, receivedAt, processedAt, summary }>` | `summary` = "defme_BE · feature/oidc-logout · 커밋 2" (처리 결과로 만듦) |

```json
{ "success": true, "data": {
  "lastReceivedAt": "2026-11-17T01:41:00Z", "stale": false,
  "lastRescan": { "startedAt": "2026-11-16T20:00:00Z", "status": "SUCCEEDED" },
  "deliveries": { "content": [
    { "deliveryId": "f3a1c2d0-c3a1-11ef-8f1c-5e2a1b9c0d11", "event": "push", "repositoryFullName": "Hoseo-I-Turtle/defme_BE",
      "status": "PROCESSED", "error": null, "receivedAt": "2026-11-17T01:41:00Z", "processedAt": "2026-11-17T01:41:03Z",
      "summary": "defme_BE · feature/oidc-logout · 커밋 2" },
    { "deliveryId": "…", "event": "push", "repositoryFullName": null, "status": "REJECTED_SIGNATURE",
      "error": "서명 불일치 · 401 로 거절", "receivedAt": "2026-11-17T00:55:00Z", "processedAt": null, "summary": null }
  ], "page": 0, "size": 20, "totalElements": 214, "totalPages": 11, "hasNext": true } }, "error": null }
```

`summary` 를 응답에 담으려면 처리할 때 한 줄을 남겨야 하는데 `github_webhook_deliveries` 에 칸이 없습니다 → `summary varchar(200)` 추가를 제안합니다.

**에러** — 공통만

### G-9. GitHub 웹훅 받기

`POST /webhooks/github`

| 항목 | 내용 |
|------|------|
| 권한 | 공개. 로그인 · CSRF 없음. **서명 검증만** (INF-3-09). Cloudflare Tunnel 이 이 경로 하나만 넘긴다 (NFR-ENV-05) |
| 요구사항 | INF-3-08~11, NFR-SEC-10 |
| 테이블 | `github_webhook_deliveries`, `github_sync_jobs`(`FETCH_PUSH`), `github_repositories.installation_id`, `member_github_accounts.org_status` |
| 감사 로그 · 알림 | 없음 (수신 기록만) |

**요청 헤더** (GitHub 가 보냄)

| 헤더 | 필수 | 값 · 처리 |
|------|------|-----------|
| `X-Hub-Signature-256` | O | `sha256=<hex>`. 본문 **원본 바이트**를 웹훅 비밀값(Vault, INF-3-14)으로 HMAC-SHA256 한 값과 **상수 시간 비교**. 없거나 다르면 본문을 읽지 않고 401 |
| `X-GitHub-Delivery` | O | 수신 ID (GUID). `github_webhook_deliveries.delivery_id`. 이미 있으면 처리하지 않고 200 (INF-3-10) |
| `X-GitHub-Event` | O | `push`, `installation`, `installation_repositories`, `organization`, `ping`. 그 밖의 이벤트는 기록만 하고 200 |
| `X-GitHub-Hook-Installation-Target-ID` | | App ID. 등록한 App 이 아니면 401 |
| `Content-Type` | O | `application/json` (웹훅 설정을 JSON 으로) |
| `User-Agent` | | `GitHub-Hookshot/…` (검사에 쓰지 않음) |

**요청 본문** — GitHub 이벤트 원문. 저장하지 않고 필요한 값만 꺼냅니다 (db 50).

| 이벤트 | 꺼내는 값 | 하는 일 |
|--------|-----------|---------|
| `push` | `repository.id`, `ref`, `before`, `after`, `commits[].id` | 연결된 저장소면 `FETCH_PUSH` 작업 생성 (`payload` = 브랜치 · before/after). 줄 수 조회는 작업이 함 (INF-3-11). 연결 안 된 저장소는 `PROCESSED` + "연결 안 된 저장소" |
| `installation`, `installation_repositories` | `installation.id`, `repositories_added[]`, `repositories_removed[]` | `github_repositories.installation_id` 갱신 |
| `organization` | `action`(`member_added`, `member_removed`, `member_invited`), `membership.user.id` | `org_status` 갱신 (초대 수락 → `MEMBER`, 탈퇴 → `REMOVED`) |
| `ping` | | 아무것도 안 함 |

**처리 순서**

1. 본문 크기 25MB 초과 → 413 `C008` (GitHub 최대, NFR-SEC-10)
2. IP 당 분당 횟수 초과 → 429 `G011`
3. 헤더 확인 → 없으면 400 `G010`
4. 서명 확인 → 틀리면 401 `G009`, 수신 기록 `REJECTED_SIGNATURE` (헤더 값만, 본문은 읽지 않음)
5. 같은 `X-GitHub-Delivery` → 200 (`duplicate: true`)
6. 수신 기록 `RECEIVED` → 작업 생성 · 간단한 갱신 → `PROCESSED` (실패면 `FAILED` + `error`)
7. **10초 안에** 응답 (INF-3-11)

**응답** `202 Accepted` (중복 · `ping` · 처리하지 않는 이벤트는 `200 OK`)

```json
{ "success": true, "data": { "deliveryId": "f3a1c2d0-c3a1-11ef-8f1c-5e2a1b9c0d11", "duplicate": false }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `G010` | `X-GitHub-Delivery` · `X-GitHub-Event` 가 없음 |
| 401 | `G009` | 서명이 없거나 틀림, 모르는 App (아무것도 저장 · 처리하지 않음, INF-3 수용 기준) |
| 413 | `C008` | 25MB 초과 |
| 429 | `G011` | 너무 자주 보냄 (`Retry-After` 헤더) |

---

## 에러 코드

### audit (`AU`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 400 | `AU001` | `INVALID_AUDIT_PERIOD` | 기간이 올바르지 않아요. 시작일이 종료일보다 앞이고 1년 안이어야 해요. |
| 400 | `AU002` | `EXPORT_TOO_LARGE` | 내려받을 기록이 10,000건을 넘어요. 기간을 줄여 주세요. |

### github (`G`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 409 | `G001` | `GITHUB_ALREADY_LINKED` | 이미 GitHub 계정을 연결했어요. 바꾸려면 먼저 해제해 주세요. |
| 409 | `G002` | `GITHUB_ACCOUNT_TAKEN` | 다른 구성원에게 연결된 GitHub 계정이에요. |
| 400 | `G003` | `LINK_STATE_INVALID` | 연결 요청이 만료됐거나 올바르지 않아요. 다시 시도해 주세요. |
| 502 | `G004` | `GITHUB_AUTH_FAILED` | GitHub 에서 계정을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요. |
| 404 | `G005` | `GITHUB_ACCOUNT_NOT_FOUND` | 연결된 GitHub 계정이 없어요. |
| 400 | `G006` | `ORG_SYNC_TARGET_INVALID` | 구성원이나 GitHub 아이디 중 하나만 넣어 주세요. |
| 409 | `G007` | `ORG_SYNC_IN_PROGRESS` | 이미 처리 중인 조직 작업이 있어요. |
| 400 | `G008` | `MEMBER_NOT_ACTIVE` | 재실 구성원만 조직에 초대할 수 있어요. |
| 401 | `G009` | `WEBHOOK_SIGNATURE_INVALID` | 웹훅 서명이 없거나 올바르지 않아요. |
| 400 | `G010` | `WEBHOOK_HEADER_MISSING` | 웹훅 헤더(X-GitHub-Delivery, X-GitHub-Event)가 없어요. |
| 429 | `G011` | `WEBHOOK_RATE_LIMITED` | 요청이 너무 많아요. 잠시 뒤 다시 보내 주세요. |
