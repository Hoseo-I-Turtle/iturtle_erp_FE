# 30. 프로젝트 API (PRJ-1)

[README](README.md) 의 공통 규칙(1.7 헤더, 1.8 공통 에러, 1.10 작성 형식, 1.11 규칙)을 따릅니다.

- 경로는 모두 `/api/v1` 아래입니다. 표에서는 `/api/v1` 을 줄여 씁니다.
- 아래 응답 JSON 은 **`ApiBaseResponse` 의 `data` 부분만** 적습니다 (`{ "success": true, "data": …, "error": null }`).
- 요청 헤더는 공통 헤더(1.7)만 씁니다. 더 필요한 API 만 따로 적습니다.
- 작업 · 보드 · 스레드는 [31-task.md](31-task.md), 회의록 · 주간 보고는 [32-minute-report.md](32-minute-report.md) 에 있습니다.

---

## 0. 공통

### 0.1 공통 모양

**`MemberRef`** — 구성원 표시 (README 1.4)

| 필드 | 타입 | 설명 |
|------|------|------|
| `memberId` | number | |
| `name` | string | |
| `memberType` | string | `PROFESSOR` · `STUDENT` · `INTERN` |
| `status` | string | `ACTIVE` · `GRADUATED` · `LEFT` (졸업 · 퇴실이면 화면이 "졸업" 표시) |
| `photoUrl` | string \| null | `/api/v1/files/{사진 publicId}/download?size=128` ([40](40-document-file.md)). 사진이 없으면 null |

**`ProjectRef`** — 다른 문서에서 프로젝트를 가리킬 때

| 필드 | 타입 | 설명 |
|------|------|------|
| `projectKey` | string | `DEFME` |
| `name` | string | |
| `status` | string | ProjectStatus |
| `visibility` | string | `LAB` · `PRIVATE` |

**`ProjectMemberRef`** — 참여자

| 필드 | 타입 | 설명 |
|------|------|------|
| `member` | MemberRef | |
| `role` | string | ProjectRole: `MANAGER` · `MEMBER` · `FORMER`(이전 참여자) |
| `joinedAt` | string (시각) | |
| `leftAt` | string \| null | 이전 참여자가 된 시각 |

**`ProjectPermissions`** — 보는 사람이 이 프로젝트에서 할 수 있는 일. 화면이 버튼을 그릴지 정하는 데만 씁니다 (실제 검사는 각 API 가 다시 함).

