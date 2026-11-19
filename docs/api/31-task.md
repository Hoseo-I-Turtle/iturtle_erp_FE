# 31. 작업 · 프로젝트 스레드 API (project 모듈)

[README](README.md) 의 공통 규칙(1.7 공통 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙, 1.12 공통 API)을 따릅니다.
범위는 SRS [PRJ-2](../srs/30-project.md#prj-2-작업-관리) 의 작업 · 보드 · 체크리스트 · 구독 · 스레드이고, 테이블은 [db/30-project.md](../db/30-project.md) 3 · 4장입니다.
프로젝트 · 참여자 · 라벨 · 마일스톤 · 프로젝트 활동 기록은 [30-project.md](30-project.md), 회의록 · 주간 보고는 [32-minute-report.md](32-minute-report.md) 에 있습니다.

| 이 문서에서 쓰는 공통 API | 문서 |
|---------------------------|------|
| 작업 댓글 · 반려 사유 · 스레드 답글: `/api/v1/comments?targetType=TASK\|PROJECT_THREAD&targetId=` | [60](60-common.md) |
| 첨부: `POST /api/v1/files/uploads` 로 올린 뒤 이 문서의 `attachmentFileIds` 로 붙임 | [40](40-document-file.md) |
| 작업 활동 기록: `GET /api/v1/projects/{projectKey}/activities?taskKey=DEFME-44` (프로젝트 활동과 같은 표 · 같은 API) | [30](30-project.md) |

---

## 공통 모양

### 권한 이름

| 이름 | 누구 |
|------|------|
| 볼 수 있음 | 그 프로젝트를 볼 수 있는 사람: 참여자, `project-observe`, 연구실 공개 프로젝트면 `project-view-public`, `project-manage` ([SRS 프로젝트 권한](../srs/30-project.md#프로젝트-권한)) |
| 참여자 | 프로젝트 관리자(PM) 또는 참여자 (`project_members.role` 이 `MANAGER`·`MEMBER`). 이전 참여자(`FORMER`)는 아님 |
| PM 급 | PM 또는 `project-manage`. SRS 권한 표가 `project-manage` 에게 "상태 바꾸기"를 주므로 상태 이동 표의 "프로젝트 관리자"는 PM 급으로 읽는다 |
| 쓰기 가능 | 참여자 또는 `project-manage` (작업 만들기 · 고치기 · 상태 바꾸기, SRS 권한 표) |

**보관된 프로젝트**(`status = ARCHIVED`)는 읽기만 됩니다. 이 문서의 모든 바꾸기 API 는 `409 P003` 으로 거절합니다 (PRJ-1-06).
볼 수 없는 프로젝트 · 작업 · 글은 `404` 입니다 (NFR-SEC-03).

### PATCH 본문의 빈 값

`PATCH` 본문에서 **필드가 없으면 그대로**, **`null` 을 보내면 비웁니다** (예: `"assigneeMemberId": null` = 담당자 없음). 구현은 `JsonNullable` 로 둘을 구분합니다.

### TaskRef

```json
{ "taskId": 4401, "taskKey": "DEFME-44", "title": "OIDC 로그아웃 테스트 케이스 추가", "status": "REVIEW" }
```

### TaskCard — 보드 카드 · 목록 한 줄 (PRJ-2-22)

| 필드 | 타입 | 설명 |
|------|------|------|
| `taskId` | number | `tasks.id`. 댓글 `targetId` 로 쓴다 |
| `taskKey` | string | `프로젝트키-task_no` |
| `projectKey` | string | |
| `title` | string | |
| `typeCode` · `typeName` | string | 공통코드 `TASK_TYPE` (`TASK` 작업 …). `typeIcon` = 상세 코드 `ref1` |
| `status` | string | `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `CANCELLED` |
| `priority` | string | `URGENT`, `HIGH`, `NORMAL`, `LOW` |
| `assignee` | MemberRef \| null | 담당자 |
| `requester` | MemberRef | 요청자 |
| `dueOn` | string \| null | `YYYY-MM-DD` |
| `overdue` | boolean | 기한이 오늘(KST) 이전이고 `DONE` · `CANCELLED` 가 아님 (빨간색) |
| `labels` | `{ labelId, name, color }[]` | |
| `milestone` | `{ milestoneId, name }` \| null | |
| `checklist` | `{ done, total }` | 하위 작업 진행 (`2/5`) |
| `commentCount` | number | comment 모듈에서 센 값 (삭제된 댓글 제외) |
| `boardRank` | string | 같은 상태 열 안의 순서 (작을수록 위) |
| `completedAt` | string \| null | |
| `updatedAt` | string | |
| `version` | number | 동시 수정 확인 값 |

### TaskDetail — 작업 상세 (PRJ-2-02)

`TaskCard` 의 모든 필드에 더해:

| 필드 | 타입 | 설명 |
|------|------|------|
| `description` | string \| null | Markdown 원문 |
| `creator` | MemberRef | 만든 사람 ([아래 불일치 1](#테이블--srs-와-맞춰-본-결과)) |
| `createdAt` | string | |
| `checklistItems` | ChecklistItem[] | 순서대로 |
| `attachments` | FileRef[] | |
| `watchers` | `{ count, watching, members: MemberRef[] }` | `watching` = 내가 구독 중 |
| `source` | `{ type, id, label, url }` \| null | 다른 곳에서 만들어졌으면 (`MEETING_ACTION` → "11/10 주간 회의", `THREAD`, `CHECKLIST` → 원래 작업 키) |
| `convertedTasks` | TaskRef[] | 이 작업의 체크리스트에서 만든 작업 |
| `allowedTransitions` | `{ toStatus, reasonRequired }[]` | **보는 사람이** 지금 옮길 수 있는 상태 (P2 표와 권한으로 서버가 계산). 화면은 이 값으로 버튼 · 끌어 놓기를 막는다 |
| `permissions` | `{ canEdit, canDelete }` | |

화면 '작업 상세'의 **PR · Jenkins 빌드 연결**은 SRS · 테이블에 없어 넣지 않았습니다 ([README S1](README.md#33-화면--srs--테이블-불일치) 결정 뒤 추가).

### ChecklistItem

```json
{ "itemId": 901, "content": "client_id 로 로그아웃", "done": true,
  "assignee": null, "displayOrder": 2, "convertedTask": null }
```

### ThreadItem — 스레드 글

| 필드 | 타입 | 설명 |
|------|------|------|
| `threadId` | number | 답글 `targetId` 로 쓴다 |
| `title` | string \| null | |
| `body` | string | Markdown 원문 (Mermaid 코드 블록 포함) |
| `author` | MemberRef | |
| `createdAt` | string | |
| `editedAt` | string \| null | 본문을 고친 시각 ("11/14 수정") |
| `editedBy` | MemberRef \| null | 고친 사람 ([README T4](README.md#32-테이블--컬럼-보완) 칸 추가 전제) |
| `pin` | `{ pinnedAt, pinnedBy: MemberRef, order }` \| null | 고정 글이면 |
| `replyCount` | number | comment 모듈에서 센 답글 수 |
| `lastActivityAt` | string | 마지막 답글 시각 (없으면 쓴 시각) |
| `attachments` | FileRef[] | |
| `convertedTask` | TaskRef \| null | 작업으로 바꿨으면 |
| `permissions` | `{ canEdit, canDelete, canPin }` | |

---

## API 목록

| # | 메서드 | 경로 | 권한 | 요약 |
|---|--------|------|------|------|
| T-1 | GET | `/api/v1/tasks` | 볼 수 있음 | 작업 조회 — 칸반 보드 · 목록 보기 · 내 작업 · 검토 대기 · 기한 겹쳐 보기를 필터로 |
| T-2 | POST | `/api/v1/tasks` | 쓰기 가능 | 작업 만들기 (체크리스트 · 스레드 글을 작업으로 바꾸기 포함) |
| T-3 | GET | `/api/v1/tasks/{taskKey}` | 볼 수 있음 | 작업 상세 |
| T-4 | PATCH | `/api/v1/tasks/{taskKey}` | 쓰기 가능 | 작업 고치기 · 같은 열 안에서 순서 바꾸기 |
| T-5 | PATCH | `/api/v1/tasks` | 쓰기 가능 | 여러 작업 한 번에 고치기 (담당자 · 마일스톤 · 라벨 · 우선순위) |
| T-6 | DELETE | `/api/v1/tasks/{taskKey}` | PM 급, 만든 사람 | 작업 지우기 (숨김) |
| T-7 | POST | `/api/v1/tasks/{taskKey}/transition` | P2 표 | 상태 옮기기 (+ 보드에 놓을 자리) |
| T-8 | POST | `/api/v1/tasks/{taskKey}/checklist-items` | 쓰기 가능 | 체크리스트 항목 더하기 |
| T-9 | PATCH | `/api/v1/tasks/{taskKey}/checklist-items/{itemId}` | 쓰기 가능 | 항목 고치기 · 체크 · 순서 바꾸기 |
| T-10 | DELETE | `/api/v1/tasks/{taskKey}/checklist-items/{itemId}` | 쓰기 가능 | 항목 지우기 |
| T-11 | PUT | `/api/v1/tasks/{taskKey}/watch` | 볼 수 있음 | 구독하기 |
| T-12 | DELETE | `/api/v1/tasks/{taskKey}/watch` | 볼 수 있음 | 구독 해제 |
| T-13 | GET | `/api/v1/tasks/lookup` | 로그인 | 작업 번호 여러 개를 링크용으로 찾기 (볼 수 있는 것만) |
| H-1 | GET | `/api/v1/projects/{projectKey}/threads` | 볼 수 있음 | 스레드 목록 (고정 영역 + 최근 답글 순) |
| H-1b | GET | `/api/v1/projects/threads` | 로그인 | 여러 프로젝트의 스레드 글 검색 (통합 검색용) |
| H-2 | POST | `/api/v1/projects/{projectKey}/threads` | 참여자, `project-observe`, `project-manage` | 글쓰기 |
| H-3 | GET | `/api/v1/projects/{projectKey}/threads/{threadId}` | 볼 수 있음 | 글 하나 (알림 · 링크로 들어올 때) |
| H-4 | PATCH | `/api/v1/projects/{projectKey}/threads/{threadId}` | 작성자 · (고정 글) PM 급 · (고정) PM 급 | 글 고치기, 상단 고정 · 해제 |
| H-5 | PUT | `/api/v1/projects/{projectKey}/threads/pinned-order` | PM 급 | 고정 글 순서 한 번에 저장 |
| H-6 | DELETE | `/api/v1/projects/{projectKey}/threads/{threadId}` | 작성자, PM 급 | 글 지우기 (숨김) |

모두 19개입니다. 같은 데이터라 따로 두지 않은 것:

| 화면 · 기능 | 쓰는 API |
|-------------|----------|
| 칸반 보드, 작업 목록 보기, 내 작업(PRJ-2-06), 홈 "내 작업" · "검토를 기다리는 작업"(CMN-1-06), 캘린더 작업 기한 층(COM-4-09) | T-1 의 필터 |
| 보드에서 다른 열로 끌기 | T-7 (`boardPosition` 포함) / 같은 열 안 끌기는 T-4 (`boardPosition` 만) |
| 체크리스트 항목 → 작업 (PRJ-2-32), 스레드 글 → 작업 (PRJ-2-76) | T-2 의 `source` |
| 작업 댓글 · 반려 사유 · 스레드 답글 | 공통 `/comments` ([60](60-common.md)). 반려 · 취소 사유는 T-7 이 만든다 |
| 작업 첨부 더하기 · 빼기 | T-4 의 `attachmentFileIds` |
| 작업 활동 기록 | `GET /projects/{projectKey}/activities?taskKey=` ([30](30-project.md)) |
| 멘션 자동 완성 | `GET /projects/{projectKey}` 의 참여자 목록 + 볼 수 있는 사람 ([README 1.12](README.md#112-여러-영역이-같이-쓰는-api)) |

---

## 작업

### T-1. 작업 조회

`GET /api/v1/tasks`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. 결과에는 **볼 수 있는 프로젝트의 작업만** 들어간다 |
| 요구사항 | PRJ-2-06, 07, 20, 21, 25, 27, COM-4-09, CMN-1 (내 작업 · 검토 대기) |
| 테이블 | `tasks` (`idx_tasks_board`, `idx_tasks_assignee`, `idx_tasks_milestone`, `idx_tasks_due`), `task_labels`, `project_labels`, `milestones`, `task_checklist_items`, `comments`(개수) |

**요청 헤더** — 공통

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `projectKey` | string | △ | 프로젝트 하나. 없으면 `mine` · `assigneeId` · `awaitingMyReview` 중 하나가 있어야 한다 (`400 P125`) |
| `statuses` | string (쉼표) | | 기본: `CANCELLED` 를 뺀 4개 (보드 기준, PRJ-2-20). 목록 보기에서 취소를 보려면 `CANCELLED` 를 넣는다 |
| `doneWithinDays` | number | | `DONE` 은 최근 N일 안에 완료된 것만 (`completed_at`). 보드는 `14` (PRJ-2-21). 1~365 |
| `mine` | boolean | | 내가 담당자 |
| `assigneeId` | number | | 담당자. `0` = 담당자 없음 |
| `requesterId` | number | | 요청자 |
| `awaitingMyReview` | boolean | | `REVIEW` 이면서 내가 요청자이거나 내가 PM 인 프로젝트의 작업 (CMN-1-06) |
| `labelIds` | number (쉼표) | | 이 라벨 중 하나라도 있는 작업 |
| `milestoneId` | number | | `0` = 마일스톤 없음 |
| `priorities` | string (쉼표) | | |
| `typeCodes` | string (쉼표) | | |
| `dueFrom` · `dueTo` | date | | 기한 범위 (캘린더 겹쳐 보기) |
| `keyword` | string | | 제목 · 설명 검색 (`ft_tasks`), 2자 이상 |
| `since` | string (시각) | | 앞 응답의 `serverTime`. 그 뒤 **바뀌거나 지워진 작업만** 준다 (PRJ-2-27, 1분 반영). 이때 `statuses` · `doneWithinDays` 는 적용하지 않는다 — 열 밖으로 나간 카드를 화면이 빼야 하므로 |
| `sort` | string | | `board`(상태 → `board_rank`, `projectKey` 가 있을 때 기본), `dueOn`(기한 → 우선순위, 없을 때 기본), `priority`, `updatedAt,desc`, `taskNo,desc` |
| `page` · `size` | number | | 기본 0 · 20, `size` 최대 100. 보드는 `size=100` 으로 `hasNext` 가 false 가 될 때까지 |

담당자별 가로 줄(PRJ-2-26), 열 나누기, 상태별 개수는 화면이 응답을 묶어 만든다.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `page` | PageResponse&lt;TaskCard&gt; | |
| `deletedTaskKeys` | string[] | `since` 를 보냈을 때만. 그 뒤 지워졌거나 볼 수 없게 된 작업 |
| `serverTime` | string | 다음 `since` 로 쓴다 |

```json
{
  "success": true,
  "data": {
    "page": {
      "content": [
        { "taskId": 4401, "taskKey": "DEFME-44", "projectKey": "DEFME",
          "title": "OIDC 로그아웃 테스트 케이스 추가",
          "typeCode": "TASK", "typeName": "작업", "typeIcon": "check",
          "status": "REVIEW", "priority": "NORMAL",
          "assignee": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=128" },
          "requester": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
          "dueOn": "2026-11-18", "overdue": false,
          "labels": [ { "labelId": 11, "name": "sso", "color": "#4F7DF3" }, { "labelId": 12, "name": "테스트", "color": "#22A06B" } ],
          "milestone": { "milestoneId": 5, "name": "v1.1 — SSO 5단계" },
          "checklist": { "done": 5, "total": 5 }, "commentCount": 2,
          "boardRank": "0|hzzzzz:", "completedAt": null,
          "updatedAt": "2026-11-17T05:40:00Z", "version": 7 }
      ],
      "page": 0, "size": 100, "totalElements": 21, "totalPages": 1, "hasNext": false
    },
    "deletedTaskKeys": [],
    "serverTime": "2026-11-17T05:41:02Z"
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P125` | `projectKey` 도 사람 필터도 없음 |
| 404 | `PROJECT_NOT_FOUND` ([30](30-project.md)) | `projectKey` 가 없거나 볼 수 없음 |

---

### T-2. 작업 만들기

`POST /api/v1/tasks`

| 항목 | 내용 |
|------|------|
| 권한 | 그 프로젝트에 쓰기 가능 |
| 요구사항 | PRJ-2-01, P1 항목, PRJ-2-32 (체크리스트 → 작업), PRJ-2-76 (스레드 → 작업), PRJ-2-53, 80 |
| 테이블 | `projects.next_task_no` (`select … for update`), `tasks`, `task_labels`, `task_watchers`, `project_activities`, `files`, (원본) `task_checklist_items.converted_task_id`, `project_threads.converted_task_id` |
| 감사 로그 · 알림 | 활동 `TASK_CREATED`. 담당자에게 `TASK_ASSIGNED`, 설명의 @멘션에 `MENTIONED` (그 작업을 볼 수 있는 사람만, 나 자신 제외). 요청자 · 담당자 · 멘션된 사람 자동 구독 |

**요청 헤더** — 공통

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `projectKey` | string | O | |
| `title` | string | O* | 1~200자. `source` 가 있으면 비워도 된다 (원본 내용으로 채움) |
| `description` | string | | Markdown, 30,000자 이하 |
| `typeCode` | string | | 공통코드 `TASK_TYPE` 의 사용 중인 코드. 기본 `TASK` |
| `priority` | string | | 기본 `NORMAL` |
| `assigneeMemberId` | number | | 그 프로젝트의 참여자(재실)만 |
| `requesterMemberId` | number | | 참여자 중에서. 기본은 만든 사람 |
| `dueOn` | date | | |
| `labelIds` | number[] | | 그 프로젝트 라벨 |
| `milestoneId` | number | | 그 프로젝트 마일스톤 |
| `attachmentFileIds` | string[] | | 파일 `publicId`, 20개 이하 |
| `source` | object | | 다른 곳에서 작업으로 바꿀 때 (아래) |
| `source.type` | string | O | `CHECKLIST` 또는 `THREAD`. 회의록 할 일은 [32](32-minute-report.md) 의 여러 개 만들기를 쓴다 |
| `source.id` | number | O | 체크리스트 항목 ID 또는 스레드 글 ID. **같은 프로젝트** 것만 |

`source` 를 주면 서버가 채우는 값 (요청 값이 있으면 요청 값이 이긴다):

| 원본 | 제목 | 설명 | 담당자 | 원본에 남기는 링크 |
|------|------|------|--------|-------------------|
| `CHECKLIST` | 항목 내용 | "DEFME-44 의 체크리스트에서 만듦" | 항목 담당자 | `task_checklist_items.converted_task_id` |
| `THREAD` | 글 제목 (없으면 본문 첫 줄 200자) | 글 본문 | 없음 | `project_threads.converted_task_id` |

```json
{
  "projectKey": "DEFME",
  "title": "알림 종류 목록 SRS 와 맞추기",
  "description": "@jhlee 확인 부탁해요. COM-5 표 기준",
  "typeCode": "TASK", "priority": "NORMAL",
  "assigneeMemberId": 6, "dueOn": "2026-11-21",
  "labelIds": [21], "milestoneId": 6,
  "attachmentFileIds": ["9b2e1c34-0f0a-4b7e-9a51-3e7d2c8a1f00"]
}
```

```json
{ "projectKey": "DEFME", "source": { "type": "THREAD", "id": 318 } }
```

**응답** `201 Created` (`Location: /api/v1/tasks/DEFME-53`) — `TaskDetail`

```json
{ "success": true,
  "data": { "taskId": 5301, "taskKey": "DEFME-53", "status": "TODO", "version": 0, "...": "TaskDetail 나머지" },
  "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P108` | 담당자가 참여자(재실)가 아님 |
| 400 | `P109` | 요청자가 참여자가 아님 |
| 400 | `P110` | 다른 프로젝트 라벨 |
| 400 | `P111` | 다른 프로젝트 마일스톤 |
| 400 | `P112` | 첨부 20개 넘음 |
| 400 | `P126` | 쓸 수 없는 `typeCode` |
| 400 | `P118` | `source` 원본이 없거나 다른 프로젝트 것 |
| 403 | `P124` | 쓰기 권한 없음 (예: `project-observe` 만 있음) |
| 404 | `PROJECT_NOT_FOUND` ([30](30-project.md)) | |
| 409 | `P003` | 보관된 프로젝트 |
| 409 | `P119` | 원본을 이미 작업으로 바꿨음 |
| 400 · 404 | `F…` ([40](40-document-file.md)) | 첨부 파일이 없음 · 다 올라가지 않음 · 이미 다른 글에 붙음 |

---

### T-3. 작업 상세

`GET /api/v1/tasks/{taskKey}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-02 |
| 테이블 | `tasks`, `task_labels`, `task_checklist_items`, `task_watchers`, `milestones`, `files`, `comments`(개수) |

**경로 파라미터**

| 이름 | 타입 | 설명 |
|------|------|------|
| `taskKey` | string | `^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$`. 형식이 틀려도 404 |

**응답** `200 OK` — `TaskDetail`

```json
{
  "success": true,
  "data": {
    "taskId": 4401, "taskKey": "DEFME-44", "projectKey": "DEFME",
    "title": "OIDC 로그아웃 테스트 케이스 추가",
    "description": "Penpot 2.x 는 id_token_hint 없이 client_id · logout_hint 만 보내므로 …",
    "typeCode": "TASK", "typeName": "작업", "typeIcon": "check",
    "status": "REVIEW", "priority": "NORMAL",
    "assignee": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=128" },
    "requester": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
    "creator": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
    "dueOn": "2026-11-18", "overdue": false,
    "labels": [ { "labelId": 11, "name": "sso", "color": "#4F7DF3" } ],
    "milestone": { "milestoneId": 5, "name": "v1.1 — SSO 5단계" },
    "checklist": { "done": 5, "total": 5 },
    "checklistItems": [
      { "itemId": 900, "content": "ID 토큰으로 로그아웃", "done": true, "assignee": null, "displayOrder": 1, "convertedTask": null }
    ],
    "attachments": [ { "publicId": "0d6c…", "name": "logout-cases.png", "size": 245760, "contentType": "image/png" } ],
    "watchers": { "count": 4, "watching": true, "members": [ { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null } ] },
    "source": { "type": "MEETING_ACTION", "id": 77, "label": "11/10 주간 회의", "url": "/meeting-minutes/31" },
    "convertedTasks": [],
    "commentCount": 2,
    "allowedTransitions": [
      { "toStatus": "DONE", "reasonRequired": false },
      { "toStatus": "IN_PROGRESS", "reasonRequired": true }
    ],
    "permissions": { "canEdit": true, "canDelete": true },
    "boardRank": "0|hzzzzz:", "completedAt": null,
    "createdAt": "2026-11-10T06:02:00Z", "updatedAt": "2026-11-17T05:40:00Z", "version": 7
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P100` | 없음 · 지워짐 · 볼 수 없음 · 형식이 틀림 |

---

### T-4. 작업 고치기 · 순서 바꾸기

`PATCH /api/v1/tasks/{taskKey}`

| 항목 | 내용 |
|------|------|
| 권한 | 쓰기 가능 |
| 요구사항 | PRJ-2-01, 24, 60, 82, P1 항목 |
| 테이블 | `tasks`, `task_labels`, `task_watchers`, `project_activities`, `files` |
| 감사 로그 · 알림 | 바뀐 항목마다 활동 `TASK_FIELD_CHANGED` (`field`, 전 → 후. 예: 기한 `11/20 → 11/25`), 첨부는 `TASK_ATTACHMENT`. 담당자가 바뀌면 새 담당자에게 `TASK_ASSIGNED` + 자동 구독. 담당자 · 기한이 바뀌면 구독자에게 `TASK_WATCH` (5분 묶기, 나 제외). 새로 생긴 @멘션에 `MENTIONED` |

**상태는 여기서 바꾸지 않습니다** (T-7). 본문에 `status` 가 있으면 `400 C001`.

**요청 본문** — 바꿀 필드만

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `version` | number | O* | T-3 에서 받은 값. 다르면 `409 P101`. **`boardPosition` 만 보낼 때는 생략** |
| `title` | string | | 1~200자 |
| `description` | string \| null | | 30,000자 이하 |
| `typeCode` | string | | |
| `priority` | string | | |
| `assigneeMemberId` | number \| null | | `null` = 담당자 없음. `IN_PROGRESS` · `REVIEW` 작업의 담당자를 비우는 것은 막지 않는다 (SRS 에 규칙 없음) |
| `requesterMemberId` | number | | |
| `dueOn` | date \| null | | |
| `labelIds` | number[] | | 통째로 바꿈 |
| `milestoneId` | number \| null | | |
| `attachmentFileIds` | string[] | | 통째로 바꿈 (빠진 파일은 떼어 내고 30일 뒤 지움, DOC-2-09). 20개 이하 |
| `boardPosition` | object | | 같은 상태 열 안에서 옮길 자리 (PRJ-2-24) |
| `boardPosition.afterTaskKey` | string \| null | | 바로 위 카드. `null` 이면 맨 위 |
| `boardPosition.beforeTaskKey` | string \| null | | 바로 아래 카드. 둘 다 `null` 이면 빈 열 |

```json
{ "version": 7, "dueOn": "2026-11-25", "assigneeMemberId": 6, "labelIds": [11, 12] }
```

```json
{ "boardPosition": { "afterTaskKey": "DEFME-41", "beforeTaskKey": "DEFME-47" } }
```

- 서버는 위 · 아래 카드의 `board_rank` 사이 값을 만들어 **이 작업 한 행만** 바꾼다 ([DB D4](../db/README.md#5-설계-판단)).
- 순서 바꾸기 때문에 다른 사람의 고치기가 409 로 막히지 않게, `board_rank` 는 낙관적 잠금에서 뺀다 (`@OptimisticLock(excluded = true)`, [아래 불일치 2](#테이블--srs-와-맞춰-본-결과)).

**응답** `200 OK` — `TaskDetail`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P108` · `P109` · `P110` · `P111` · `P112` · `P126` | T-2 와 같음 |
| 400 | `P117` | `boardPosition` 의 위 · 아래 카드가 같은 프로젝트 · 같은 상태 열이 아님 (보드가 낡음) |
| 403 | `P124` | 쓰기 권한 없음 |
| 404 | `P100` | |
| 409 | `P101` | `version` 이 다름 |
| 409 | `P003` | 보관된 프로젝트 |

---

### T-5. 여러 작업 한 번에 고치기

`PATCH /api/v1/tasks`

| 항목 | 내용 |
|------|------|
| 권한 | 그 프로젝트에 쓰기 가능 |
| 요구사항 | PRJ-2-07 (상태는 한 번에 바꾸지 않음) |
| 테이블 | `tasks`, `task_labels`, `task_watchers`, `project_activities` |
| 감사 로그 · 알림 | 작업마다 T-4 와 같음 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `taskKeys` | string[] | O | 1~100개, **한 프로젝트** 작업만 |
| `assigneeMemberId` | number \| null | | |
| `milestoneId` | number \| null | | |
| `labelIdsToAdd` | number[] | | 있는 라벨은 그대로 두고 더함 |
| `labelIdsToRemove` | number[] | | |
| `priority` | string | | |

```json
{ "taskKeys": ["DEFME-45", "DEFME-46", "DEFME-49"], "milestoneId": 6, "labelIdsToAdd": [21], "priority": "HIGH" }
```

- 전부 되거나 전부 안 된다 (한 트랜잭션). `version` 은 확인하지 않는다 (목록에서 고르는 기능이라 마지막 저장이 이김).
- 하나라도 실패하면 `error.errors[]` 에 `{ "field": "taskKeys[DEFME-46]", "reason": "…" }` 로 어느 작업인지 알려 준다.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `tasks` | TaskCard[] | 바뀐 작업 |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P114` | 100개 넘음 |
| 400 | `P115` | 여러 프로젝트 작업이 섞임 |
| 400 | `P108` · `P110` · `P111` | T-2 와 같음 |
| 403 | `P124` | |
| 404 | `P100` | 볼 수 없는 작업이 섞임 |
| 409 | `P003` | |

---

### T-6. 작업 지우기

`DELETE /api/v1/tasks/{taskKey}`

| 항목 | 내용 |
|------|------|
| 권한 | PM 급, 또는 그 작업을 **만든** 참여자 (SRS 권한 표 "자기가 만든 작업만") |
| 요구사항 | PRJ-2-05 |
| 테이블 | `tasks` (숨김), `project_activities`, `comments` (comment API 로 함께 숨김), `files.purge_at` |
| 감사 로그 · 알림 | 활동 기록 (작업 삭제). 작업 번호는 다시 쓰지 않는다 |

**응답** `200 OK` — `data: null`

- 이 작업을 가리키던 회의록 할 일 · 스레드 · 체크리스트의 링크는 그대로 두고, 화면에는 번호만 보인다 (T-13 이 결과에서 뺌).

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `P116` | 남이 만든 작업을 참여자가 지우려 함 |
| 404 | `P100` | |
| 409 | `P003` | |

---

### T-7. 상태 옮기기

`POST /api/v1/tasks/{taskKey}/transition`

| 항목 | 내용 |
|------|------|
| 권한 | 아래 이동 표 |
| 요구사항 | P2 상태 흐름, PRJ-2-10, 11, 12, 23, 33, 82 |
| 테이블 | `tasks` (`status`, `completed_at`, `board_rank`), `comments` (사유), `project_activities`, `task_watchers` |
| 감사 로그 · 알림 | 활동 `TASK_STATUS_CHANGED`. 구독자에게 `TASK_WATCH` (나 제외). 사유는 작업 댓글로 남긴다: 반려 → `kind = REJECT_REASON`, 취소 · 다시 열기 → `STATUS_REASON` |

**이동 표** (이 밖의 이동은 `400 P102`, PRJ-2-10)

| 지금 → 갈 곳 | 할 수 있는 사람 | 조건 | 틀리면 |
|--------------|-----------------|------|--------|
| `TODO` → `IN_PROGRESS` | 담당자, PM 급 | 담당자가 있어야 함 | `P103`, 권한 `P105` |
| `TODO` → `CANCELLED` | 요청자, PM 급 | `reason` 필수 | `P106`, 권한 `P104` |
| `IN_PROGRESS` → `TODO` | 담당자, PM 급 | | `P105` |
| `IN_PROGRESS` → `REVIEW` | 담당자, PM 급 | 체크리스트가 남아도 됨 (화면이 `checklist` 로 경고, PRJ-2-33) | `P105` |
| `IN_PROGRESS` → `CANCELLED` | 요청자, PM 급 | `reason` 필수 | `P106`, `P104` |
| `REVIEW` → `DONE` | 요청자, PM 급. 담당자는 요청자를 겸할 때만 | `completed_at` 기록 | `P104` |
| `REVIEW` → `IN_PROGRESS` (반려) | 요청자, PM 급 | `reason` 필수 → 반려 사유 댓글 | `P107`, `P104` |
| `DONE` → `IN_PROGRESS` (다시 열기) | 요청자, PM 급 | `reason` 필수. `completed_at` 지움 | `P106`, `P104` |
| `CANCELLED` → `TODO` (다시 열기) | 요청자, PM 급 | | `P104` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `toStatus` | string | O | |
| `version` | number | O | 다르면 `409 P101` (보드가 낡았을 때 엉뚱한 상태에서 옮기지 않게) |
| `reason` | string | 표에 따라 | 1~10,000자 (작업 댓글 길이). 사유가 필요 없는 이동에서 보내면 무시 |
| `boardPosition` | object | | 새 열에서 놓을 자리. T-4 와 같은 모양. 없으면 새 열의 맨 위 |

```json
{ "toStatus": "IN_PROGRESS", "version": 7,
  "reason": "미등록 돌아갈 주소일 때 응답 코드가 302 가 아니라 400 이어야 해요.",
  "boardPosition": { "afterTaskKey": null, "beforeTaskKey": "DEFME-45" } }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `task` | TaskCard | 옮긴 뒤 |
| `reasonCommentId` | number \| null | 사유로 만든 댓글 |

```json
{ "success": true,
  "data": { "task": { "taskKey": "DEFME-44", "status": "IN_PROGRESS", "version": 8, "...": "TaskCard 나머지" }, "reasonCommentId": 7712 },
  "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P102` | 표에 없는 이동 (예: `TODO` → `DONE`, 같은 상태로) |
| 400 | `P103` | 담당자 없이 `IN_PROGRESS` 로 |
| 400 | `P106` | 취소 · 다시 열기에 사유 없음 |
| 400 | `P107` | 반려에 사유 없음 |
| 400 | `P117` | `boardPosition` 이 새 열과 맞지 않음 |
| 403 | `P104` | 요청자 · PM 급이 아님 |
| 403 | `P105` | 담당자 · PM 급이 아님 |
| 404 | `P100` | |
| 409 | `P101` | `version` 이 다름 |
| 409 | `P003` | 보관된 프로젝트 |

---

### T-8. 체크리스트 항목 더하기

`POST /api/v1/tasks/{taskKey}/checklist-items`

| 항목 | 내용 |
|------|------|
| 권한 | 쓰기 가능 |
| 요구사항 | PRJ-2-30 |
| 테이블 | `task_checklist_items` |

체크리스트는 작업 행과 따로 저장하므로 작업의 `version` 을 올리지 않습니다 (체크 하나로 남의 작업 고치기가 409 로 막히지 않게).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `content` | string | O | 1~200자 |
| `assigneeMemberId` | number | | 참여자(재실) |
| `afterItemId` | number \| null | | 이 항목 다음에. 없으면 맨 끝 |

```json
{ "content": "미등록 돌아갈 주소", "assigneeMemberId": 3 }
```

**응답** `201 Created` — `ChecklistItem`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P121` | 이미 50개 |
| 400 | `P108` | 담당자가 참여자가 아님 |
| 403 | `P124` | |
| 404 | `P100` | |
| 409 | `P003` | |

---

### T-9. 체크리스트 항목 고치기 · 체크 · 순서

`PATCH /api/v1/tasks/{taskKey}/checklist-items/{itemId}`

| 항목 | 내용 |
|------|------|
| 권한 | 쓰기 가능 |
| 요구사항 | PRJ-2-30, 31 |
| 테이블 | `task_checklist_items` (`display_order`) |

**요청 본문** — 바꿀 필드만

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `content` | string | | 1~200자 |
| `done` | boolean | | |
| `assigneeMemberId` | number \| null | | |
| `afterItemId` | number \| null | | 끌어서 옮길 때: 이 항목 다음으로. `null` = 맨 위 |

```json
{ "done": true }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `items` | ChecklistItem[] | 순서가 바뀔 수 있어 전체를 준다 |
| `checklist` | `{ done, total }` | |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P108` | |
| 400 | `P127` | `afterItemId` 가 이 작업의 항목이 아님 |
| 403 | `P124` | |
| 404 | `P120` | 항목 없음 |
| 409 | `P003` | |

---

### T-10. 체크리스트 항목 지우기

`DELETE /api/v1/tasks/{taskKey}/checklist-items/{itemId}`

| 항목 | 내용 |
|------|------|
| 권한 | 쓰기 가능 |
| 요구사항 | PRJ-2-30 |
| 테이블 | `task_checklist_items` (행 삭제). 작업으로 바꾼 항목이면 만든 작업은 그대로 둔다 |

**응답** `200 OK` — `{ "checklist": { "done": 4, "total": 4 } }`

**에러** — `403 P124`, `404 P120`, `409 P003`

---

### T-11 · T-12. 구독하기 · 해제

`PUT /api/v1/tasks/{taskKey}/watch` · `DELETE /api/v1/tasks/{taskKey}/watch`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 (참여하지 않은 `project-observe` 도 구독 가능, PRJ-2-81) |
| 요구사항 | PRJ-2-80, 81 |
| 테이블 | `task_watchers` (`PUT` 은 `source = MANUAL`) |

요청 본문 없음. 같은 요청을 두 번 보내도 결과가 같습니다 (멱등).
해제한 뒤에도 댓글을 달거나 멘션되면 다시 자동 구독됩니다 (PRJ-2-80).

**응답** `200 OK`

```json
{ "success": true, "data": { "watching": true, "count": 5 }, "error": null }
```

**에러** — `404 P100`

---

### T-13. 작업 번호 찾기 (링크용)

`GET /api/v1/tasks/lookup`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. **볼 수 있는 작업만** 돌려준다 |
| 요구사항 | PRJ-2-03 (볼 권한이 없으면 번호만 보임), CMN-2-06 (번호로 바로 가기) |
| 테이블 | `projects`, `tasks` |

Markdown 화면이 본문의 `DEFME-12` 같은 번호를 모아 한 번에 묻습니다.

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `keys` | string (쉼표) | O | 1~50개 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `tasks` | TaskRef[] + `projectKey` | 찾은 것만. 없거나 볼 수 없는 번호는 **빼고** 준다 (에러 아님, 있는지도 알리지 않음) |

```json
{ "success": true,
  "data": { "tasks": [ { "taskId": 3101, "taskKey": "DEFME-31", "title": "모듈 의존 규칙 ArchUnit", "status": "DONE", "projectKey": "DEFME" } ] },
  "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P122` | 50개 넘음 |

---

## 프로젝트 스레드 (P9)

### H-1. 스레드 목록

`GET /api/v1/projects/{projectKey}/threads`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-72, 73a, 73c, 75 |
| 테이블 | `project_threads` (`idx_project_threads_pinned`, `idx_project_threads_list`), `comments`(답글 수), `files` |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `pinnedOnly` | boolean | | "고정 글만 보기". `true` 면 `page` 는 비어 있다 |
| `since` | string (시각) | | 앞 응답의 `serverTime`. 그 뒤 쓰이거나 · 고쳐지거나 · 답글이 달린 글만 `page` 에, 지워진 글은 `deletedThreadIds` 에 (1분 반영) |
| `page` · `size` | number | | 고정 안 된 글. 기본 0 · 20, 최대 100 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `pinned` | ThreadItem[] | 고정 글 (최대 10개, `pin.order` 순). 답글이 달려도 자리가 바뀌지 않음. `page` 와 겹치지 않음 |
| `pinnedLimit` | number | `10` ("3 / 10") |
| `page` | PageResponse&lt;ThreadItem&gt; | 고정 안 된 글, `lastActivityAt` 최신 순 |
| `totalCount` | number | 전체 글 수 ("전체 글 24") |
| `deletedThreadIds` | number[] | `since` 일 때만 |
| `serverTime` | string | |

```json
{
  "success": true,
  "data": {
    "pinned": [
      { "threadId": 301, "title": "백엔드 아키텍처 정리",
        "body": "모듈러 모놀리스 구조와 요청 흐름을 정리합니다 …\n\n```mermaid\nflowchart LR\n…\n```",
        "author": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
        "createdAt": "2026-10-21T01:00:00Z",
        "editedAt": "2026-11-14T08:10:00Z",
        "editedBy": { "memberId": 9, "name": "김서연", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
        "pin": { "pinnedAt": "2026-10-21T02:00:00Z", "pinnedBy": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null }, "order": 1 },
        "replyCount": 6, "lastActivityAt": "2026-11-14T08:10:00Z",
        "attachments": [], "convertedTask": null,
        "permissions": { "canEdit": true, "canDelete": false, "canPin": false } }
    ],
    "pinnedLimit": 10,
    "page": { "content": [], "page": 0, "size": 20, "totalElements": 21, "totalPages": 2, "hasNext": true },
    "totalCount": 24,
    "deletedThreadIds": [],
    "serverTime": "2026-11-17T05:41:02Z"
  },
  "error": null
}
```

**에러** — `404 PROJECT_NOT_FOUND` ([30](30-project.md))

---

### H-1b. 스레드 글 검색 (여러 프로젝트)

`GET /api/v1/projects/threads`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. 볼 수 있는 프로젝트의 글만 (SQL 안에서 거름, CMN-2-02) |
| 요구사항 | CMN-2-01~04 (통합 검색의 "프로젝트 스레드") |
| 테이블 | `project_threads` (`ft_project_threads`), `project_members` |
| 감사 로그 · 알림 | 없음 |

H-1 은 한 프로젝트 안의 목록이라, 통합 검색이 모든 프로젝트를 훑을 수 있게 이것만 따로 둡니다 ([60 2장](60-common.md)). 답글 내용은 찾지 않습니다 (답글은 `comments`).

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `keyword` | string | O | 2자 이상. 제목 · 본문(Mermaid 원문 포함, CMN-3-04) |
| `projectKey` | string | X | 한 프로젝트만 |
| `authorId` | number | X | 작성자 |
| `from` · `to` | date | X | 쓴 날짜 범위 |
| `page` · `size` | number | X | 기본 0 · 20, 최대 100. 최신 순 |

**응답** `200 OK` — `PageResponse<ThreadItem>` (H-1 과 같은 항목) + 항목마다 `project`(ProjectRef)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `keyword` 가 없거나 2자보다 짧음, `from > to` |

### H-2. 글쓰기

`POST /api/v1/projects/{projectKey}/threads`

| 항목 | 내용 |
|------|------|
| 권한 | 참여자, `project-observe`, `project-manage` (PRJ-2-70). `project-view-public` 만 있으면 403 |
| 요구사항 | PRJ-2-70, 74, CMN-3 |
| 테이블 | `project_threads` (`last_activity_at` = 쓴 시각), `files`, `project_activities` |
| 감사 로그 · 알림 | 활동 `THREAD_POSTED`. 본문 @멘션에 `MENTIONED` (그 프로젝트를 볼 수 있는 사람만, 나 제외) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `title` | string | | 100자 이하 (선택). 고정하려면 필요 |
| `body` | string | O | Markdown 1~30,000자. Mermaid 코드 블록 원문 그대로 (서버는 그리지 않음, CMN-3-04) |
| `attachmentFileIds` | string[] | | 10개 이하 |

```json
{ "title": "로그인 흐름 정리",
  "body": "로그인 흐름을 정리했어요. @kimsy 확인 부탁해요. DEFME-52\n\n## 로그인 시퀀스\n\n```mermaid\nsequenceDiagram\n  actor U as 사용자\n  …\n```",
  "attachmentFileIds": ["7a10…"] }
```

상단 고정은 글을 올린 뒤 H-4 로 합니다 (화면 안내 "상단 고정은 프로젝트 관리자가 글을 올린 뒤 할 수 있어요").

**응답** `201 Created` (`Location: /api/v1/projects/DEFME/threads/325`) — `ThreadItem`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P135` | 첨부 10개 넘음 |
| 403 | `P138` | 글을 쓸 수 없음 |
| 404 | `PROJECT_NOT_FOUND` ([30](30-project.md)) | |
| 409 | `P003` | 보관된 프로젝트 |

---

### H-3. 글 하나

`GET /api/v1/projects/{projectKey}/threads/{threadId}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-2-70 (알림 · 링크에서 들어올 때) |
| 테이블 | `project_threads`, `files`, `comments`(답글 수) |

답글은 `GET /api/v1/comments?targetType=PROJECT_THREAD&targetId={threadId}` ([60](60-common.md)).

**응답** `200 OK` — `ThreadItem`

**에러** — `404 P130` (없음 · 지워짐 · 다른 프로젝트 글 · 볼 수 없음)

---

### H-4. 글 고치기 · 상단 고정

`PATCH /api/v1/projects/{projectKey}/threads/{threadId}`

| 항목 | 내용 |
|------|------|
| 권한 | 내용(`title` · `body` · `attachmentFileIds`): 작성자. **고정 글이면 PM 급도** (PRJ-2-73b). 고정(`pinned`): PM 급 (PRJ-2-73) |
| 요구사항 | PRJ-2-73, 73a, 73b |
| 테이블 | `project_threads` (`edited_at`, `pinned_at`, `pinned_by_member_id`, `pinned_order`), `project_activities` |
| 감사 로그 · 알림 | 작성자가 아닌 사람이 고치면 활동 `THREAD_EDITED`. 고정하면 `THREAD_PINNED`. 새로 생긴 @멘션에 `MENTIONED` |

**요청 본문** — 바꿀 필드만

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `title` | string \| null | | 100자 이하. 고정 글은 비울 수 없음 |
| `body` | string | | 1~30,000자 |
| `attachmentFileIds` | string[] | | 통째로 바꿈, 10개 이하 |
| `pinned` | boolean | | `true` = 고정 영역 맨 끝에 붙임, `false` = 고정 해제 |

```json
{ "pinned": true, "title": "로그인 흐름 정리" }
```

- 제목 없는 글을 고정하려면 같은 요청에 `title` 을 함께 보낸다 (PRJ-2-73 "고정할 때 제목을 붙이게").
- 답글이 달리는 것은 이 API 가 아니라 댓글 API 이고, 그때 `last_activity_at` 만 바뀐다.

**응답** `200 OK` — `ThreadItem`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P134` | 제목 없이 고정하려 함 · 고정 글의 제목을 비우려 함 |
| 400 | `P135` | 첨부 10개 넘음 |
| 403 | `P131` | 남의 글(고정 안 됨)을 고치려 함 |
| 403 | `P132` | PM 급이 아닌데 `pinned` 를 보냄 |
| 404 | `P130` | |
| 409 | `P133` | 고정 글이 이미 10개 |
| 409 | `P003` | 보관된 프로젝트 |

---

### H-5. 고정 글 순서 저장

`PUT /api/v1/projects/{projectKey}/threads/pinned-order`

| 항목 | 내용 |
|------|------|
| 권한 | PM 급 |
| 요구사항 | PRJ-2-73a ("끌어서 순서 바꾸기") |
| 테이블 | `project_threads.pinned_order` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `threadIds` | number[] | O | 지금 고정된 글 **전부**를 새 순서로. 하나라도 빠지거나 더 있으면 거절 |

```json
{ "threadIds": [305, 301, 312] }
```

**응답** `200 OK` — `{ "pinned": ThreadItem[] }`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P136` | 목록이 지금 고정 글과 다름 (그사이 누가 고정 · 해제함) |
| 403 | `P132` | PM 급이 아님 |
| 409 | `P003` | |

---

### H-6. 글 지우기

`DELETE /api/v1/projects/{projectKey}/threads/{threadId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, PM 급 ([아래 불일치 4](#테이블--srs-와-맞춰-본-결과)) |
| 요구사항 | PRJ-2-70 |
| 테이블 | `project_threads` (숨김, 고정이면 고정 영역에서 빠짐), `comments` (함께 숨김), `files.purge_at` |

작업으로 바꾼 글이면 만든 작업은 그대로 둡니다.

**응답** `200 OK` — `data: null`

**에러** — `403 P137`, `404 P130`, `409 P003`

---

## 에러 코드 (P100~P199)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `P100` | `TASK_NOT_FOUND` | 작업을 찾을 수 없어요. |
| 409 | `P101` | `TASK_VERSION_CONFLICT` | 다른 사람이 먼저 고쳤어요. 새 내용을 보고 다시 고쳐 주세요. |
| 400 | `P102` | `TASK_TRANSITION_NOT_ALLOWED` | 이 상태로는 옮길 수 없어요. |
| 400 | `P103` | `TASK_ASSIGNEE_REQUIRED` | 담당자가 없는 작업은 진행 중으로 옮길 수 없어요. |
| 403 | `P104` | `TASK_TRANSITION_REQUESTER_ONLY` | 요청자나 프로젝트 관리자만 옮길 수 있어요. |
| 403 | `P105` | `TASK_TRANSITION_ASSIGNEE_ONLY` | 담당자나 프로젝트 관리자만 옮길 수 있어요. |
| 400 | `P106` | `TASK_STATUS_REASON_REQUIRED` | 취소하거나 다시 열려면 사유를 적어 주세요. |
| 400 | `P107` | `TASK_REJECT_REASON_REQUIRED` | 반려하려면 사유를 댓글로 남겨야 해요. |
| 400 | `P108` | `TASK_ASSIGNEE_NOT_PARTICIPANT` | 담당자는 이 프로젝트의 재실 참여자만 될 수 있어요. |
| 400 | `P109` | `TASK_REQUESTER_NOT_PARTICIPANT` | 요청자는 이 프로젝트 참여자 중에서 골라 주세요. |
| 400 | `P110` | `TASK_LABEL_NOT_IN_PROJECT` | 이 프로젝트의 라벨이 아니에요. |
| 400 | `P111` | `TASK_MILESTONE_NOT_IN_PROJECT` | 이 프로젝트의 마일스톤이 아니에요. |
| 400 | `P112` | `TASK_ATTACHMENT_LIMIT` | 첨부파일은 20개까지 붙일 수 있어요. |
| 409 | `P003` | `PROJECT_ARCHIVED` | (30 문서에서 정의. 여기서는 같은 코드를 씀) |
| 400 | `P114` | `TASK_BULK_LIMIT` | 한 번에 100개까지 고칠 수 있어요. |
| 400 | `P115` | `TASK_BULK_MIXED_PROJECT` | 같은 프로젝트의 작업만 한 번에 고칠 수 있어요. |
| 403 | `P116` | `TASK_DELETE_FORBIDDEN` | 자기가 만든 작업만 지울 수 있어요. |
| 400 | `P117` | `TASK_BOARD_POSITION_INVALID` | 옮길 자리를 찾을 수 없어요. 보드를 새로 고쳐 주세요. |
| 400 | `P118` | `TASK_SOURCE_NOT_FOUND` | 작업으로 바꿀 원본을 찾을 수 없어요. |
| 409 | `P119` | `TASK_SOURCE_ALREADY_CONVERTED` | 이미 작업으로 바꾼 항목이에요. |
| 404 | `P120` | `CHECKLIST_ITEM_NOT_FOUND` | 체크리스트 항목을 찾을 수 없어요. |
| 400 | `P121` | `CHECKLIST_LIMIT` | 체크리스트는 50개까지 만들 수 있어요. |
| 400 | `P122` | `TASK_LOOKUP_LIMIT` | 한 번에 50개까지 찾을 수 있어요. |
| 403 | `P124` | `TASK_WRITE_FORBIDDEN` | 이 프로젝트의 참여자만 작업을 만들고 고칠 수 있어요. |
| 400 | `P125` | `TASK_QUERY_SCOPE_REQUIRED` | 프로젝트나 담당자를 골라 주세요. |
| 400 | `P126` | `TASK_TYPE_INVALID` | 쓸 수 없는 작업 유형이에요. |
| 400 | `P127` | `CHECKLIST_POSITION_INVALID` | 옮길 자리를 찾을 수 없어요. 새로 고친 뒤 다시 해 주세요. |
| 404 | `P130` | `THREAD_NOT_FOUND` | 글을 찾을 수 없어요. |
| 403 | `P131` | `THREAD_EDIT_FORBIDDEN` | 자기 글만 고칠 수 있어요. 고정 글은 프로젝트 관리자도 고칠 수 있어요. |
| 403 | `P132` | `THREAD_PIN_FORBIDDEN` | 상단 고정은 프로젝트 관리자가 할 수 있어요. |
| 409 | `P133` | `THREAD_PIN_LIMIT` | 고정 글은 10개까지 둘 수 있어요. |
| 400 | `P134` | `THREAD_PIN_TITLE_REQUIRED` | 고정하려면 제목을 붙여 주세요. |
| 400 | `P135` | `THREAD_ATTACHMENT_LIMIT` | 첨부파일은 10개까지 붙일 수 있어요. |
| 400 | `P136` | `THREAD_PINNED_ORDER_MISMATCH` | 고정 글이 바뀌었어요. 새로 고친 뒤 다시 순서를 정해 주세요. |
| 403 | `P137` | `THREAD_DELETE_FORBIDDEN` | 자기 글만 지울 수 있어요. |
| 403 | `P138` | `THREAD_WRITE_FORBIDDEN` | 이 프로젝트 스레드에 글을 쓸 권한이 없어요. |

`P123`, `P128`, `P129`, `P139~P199` 는 비워 둡니다.

---

## 테이블 · SRS 와 맞춰 본 결과

[README 3장](README.md#3-테이블-설계와-맞춰-본-결과)에 없는 것만 적습니다.

| # | 내용 | 제안 |
|---|------|------|
| 1 | `tasks` 에 **만든 사람 ID** 가 없다. "자기가 만든 작업만 지우기"(SRS 권한 표)와 상세의 "만든 사람"을 감사 컬럼 `created_by`(로그인 ID)로만 알 수 있다. 공통 규칙은 화면에 이름을 보여 주는 "누가"를 `~_member_id` 로 둔다 | `creator_member_id bigint` 추가 |
| 2 | `board_rank` 와 `version` 이 같은 행이라, 누가 카드를 끌기만 해도 그 작업을 고치던 사람이 409 를 받는다 | `board_rank` 를 낙관적 잠금에서 뺀다 (`@OptimisticLock(excluded = true)`). 테이블 변화 없음 |
| 3 | 보드의 `since` 조회는 `tasks.updated_at` 으로 바뀐 카드를 찾는데, 댓글 · 체크리스트는 다른 표라 카드의 댓글 수 · `3/5` 가 1분 반영에서 빠진다 | 댓글 · 체크리스트가 바뀔 때 `tasks` 에 버전과 무관한 `activity_at` 을 갱신하거나(칸 추가), 보드는 몇 분마다 전체를 다시 받는다 |
| 4 | 스레드 글 **지우기 권한**이 SRS 에 없다 (댓글 지우기만 PRJ-2-51) | 작성자 + PM 급 으로 적음. SRS PRJ-2-70 에 더한다 |
| 5 | 고정 순서를 바꾸는 사람이 PRJ-2-73a 는 "고정한 사람", 권한 표는 "프로젝트 관리자 · `project-manage`" | 권한 표대로 PM 급. PRJ-2-73a 문구를 맞춘다 |
| 6 | (해결) 캘린더 작업 기한 층은 T-1(`mine=true&dueFrom=&dueTo=`)을 쓰고, 마일스톤은 [30 P-10](30-project.md) `GET /milestones` 로 나눴다 | — |
| 7 | 작업 활동 기록을 프로젝트 활동 API 의 `taskKey` 필터로 쓴다 | [30](30-project.md) 의 프로젝트 활동 API 에 `taskKey` 파라미터가 있어야 한다 |