| 필드 | 타입 | 참 조건 ([SRS 프로젝트 권한](../srs/30-project.md#프로젝트-권한)) |
|------|------|------|
| `canManage` | boolean | PM, `project-manage` — 설정 · 참여자 · 마일스톤 · 라벨 · 연동 서비스 · 서비스 권한 |
| `canWriteTasks` | boolean | PM, 참여자, `project-manage` — 작업 만들기 · 고치기 · 상태 바꾸기 |
| `canComment` | boolean | PM, 참여자, `project-observe`, `project-manage` — 댓글 · 스레드 · 회의록 |
| `canArchive` | boolean | PM, `project-manage` (보관 · 보관 풀기) |
| `canDelete` | boolean | `project-manage` |

보관(`ARCHIVED`)된 프로젝트는 `canArchive`(보관 풀기), `canDelete` 를 빼면 모두 false 입니다 (PRJ-1-06).

**`ServiceLevel`** 값

| 서비스 | 값 |
|--------|----|
| Vault | `NONE` · `READ` · `WRITE` |
| Jenkins | `NONE` · `READ` · `BUILD` |

### 0.2 열람 규칙

이 문서의 "볼 수 있음"은 다음 중 하나입니다. 아니면 **404 `P001`** 로 답합니다 (NFR-SEC-03).

| 보는 사람 | 볼 수 있는 프로젝트 |
|-----------|---------------------|
| PM · 참여자 (`MANAGER` · `MEMBER`) | 그 프로젝트 |
| `project-observe` · `project-manage` | 모든 프로젝트 (비공개 포함) |
| `project-view-public` | 공개 범위 `LAB` 인 프로젝트 |
| 그 밖 (예: 인턴 기본 프리셋) | 참여 중인 프로젝트만 |

이전 참여자(`FORMER`)는 참여자로 치지 않습니다.

---

## API 목록

| # | 메서드 | 경로 | 권한 | 요약 |
|---|--------|------|------|------|
| P-1 | GET | `/projects` | 로그인 | 프로젝트 목록 (+ 카테고리별 개수) |
| P-2 | POST | `/projects` | `project-create` | 프로젝트 만들기 |
| P-3 | GET | `/projects/{projectKey}` | 볼 수 있음 | 프로젝트 상세 (홈 개요, 참여자, 내 권한) |
| P-4 | PATCH | `/projects/{projectKey}` | PM, `project-manage` | 설정 고치기 · 상태 바꾸기 · 보관 · 보관 풀기 |
| P-5 | DELETE | `/projects/{projectKey}` | `project-manage` | 프로젝트 지우기 (숨김) |
| P-6 | POST | `/projects/{projectKey}/members` | PM, `project-manage` | 참여자 더하기 |
| P-7 | PATCH | `/projects/{projectKey}/members/{memberId}` | PM, `project-manage` | 프로젝트 역할 바꾸기 |
| P-8 | POST | `/projects/{projectKey}/members/{memberId}/remove` | PM, `project-manage` | 참여자 빼기 (담당 작업 넘기기) |
| P-9a | GET | `/projects/handover?memberId=` | PM, `project-manage`, `member-manage` | 한 구성원의 참여 · 끝나지 않은 담당 작업 (참여자 빼기 · 졸업 처리 확인) |
| P-9 | GET | `/projects/{projectKey}/activities` | 볼 수 있음 | 활동 기록 (프로젝트 전체 · 작업 하나) |
| P-10 | GET | `/milestones` | 로그인 | 여러 프로젝트의 마일스톤 기한 (캘린더 · 프로젝트 홈). 작업 기한은 `GET /tasks` |
| P-11 | GET | `/projects/{projectKey}/links` | 볼 수 있음 | 연동 서비스 연결 목록 |
| P-12 | POST | `/projects/{projectKey}/links` | PM, `project-manage` | 연동 서비스 연결 |
| P-13 | PATCH | `/projects/{projectKey}/links/{linkId}` | PM, `project-manage` | 연결 고치기 (GitHub 제외 패턴 포함) |
| P-14 | DELETE | `/projects/{projectKey}/links/{linkId}` | PM, `project-manage` | 연결 끊기 |
| P-15 | GET | `/projects/{projectKey}/links/status` | 볼 수 있음 | 연동 서비스 상태 (Jenkins · Penpot · GitHub, 5분 캐시) |
| P-16 | GET | `/projects/{projectKey}/service-access` | 볼 수 있음 | 프로젝트 서비스 권한 (설정 · 구성원별 · 프로비저닝 결과) |
| P-17 | PATCH | `/projects/{projectKey}/service-access/{service}` | PM, `project-manage` | 서비스 켜기 · 끄기, 역할별 기본 수준 |
| P-18 | PUT | `/projects/{projectKey}/service-access/members` | PM, `project-manage` | 구성원별 수준 저장 |
| P-19 | POST | `/projects/{projectKey}/service-access/{service}/sync` | PM, `project-manage` | 프로비저닝 다시 시도 |
| P-20 | GET | `/projects/service-access` | `sso-admin` | 모든 프로젝트의 프로비저닝 실패 · 불일치 |
| P-21 | POST | `/projects/{projectKey}/vault-path-requests` | PM, `project-manage` | 기존 Vault 경로 묶기 신청 |
| P-22 | GET | `/vault-path-requests` | `sso-admin` | Vault 경로 묶기 신청 목록 |
| P-23 | POST | `/vault-path-requests/{requestId}/review` | `sso-admin` | Vault 경로 묶기 승인 · 거절 |
| P-24 | GET | `/projects/{projectKey}/labels` | 볼 수 있음 | 라벨 목록 |
| P-25 | POST | `/projects/{projectKey}/labels` | PM, `project-manage` | 라벨 만들기 |
| P-26 | PATCH | `/projects/{projectKey}/labels/{labelId}` | PM, `project-manage` | 라벨 고치기 |
| P-27 | DELETE | `/projects/{projectKey}/labels/{labelId}` | PM, `project-manage` | 라벨 지우기 |
| P-28 | GET | `/projects/{projectKey}/milestones` | 볼 수 있음 | 마일스톤 목록 (진행률) |
| P-29 | POST | `/projects/{projectKey}/milestones` | PM, `project-manage` | 마일스톤 만들기 |
| P-30 | PATCH | `/projects/{projectKey}/milestones/{milestoneId}` | PM, `project-manage` | 마일스톤 고치기 · 닫기 · 다시 열기 |
| P-31 | POST | `/projects/{projectKey}/meeting-polls` | 볼 수 있음 | 프로젝트 참여자 대상 모임 날짜 정하기 만들기 |

화면 ↔ API:

| 화면 | API |
|------|-----|
| 03 · 프로젝트 목록 | P-1 |
| 03 · 프로젝트 홈 | P-3 (개요 · 참여자), P-28 (마일스톤), P-9 (최근 활동), P-10 + `GET /calendar-events?projectId=` (다가오는 일정 · 기한), P-11 + P-15 (연동 서비스 카드), P-16 (서비스 권한 요약) |
| 03 · 프로젝트 설정 · 서비스 권한 | P-16, P-17, P-18, P-19, P-21 |
| 프로젝트 설정 (일반 · 참여자 · 라벨 · 연동 서비스 · 보관 · 삭제) — 화면 없음 | P-4, P-5, P-6~P-8, P-24~P-27, P-11~P-14 |
| 02 · 캘린더 (작업 기한 · 마일스톤 층) | P-10 |
| 02 · 구성원 (참여 중인 프로젝트) | P-1 `?memberId=` |

**만들지 않은 API** (README 1.11 규칙 1): 카테고리 개수 · 키 중복 확인 · "다가오는 일정" · 참여자 빼기 미리보기 · 멘션 후보 API 는 따로 두지 않습니다. 각각 P-1 응답의 `categoryCounts`, P-2 의 409, P-10 + 캘린더 일정 API, [작업 목록 API](31-task.md) 를 담당자로 거른 결과, P-3 의 `members` 로 화면이 만듭니다.

---

## 1. 프로젝트 — PRJ-1

### P-1. 프로젝트 목록

`GET /api/v1/projects`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. **볼 수 있는 프로젝트만** 나오고 개수에도 들어가지 않음 (PRJ-1-02, [0.2](#02-열람-규칙)) |
| 요구사항 | PRJ-1-02, MEM-2-07 |
| 테이블 | `projects`, `project_members`, `milestones`, `tasks`(진행률 계산), `common_code_details`(`PROJECT_CATEGORY`) |
| 감사 로그 · 알림 | 없음 |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `categoryCode` | string | X | `PROJECT_CATEGORY` 상세 코드 (`DEV`) |
| `status` | string | X | ProjectStatus. 여러 개는 쉼표 (`PREPARING,ACTIVE`) |
| `includeArchived` | boolean | X | 기본 false. false 면 `ARCHIVED` 를 뺀다 ("보관 포함") |
| `mine` | boolean | X | true 면 내가 PM · 참여자인 것만 ("내 프로젝트") |
| `memberId` | number | X | 그 구성원이 PM · 참여자인 것만 (구성원 상세의 "참여 중인 프로젝트", MEM-2-07). 보는 사람의 열람 규칙은 그대로 |
| `keyword` | string | X | 이름 · 키 부분 일치 (2자 이상) |
| `page`, `size`, `sort` | | X | 기본 `sort=name,asc`. `size` 최대 100 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `categoryCounts` | object | `{ "ALL": 9, "DEV": 4, … }`. `categoryCode` 를 뺀 나머지 조건으로 센 개수 (탭 숫자) |
| `page` | PageResponse&lt;ProjectSummary&gt; | |

`ProjectSummary`

| 필드 | 타입 | 설명 |
|------|------|------|
| `projectKey`, `name`, `status`, `visibility` | | ProjectRef |
| `categoryCode`, `categoryName` | string | |
| `summary` | string \| null | 설명의 첫 줄 (Markdown 기호 뺀 100자까지) |
| `startsOn`, `endsOn` | string \| null | 날짜 |
| `myRole` | string | `MANAGER` · `MEMBER` · `NONE`(참여 안 함) |
| `memberCount` | number | PM + 참여자 수 |
| `memberPreview` | MemberRef[] | 앞의 5명 (PM 먼저) |
| `nextMilestone` | object \| null | 열린 마일스톤 중 기한이 가장 가까운 것: `{ milestoneId, name, dueOn, progress }` (`progress` 는 P-28 과 같음) |

```json
{
  "categoryCounts": { "ALL": 9, "DEV": 4, "SEMINAR": 2, "PAPER": 2, "CONTEST": 1 },
  "page": {
    "content": [
      { "projectKey": "DEFME", "name": "DEFME 백엔드", "status": "ACTIVE", "visibility": "LAB",
        "categoryCode": "DEV", "categoryName": "개발",
        "summary": "연구실 ERP 와 SSO. Spring Boot 모듈러 모놀리스",
        "startsOn": "2026-09-01", "endsOn": "2027-02-28",
        "myRole": "MANAGER", "memberCount": 5,
        "memberPreview": [ { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null } ],
        "nextMilestone": { "milestoneId": 21, "name": "v1.2 배포", "dueOn": "2026-12-01",
                           "progress": { "done": 9, "total": 14, "ratio": 0.64 } } }
    ],
    "page": 0, "size": 20, "totalElements": 9, "totalPages": 1, "hasNext": false
  }
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `status` 값이 ProjectStatus 가 아님, `keyword` 가 1자 |

---

### P-2. 프로젝트 만들기

`POST /api/v1/projects`

| 항목 | 내용 |
|------|------|
| 권한 | `project-create` (인턴 기본 프리셋에는 없음) |
| 요구사항 | PRJ-1-01, 데이터 항목 |
| 테이블 | `projects`, `project_members`, `project_activities`(`MEMBER_ADDED`) |
| 감사 로그 · 알림 | 감사 `PROJECT_CREATED`. 더한 참여자에게 `PROJECT_MEMBER_ADDED` (만든 사람 제외) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `projectKey` | string | O | `^[A-Z][A-Z0-9]{1,9}$` (영문 대문자 · 숫자 2~10자, 영문 시작). 고유. **만든 뒤 바꿀 수 없음** |
| `name` | string | O | 1~50자 |
| `categoryCode` | string | O | 사용 중인 `PROJECT_CATEGORY` 상세 코드 |
| `description` | string | X | Markdown, 10,000자 이하 |
| `visibility` | string | X | `LAB`(기본) · `PRIVATE` |
| `startsOn` | string | X | 날짜 |
| `endsOn` | string | X | 날짜. `startsOn` 과 같거나 뒤 |
| `members` | array | X | 처음 참여자 `[{ memberId, role }]`. `role` 은 `MANAGER` · `MEMBER`. 재실 구성원만. 만든 사람은 넣지 않아도 `MANAGER` 로 들어가고, 넣으면 `MANAGER` 로 고정 |

상태는 늘 `PREPARING`(준비)으로 만듭니다.

```json
{
  "projectKey": "SENS",
  "name": "매트 센서 데이터 수집",
  "categoryCode": "DEV",
  "description": "센서 수집 파이프라인과 대시보드",
  "visibility": "LAB",
  "startsOn": "2026-11-20",
  "endsOn": "2027-03-31",
  "members": [ { "memberId": 8, "role": "MEMBER" } ]
}
```

**응답** `201 Created` · `Location: /api/v1/projects/SENS`

본문은 [P-3](#p-3-프로젝트-상세) 과 같습니다.

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 키 형식 · 이름 길이 · 설명 길이 위반 |
| 400 | `P004` | `categoryCode` 가 없거나 사용 안 함 |
| 400 | `P005` | `endsOn` 이 `startsOn` 보다 앞 |
| 400 | `P009` | `members` 에 재실이 아닌 구성원 |
| 409 | `P002` | 이미 있는 키 (지운 프로젝트의 키 포함) |

---

### P-3. 프로젝트 상세

`GET /api/v1/projects/{projectKey}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-1-03 (개요 · 참여자) |
| 테이블 | `projects`, `project_members`, `tasks`(개수) |
| 감사 로그 · 알림 | 없음 |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `projectKey` | string | O | 경로. 대소문자 구분 (대문자) |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `projectId` | number | 다른 모듈(`calendar-events?projectId=`, 자료) 이 쓰는 숫자 ID |
| `projectKey`, `name`, `status`, `visibility` | | |
| `categoryCode`, `categoryName` | string | |
| `description` | string \| null | Markdown 원문 |
| `startsOn`, `endsOn` | string \| null | |
| `taskCounts` | object | `{ total, done, cancelled }` — 화면 "작업 46 · 완료 29" (지운 작업 제외) |
| `members` | ProjectMemberRef[] | PM → 참여자 → 이전 참여자 순. 멘션 후보 · 담당자 고르기도 이 목록을 쓴다 (`FORMER` 제외) |
| `myRole` | string | `MANAGER` · `MEMBER` · `FORMER` · `NONE` |
| `permissions` | ProjectPermissions | |
| `createdAt`, `updatedAt` | string | |

```json
{
  "projectId": 4, "projectKey": "DEFME", "name": "DEFME 백엔드",
  "status": "ACTIVE", "visibility": "LAB", "categoryCode": "DEV", "categoryName": "개발",
  "description": "연구실 ERP 와 SSO. Vault · Jenkins · Penpot 계정을 하나로 묶고 …",
  "startsOn": "2026-09-01", "endsOn": "2027-02-28",
  "taskCounts": { "total": 46, "done": 29, "cancelled": 2 },
  "members": [
    { "member": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
      "role": "MANAGER", "joinedAt": "2026-09-01T00:00:00Z", "leftAt": null },
    { "member": { "memberId": 11, "name": "한유진", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null },
      "role": "MEMBER", "joinedAt": "2026-10-02T01:00:00Z", "leftAt": null }
  ],
  "myRole": "MANAGER",
  "permissions": { "canManage": true, "canWriteTasks": true, "canComment": true, "canArchive": true, "canDelete": false },
  "createdAt": "2026-09-01T00:00:00Z", "updatedAt": "2026-11-14T05:00:00Z"
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 없는 키, 지운 프로젝트, **볼 수 없는 프로젝트** |

---

### P-4. 프로젝트 고치기 · 상태 바꾸기 · 보관

`PATCH /api/v1/projects/{projectKey}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-06, PRJ-1-09, 데이터 항목 |
| 테이블 | `projects`, `project_activities`(`SETTINGS_CHANGED`) |
| 감사 로그 · 알림 | 감사 `PROJECT_UPDATED`(공개 범위 변경), `PROJECT_ARCHIVED`, `PROJECT_UNARCHIVED` — 바뀐 값 전 · 후 |

보관 · 보관 풀기는 `status` 를 바꾸는 것으로 합니다 (README 1.11 규칙 2). 따로 API 를 두지 않습니다.

**요청 본문** — 보낸 필드만 바꿉니다. `projectKey` 는 받지 않습니다 (변경 불가).

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `name` | string | X | 1~50자 |
| `categoryCode` | string | X | 사용 중인 `PROJECT_CATEGORY` |
| `description` | string \| null | X | 10,000자 이하. null 이면 지움 |
| `status` | string | X | `PREPARING` · `ACTIVE` · `ON_HOLD` · `DONE` · `ARCHIVED`. `ARCHIVED` 로 바꾸면 보관, `ARCHIVED` 에서 다른 값으로 바꾸면 보관 풀기 |
| `visibility` | string | X | `LAB` · `PRIVATE` |
| `startsOn`, `endsOn` | string \| null | X | 종료 ≥ 시작 |

**규칙**

- 보관 상태에서는 **`status` 만** 보낼 수 있습니다. 다른 필드가 있으면 `P003`. 보관을 푸는 요청에 다른 필드를 함께 보낼 수도 없습니다 (먼저 풀고 고침).
- 보관하면 그 프로젝트의 Vault · Jenkins 권한이 OIDC `groups` 계산에서 빠집니다 (다음 로그인부터, PRJ-1 "누가 얼마나 받나"). 외부 서비스의 정책 · 역할은 지우지 않으므로 풀면 바로 다시 생깁니다.
- `LAB`(연구실 운영) 프로젝트는 보관할 수 없습니다 (`P035`, 제안 — 아래 보고 참고).

```json
{ "status": "ARCHIVED" }
```

```json
{ "name": "DEFME 백엔드", "visibility": "PRIVATE", "endsOn": "2027-03-31" }
```

**응답** `200 OK` — [P-3](#p-3-프로젝트-상세) 과 같음

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 · 값 형식 위반 |
| 400 | `P004` | 사용할 수 없는 카테고리 |
| 400 | `P005` | 종료 예정일이 시작일보다 앞 |
| 403 | `C003` | 볼 수는 있지만 PM · `project-manage` 가 아님 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관 상태에서 `status` 말고 다른 필드를 바꿈 |
| 409 | `P035` | `LAB` 프로젝트를 보관 |

---

### P-5. 프로젝트 지우기

`DELETE /api/v1/projects/{projectKey}`

| 항목 | 내용 |
|------|------|
| 권한 | `project-manage` |
| 요구사항 | PRJ-1-07, PRJ-1-45 |
| 테이블 | `projects`(숨김 `deleted_at`), `project_service_sync_jobs`(`DEPROVISION`), `files.purge_at`, `comments` |
| 감사 로그 · 알림 | 감사 `PROJECT_DELETED` |

**규칙**

- 숨김(소프트 삭제)입니다. 작업 · 스레드 · 회의록 · 댓글 · 첨부도 함께 숨고, 첨부는 30일 뒤 완전히 지웁니다 (DOC-2-09).
- 서비스 권한이 켜진 서비스마다 `DEPROVISION` 작업을 만들어 ERP 가 만든 `prj-<키>-…` 정책 · 그룹 · 항목 역할만 지웁니다 (커밋 뒤 실행).
- 연결한 GitHub 저장소는 모두 끊습니다. 받아 둔 커밋은 90일 동안 남고 그 뒤 지웁니다 (github `github-commit-purge`, 2026-11-19).
- 키는 다시 쓸 수 없습니다 (작업 번호 · 감사 로그가 키를 가리키므로). P-2 의 `P002` 참고.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | `project-manage` 가 없음 (볼 수 있을 때) |
| 404 | `P001` | 없거나 볼 수 없는 프로젝트 |
| 409 | `P035` | `LAB` 프로젝트 |

---

## 2. 참여자 — PRJ-1-04, 05

### P-6. 참여자 더하기

`POST /api/v1/projects/{projectKey}/members`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-04, 데이터 항목(재실 구성원만) |
| 테이블 | `project_members`, `project_activities`(`MEMBER_ADDED`) |
| 감사 로그 · 알림 | 감사 `PROJECT_MEMBER_CHANGED`. 더한 사람에게 `PROJECT_MEMBER_ADDED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `memberId` | number | O | 재실(`ACTIVE`) · 활성 구성원 |
| `role` | string | O | `MANAGER` · `MEMBER` |

```json
{ "memberId": 12, "role": "MEMBER" }
```

- 이전 참여자(`FORMER`)를 다시 더하면 같은 행을 되살립니다 (`uk_project_members` 때문에 새 행을 만들지 않음). `joined_at` 은 새 시각, `left_at` 은 비움.

**응답** `201 Created` — 더한 `ProjectMemberRef`

```json
{ "member": { "memberId": 12, "name": "강다은", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
  "role": "MEMBER", "joinedAt": "2026-11-18T02:00:00Z", "leftAt": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P009` | 재실이 아니거나 비활성 구성원 |
| 404 | `M001` | 없는 구성원 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P008` | 이미 PM · 참여자 |

---

### P-7. 프로젝트 역할 바꾸기

`PATCH /api/v1/projects/{projectKey}/members/{memberId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-04 |
| 테이블 | `project_members`, `project_activities` |
| 감사 로그 · 알림 | 감사 `PROJECT_MEMBER_CHANGED` (역할 전 · 후) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `role` | string | O | `MANAGER` · `MEMBER`. 이전 참여자로 바꾸는 것은 P-8 |

```json
{ "role": "MANAGER" }
```

- 역할이 바뀌면 그 구성원의 Vault · Jenkins **기본 수준**도 바뀝니다 (개별 수준이 있으면 개별 수준이 이김, P-16).

**응답** `200 OK` — 바뀐 `ProjectMemberRef`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P007` | 그 프로젝트의 PM · 참여자가 아님 (이전 참여자 포함) |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P010` | 마지막 PM 을 `MEMBER` 로 낮춤 |

---

### P-8. 참여자 빼기

`POST /api/v1/projects/{projectKey}/members/{memberId}/remove`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-04, PRJ-1-05, PRJ-1-48 |
| 테이블 | `project_members`(`role = FORMER`, `left_at`), `tasks`(담당자), `project_member_service_levels`(행 지움), `project_activities`(`MEMBER_REMOVED`, `TASK_FIELD_CHANGED`) |
| 감사 로그 · 알림 | 감사 `PROJECT_MEMBER_CHANGED`. 새 담당자에게 `TASK_ASSIGNED` |

부수 효과(작업 넘기기, 서비스 권한 회수)가 커서 동작 경로로 둡니다 (README 1.11 규칙 2).
빼기 전 확인 화면의 "끝나지 않은 담당 작업"은 [P-9a](#p-9a-구성원-인수인계-확인) 를 `projectKey` 로 걸러 그립니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `taskReassignments` | array | O | 그 구성원이 담당자인 끝나지 않은 작업(`TODO` · `IN_PROGRESS` · `REVIEW`) **모두**. 없으면 빈 배열 |
| `taskReassignments[].taskKey` | string | O | `DEFME-46` |
| `taskReassignments[].assigneeMemberId` | number \| null | O | 새 담당자 (그 프로젝트의 재실 PM · 참여자, 빼는 사람 제외). null 이면 담당자 없음 |

```json
{
  "taskReassignments": [
    { "taskKey": "DEFME-46", "assigneeMemberId": 3 },
    { "taskKey": "DEFME-52", "assigneeMemberId": null }
  ]
}
```

- 담당자가 없어진 `IN_PROGRESS` 작업은 상태를 그대로 둡니다 (P2 규칙은 "할 일 → 진행 중"에만 담당자를 요구함).
- 그 구성원의 개별 서비스 수준 행은 지웁니다. 프로젝트 서비스 권한은 다음 로그인부터 없어집니다.

**응답** `200 OK` — 바뀐 `ProjectMemberRef` (`role: "FORMER"`)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P011` | 끝나지 않은 담당 작업이 요청에 빠졌거나, 그 사람 담당이 아닌 작업이 들어 있음. `error.errors[]` 에 `{ "field": "taskReassignments", "reason": "DEFME-46" }` 처럼 빠진 작업 키 |
| 400 | `P012` | 새 담당자가 그 프로젝트의 재실 PM · 참여자가 아님 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P007` | PM · 참여자가 아님 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P010` | 마지막 PM 을 뺌 |

### P-9a. 구성원 인수인계 확인

`GET /api/v1/projects/handover`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage`(모든 프로젝트, 비공개 포함 — 졸업 처리하는 사람이 넘길 작업을 알아야 함), `project-manage`(모든 프로젝트), PM(`projectKey` 를 준 그 프로젝트만) |
| 요구사항 | PRJ-1-05 (참여자 빼기), MEM-4-02 · 03 (졸업 · 퇴실 확인 화면) |
| 테이블 | `project_members`, `tasks`(`idx_tasks_assignee`), `project_member_service_levels`, `project_service_settings` |
| 감사 로그 · 알림 | 없음 |

참여자 빼기(P-8)와 졸업 · 퇴실 처리([10 6-2](10-member.md))가 **같은 확인 데이터**를 쓰므로 하나로 둡니다. 졸업 처리는 member 모듈에 있고 member 는 project 를 모르므로, 화면이 이 API 를 따로 부릅니다.

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `memberId` | number | O | 확인할 구성원 |
| `projectKey` | string | X | 한 프로젝트만 (참여자 빼기). PM 은 이것을 꼭 넣어야 한다 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `projects[]` | array | 그 구성원이 PM · 참여자인 프로젝트 (보관 포함) |
| `projects[].project` | ProjectRef | |
| `projects[].projectRole` | string | `MANAGER` · `MEMBER` |
| `projects[].lastManager` | boolean | 그 사람이 마지막 PM. 졸업 처리에는 `projectManagerHandovers` 가, 참여자 빼기에는 먼저 역할 바꾸기가 필요 |
| `projects[].serviceAccess` | `{ vault, jenkins }` | 함께 사라질 프로젝트 서비스 수준 (`NONE` · `READ` · `WRITE` · `BUILD`, 서비스를 안 켰으면 null) |
| `projects[].openTasks[]` | TaskRef[] | 그 사람이 담당자인 끝나지 않은 작업 (`TODO` · `IN_PROGRESS` · `REVIEW`) |
| `projects[].candidates[]` | MemberRef[] | 새 담당자 · 새 PM 후보 (그 프로젝트의 재실 PM · 참여자, 그 사람 제외) |

```json
{
  "success": true,
  "data": {
    "projects": [
      { "project": { "projectKey": "DEFME", "name": "DEFME 백엔드", "status": "ACTIVE", "visibility": "LAB" },
        "projectRole": "MANAGER", "lastManager": false,
        "serviceAccess": { "vault": "WRITE", "jenkins": "BUILD" },
        "openTasks": [ { "taskKey": "DEFME-46", "title": "MinIO 업로드 서명 주소 만료 5분", "status": "IN_PROGRESS" } ],
        "candidates": [ { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null } ] }
    ]
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | PM 인데 `projectKey` 가 없거나 자기 프로젝트가 아님 |
| 404 | `P001` | `projectKey` 가 볼 수 없는 프로젝트 |

### 졸업 · 퇴실 이벤트 받기 (HTTP 아님)

member 의 졸업 처리([10 6-2](10-member.md))가 같은 트랜잭션 안에서 `MemberDepartedEvent { memberId, taskReassignments, projectManagerHandovers }` 를 냅니다. project 는 `@EventListener`(커밋 전, 같은 트랜잭션)로 받아:

1. `projectManagerHandovers` 로 새 PM 을 세운다 (마지막 PM 인 프로젝트가 빠졌으면 `P040`)
2. `taskReassignments` 로 작업을 넘긴다 (P-8 과 같은 검사: `P011`, `P012`)
3. 그 구성원을 모든 프로젝트에서 `FORMER` 로 바꾸고 개별 서비스 수준 행을 지운다
4. 이전 참여자가 된 프로젝트 목록을 `MemberCommandApi` 로 `member_departures.former_projects` 에 적는다

예외가 나면 졸업 처리 전체가 되돌려집니다 (MEM-4-04).

---

## 3. 활동 기록 · 기한 — PRJ-1-03, PRJ-2-62, COM-4-09

### P-9. 활동 기록

`GET /api/v1/projects/{projectKey}/activities`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-60~62, PRJ-1-09 |
| 테이블 | `project_activities` (`idx_project_activities_project`, `idx_project_activities_task`) |
| 감사 로그 · 알림 | 없음 |

프로젝트 홈의 "최근 활동"과 작업 상세의 "활동 기록"이 같은 표를 읽으므로 이 API 하나로 둡니다 (README 1.11 규칙 1). 문장("박지훈 님이 DEFME-44 를 검토로 옮겼어요")은 화면이 `type` · `field` · 값으로 만듭니다.

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `taskKey` | string | X | 그 작업의 기록만 (작업 상세) |
| `types` | string | X | ActivityType 쉼표 구분 |
| `page`, `size` | | X | 최신 순 고정. 기본 `size=20` |

**응답** `200 OK` — `PageResponse<ProjectActivity>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `activityId` | number | |
| `type` | string | ActivityType (`TASK_STATUS_CHANGED`, `MEMBER_ADDED`, `THREAD_POSTED`, `MINUTE_ACTIONS_CONVERTED` …) |
| `actor` | MemberRef \| null | null 이면 시스템 |
| `task` | TaskRef \| null | `{ taskKey, title, status }` |
| `field` | string \| null | 바뀐 항목 (`status`, `due_on`, `assignee` …) |
| `before`, `after` | string \| null | 표시용 문자열 |
| `ref` | object \| null | 관련 대상 `{ type: "PROJECT_THREAD" \| "MEETING_MINUTE" \| …, id, title }` |
| `createdAt` | string | |

```json
{
  "content": [
    { "activityId": 901, "type": "TASK_STATUS_CHANGED",
      "actor": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
      "task": { "taskKey": "DEFME-44", "title": "OIDC 로그아웃 테스트 케이스 추가", "status": "REVIEW" },
      "field": "status", "before": "IN_PROGRESS", "after": "REVIEW", "ref": null,
      "createdAt": "2026-11-17T05:55:00Z" },
    { "activityId": 899, "type": "MINUTE_ACTIONS_CONVERTED", "actor": { "memberId": 6, "name": "최현우", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
      "task": null, "field": null, "before": null, "after": "3",
      "ref": { "type": "MEETING_MINUTE", "id": 55, "title": "11/17 주간 회의" }, "createdAt": "2026-11-17T05:00:00Z" }
  ],
  "page": 0, "size": 20, "totalElements": 132, "totalPages": 7, "hasNext": true
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P100` | `taskKey` 가 그 프로젝트에 없음 (작업 코드, [31](31-task.md)) |

---

### P-10. 마일스톤 기한 (여러 프로젝트)

`GET /api/v1/milestones`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. 볼 수 있는 프로젝트의 것만 |
| 요구사항 | COM-4-09, PRJ-2-44, PRJ-1-03 (다가오는 일정 · 기한) |
| 테이블 | `milestones`, `project_members` |
| 감사 로그 · 알림 | 없음 |

calendar 모듈은 project 를 모르므로([README R3](README.md#31-모듈-의존이-순환함-설계-수정-필요)) 캘린더 화면이 겹쳐 그릴 기한을 project 에서 따로 받습니다.
**작업 기한은 이 API 에 넣지 않고** 작업 조회 [`GET /tasks?mine=true&dueFrom=&dueTo=`](31-task.md) 를 그대로 씁니다 (같은 데이터는 같은 API, README 1.11 규칙 1).
프로젝트 홈의 "다가오는 일정 · 기한"은 이 API(`projectKey`), `GET /tasks?projectKey=&dueFrom=&dueTo=`, `GET /calendar-events?projectId=` 를 함께 씁니다.

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `dueFrom`, `dueTo` | string | O | 날짜 (포함). 최대 92일 |
| `projectKey` | string | X | 없으면 내가 PM · 참여자인 프로젝트의 열린 마일스톤. 있으면 그 프로젝트의 열린 마일스톤 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `items[]` | array | 기한 순 |
| `items[].milestoneId` | number | |
| `items[].name` | string | |
| `items[].dueOn` | string | 날짜 |
| `items[].project` | ProjectRef | |
| `items[].overdue` | boolean | 오늘(KST) 보다 앞이고 열려 있음 (PRJ-2-42) |

```json
{
  "success": true,
  "data": {
    "items": [
      { "milestoneId": 21, "name": "v1.2 배포", "dueOn": "2026-12-01", "overdue": false,
        "project": { "projectKey": "DEFME", "name": "DEFME 백엔드", "status": "ACTIVE", "visibility": "LAB" } }
    ]
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `dueFrom` · `dueTo` 없음, 순서가 틀림, 92일 넘음 |
| 404 | `P001` | `projectKey` 가 볼 수 없는 프로젝트 |

---

## 4. 연동 서비스 연결 — PRJ-1-20~29

### P-11. 연결 목록

`GET /api/v1/projects/{projectKey}/links`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-1-20, 22, 23, 24 |
| 테이블 | `project_links`, `github_repositories`(GitHub), `project_member_service_levels` · `member_roles`(내 접근) |
| 감사 로그 · 알림 | 없음 |

외부 서비스를 부르지 않습니다. 상태는 P-15 가 따로 줍니다 (외부 호출이 느려도 카드 틀은 먼저 그리게).

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `links[]` | ProjectLink[] | 서비스 → `displayOrder` 순 |

`ProjectLink`

| 필드 | 타입 | 설명 |
|------|------|------|
| `linkId` | number | |
| `service` | string | `PENPOT` · `VAULT` · `JENKINS` · `GITHUB` · `OTHER` |
| `url` | string | 새 탭으로 여는 주소 |
| `displayName` | string | |
| `description` | string \| null | |
| `externalRef` | string \| null | 서버가 주소에서 꺼낸 대상: Jenkins 작업 경로, GitHub `owner/repo`, Vault 경로, Penpot 파일 · 프로젝트 ID |
| `displayOrder` | number | |
| `myAccess` | object | `{ granted: boolean, level: string \| null }`. Vault · Jenkins 는 이 프로젝트의 내 실제 수준(`NONE` 이면 false) 또는 `vault-admin` · `jenkins-admin`, Penpot 은 `penpot-member`, GitHub · 기타는 늘 true. false 면 화면이 카드를 흐리게 하고 권한 신청 링크를 보인다 (PRJ-1-23) |
| `github` | object \| null | GitHub 일 때만: `{ repositoryId, fullName, defaultBranch, appInstalled, locExcludePatterns, patternsChangedAt }` |

```json
{
  "links": [
    { "linkId": 7, "service": "JENKINS", "url": "https://lab.iturtle.win/jenkins/job/Hoseo-I-Turtle/job/defme_BE/",
      "displayName": "defme_BE 배포", "description": null, "externalRef": "Hoseo-I-Turtle/defme_BE", "displayOrder": 0,
      "myAccess": { "granted": true, "level": "BUILD" }, "github": null },
    { "linkId": 8, "service": "VAULT", "url": "https://vault.iturtle.win/ui/vault/secrets/secret/kv/projects%2Fdefme%2F",
      "displayName": "비밀값", "description": "비밀값은 Vault 에서만 보여요", "externalRef": "secret/projects/defme/", "displayOrder": 0,
      "myAccess": { "granted": true, "level": "WRITE" }, "github": null },
    { "linkId": 9, "service": "GITHUB", "url": "https://github.com/Hoseo-I-Turtle/defme_BE",
      "displayName": "defme_BE", "description": null, "externalRef": "Hoseo-I-Turtle/defme_BE", "displayOrder": 0,
      "myAccess": { "granted": true, "level": null },
      "github": { "repositoryId": 2, "fullName": "Hoseo-I-Turtle/defme_BE", "defaultBranch": "main", "appInstalled": true,
                  "locExcludePatterns": "package-lock.json\npnpm-lock.yaml\nyarn.lock\n*.min.js\nbuild/\ndist/",
                  "patternsChangedAt": null } }
  ]
}
```

- Vault 는 경로와 바로 가기만 줍니다. **비밀값은 ERP 로 가져오지 않습니다** (PRJ-1-24).

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |

---

### P-12. 연동 서비스 연결

`POST /api/v1/projects/{projectKey}/links`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-20, 21, 43, INF-3-07, PRJ-4-24 |
| 테이블 | `project_links`, `github_repositories`(GitHub, github 모듈 API), `project_service_resources`(Jenkins 작업) · `project_service_sync_jobs`(Jenkins 서비스 권한이 켜져 있으면 다시 프로비저닝) |
| 감사 로그 · 알림 | 감사 `PROJECT_LINK_ADDED`. 활동 `SETTINGS_CHANGED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `service` | string | O | LinkedService |
| `url` | string | O | 500자 이하. `OTHER` 는 http/https 만 검사. 나머지는 그 서비스 기본 주소로 시작해야 함: Penpot · Vault · Jenkins = 공통코드 `SSO_APP` 의 `ref1`, GitHub = `https://github.com/<조직>/` |
| `displayName` | string | O | 1~50자 |
| `description` | string | X | 200자 이하 |
| `displayOrder` | number | X | 기본: 같은 서비스의 마지막 다음 |

`externalRef` 는 보내지 않습니다. 서버가 주소에서 꺼냅니다 (Jenkins `/job/A/job/B/` → `A/B`, GitHub `owner/repo`, Penpot `file-id` · `project-id`, Vault UI 경로 → KV 경로). 꺼낼 수 없으면 `P014`.

```json
{ "service": "GITHUB", "url": "https://github.com/Hoseo-I-Turtle/sensor-collector", "displayName": "sensor-collector" }
```

**서비스별 처리**

| 서비스 | 처리 |
|--------|------|
| Jenkins | 권한 대상(`project_service_resources`, `LINKED`)으로도 넣는다. 다른 프로젝트가 이미 쓰는 작업이면 거절 (PRJ-1-43, UK). Jenkins 서비스 권한이 켜져 있으면 `PROVISION` 작업을 만든다 (PRJ-1-44) |
| GitHub | github 모듈에 저장소를 등록한다 (`github_repositories`). 제외 패턴은 공통코드 `GITHUB_LOC_EXCLUDE` 기본값을 복사 (PRJ-4-24). App 이 설치되지 않은 저장소면 거절 (INF-3-07) |
| Vault | 바로 가기만 만든다. **권한을 줄 경로를 더 묶는 것은 P-21** (sso-admin 승인) |
| Penpot · 기타 | 저장만 |

**응답** `201 Created` · `Location: /api/v1/projects/{projectKey}/links/{linkId}` — 만든 `ProjectLink`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 · 필수 위반 |
| 400 | `P014` | 주소가 그 서비스 기본 주소로 시작하지 않음, 또는 대상(작업 · 저장소 · 파일)을 꺼낼 수 없음 |
| 400 | `P017` | GitHub App 이 설치되지 않은 저장소 ("조직 관리자에게 App 설치를 요청해 주세요") |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P015` | 다른 프로젝트가 이미 연결한 Jenkins 작업 (`project_service_resources` UK) |
| 409 | `P016` | 다른 프로젝트가 이미 연결한 GitHub 저장소 (`github_repositories.full_name` UK) |
| 409 | `P041` | 이 프로젝트에 같은 대상이 이미 연결됨 (`project_links` UK) |
| 502 | `C010` | GitHub 저장소 정보를 가져오지 못함 |

---

### P-13. 연결 고치기 (GitHub 제외 패턴 포함)

`PATCH /api/v1/projects/{projectKey}/links/{linkId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-20, PRJ-4-24, PRJ-4-24a |
| 테이블 | `project_links`, `github_repositories.loc_exclude_patterns` · `patterns_changed_at`, `github_sync_jobs`(`RECALCULATE_LOC`) |
| 감사 로그 · 알림 | 감사 `PROJECT_LINK_CHANGED` |

저장소의 줄 수 제외 패턴은 화면에서 "그 GitHub 연결의 설정"이므로 별도 API 없이 이 연결을 고치는 것으로 둡니다.

**요청 본문** — 보낸 필드만 바꿉니다. `service` 는 바꿀 수 없습니다 (끊고 새로 연결).

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `url` | string | X | P-12 와 같은 검사. Jenkins · GitHub 는 대상이 바뀌면 P-12 의 서비스별 처리를 다시 함 |
| `displayName` | string | X | 1~50자 |
| `description` | string \| null | X | 200자 |
| `displayOrder` | number | X | |
| `locExcludePatterns` | string | X | **GitHub 연결만.** gitignore 형식, 줄바꿈 구분, 100줄 · 줄당 200자 이하. 바뀌면 이미 모은 커밋 줄 수를 다시 계산하는 작업을 만든다 |

```json
{ "locExcludePatterns": "package-lock.json\npnpm-lock.yaml\nyarn.lock\n*.min.js\nbuild/\ndist/\n**/generated/**" }
```

**응답** `200 OK` — 바뀐 `ProjectLink`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 위반 |
| 400 | `P014` | 주소 검사 실패 |
| 400 | `P018` | GitHub 가 아닌 연결에 `locExcludePatterns` |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P013` | 그 프로젝트에 없는 연결 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P015`, `P016`, `P041` | P-12 와 같음 |

---

### P-14. 연결 끊기

`DELETE /api/v1/projects/{projectKey}/links/{linkId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-20 |
| 테이블 | `project_links`, `project_service_resources`(Jenkins 작업), `project_service_sync_jobs` |
| 감사 로그 · 알림 | 감사 `PROJECT_LINK_REMOVED` |

- Jenkins 연결을 끊으면 그 작업을 권한 대상에서 빼고(`project_service_resources` 행 삭제) 프로비저닝합니다. 마지막 Jenkins 작업을 끊으면 Jenkins 서비스 권한이 켜져 있을 수 없으므로 `P020` 으로 거절합니다 (먼저 P-17 로 끔).
- GitHub 연결을 끊어도 이미 모은 커밋은 지우지 않습니다 (지난 주간 보고 숫자 유지). 새 커밋 수집만 멈춥니다.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P013` | 없는 연결 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P020` | Jenkins 서비스 권한이 켜진 채 마지막 Jenkins 작업을 끊음 |

---

### P-15. 연동 서비스 상태

`GET /api/v1/projects/{projectKey}/links/status`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-1-25, 26, 27, 28, 29, NFR-PER-05 |
| 테이블 | 없음 (서비스별 5분 Caffeine 캐시). GitHub 는 `github_commits` 도 읽음 |
| 감사 로그 · 알림 | 없음 |

프로젝트의 모든 연결 상태를 **한 번에** 줍니다. 서비스가 응답하지 않으면 그 연결만 `UNAVAILABLE` 이고 **응답 전체는 늘 200** 입니다 (PRJ-1-28). 서비스 호출마다 시간 제한(3초)을 둡니다.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `statuses[]` | array | 연결마다 하나 |
| `statuses[].linkId` | number | |
| `statuses[].status` | string | `OK` · `UNAVAILABLE`(응답 없음 · 오류) · `NOT_SUPPORTED`(Vault · 기타 — 상태를 가져오지 않음) |
| `statuses[].fetchedAt` | string \| null | 캐시에 담은 시각 |
| `statuses[].jenkins` | object \| null | `{ lastBuild: { number, result: "SUCCESS" \| "FAILURE" \| "UNSTABLE" \| "ABORTED" \| "IN_PROGRESS", startedAt, durationMs, url }, branch }` — 멀티브랜치면 기본 브랜치 기준 |
| `statuses[].penpot` | object \| null | `{ fileCount, files: [{ name, modifiedAt, thumbnailUrl, url }] }` — 최근 수정 순 5개 |
| `statuses[].github` | object \| null | `{ weekCommitCount, openPullRequestCount, recentCommits: [{ sha, messageTitle, authorLogin, member: MemberRef \| null, committedAt, url }] }` — 커밋은 ERP 에 모은 것, PR 수만 GitHub API |

```json
{
  "statuses": [
    { "linkId": 7, "status": "OK", "fetchedAt": "2026-11-17T05:57:00Z",
      "jenkins": { "branch": "main", "lastBuild": { "number": 142, "result": "SUCCESS",
                   "startedAt": "2026-11-17T05:53:00Z", "durationMs": 252000,
                   "url": "https://lab.iturtle.win/jenkins/job/Hoseo-I-Turtle/job/defme_BE/job/main/142/" } },
      "penpot": null, "github": null },
    { "linkId": 8, "status": "NOT_SUPPORTED", "fetchedAt": null, "jenkins": null, "penpot": null, "github": null },
    { "linkId": 10, "status": "UNAVAILABLE", "fetchedAt": null, "jenkins": null, "penpot": null, "github": null }
  ]
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |

---

## 5. 프로젝트 서비스 권한 (Vault · Jenkins) — PRJ-1-40~53

### P-16. 프로젝트 서비스 권한 보기

`GET /api/v1/projects/{projectKey}/service-access`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음. 단 `provisionError` · `pendingVaultPathRequests` 와 구성원별 `source` · `expiresAt` 은 **PM · `project-manage` 에게만** 응답에 넣는다 (README 1.11 규칙 4) |
| 요구사항 | PRJ-1-40, 41, 44, 46, 47 |
| 테이블 | `project_service_settings`, `project_service_resources`, `project_member_service_levels`, `project_members`, `project_vault_path_requests` |
| 감사 로그 · 알림 | 없음 |

프로젝트 홈의 "프로젝트 서비스 권한" 요약과 설정 화면이 같은 데이터를 씁니다.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `services[]` | array | `VAULT`, `JENKINS` 두 개 늘 |
| `services[].service` | string | ProjectService |
| `services[].enabled` | boolean | |
| `services[].managerLevel` | string | 프로젝트 관리자 기본 수준 |
| `services[].memberLevel` | string | 참여자 기본 수준 |
| `services[].resources[]` | array | 권한을 줄 대상 **여러 개** (PRJ-1-42, 43). 그 서비스의 수준이 모두에 똑같이 적용된다 |
| `services[].resources[].resourceId` | number | |
| `services[].resources[].ref` | string | Vault: KV 경로 (`secret/projects/defme/`). Jenkins: 작업 경로 (`Hoseo-I-Turtle/defme_BE`) |
| `services[].resources[].origin` | string | `DEFAULT` 기본 경로 · `APPROVED` 승인된 기존 경로 · `LINKED` 연결한 Jenkins 작업 |
| `services[].resources[].linkId` | number \| null | `LINKED`: 근거가 된 연결 (P-14 로 끊으면 빠짐) |
| `services[].pendingVaultPathRequests` | array | Vault, PM 만: `[{ requestId, vaultPath, requestedAt }]` |
| `services[].provisionStatus` | string | `PENDING` · `DONE` · `FAILED` |
| `services[].provisionError` | string \| null | PM 만. "Jenkins 가 응답하지 않았어요" |
| `services[].provisionedAt`, `reconciledAt` | string \| null | |
| `services[].driftDetected` | boolean | 하루 비교에서 불일치 (PRJ-1-46) |
| `members[]` | array | PM → 참여자 순 (이전 참여자 제외) |
| `members[].member` | MemberRef | |
| `members[].projectRole` | string | `MANAGER` · `MEMBER` |
| `members[].vault`, `members[].jenkins` | object | `{ override: string \| null, effective: string, source: "MANUAL" \| "REQUEST" \| null, expiresAt: string \| null }` — `override` 가 null 이면 역할 기본값. `source` · `expiresAt` 은 PM 만 |
| `notice` | string | "바꾼 권한은 다음 로그인부터 반영돼요. 뺀 권한은 이미 로그인한 세션이 끝나야 적용돼요 (Vault 토큰 최대 8시간, Jenkins 세션)." (PRJ-1-47) |

```json
{
  "services": [
    { "service": "VAULT", "enabled": true, "managerLevel": "WRITE", "memberLevel": "READ",
      "resources": [
        { "resourceId": 1, "ref": "secret/projects/defme/", "origin": "DEFAULT", "linkId": null },
        { "resourceId": 7, "ref": "secret/defme-legacy/", "origin": "APPROVED", "linkId": null } ],
      "pendingVaultPathRequests": [ { "requestId": 3, "vaultPath": "secret/defme/", "requestedAt": "2026-11-16T02:00:00Z" } ],
      "provisionStatus": "DONE", "provisionError": null,
      "provisionedAt": "2026-11-10T01:00:00Z", "reconciledAt": "2026-11-17T20:00:00Z", "driftDetected": false },
    { "service": "JENKINS", "enabled": true, "managerLevel": "BUILD", "memberLevel": "BUILD",
      "resources": [
        { "resourceId": 2, "ref": "Hoseo-I-Turtle/defme_BE", "origin": "LINKED", "linkId": 21 },
        { "resourceId": 3, "ref": "Hoseo-I-Turtle/defme_FE", "origin": "LINKED", "linkId": 22 } ],
      "pendingVaultPathRequests": [], "provisionStatus": "FAILED",
      "provisionError": "Jenkins 가 응답하지 않았어요", "provisionedAt": null, "reconciledAt": null, "driftDetected": false }
  ],
  "members": [
    { "member": { "memberId": 11, "name": "한유진", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null },
      "projectRole": "MEMBER",
      "vault": { "override": "NONE", "effective": "NONE", "source": "MANUAL", "expiresAt": null },
      "jenkins": { "override": "READ", "effective": "READ", "source": "MANUAL", "expiresAt": null } }
  ],
  "notice": "바꾼 권한은 다음 로그인부터 반영돼요. 뺀 권한은 이미 로그인한 세션이 끝나야 적용돼요 (Vault 토큰 최대 8시간, Jenkins 세션)."
}
```

- `effective` 는 서비스가 꺼져 있거나 프로젝트가 보관이면 `NONE` 입니다 (실제 권한 계산, DB 30 2장).

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |

---

### P-17. 서비스 켜기 · 끄기, 역할별 기본 수준

`PATCH /api/v1/projects/{projectKey}/service-access/{service}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-40, 44, 45, 49 |
| 테이블 | `project_service_settings`, `project_service_sync_jobs` |
| 감사 로그 · 알림 | 감사 `PROJECT_SERVICE_LEVEL_CHANGED` (전 · 후) |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `service` | string | O | `VAULT` · `JENKINS` (경로 값은 대문자) |

**요청 본문** — 보낸 필드만 바꿉니다.

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `enabled` | boolean | X | 켜면 `PROVISION`, 끄면 `DEPROVISION` 작업을 만든다 (커밋 뒤 실행). Jenkins 는 연결한 작업이 하나 이상 있어야 켤 수 있음 |
| `managerLevel` | string | X | 0.1 `ServiceLevel` 중 그 서비스의 값 |
| `memberLevel` | string | X | 같음 |

```json
{ "enabled": true, "managerLevel": "WRITE", "memberLevel": "READ" }
```

- 수준만 바꾸는 것은 외부 서비스를 부르지 않습니다 (정책 · 역할은 수준마다 이미 있고, 바뀌는 것은 OIDC `groups` 뿐).
- 처음 켤 때 서비스 설정 행이 없으면 만듭니다. 기본값: Vault `WRITE`/`READ`, Jenkins `BUILD`/`BUILD` (SRS "누가 얼마나 받나").

**응답** `200 OK` — [P-16](#p-16-프로젝트-서비스-권한-보기) 과 같음 (`provisionStatus: "PENDING"`)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P018` | `service` 가 `VAULT` · `JENKINS` 가 아님 |
| 400 | `P019` | 그 서비스에 없는 수준 (Vault 에 `BUILD`, Jenkins 에 `WRITE`) |
| 400 | `P020` | 연결한 Jenkins 작업 없이 Jenkins 를 켬 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |

---

### P-18. 구성원별 수준 저장

`PUT /api/v1/projects/{projectKey}/service-access/members`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-41, 47, 49 |
| 테이블 | `project_member_service_levels` (`source = MANUAL`) |
| 감사 로그 · 알림 | 감사 `PROJECT_SERVICE_LEVEL_CHANGED` (구성원 · 서비스마다 전 · 후). 바뀐 구성원에게 `ACCESS_RESULT` |

화면의 참여자 × 서비스 표를 "저장" 한 번으로 보냅니다. 보낸 구성원만 바꾸고, 보내지 않은 구성원은 그대로입니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `items[]` | array | O | 1~100개 |
| `items[].memberId` | number | O | 그 프로젝트의 PM · 참여자 |
| `items[].vault` | string | X | `DEFAULT`(개별 값 지움) · `NONE` · `READ` · `WRITE`. 없으면 그대로 |
| `items[].jenkins` | string | X | `DEFAULT` · `NONE` · `READ` · `BUILD` |
| `items[].expiresAt` | string \| null | X | 개별 값의 기한 (지나면 기본값으로, INF-1-06). 없으면 기한 없음 |

```json
{
  "items": [
    { "memberId": 6, "vault": "WRITE" },
    { "memberId": 11, "vault": "NONE", "jenkins": "READ" },
    { "memberId": 3, "vault": "DEFAULT", "jenkins": "DEFAULT" }
  ]
}
```

- 권한 신청 승인으로 생긴 값(`source = REQUEST`)을 PM 이 바꾸면 `MANUAL` 이 되고 기한은 요청 값을 따릅니다.

**응답** `200 OK` — [P-16](#p-16-프로젝트-서비스-권한-보기) 과 같음

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `items` 가 비었거나 100개 넘음, 값이 목록에 없음 |
| 400 | `P019` | 서비스에 없는 수준 |
| 400 | `P037` | PM · 참여자가 아닌 구성원 (이전 참여자 포함) |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |

---

### P-19. 프로비저닝 다시 시도

`POST /api/v1/projects/{projectKey}/service-access/{service}/sync`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-44 ("실패하면 다시 시도") |
| 테이블 | `project_service_sync_jobs`, `project_service_settings.provision_status` |
| 감사 로그 · 알림 | 감사 `PROVISION_RESULT` (작업이 끝날 때) |

외부 서비스를 바로 부르지 않고 작업을 만들어 돌려줍니다 (작업 테이블이 다시 시도 · 결과를 맡음).

**요청 본문** — 없음

**응답** `202 Accepted`

| 필드 | 타입 | 설명 |
|------|------|------|
| `jobId` | number | |
| `action` | string | 켜져 있으면 `PROVISION`, 꺼져 있으면 `DEPROVISION` |
| `status` | string | `PENDING` |

```json
{ "jobId": 77, "action": "PROVISION", "status": "PENDING" }
```

화면은 P-16 을 다시 불러 결과를 봅니다.

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P018` | 지원하지 않는 서비스 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P021` | 같은 서비스의 작업이 이미 대기 · 실행 중 |

---

### P-20. 모든 프로젝트의 실패 · 불일치

`GET /api/v1/projects/service-access`

| 항목 | 내용 |
|------|------|
| 권한 | `sso-admin` (SRS 에 역할이 없어 제안 — [README 3.4](README.md#34-화면이-없는-기능)) |
| 요구사항 | PRJ-1-46 ("관리 화면에 불일치로 보여 준다") |
| 테이블 | `project_service_settings`, `projects` |
| 감사 로그 · 알림 | 없음 |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `provisionStatus` | string | X | `PENDING` · `DONE` · `FAILED` |
| `driftDetected` | boolean | X | |
| `service` | string | X | `VAULT` · `JENKINS` |
| `page`, `size` | | X | |

**응답** `200 OK` — `PageResponse<…>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `project` | ProjectRef | |
| `service`, `enabled`, `provisionStatus`, `provisionError`, `provisionedAt`, `reconciledAt`, `driftDetected` | | P-16 의 `services[]` 와 같음 |

```json
{ "content": [ { "project": { "projectKey": "DEFME", "name": "DEFME 백엔드", "status": "ACTIVE", "visibility": "LAB" },
                 "service": "JENKINS", "enabled": true, "provisionStatus": "FAILED",
                 "provisionError": "Jenkins 가 응답하지 않았어요", "provisionedAt": null,
                 "reconciledAt": "2026-11-17T20:00:00Z", "driftDetected": false } ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1, "hasNext": false }
```

**에러** — 공통만

---

## 6. Vault 경로 묶기 — PRJ-1-42

프로젝트는 기본 경로(`secret/projects/<키>/`) 말고도 승인받은 기존 경로를 **여러 개** 묶을 수 있습니다. 경로마다 신청 하나입니다.

### P-21. 기존 Vault 경로 묶기 신청

`POST /api/v1/projects/{projectKey}/vault-path-requests`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-1-42, "기존 권한 옮기기" 2단계 |
| 테이블 | `project_vault_path_requests` |
| 감사 로그 · 알림 | `sso-admin` 에게 `VAULT_PATH_REQUEST` (제안 종류, [README T6](README.md#32-테이블--컬럼-보완)) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `vaultPath` | string | O | 200자 이하. `secret/` 로 시작하고 `/` 로 끝남, 영문 소문자 · 숫자 · `-` · `_` · `/` 만. 기본 접두어 `secret/projects/` 아래는 안 됨 (프로젝트 키로 이미 정해짐) |

```json
{ "vaultPath": "secret/defme/" }
```

**응답** `201 Created` · `Location: /api/v1/vault-path-requests/3`

| 필드 | 타입 | 설명 |
|------|------|------|
| `requestId` | number | |
| `project` | ProjectRef | |
| `vaultPath` | string | |
| `status` | string | `PENDING` |
| `requestedBy` | MemberRef | |
| `requestedAt` | string | |
| `reviewedBy`, `reviewedAt`, `rejectReason` | | null |

```json
{ "requestId": 3, "project": { "projectKey": "DEFME", "name": "DEFME 백엔드", "status": "ACTIVE", "visibility": "LAB" },
  "vaultPath": "secret/defme/", "status": "PENDING",
  "requestedBy": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
  "requestedAt": "2026-11-16T02:00:00Z", "reviewedBy": null, "reviewedAt": null, "rejectReason": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P026` | 경로 형식이 틀리거나 `secret/projects/` 아래 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P023` | 이미 어느 프로젝트에 묶인 경로 (`project_service_resources`), 또는 묶인 경로와 서로 품는 경로 (`secret/defme/` ↔ `secret/defme/api/`) |
| 409 | `P024` | 같은 경로로 대기 중인 신청이 있음 (어느 프로젝트든) |

---

### P-22. Vault 경로 묶기 신청 목록

`GET /api/v1/vault-path-requests`

| 항목 | 내용 |
|------|------|
| 권한 | `sso-admin` |
| 요구사항 | PRJ-1-42 |
| 테이블 | `project_vault_path_requests` |
| 감사 로그 · 알림 | 없음 |

PM 은 자기 프로젝트의 대기 신청을 P-16 에서 봅니다.

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string | X | `PENDING` · `APPROVED` · `REJECTED` |
| `projectKey` | string | X | |
| `page`, `size` | | X | 최신 순 |

**응답** `200 OK` — `PageResponse<VaultPathRequest>` (P-21 응답과 같은 모양) + `statusCounts { PENDING, APPROVED, REJECTED }`

```json
{ "statusCounts": { "PENDING": 1, "APPROVED": 4, "REJECTED": 0 },
  "page": { "content": [ { "requestId": 3, "vaultPath": "secret/defme/", "status": "PENDING", "…": "…" } ],
            "page": 0, "size": 20, "totalElements": 1, "totalPages": 1, "hasNext": false } }
```

**에러** — 공통만

---

### P-23. Vault 경로 묶기 승인 · 거절

`POST /api/v1/vault-path-requests/{requestId}/review`

| 항목 | 내용 |
|------|------|
| 권한 | `sso-admin` |
| 요구사항 | PRJ-1-42, 44 |
| 테이블 | `project_vault_path_requests`, `project_service_resources`(승인 → `APPROVED` 행 추가), `project_service_sync_jobs`(Vault 켜짐 → `PROVISION`, 정책에 경로 추가) |
| 감사 로그 · 알림 | 감사 `VAULT_PATH_REVIEWED`. 신청한 PM 에게 `ACCESS_RESULT` |

**요청 본문** (README 1.12 승인 · 거절 모양)

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `decision` | string | O | `APPROVE` · `REJECT` |
| `reason` | string | 거절이면 O | 500자 이하 |

```json
{ "decision": "APPROVE" }
```

```json
{ "decision": "REJECT", "reason": "secret/defme/ 는 SENS 프로젝트도 쓰고 있어요. LAB 에 묶어 주세요." }
```

**응답** `200 OK` — 처리한 `VaultPathRequest`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P032` | 거절인데 `reason` 없음 |
| 404 | `P022` | 없는 신청 |
| 409 | `P023` | 그사이 같은 경로(또는 서로 품는 경로)가 다른 프로젝트에 묶임 |
| 409 | `P025` | 이미 처리한 신청 |

---

## 7. 라벨 — PRJ-2-04

### P-24. 라벨 목록

`GET /api/v1/projects/{projectKey}/labels`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-04, PRJ-2-25 (보드 거르기) |
| 테이블 | `project_labels`, `task_labels`(사용 수) |
| 감사 로그 · 알림 | 없음 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `labels[]` | array | 이름 순 |
| `labels[].labelId` | number | |
| `labels[].name` | string | |
| `labels[].color` | string | `#RRGGBB` |
| `labels[].taskCount` | number | 붙은 작업 수 (지운 작업 제외) |

```json
{ "labels": [ { "labelId": 1, "name": "sso", "color": "#3B82F6", "taskCount": 12 },
              { "labelId": 2, "name": "테스트", "color": "#10B981", "taskCount": 5 } ] }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |

---

### P-25. 라벨 만들기

`POST /api/v1/projects/{projectKey}/labels`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-2-04 |
| 테이블 | `project_labels` |
| 감사 로그 · 알림 | 활동 `SETTINGS_CHANGED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `name` | string | O | 1~30자, 프로젝트 안에서 고유 (대소문자 무시) |
| `color` | string | O | `^#[0-9A-Fa-f]{6}$`. 대문자로 저장 |

```json
{ "name": "보안", "color": "#EF4444" }
```

**응답** `201 Created` · `Location: /api/v1/projects/{projectKey}/labels/{labelId}` — `{ labelId, name, color, taskCount: 0 }`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 · 색 형식 위반 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P028` | 같은 이름의 라벨이 있음 |

---

### P-26. 라벨 고치기

`PATCH /api/v1/projects/{projectKey}/labels/{labelId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-2-04 |
| 테이블 | `project_labels` |
| 감사 로그 · 알림 | 활동 `SETTINGS_CHANGED` |

**요청 본문** — `name`, `color` 중 보낸 것만 (규칙은 P-25)

```json
{ "color": "#F59E0B" }
```

**응답** `200 OK` — 바뀐 라벨

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 형식 위반 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P027` | 그 프로젝트에 없는 라벨 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P028` | 같은 이름의 라벨이 있음 |

---

### P-27. 라벨 지우기

`DELETE /api/v1/projects/{projectKey}/labels/{labelId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-2-04 |
| 테이블 | `project_labels`, `task_labels`(그 라벨 행 함께 지움) |
| 감사 로그 · 알림 | 활동 `SETTINGS_CHANGED` (작업마다 기록하지 않음) |

라벨은 숨김 없이 지웁니다 (테이블에 `[삭제]` 칸 없음). 붙어 있던 작업에서도 빠집니다.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P027` | 없는 라벨 |
| 409 | `P003` | 보관된 프로젝트 |

---

## 8. 마일스톤 — PRJ-2 P5

### P-28. 마일스톤 목록

`GET /api/v1/projects/{projectKey}/milestones`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-41, 42, PRJ-1-03 |
| 테이블 | `milestones`, `tasks` (`idx_tasks_milestone`, 진행률 계산) |
| 감사 로그 · 알림 | 없음 |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string | X | `OPEN` · `CLOSED`. 없으면 둘 다 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `milestones[]` | array | 열린 것 먼저, 그 안에서 기한 순(기한 없는 것은 뒤) |
| `milestones[].milestoneId` | number | |
| `milestones[].name` | string | |
| `milestones[].description` | string \| null | |
| `milestones[].dueOn` | string \| null | |
| `milestones[].status` | string | `OPEN` · `CLOSED` |
| `milestones[].closedAt` | string \| null | |
| `milestones[].overdue` | boolean | 열려 있고 기한이 오늘(KST) 보다 앞 (PRJ-2-42) |
| `milestones[].progress` | object | `{ done, total, ratio }` — `total` = 전체 − 취소, `ratio` = done ÷ total (total 0 이면 0) (PRJ-2-41) |
| `milestones[].openTaskCount` | number | 끝나지 않은 작업 수 (닫을 때 확인) |

```json
{ "milestones": [
  { "milestoneId": 21, "name": "v1.2 배포 — 공지 · 캘린더", "description": null, "dueOn": "2026-12-01",
    "status": "OPEN", "closedAt": null, "overdue": false,
    "progress": { "done": 9, "total": 14, "ratio": 0.64 }, "openTaskCount": 5 },
  { "milestoneId": 18, "name": "v1.1 — SSO 5단계", "description": null, "dueOn": "2026-11-17",
    "status": "CLOSED", "closedAt": "2026-11-17T08:00:00Z", "overdue": false,
    "progress": { "done": 12, "total": 12, "ratio": 1.0 }, "openTaskCount": 0 } ] }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P001` | 볼 수 없는 프로젝트 |

---

### P-29. 마일스톤 만들기

`POST /api/v1/projects/{projectKey}/milestones`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-2-40, P5 항목 |
| 테이블 | `milestones` |
| 감사 로그 · 알림 | 활동 `SETTINGS_CHANGED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `name` | string | O | 1~50자, 프로젝트 안에서 고유 |
| `description` | string | X | 2,000자 이하 |
| `dueOn` | string | X | 날짜 |

```json
{ "name": "문서화 · 운영 가이드", "dueOn": "2026-12-15" }
```

**응답** `201 Created` · `Location: /api/v1/projects/{projectKey}/milestones/{milestoneId}` — P-28 의 항목 하나 (`status: "OPEN"`)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 위반 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P030` | 같은 이름의 마일스톤이 있음 |

---

### P-30. 마일스톤 고치기 · 닫기 · 다시 열기

`PATCH /api/v1/projects/{projectKey}/milestones/{milestoneId}`

| 항목 | 내용 |
|------|------|
| 권한 | PM, `project-manage` |
| 요구사항 | PRJ-2-40, 43 |
| 테이블 | `milestones`, `tasks.milestone_id`, `project_activities`(옮긴 작업마다 `TASK_FIELD_CHANGED`) |
| 감사 로그 · 알림 | 활동 `SETTINGS_CHANGED`. 옮긴 작업의 구독자에게 알림 없음 (마일스톤은 P11 알림 대상 항목이 아님) |

닫기 · 다시 열기는 `status` 로 합니다 (README 1.11 규칙 2).

**요청 본문** — 보낸 필드만 바꿉니다.

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `name` | string | X | 1~50자, 고유 |
| `description` | string \| null | X | 2,000자 |
| `dueOn` | string \| null | X | |
| `status` | string | X | `OPEN` · `CLOSED` |
| `openTasks` | object | 닫을 때 끝나지 않은 작업이 있으면 O | 그 작업을 어떻게 할지 (PRJ-2-43) |
| `openTasks.action` | string | O | `MOVE`(다른 마일스톤으로) · `CLEAR`(마일스톤 없음) |
| `openTasks.targetMilestoneId` | number | `MOVE` 면 O | 같은 프로젝트의 **열린** 다른 마일스톤 |

```json
{ "status": "CLOSED", "openTasks": { "action": "MOVE", "targetMilestoneId": 22 } }
```

```json
{ "status": "OPEN" }
```

**응답** `200 OK` — 바뀐 마일스톤 (P-28 항목 모양)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 길이 위반 |
| 400 | `P031` | `targetMilestoneId` 가 같은 프로젝트의 열린 다른 마일스톤이 아님 |
| 400 | `P038` | 끝나지 않은 작업이 있는데 `openTasks` 없이 닫음 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 404 | `P029` | 없는 마일스톤 |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P030` | 같은 이름의 마일스톤이 있음 |

---

## 9. 프로젝트 모임 날짜 정하기 — COM-3-09

### P-31. 프로젝트 참여자 대상 모임 날짜 정하기 만들기

`POST /api/v1/projects/{projectKey}/meeting-polls`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 (모임 날짜 정하기는 모든 구성원이 만들 수 있음, COM-3-01) |
| 요구사항 | COM-3-09 |
| 테이블 | calendar 모듈 `meeting_polls`(`project_id`), `meeting_poll_dates`, `meeting_poll_targets` — project 가 calendar 공개 API 를 부른다 |
| 감사 로그 · 알림 | 대상에게 `MEETING_POLL_REQUEST` (calendar 가 보냄) |

calendar 는 project 를 모르므로([README R3](README.md#31-모듈-의존이-순환함-설계-수정-필요)), 대상 펼치기만 project 가 하고 나머지는 `POST /api/v1/meeting-polls` 와 같습니다. 확정한 일정에는 이 프로젝트가 연결됩니다.

**요청 본문** — [20 · 모임 날짜 정하기 만들기](20-communication.md#3-모임-날짜-정하기--com-3-화면-02--모임-날짜-정하기) 와 같고, `targets` 대신 아래를 받습니다.

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `excludeMemberIds` | number[] | X | 참여자 중 뺄 사람. 대상 = 지금의 PM · 참여자(재실) − 이것. 만든 사람은 참여자가 아니어도 대상에 넣지 않음 |
| 나머지 | | | `title`, `description`, `candidateDates`, `dayStartTime`, `dayEndTime`, `slotMinutes`, `durationMinutes`, `location`, `onlineUrl`, `closesAt` — 20 문서 규칙 그대로 |

```json
{ "title": "DEFME 중간 점검 회의",
  "candidateDates": ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"],
  "dayStartTime": "10:00", "dayEndTime": "19:00", "slotMinutes": 60, "durationMinutes": 120,
  "location": "세미나실", "closesAt": "2026-11-19T09:00:00Z", "excludeMemberIds": [] }
```

**응답** `201 Created` · `Location: /api/v1/meeting-polls/{pollId}` — `GET /api/v1/meeting-polls/{pollId}` 와 같은 본문 (20 문서)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `CL…` | 후보 날짜 · 시간 · 마감 규칙 위반 (calendar 에러 코드, 20 문서) |
| 400 | `P039` | 빼고 나니 대상이 0명 |
| 404 | `P001` | 볼 수 없는 프로젝트 |
| 409 | `P003` | 보관된 프로젝트 |

---

## 10. sso 가 쓰는 공개 API (HTTP 아님)

sso 모듈은 OIDC 토큰을 만들 때 project 공개 API `ProjectServiceAccessQueryApi` 를 부릅니다 (의존 `sso → project`, [README R7](README.md#31-모듈-의존이-순환함-설계-수정-필요)).

| 메서드 | 돌려주는 것 | 쓰는 곳 |
|--------|-------------|---------|
| `findServiceGroups(memberId)` | `prj-<키 소문자>-vault-read` · `-vault-write` · `-jenkins-read` · `-jenkins-build` 그룹 이름 목록 + Jenkins 권한이 하나라도 있으면 `jenkins-user`. 계산은 P-16 의 `effective` 와 같다 (참여 중 · 보관 아님 · 서비스 켜짐 · 개별 값 또는 역할 기본값) | OIDC `groups` 클레임 (PRJ-1-51, 52) |
| `hasAnyServiceAccess(memberId, service)` | 그 서비스의 프로젝트 권한이 하나라도 있는지 | 공통코드 `SSO_APP` 접근 역할의 `@project` 판단 (PRJ-1-51) |

auth 모듈(내 서비스 권한, 권한 신청 승인 — [10 7장](10-member.md))도 같은 API 와 `ProjectServiceAccessCommandApi.setMemberLevel(...)` 을 씁니다.

---

## 에러 코드 (project, P001~P099)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `P001` | `PROJECT_NOT_FOUND` | 프로젝트를 찾을 수 없어요. |
| 409 | `P002` | `DUPLICATE_PROJECT_KEY` | 이미 쓰고 있거나 예전에 쓴 프로젝트 키예요. 다른 키를 정해 주세요. |
| 409 | `P003` | `PROJECT_ARCHIVED` | 보관된 프로젝트는 고칠 수 없어요. 보관을 먼저 풀어 주세요. |
| 400 | `P004` | `INVALID_PROJECT_CATEGORY` | 사용할 수 없는 프로젝트 카테고리예요. |
| 400 | `P005` | `INVALID_PROJECT_PERIOD` | 종료 예정일은 시작일과 같거나 뒤여야 해요. |
| 404 | `P007` | `PROJECT_MEMBER_NOT_FOUND` | 이 프로젝트의 참여자가 아니에요. |
| 409 | `P008` | `ALREADY_PROJECT_MEMBER` | 이미 이 프로젝트에 참여하고 있어요. |
| 400 | `P009` | `MEMBER_NOT_ACTIVE` | 재실 중인 구성원만 참여자로 더할 수 있어요. |
| 409 | `P010` | `LAST_PROJECT_MANAGER` | 프로젝트 관리자는 한 명 이상 있어야 해요. |
| 400 | `P011` | `TASK_REASSIGNMENT_REQUIRED` | 끝나지 않은 담당 작업을 모두 넘기거나 담당자 없음으로 정해 주세요. |
| 400 | `P012` | `INVALID_NEW_ASSIGNEE` | 새 담당자는 이 프로젝트에 참여 중인 재실 구성원이어야 해요. |
| 404 | `P013` | `PROJECT_LINK_NOT_FOUND` | 연동 서비스 연결을 찾을 수 없어요. |
| 400 | `P014` | `INVALID_LINK_URL` | 주소가 그 서비스의 주소가 아니에요. 서비스에서 주소를 복사해 넣어 주세요. |
| 409 | `P015` | `JENKINS_JOB_ALREADY_LINKED` | 다른 프로젝트가 이미 연결한 Jenkins 작업이에요. |
| 409 | `P016` | `GITHUB_REPOSITORY_ALREADY_LINKED` | 다른 프로젝트가 이미 연결한 GitHub 저장소예요. |
| 400 | `P017` | `GITHUB_APP_NOT_INSTALLED` | 이 저장소에는 연구실 GitHub App 이 설치되어 있지 않아요. 조직 관리자에게 설치를 요청해 주세요. |
| 400 | `P018` | `UNSUPPORTED_SERVICE` | 이 서비스에는 쓸 수 없는 설정이에요. |
| 400 | `P019` | `INVALID_SERVICE_LEVEL` | Vault 는 없음 · 읽기 · 쓰기, Jenkins 는 없음 · 읽기 · 빌드만 고를 수 있어요. |
| 400 | `P020` | `JENKINS_JOB_REQUIRED` | Jenkins 서비스 권한을 쓰려면 Jenkins 작업을 하나 이상 연결해 두어야 해요. |
| 409 | `P021` | `SERVICE_SYNC_IN_PROGRESS` | 이미 서비스 설정을 만들고 있어요. 잠시 뒤 결과를 확인해 주세요. |
| 404 | `P022` | `VAULT_PATH_REQUEST_NOT_FOUND` | Vault 경로 묶기 신청을 찾을 수 없어요. |
| 409 | `P023` | `VAULT_PATH_ALREADY_BOUND` | 다른 프로젝트에 이미 묶인 Vault 경로예요. |
| 409 | `P024` | `DUPLICATE_VAULT_PATH_REQUEST` | 같은 경로로 처리를 기다리는 신청이 있어요. |
| 409 | `P025` | `VAULT_PATH_REQUEST_ALREADY_REVIEWED` | 이미 처리한 신청이에요. |
| 400 | `P026` | `INVALID_VAULT_PATH` | Vault 경로는 secret/ 로 시작하고 / 로 끝나야 하며, secret/projects/ 아래는 묶을 수 없어요. |
| 404 | `P027` | `LABEL_NOT_FOUND` | 라벨을 찾을 수 없어요. |
| 409 | `P028` | `DUPLICATE_LABEL_NAME` | 같은 이름의 라벨이 있어요. |
| 404 | `P029` | `MILESTONE_NOT_FOUND` | 마일스톤을 찾을 수 없어요. |
| 409 | `P030` | `DUPLICATE_MILESTONE_NAME` | 같은 이름의 마일스톤이 있어요. |
| 400 | `P031` | `INVALID_TARGET_MILESTONE` | 옮길 곳은 이 프로젝트의 열린 다른 마일스톤이어야 해요. |
| 400 | `P032` | `REVIEW_REASON_REQUIRED` | 거절할 때는 사유를 적어 주세요. |
| 409 | `P035` | `LAB_PROJECT_PROTECTED` | 연구실 운영(LAB) 프로젝트는 보관하거나 지울 수 없어요. |
| 400 | `P037` | `NOT_PROJECT_PARTICIPANT` | 참여 중인 구성원에게만 서비스 권한을 정할 수 있어요. |
| 400 | `P038` | `OPEN_TASKS_ACTION_REQUIRED` | 끝나지 않은 작업이 있어요. 다른 마일스톤으로 옮길지, 마일스톤 없음으로 둘지 골라 주세요. |
| 400 | `P039` | `NO_MEETING_POLL_TARGET` | 모임 날짜를 물어볼 참여자가 없어요. |
| 400 | `P040` | `PROJECT_MANAGER_HANDOVER_MISSING` | 마지막 프로젝트 관리자인 프로젝트의 새 관리자를 골라 주세요. 새 관리자는 그 프로젝트의 재실 참여자여야 해요. |
| 409 | `P041` | `PROJECT_LINK_DUPLICATED` | 이 프로젝트에 이미 연결한 대상이에요. |

`P006`, `P033`, `P034`, `P036` 은 비워 둡니다 (쓰지 않음). 작업 · 스레드는 `P100~`([31](31-task.md)), 회의록 · 주간 보고는 `P200~`([32](32-minute-report.md)) 입니다.
