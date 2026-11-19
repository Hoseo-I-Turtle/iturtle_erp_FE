# 32. 회의록 · 주간 보고 API

[README](README.md) 의 공통 규칙(1.7 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙, 1.12 공통 API)을 따릅니다. 경로 앞의 `/api/v1` 은 줄여 씁니다.
모듈은 `project` 입니다 (테이블: [db/30-project.md](../db/30-project.md) 5 · 6장, GitHub 표는 [db/50-infra.md](../db/50-infra.md)).
프로젝트 · 참여자 권한은 [30-project](30-project.md), 작업은 [31-task](31-task.md), 댓글은 [60-common](60-common.md), 파일은 [40-document-file](40-document-file.md) 을 봅니다.

## 공통 모양

README 1.4 의 `MemberRef`, `TaskRef`, `FileRef`, `PageResponse` 를 씁니다. 이 문서에서 더 쓰는 모양:

| 이름 | 필드 | 비고 |
|------|------|------|
| `ProjectRef` | `projectKey` string, `name` string | 연구실 회의(프로젝트 없음)면 `null` |
| `MinuteAction` | `actionId` number, `content` string, `assignee` MemberRef \| null, `dueOn` date \| null, `done` boolean, `task` TaskRef \| null, `displayOrder` number | `task` 는 작업으로 만들었을 때. 화면의 `DEFME-50 · 할 일` |
| `ReportTask` | `task` TaskRef, `projectKey` string, `kind` `DONE` \| `IN_PROGRESS`, `excluded` boolean, `note` string \| null | 주간 보고의 작업 연동 (P12) |

### 이 문서에서 쓰는 값

| 값 | 내용 | 근거 |
|----|------|------|
| 주 | 월요일 ~ 일요일 (Asia/Seoul). 경로 · 파라미터의 `weekStartOn` 은 **그 주 월요일 날짜**, 다른 요일이면 400 `P233` | PRJ-4 데이터 항목 |
| 마감 | 그 주가 끝난 다음 날의 `DUE_DAY_OF_WEEK` + `DUE_TIME` (공통코드 `WEEKLY_REPORT_POLICY`, 기본 다음 월요일 10:00 KST). 응답의 `dueAt` 은 UTC 로 바꾼 값 | PRJ-4-02 |
| 늦은 제출 | 제출 시각 > 마감. 제출할 때 한 번 정하고(`late`), 뒤에 고쳐도 바뀌지 않음 | PRJ-4-02 |
| 미리 알림 | `REMIND_AT`(기본 마감 전날 18:00) 에 아직 제출 안 한 사람에게 `REPORT_DUE` (주기 작업, API 없음) | PRJ-4-07 |
| Markdown 길이 | 회의록 안건 · 논의 내용 · 결정 사항, 주간 보고 세 칸: 각 **30,000자** 이하 | SRS 에 상한이 없어 다른 Markdown 본문(작업 설명 · 자료)과 맞춤 — 아래 [불일치](#맞춰-본-결과) 참고 |

---

## API 목록

| # | 메서드 | 경로 | 권한 | 요약 |
|---|--------|------|------|------|
| MM-1 | GET | `/meeting-minutes` | 로그인 (볼 수 있는 것만) | 회의록 목록 · 거르기 · 검색 |
| MM-2 | POST | `/meeting-minutes` | 프로젝트: 참여자 · `project-observe` · `project-manage` / 연구실: 로그인 | 회의록 만들기 |
| MM-3 | GET | `/meeting-minutes/{minuteId}` | 볼 수 있음 | 회의록 보기 |
| MM-4 | PUT | `/meeting-minutes/{minuteId}` | 작성자, 참석자 | 회의록 저장 (버전 확인) |
| MM-5 | DELETE | `/meeting-minutes/{minuteId}` | 작성자, PM, `project-manage` | 회의록 지우기 (숨김) |
| MM-6 | GET | `/meeting-minutes/{minuteId}/revisions` | 볼 수 있음 | 수정 이력 목록 |
| MM-7 | GET | `/meeting-minutes/{minuteId}/revisions/{version}` | 볼 수 있음 | 이전 버전 보기 |
| MM-8 | POST | `/meeting-minutes/{minuteId}/actions/convert-to-tasks` | 참여자 | 할 일 여러 개를 작업으로 |
| MM-9 | PATCH | `/meeting-minutes/{minuteId}/actions/{actionId}` | 작성자, 참석자, 그 할 일 담당자 | 연구실 회의 할 일 체크 |
| WR-1 | GET | `/weekly-reports` | 로그인 | 주별 제출 현황 / 구성원별 지난 보고 |
| WR-2 | GET | `/weekly-reports/me/{weekStartOn}` | `report-write` (본인) | 내 그 주 보고 (없으면 빈 초안 + 작업 자동 채움) |
| WR-3 | PUT | `/weekly-reports/me/{weekStartOn}` | `report-write` (본인) | 내 보고 저장 (자동 저장) |
| WR-4 | GET | `/weekly-reports/{reportId}` | 로그인 (작성 중이면 본인만) | 보고 보기 |
| WR-5 | PATCH | `/weekly-reports/{reportId}` | 제출: 본인 / 확인: `report-review` | 제출 · 확인 (`status`) |
| WR-6 | GET | `/weekly-reports/github-activity` | 로그인 | GitHub 활동 (보고 칸, 현황 표, 칸 → 커밋 목록) |
| WR-7 | POST | `/weekly-reports/github-activity/refresh` | 로그인 | "지금 새로 받기" |
| — | GET · POST · PATCH · DELETE | `/comments?targetType=WEEKLY_REPORT&targetId={reportId}` | [아래](#주간-보고-코멘트--답글) | 코멘트 · 답글 (공통 댓글 API) |

**따로 두지 않은 API** (README 1.11 규칙 1)

| 화면 동작 | 쓰는 API | 이유 |
|-----------|----------|------|
| 회의록 **양식** 불러오기 (PRJ-3-03) | 공통코드 `PROJECT_CATEGORY` 의 `ref1` 조회 | 양식은 공통코드 값 그대로라 화면이 읽어 채운다. 단 지금 공통코드 조회는 관리 권한이 필요하다 → [불일치 N1](#맞춰-본-결과) |
| 공용 일정에서 "회의록 만들기" (PRJ-3-02, COM-4-11) | `GET /calendar-events/{eventId}` | 제목 · 일시 · 참석자 · 프로젝트를 화면이 그대로 MM-2 본문에 넣는다 |
| 일정 상세의 "연결된 회의록" | MM-1 `?calendarEventId=` | |
| 프로젝트 화면의 회의록 탭 (PRJ-1-08) | MM-1 `?projectKey=` | |
| 주간 보고 "지난 주 복사" (PRJ-4-08) | WR-2 로 지난 주를 읽고 `planText` 를 이번 주 `doneText` 에 넣어 WR-3 | 서버가 할 일이 없음 |
| 제출 현황 / 구성원별 보고 / 내 보고 이력 | WR-1 하나 (`weekStartOn` 또는 `memberId`) | 같은 보고 목록 |
| 보고 안 GitHub 칸 / 현황 표 / 칸 → 커밋 목록 | WR-6 하나 (파라미터로 범위만 다름) | 같은 커밋 집계 |

---

## 1. 회의록 — PRJ-3 (화면: 03 · 회의록)

### 열람 · 쓰기 권한

| 회의록 | 보기 | 만들기 | 고치기 | 지우기 | 할 일 → 작업 |
|--------|------|--------|--------|--------|--------------|
| 프로젝트 회의 | 그 프로젝트를 볼 수 있는 사람 ([30](30-project.md) 권한 표) | 참여자, `project-observe`, `project-manage` | 작성자, 참석자 | 작성자, PM, `project-manage` | 참여자 (작업 만들기 권한) |
| 연구실 회의 (`project_id` 없음) | 모든 구성원 (인턴 포함) | 로그인 | 작성자, 참석자 | 작성자, `project-manage` | 없음 (체크리스트로만) |

- 볼 수 없는 회의록은 404 `P200`. 보관된 프로젝트의 회의록은 보기만 된다 (만들기 · 고치기 · 지우기 · 작업 만들기 409 `P003`, PRJ-1-06).
- "참석자"는 `meeting_minute_attendees` 에 있는 사람(참석 · 불참 모두)입니다.

### MM-1. 회의록 목록

`GET /api/v1/meeting-minutes`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. 볼 수 있는 회의록만 나오고 개수에도 넣지 않음 |
| 요구사항 | PRJ-3-10, PRJ-1-08 |
| 테이블 | `meeting_minutes` (`idx_meeting_minutes_project`, `ft_meeting_minutes`), `meeting_minute_attendees`, `meeting_minute_actions` |

**요청 헤더** — 공통

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `scope` | `ALL` \| `PROJECT` \| `LAB` | X | 기본 `ALL`. `LAB` = 연구실 회의만 |
| `projectKey` | string | X | 그 프로젝트 회의록만. 볼 수 없는 프로젝트면 404 |
| `from` · `to` | date | X | 회의 날짜(시작 시각의 KST 날짜) 범위, 양 끝 포함 |
| `attendeeId` | number | X | 이 구성원이 참석자인 것 |
| `calendarEventId` | number | X | 이 일정에 연결된 것 |
| `keyword` | string | X | 제목 · 안건 · 논의 내용 · 결정 사항 검색, 2자 이상 (ngram) |
| `page` · `size` · `sort` | | X | 기본 `sort=startsAt,desc`. `startsAt`, `createdAt` 만 |

**응답** `200 OK` — `PageResponse<MinuteSummary>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `minuteId` | number | |
| `title` | string | |
| `startsAt` · `endsAt` | datetime | |
| `project` | ProjectRef \| null | |
| `author` | MemberRef | |
| `templateCode` | string \| null | 쓴 양식 (프로젝트 카테고리 코드) |
| `attendeeCount` | number | 참석으로 표시한 사람 수 |
| `actionCount` | number | 할 일 수 |
| `convertedTaskCount` | number | 작업으로 만든 할 일 수 (화면 "할 일 3 → 작업 3") |
| `updatedAt` | datetime | |

```json
{
  "success": true,
  "data": {
    "content": [
      { "minuteId": 51, "title": "11/17 주간 회의", "startsAt": "2026-11-17T05:00:00Z", "endsAt": "2026-11-17T06:00:00Z",
        "project": { "projectKey": "DEFME", "name": "DEFME 백엔드" },
        "author": { "memberId": 7, "name": "최현우", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=128" },
        "templateCode": "DEV", "attendeeCount": 4, "actionCount": 4, "convertedTaskCount": 2,
        "updatedAt": "2026-11-17T07:58:00Z" }
    ],
    "page": 0, "size": 20, "totalElements": 4, "totalPages": 1, "hasNext": false
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `keyword` 가 1자, `from > to` |
| 404 | `P200` | `projectKey` 의 프로젝트를 볼 수 없음 (존재를 숨김) |

### MM-2. 회의록 만들기

`POST /api/v1/meeting-minutes`

| 항목 | 내용 |
|------|------|
| 권한 | `projectKey` 있음: 그 프로젝트의 참여자 · `project-observe` · `project-manage` / 없음: 로그인 |
| 요구사항 | PRJ-3-01, 02, 03, 09 |
| 테이블 | `meeting_minutes`, `meeting_minute_attendees`, `meeting_minute_actions`, `meeting_minute_revisions` (버전 1), `files` |
| 감사 로그 · 알림 | 활동 기록 `MINUTE_CREATED` (프로젝트 회의). 할 일 담당자에게 `MINUTE_ACTION_ASSIGNED` (자기 자신 제외) |

**요청 헤더** — 공통

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `projectKey` | string | X | 없으면 연구실 회의. 만든 뒤 바꿀 수 없음 |
| `title` | string | O | 1~100자 |
| `startsAt` · `endsAt` | datetime | O | `endsAt > startsAt` |
| `location` | string | X | 200자 |
| `onlineUrl` | string | X | http/https, 500자 |
| `templateCode` | string | X | `PROJECT_CATEGORY` 상세 코드. 기록용 (양식 문구는 화면이 이미 `agenda` · `discussion` 에 채워 보냄) |
| `calendarEventId` | number | X | 연결할 **공용** 일정. 볼 수 있어야 함 |
| `attendees` | array | O | 1명 이상. `{ memberId, attended: boolean }`. 재실 구성원만 |
| `agenda` · `discussion` · `decisions` | string (Markdown) | X | 각 30,000자. `decisions` 는 Markdown 목록 |
| `actions` | array | X | 50개까지. `{ content (1~200자), assigneeMemberId?, dueOn? }`. 프로젝트 회의면 담당자는 그 프로젝트의 재실 참여자 |
| `attachmentFileIds` | string[] | X | 10개까지 ([파일 올리기](40-document-file.md)) |

```json
{
  "projectKey": "DEFME",
  "title": "11/17 주간 회의",
  "startsAt": "2026-11-17T05:00:00Z", "endsAt": "2026-11-17T06:00:00Z",
  "location": "세미나실", "onlineUrl": null,
  "templateCode": "DEV", "calendarEventId": 31,
  "attendees": [ { "memberId": 3, "attended": true }, { "memberId": 11, "attended": false } ],
  "agenda": "- v1.2 범위 확정 (공지 · 캘린더)\n- SSO 5단계 마무리",
  "discussion": "- 공지 투표는 공지 하나에 하나만 붙이기로 함",
  "decisions": "- v1.2 마감은 12/1 로 유지",
  "actions": [ { "content": "Penpot 남은 2명 계정 이관", "assigneeMemberId": 4, "dueOn": "2026-11-21" } ],
  "attachmentFileIds": []
}
```

**응답** `201 Created` (`Location: /api/v1/meeting-minutes/51`) — MM-3 과 같은 `MinuteDetail`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P203` | `endsAt <= startsAt` |
| 400 | `P204` | 참석자 · 담당자가 재실 구성원이 아님, 참석자가 0명 |
| 400 | `P209` | 프로젝트 회의인데 할 일 담당자가 그 프로젝트 참여자가 아님 |
| 400 | `P212` | `templateCode` 가 `PROJECT_CATEGORY` 에 없음 |
| 400 | `P213` | `calendarEventId` 가 없거나 볼 수 없거나 개인 일정 |
| 400 | `P215` | 첨부 10개 · 할 일 50개 초과 |
| 409 | `P003` | 보관된 프로젝트 ([30](30-project.md)) |
| 403 | `C003` | 그 프로젝트에 회의록을 쓸 권한 없음 (볼 수는 있음) |
| 404 | `P200` | `projectKey` 의 프로젝트를 볼 수 없음 |

### MM-3. 회의록 보기

`GET /api/v1/meeting-minutes/{minuteId}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-3-06, 08 |
| 테이블 | `meeting_minutes`, `meeting_minute_attendees`, `meeting_minute_actions`, `tasks`(할 일의 작업 상태), `meeting_minute_revisions`(마지막 수정자), `files` |

**경로 파라미터** — `minuteId` number

**응답** `200 OK` — `MinuteDetail`

| 필드 | 타입 | 설명 |
|------|------|------|
| `minuteId` | number | |
| `project` | ProjectRef \| null | |
| `title`, `startsAt`, `endsAt`, `location`, `onlineUrl`, `templateCode` | | 만들기 값 |
| `calendarEvent` | `{ eventId, title }` \| null | 연결 일정 (화면 "공용 일정 · 주간 회의") |
| `author` | MemberRef | |
| `attendees` | `{ member: MemberRef, attended: boolean }[]` | |
| `agenda`, `discussion`, `decisions` | string \| null | Markdown 원문 |
| `actions` | MinuteAction[] | `displayOrder` 순 |
| `attachments` | FileRef[] | |
| `version` | number | **MM-4 에 그대로 보낸다** |
| `lastEditor` | MemberRef | 마지막으로 저장한 사람 (충돌 안내 "박지훈 · 2분 전") |
| `createdAt`, `updatedAt` | datetime | |
| `permissions` | `{ edit, delete, convertActions }` boolean | 버튼 표시용. 서버는 요청마다 다시 검사 |

```json
{
  "success": true,
  "data": {
    "minuteId": 51,
    "project": { "projectKey": "DEFME", "name": "DEFME 백엔드" },
    "title": "11/17 주간 회의",
    "startsAt": "2026-11-17T05:00:00Z", "endsAt": "2026-11-17T06:00:00Z",
    "location": "세미나실", "onlineUrl": null, "templateCode": "DEV",
    "calendarEvent": { "eventId": 31, "title": "주간 회의" },
    "author": { "memberId": 7, "name": "최현우", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": "…" },
    "attendees": [ { "member": { "memberId": 3, "name": "김민서", "…": "…" }, "attended": true } ],
    "agenda": "- v1.2 범위 확정 …", "discussion": "…", "decisions": "- v1.2 마감은 12/1 로 유지",
    "actions": [
      { "actionId": 201, "content": "Penpot 남은 2명 계정 이관", "assignee": { "memberId": 4, "name": "박지훈", "…": "…" },
        "dueOn": "2026-11-21", "done": false, "task": { "taskKey": "DEFME-50", "title": "Penpot 남은 2명 계정 이관", "status": "TODO" }, "displayOrder": 0 },
      { "actionId": 203, "content": "공지 투표 UI 시안 정리", "assignee": { "memberId": 3, "…": "…" },
        "dueOn": "2026-11-20", "done": false, "task": null, "displayOrder": 2 }
    ],
    "attachments": [],
    "version": 3,
    "lastEditor": { "memberId": 4, "name": "박지훈", "…": "…" },
    "createdAt": "2026-11-17T06:58:00Z", "updatedAt": "2026-11-17T07:58:00Z",
    "permissions": { "edit": true, "delete": false, "convertActions": true }
  },
  "error": null
}
```

- 작업으로 만든 할 일의 `task` 가 내가 볼 수 없는 작업이면 넣지 않는다 (같은 프로젝트라 보통 볼 수 있음).

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P200` | 없음, 지움, 볼 수 없음 |

### MM-4. 회의록 저장

`PUT /api/v1/meeting-minutes/{minuteId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, 참석자 |
| 요구사항 | PRJ-3-04, 05, 06 |
| 테이블 | `meeting_minutes` (`version`), `meeting_minute_attendees`, `meeting_minute_actions`, `meeting_minute_revisions`, `files` |
| 감사 로그 · 알림 | 새로 배정된 할 일 담당자에게 `MINUTE_ACTION_ASSIGNED` |

통째로 저장합니다. 본문에 없는 할 일 · 참석자 · 첨부는 지워집니다. 저장할 때마다 새 버전과 수정 이력 한 줄(`summary` 는 서버가 바뀐 칸으로 만듦: "결정 사항", "할 일 2개 추가")이 생깁니다.

**경로 파라미터** — `minuteId` number

**요청 본문** — MM-2 와 같고 다음만 다름

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `version` | number | O | MM-3 에서 받은 값. 서버와 다르면 409 `P201` |
| `projectKey` | — | — | 받지 않음 (프로젝트는 바꿀 수 없음) |
| `actions[].actionId` | number | X | 있던 할 일이면 그 ID, 새 할 일이면 생략. 작업으로 만든 할 일의 `content` · 담당자 · 기한을 바꿔도 작업은 바뀌지 않음. 지워도 작업은 남음 |
| `actions[].done` | boolean | X | 연구실 회의만. 프로젝트 회의에서는 무시 |

```json
{
  "version": 3,
  "title": "11/17 주간 회의",
  "startsAt": "2026-11-17T05:00:00Z", "endsAt": "2026-11-17T06:00:00Z",
  "location": "세미나실", "onlineUrl": null, "templateCode": "DEV", "calendarEventId": 31,
  "attendees": [ { "memberId": 3, "attended": true } ],
  "agenda": "…", "discussion": "…", "decisions": "…",
  "actions": [
    { "actionId": 201, "content": "Penpot 남은 2명 계정 이관", "assigneeMemberId": 4, "dueOn": "2026-11-21" },
    { "content": "알림 종류 목록 SRS 와 맞추기", "assigneeMemberId": 5, "dueOn": "2026-11-21" }
  ],
  "attachmentFileIds": []
}
```

**응답** `200 OK` — `MinuteDetail` (`version` 이 하나 오름)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `P201` | `version` 이 다름 — 다른 사람이 먼저 저장. **덮어쓰지 않는다.** 에러 응답에는 최신 내용을 담지 않으므로 화면이 MM-3 를 다시 불러 `lastEditor` · `updatedAt` 으로 "박지훈 · 2분 전. 내 수정은 덮어쓰지 않았어요"를 보여 준다 |
| 403 | `P202` | 작성자 · 참석자가 아님 |
| 409 | `P003` | 보관된 프로젝트 ([30](30-project.md)) |
| 400 | `P203`, `P204`, `P209`, `P212`, `P213`, `P215` | MM-2 와 같음 |
| 400 | `P206` | `actionId` 가 이 회의록의 할 일이 아님 |
| 404 | `P200` | 없음, 볼 수 없음 |

### MM-5. 회의록 지우기

`DELETE /api/v1/meeting-minutes/{minuteId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, PM(프로젝트 회의), `project-manage` |
| 요구사항 | PRJ-3-11 |
| 테이블 | `meeting_minutes` (`deleted_at`), `files.purge_at` (+30일, DOC-2-09) |

숨김(소프트 삭제)입니다. **할 일로 만든 작업은 지우지 않습니다.**

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | 지울 권한 없음 (볼 수는 있음) |
| 409 | `P003` | 보관된 프로젝트 ([30](30-project.md)) |
| 404 | `P200` | 없음, 이미 지움, 볼 수 없음 |

### MM-6. 수정 이력 목록

`GET /api/v1/meeting-minutes/{minuteId}/revisions`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-3-06 |
| 테이블 | `meeting_minute_revisions` |

**쿼리 파라미터** — `page`, `size` (기본 `version` 내림차순)

**응답** `200 OK` — `PageResponse<MinuteRevisionSummary>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `version` | number | |
| `editor` | MemberRef | 고친 사람 |
| `summary` | string \| null | "결정 사항", "할 일 2개 추가", 첫 버전은 "처음 작성" |
| `createdAt` | datetime | |

```json
{ "success": true, "data": { "content": [
  { "version": 3, "editor": { "memberId": 4, "name": "박지훈", "…": "…" }, "summary": "결정 사항", "createdAt": "2026-11-17T07:58:00Z" },
  { "version": 1, "editor": { "memberId": 7, "name": "최현우", "…": "…" }, "summary": "처음 작성", "createdAt": "2026-11-17T06:58:00Z" }
], "page": 0, "size": 20, "totalElements": 3, "totalPages": 1, "hasNext": false }, "error": null }
```

**에러** — 404 `P200`

### MM-7. 이전 버전 보기

`GET /api/v1/meeting-minutes/{minuteId}/revisions/{version}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음 |
| 요구사항 | PRJ-3-06 ("보기" 버튼) |
| 테이블 | `meeting_minute_revisions.snapshot` |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `version`, `editor`, `summary`, `createdAt` | | MM-6 과 같음 |
| `snapshot` | object | 그 버전의 `title`, `startsAt`, `endsAt`, `location`, `onlineUrl`, `attendees`, `agenda`, `discussion`, `decisions`, `actions`(`content` · 담당자 · 기한 · `taskKey`) |

이전 버전으로 **되돌리는 API 는 없습니다** (SRS 에 없음). 필요하면 화면이 snapshot 을 편집기에 채워 MM-4 로 저장합니다.

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `P200` | 회의록을 볼 수 없음 |
| 404 | `P205` | 그 버전이 없음 |

### MM-8. 할 일을 작업으로 만들기

`POST /api/v1/meeting-minutes/{minuteId}/actions/convert-to-tasks`

| 항목 | 내용 |
|------|------|
| 권한 | 그 프로젝트의 참여자 (PM · 참여자 — 작업 만들기 권한, [31](31-task.md)). `project-observe` 는 회의록은 쓰지만 작업은 못 만듦 |
| 요구사항 | PRJ-3-07, 08 |
| 테이블 | `tasks` (`source_type = MEETING_ACTION`, `source_id = actionId`), `projects.next_task_no`, `meeting_minute_actions.task_id`, `task_watchers`, `project_activities` (`TASK_CREATED` × n, `MINUTE_ACTIONS_CONVERTED` 1줄) |
| 감사 로그 · 알림 | 담당자에게 `TASK_ASSIGNED` (작업 만들기 규칙과 같음) |

한 트랜잭션입니다. 하나라도 안 되면 하나도 만들지 않습니다.
만든 작업: 제목 = 할 일 내용, 담당자 · 기한 그대로, 상태 "할 일", 유형 = `TASK_TYPE` 기본값, 우선순위 보통, 요청자 = 요청한 사람, 설명에 회의록 링크.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `actionIds` | number[] | O | 1개 이상, 이 회의록의 할 일, 아직 작업이 없는 것 |

```json
{ "actionIds": [203, 204] }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `actions` | MinuteAction[] | 바뀐 할 일 (각 `task` 가 채워짐) |

```json
{ "success": true, "data": { "actions": [
  { "actionId": 203, "content": "공지 투표 UI 시안 정리", "assignee": { "memberId": 3, "…": "…" }, "dueOn": "2026-11-20",
    "done": false, "task": { "taskKey": "DEFME-53", "title": "공지 투표 UI 시안 정리", "status": "TODO" }, "displayOrder": 2 }
] }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P208` | 연구실 회의록 (작업으로 만들 수 없음) |
| 400 | `P206` | 이 회의록의 할 일이 아님 |
| 409 | `P207` | 이미 작업으로 만든 할 일이 섞여 있음 |
| 400 | `P209` | 담당자가 이제 그 프로젝트의 재실 참여자가 아님 (빠졌거나 졸업) — 회의록에서 담당자를 바꾼 뒤 다시 |
| 403 | `P216` | 작업 만들기 권한 없음 (`project-observe` 등) |
| 409 | `P003` | 보관된 프로젝트 ([30](30-project.md)) |
| 404 | `P200` | 회의록을 볼 수 없음 |

### MM-9. 연구실 회의 할 일 체크

`PATCH /api/v1/meeting-minutes/{minuteId}/actions/{actionId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, 참석자, 그 할 일 담당자 |
| 요구사항 | PRJ-3-09 |
| 테이블 | `meeting_minute_actions.done` |

체크 하나 때문에 회의록 전체를 버전 확인으로 저장하지 않도록 따로 둡니다. **버전을 올리지 않고** 수정 이력도 남기지 않습니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `done` | boolean | O | |

```json
{ "done": true }
```

**응답** `200 OK` — `MinuteAction`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P214` | 프로젝트 회의록의 할 일 (작업으로 관리) |
| 403 | `P202` | 작성자 · 참석자 · 담당자가 아님 |
| 404 | `P200` · `P206` | 회의록 · 할 일이 없음 |

---

## 2. 주간 보고 — PRJ-4 (화면: 03 · 주간 보고)

### 열람 · 쓰기 권한

| 동작 | 누가 |
|------|------|
| 쓰기 · 저장 · 제출 | `report-write` 를 가진 **재실** 구성원, 자기 보고만 |
| 보기 (제출 · 확인된 보고, 제출 현황) | 모든 구성원 (PRJ-4-06) |
| 보기 (작성 중 보고) | **본인만**. 다른 사람에게는 목록에서 빠지고 직접 열면 404 (README 1.11 규칙 4) |
| 확인 · 코멘트 | `report-review` |
| 코멘트에 답글 | 그 보고의 작성자 |

### WR-1. 보고 목록 (제출 현황 · 구성원별 보고)

`GET /api/v1/weekly-reports`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | PRJ-4-04, 06, 09 |
| 테이블 | `weekly_reports` (`idx_weekly_reports_week`), `member_roles`(`report-write`), `members` |

화면 탭 세 개가 이 API 하나를 씁니다: "제출 현황" = `weekStartOn`, "구성원별 보고" = `memberId`, 내 지난 보고 = `memberId={내 ID}`.

**쿼리 파라미터** — `weekStartOn` 과 `memberId` 중 **하나는 필수**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `weekStartOn` | date | △ | 그 주의 모든 보고 + 미제출 명단 + 개수 |
| `memberId` | number | △ | 그 구성원의 보고를 주 역순으로 (PRJ-4-09) |
| `page` · `size` | | X | `content` 에 적용. 기본 `weekStartOn,desc` |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `week` | `{ weekStartOn, weekEndOn, dueAt }` \| null | `weekStartOn` 으로 불렀을 때만 |
| `counts` | `{ submitted, late, missing }` \| null | 같음. `submitted` = 제때 제출(확인 포함), `late` = 늦은 제출, `missing` = 미제출 |
| `missingMembers` | MemberRef[] \| null | 같음. `report-write` 를 가진 재실 구성원 중 제출 · 확인된 보고가 없는 사람 (작성 중이어도 미제출) |
| `content` … | PageResponse\<ReportSummary\> | 아래 |

`ReportSummary`

| 필드 | 타입 | 설명 |
|------|------|------|
| `reportId` | number | |
| `member` | MemberRef | |
| `weekStartOn` | date | |
| `status` | `DRAFT` \| `SUBMITTED` \| `CONFIRMED` | `DRAFT` 는 본인 것만 나옴 |
| `late` | boolean | |
| `submittedAt` · `confirmedAt` | datetime \| null | |
| `confirmedBy` | MemberRef \| null | |
| `doneSummary` | string | "이번 주 한 일" 앞 200자 (Markdown 기호 뺀 평문) |
| `taskCounts` | `{ done, inProgress }` | 뺀 작업(`excluded`) 제외 |
| `commentCount` | number | |

```json
{
  "success": true,
  "data": {
    "week": { "weekStartOn": "2026-11-16", "weekEndOn": "2026-11-22", "dueAt": "2026-11-23T01:00:00Z" },
    "counts": { "submitted": 6, "late": 1, "missing": 2 },
    "missingMembers": [ { "memberId": 11, "name": "한유진", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null } ],
    "page": {
      "content": [
        { "reportId": 301, "member": { "memberId": 6, "name": "오세훈", "…": "…" }, "weekStartOn": "2026-11-16",
          "status": "SUBMITTED", "late": true, "submittedAt": "2026-11-23T02:12:00Z", "confirmedAt": null, "confirmedBy": null,
          "doneSummary": "v1.2 공지 투표 화면 시안 …", "taskCounts": { "done": 2, "inProgress": 1 }, "commentCount": 0 }
      ],
      "page": 0, "size": 20, "totalElements": 7, "totalPages": 1, "hasNext": false
    }
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P240` | `weekStartOn` · `memberId` 둘 다 없음 또는 둘 다 있음 |
| 400 | `P233` | `weekStartOn` 이 월요일이 아님 |
| 404 | `M001` | `memberId` 구성원이 없음 |

### WR-2. 내 그 주 보고

`GET /api/v1/weekly-reports/me/{weekStartOn}`

| 항목 | 내용 |
|------|------|
| 권한 | `report-write` 를 가진 재실 구성원 (본인) |
| 요구사항 | PRJ-4-01, 03, PRJ-2-90, 91 |
| 테이블 | `weekly_reports`, `weekly_report_tasks`, `tasks` (`idx_tasks_completed`, `idx_tasks_assignee`) |

"내 보고" 탭이 엽니다. 아직 저장한 적이 없으면 **저장하지 않은 빈 초안**(`reportId: null`)을 돌려주고, 작업 연동 목록은 언제나 채워서 줍니다.

**작업 자동 채우기** (PRJ-2-90): 그 주(KST 월 00:00 ~ 다음 월 00:00)에 내가 담당자로 **완료**한 작업 → `DONE`, 지금 내가 담당자이고 **진행 중 · 검토**인 작업 → `IN_PROGRESS`. 이미 저장한 행의 `excluded` · `note` 를 이어 붙입니다. 확인(`CONFIRMED`)된 보고는 다시 계산하지 않고 저장된 목록 그대로입니다.

**경로 파라미터** — `weekStartOn` date (월요일)

**응답** `200 OK` — `ReportDetail` (WR-4 와 같음) + 아래

| 필드 | 타입 | 설명 |
|------|------|------|
| `reportId` | number \| null | 아직 저장 안 했으면 null |
| `editable` | boolean | 확인 전이면 true |

```json
{
  "success": true,
  "data": {
    "reportId": 305, "member": { "memberId": 3, "name": "김민서", "…": "…" },
    "weekStartOn": "2026-11-16", "weekEndOn": "2026-11-22", "dueAt": "2026-11-23T01:00:00Z",
    "status": "DRAFT", "late": false, "submittedAt": null, "confirmedAt": null, "confirmedBy": null,
    "doneText": "OIDC 로그아웃 6가지 테스트 작성 …", "planText": "v1.2 공지 투표 화면 시안 …", "issueText": "Testcontainers 가 Windows 에서 느림",
    "tasks": [
      { "task": { "taskKey": "DEFME-40", "title": "client_id 로그아웃", "status": "DONE" }, "projectKey": "DEFME", "kind": "DONE", "excluded": false, "note": null },
      { "task": { "taskKey": "DEFME-44", "title": "로그아웃 테스트", "status": "REVIEW" }, "projectKey": "DEFME", "kind": "IN_PROGRESS", "excluded": false, "note": null }
    ],
    "hiddenTaskCount": 0,
    "updatedAt": "2026-11-21T08:30:00Z",
    "editable": true
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P233` | 월요일이 아님 |
| 400 | `P234` | 아직 시작하지 않은 주 |
| 403 | `P231` | `report-write` 가 없거나 재실이 아님 |

### WR-3. 내 보고 저장 (자동 저장)

`PUT /api/v1/weekly-reports/me/{weekStartOn}`

| 항목 | 내용 |
|------|------|
| 권한 | `report-write` 를 가진 재실 구성원 (본인) |
| 요구사항 | PRJ-4-01, 03, 08, PRJ-2-91 |
| 테이블 | `weekly_reports` (UK `member_id, week_start_on`), `weekly_report_tasks` |

화면이 고칠 때마다 몇 초 간격으로 보내는 **자동 저장**입니다 ("작성 중 · 자동 저장됨"). 같은 내용을 여러 번 보내도 결과가 같습니다. 처음이면 `DRAFT` 로 만들고(201), 이미 제출했으면 `SUBMITTED` 그대로 내용만 바꿉니다 (제출 시각 · 늦은 제출 여부는 바뀌지 않음). 확인된 보고는 409.
작성자 한 사람만 고치므로 버전 확인은 하지 않습니다 (두 탭에서 고치면 나중 것이 남음).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `doneText` | string | X | 이번 주 한 일, Markdown 30,000자. 작성 중에는 비어도 됨 (제출 때 필수) |
| `planText` | string | X | 다음 주 계획. 같음 |
| `issueText` | string | X | 이슈 · 도움 필요. 30,000자 |
| `tasks` | array | X | 작업 연동 조정만 보낸다: `{ taskKey, excluded, note (200자) }`. 목록에 없는 작업은 자동 채우기 값 그대로. 자동 채우기 대상이 아닌 작업을 보내면 400 `P238` |

```json
{
  "doneText": "OIDC 로그아웃 6가지 테스트 작성 · 로그인 화면 리팩터링 리뷰 반영",
  "planText": "v1.2 공지 투표 화면 시안 · MinIO 업로드 API 설계",
  "issueText": "Testcontainers 가 Windows 에서 느림 — 설정 공유 부탁드려요",
  "tasks": [ { "taskKey": "DEFME-41", "excluded": true, "note": null } ]
}
```

**응답** `201 Created`(처음) / `200 OK` — `ReportDetail` (WR-2 와 같은 모양)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `P232` | 확인된 보고 |
| 400 | `P233` · `P234` | 월요일이 아님, 아직 시작 안 한 주 |
| 400 | `P238` | 자동 채우기 대상이 아닌 작업 |
| 403 | `P231` | `report-write` 없음 · 재실 아님 |

### WR-4. 보고 보기

`GET /api/v1/weekly-reports/{reportId}`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. 작성 중(`DRAFT`)이면 본인만 |
| 요구사항 | PRJ-4-06 |
| 테이블 | `weekly_reports`, `weekly_report_tasks`, `tasks` |

**응답** `200 OK` — `ReportDetail`

| 필드 | 타입 | 설명 |
|------|------|------|
| `reportId`, `member`, `weekStartOn`, `weekEndOn`, `dueAt` | | |
| `status`, `late`, `submittedAt`, `confirmedAt`, `confirmedBy` | | |
| `doneText`, `planText`, `issueText` | string \| null | Markdown 원문 |
| `tasks` | ReportTask[] | 작성자가 뺀 것(`excluded`)은 **작성자에게만** 나옴. 보는 사람이 **볼 수 없는 프로젝트의 작업은 넣지 않음** |
| `hiddenTaskCount` | number | 위 이유로 뺀 작업 수 (화면 "비공개 작업 n개") |
| `updatedAt` | datetime | |
| `permissions` | `{ edit, confirm, comment }` boolean | 버튼 표시용 |

GitHub 활동 칸은 WR-6 (`memberId` + `weekStartOn`), 코멘트는 [공통 댓글](#주간-보고-코멘트--답글)을 함께 부릅니다.

**에러** — 404 `P230` (없음, 다른 사람의 작성 중 보고)

### WR-5. 제출 · 확인

`PATCH /api/v1/weekly-reports/{reportId}`

| 항목 | 내용 |
|------|------|
| 권한 | `SUBMITTED` 로: 작성자 본인 (`report-write`, 재실) / `CONFIRMED` 로: `report-review` (자기 보고는 확인할 수 없음) |
| 요구사항 | PRJ-4-01, 02, 03, 04 |
| 테이블 | `weekly_reports` (`status`, `submitted_at`, `late`, `confirmed_by_member_id`, `confirmed_at`) |
| 감사 로그 · 알림 | 확인하면 작성자에게 `REPORT_CONFIRMED` (README T6 제안 종류) |

제출과 확인을 `status` 하나로 바꿉니다 (README 1.11 규칙 2). 허용되는 이동은 `DRAFT → SUBMITTED`, `SUBMITTED → CONFIRMED` 뿐입니다. 제출 취소 · 확인 취소는 SRS 에 없어 두지 않습니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `status` | `SUBMITTED` \| `CONFIRMED` | O | |

```json
{ "status": "SUBMITTED" }
```

- 제출할 때 서버가 `doneText` · `planText` 가 비어 있지 않은지 확인하고, 마감과 비교해 `late` 를 정합니다.

**응답** `200 OK` — `ReportDetail`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P235` | 제출인데 이번 주 한 일 · 다음 주 계획이 비어 있음 |
| 400 | `P236` | 허용되지 않는 이동 (`CONFIRMED → SUBMITTED`, 이미 제출한 것을 다시 제출 등) |
| 409 | `P237` | 확인인데 아직 제출하지 않은 보고 |
| 403 | `P231` | 제출인데 작성자가 아니거나 `report-write` 없음 |
| 403 | `C003` | 확인인데 `report-review` 없음, 또는 자기 보고 |
| 404 | `P230` | 없음, 다른 사람의 작성 중 보고 |

### WR-6. GitHub 활동

`GET /api/v1/weekly-reports/github-activity`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | PRJ-4-20~30 |
| 테이블 | `github_commits` (`idx_github_commits_member`, `idx_github_commits_repo`), `github_commit_branches`, `github_repositories`, `member_github_accounts` (github 모듈 query API 로 읽음) |

세 화면이 이 API 하나를 씁니다.

| 화면 | 파라미터 |
|------|----------|
| 보고 안 "GitHub 활동" 칸 (PRJ-4-25) | `weekStartOn` + `memberId` |
| 제출 현황의 구성원 × 저장소 표 (PRJ-4-26) | `weekStartOn` |
| 표의 칸 · 브랜치 줄을 눌러 커밋 목록 | `weekStartOn` + `memberId` + `repositoryId` + `includeCommits=true` (+ `branch`) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `weekStartOn` | date | O | 커밋 시각(`committed_at`)이 그 주(KST) 안인 것 |
| `memberId` | number | X | 그 구성원. 연결 안 된 작성자는 `unlinked=true` 로 따로 |
| `unlinked` | boolean | X | 구성원과 이어지지 않은 작성자의 커밋만 (PRJ-4-22) |
| `repositoryId` | number | X | 그 저장소만 |
| `branch` | string | X | 그 브랜치만 (커밋 목록용) |
| `includeCommits` | boolean | X | 커밋 목록을 넣음. 이때 `page` · `size` 적용 (기본 `committedAt,desc`) |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `weekStartOn` | date | |
| `lastFetchedAt` | datetime \| null | 대상 저장소 중 **가장 오래된** 마지막 수집 시각 (화면 "마지막으로 받은 시각 · 3분 전", PRJ-4-30) |
| `patternsChangedAt` | datetime \| null | 대상 저장소 중 가장 최근에 제외 패턴을 바꾼 시각 ("제외 패턴이 바뀌어 다시 계산됨", PRJ-4-24a) |
| `rows` | array | 구성원(또는 연결 안 된 작성자) × 저장소 한 줄 |
| `rows[].member` | MemberRef \| null | null 이면 연결 안 된 작성자 |
| `rows[].authorLogin` | string \| null | 연결 안 된 작성자의 GitHub 아이디 (없으면 커밋에 적힌 이름) |
| `rows[].repository` | `{ repositoryId, fullName, projectKey }` \| null | **볼 수 없는 프로젝트의 저장소면 null** 이고 `hidden: true` (아래) |
| `rows[].hidden` | boolean | |
| `rows[].commitCount` | number | 병합 커밋 포함. 같은 커밋은 한 번 |
| `rows[].mergeCommitCount` | number | 줄 수에서 뺀 병합 커밋 수 |
| `rows[].additions` · `rows[].deletions` | number | 병합 커밋 · 제외 패턴 뺀 줄 수. 같은 커밋은 한 번 |
| `rows[].branches` | `{ branch, commitCount, additions, deletions }[]` | 브랜치별. 한 커밋이 여러 브랜치에 있으면 **각 브랜치 줄에 모두 나오므로 브랜치 합이 저장소 합보다 클 수 있음** — 저장소 합은 한 번만 셈 (PRJ-4-21) |
| `totals` | `{ commitCount, mergeCommitCount, additions, deletions }` | `rows` 합 (화면 "합계 · 병합 커밋 1개와 lock 파일 제외") |
| `commits` | PageResponse\<Commit\> \| null | `includeCommits=true` 일 때만 |
| `commits.content[]` | `{ sha, messageTitle, committedAt, branches: string[], additions, deletions, mergeCommit, url }` | `url` = GitHub 커밋 주소 |

```json
{
  "success": true,
  "data": {
    "weekStartOn": "2026-11-16",
    "lastFetchedAt": "2026-11-21T08:27:00Z",
    "patternsChangedAt": null,
    "rows": [
      { "member": { "memberId": 3, "name": "김민서", "…": "…" }, "authorLogin": null,
        "repository": { "repositoryId": 4, "fullName": "Hoseo-I-Turtle/defme_BE", "projectKey": "DEFME" }, "hidden": false,
        "commitCount": 11, "mergeCommitCount": 1, "additions": 458, "deletions": 74,
        "branches": [
          { "branch": "feature/oidc-logout", "commitCount": 6, "additions": 320, "deletions": 40 },
          { "branch": "test/logout-cases", "commitCount": 3, "additions": 120, "deletions": 30 },
          { "branch": "main", "commitCount": 2, "additions": 18, "deletions": 4 }
        ] }
    ],
    "totals": { "commitCount": 11, "mergeCommitCount": 1, "additions": 458, "deletions": 74 },
    "commits": null
  },
  "error": null
}
```

- **볼 수 없는 프로젝트의 저장소**(비공개 프로젝트)는 주간 보고를 모두가 보더라도 저장소 이름 · 브랜치 · 커밋 메시지를 넣지 않고 개수 · 줄 수만 `hidden: true` 한 줄로 합쳐 준다 (README 1.11 규칙 4, [불일치 N3](#맞춰-본-결과)). `includeCommits` 로 그 저장소를 고르면 404 `P241`.
- GitHub 에 접속하지 못해도 이 API 는 이미 모은 값으로 답한다 (DB 만 읽음, PRJ-4-30).
- 화면의 "줄 수는 참고 지표예요" 안내는 화면 문구다 (PRJ-4-28).

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `P233` | 월요일이 아님 |
| 400 | `C001` | `memberId` 와 `unlinked=true` 를 함께 보냄, `includeCommits` 인데 `repositoryId` 가 없음 |
| 404 | `P241` | `repositoryId` 가 없거나 볼 수 없는 프로젝트의 저장소 |

### WR-7. 지금 새로 받기

`POST /api/v1/weekly-reports/github-activity/refresh`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | INF-3-12, 13, PRJ-4-30 |
| 테이블 | `github_sync_jobs` (`RESCAN_REPOSITORY`), `github_repositories.last_polled_at` (github 모듈 command API 로 만듦) |

**내가 재실 참여자인 프로젝트**에 연결된 저장소를 다시 훑는 작업을 만듭니다. 무거운 일은 작업이 따로 하고 바로 답합니다. 다시 훑을 때는 끝 커밋이 바뀐 브랜치만 받습니다 (INF-3-13, `github_branch_heads`).
마지막 수집이 5분 안인 저장소는 건너뜁니다 (API 호출 한도 보호).

**요청 본문** — 없음

**응답** `202 Accepted`

| 필드 | 타입 | 설명 |
|------|------|------|
| `queuedRepositoryCount` | number | 새로 훑기 시작한 저장소 수 |
| `skippedRepositoryCount` | number | 5분 안에 받아서 건너뛴 수 |
| `lastFetchedAt` | datetime \| null | WR-6 과 같은 값 (요청 시점) |

```json
{ "success": true, "data": { "queuedRepositoryCount": 2, "skippedRepositoryCount": 0, "lastFetchedAt": "2026-11-21T08:27:00Z" }, "error": null }
```

화면은 1분쯤 뒤 WR-6 을 다시 불러 숫자를 바꿉니다.

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 429 | `P239` | 같은 사람이 1분 안에 다시 누름 |
| 400 | `P242` | 내가 참여한 프로젝트에 연결된 저장소가 없음 |
| 502 | `C010` | GitHub App 설치 토큰을 받지 못함 (작업 만들기 전 확인 단계) |

### 주간 보고 코멘트 · 답글

공통 댓글 API 를 씁니다 ([60-common](60-common.md)). `targetType = WEEKLY_REPORT`, `targetId = reportId`.

| 동작 | API | 누가 | 규칙 |
|------|-----|------|------|
| 목록 | `GET /api/v1/comments?targetType=WEEKLY_REPORT&targetId=305` | 그 보고를 볼 수 있는 사람 | 작성 중 보고는 404 |
| 코멘트 | `POST /api/v1/comments` (`parentId` 없음) | `report-review` | 작성 중 보고에는 달 수 없음. 작성자에게 `REPORT_COMMENT` |
| 답글 | `POST /api/v1/comments` (`parentId` = 코멘트 ID) | 보고 작성자, `report-review` | PRJ-4-05 |
| 고치기 · 지우기 | `PATCH` · `DELETE /api/v1/comments/{commentId}` | 댓글 작성자 | |

이 판단은 project 모듈의 `CommentTargetPolicy`(`WEEKLY_REPORT`) 구현이 합니다. 확인된 보고에도 코멘트는 달 수 있습니다 (SRS 가 막지 않음).

---

## 에러 코드

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `P200` | `MINUTE_NOT_FOUND` | 회의록을 찾을 수 없어요. |
| 409 | `P201` | `MINUTE_VERSION_CONFLICT` | 다른 사람이 먼저 저장했어요. 새 내용을 보고 다시 고쳐 주세요. |
| 403 | `P202` | `MINUTE_EDIT_FORBIDDEN` | 작성자와 참석자만 회의록을 고칠 수 있어요. |
| 400 | `P203` | `MINUTE_INVALID_PERIOD` | 끝 시각은 시작 시각 뒤여야 해요. |
| 400 | `P204` | `MINUTE_INVALID_MEMBER` | 참석자와 담당자는 재실 구성원이어야 하고, 참석자는 한 명 이상이어야 해요. |
| 404 | `P205` | `MINUTE_REVISION_NOT_FOUND` | 그 버전의 회의록을 찾을 수 없어요. |
| 404 | `P206` | `MINUTE_ACTION_NOT_FOUND` | 이 회의록의 할 일이 아니에요. |
| 409 | `P207` | `MINUTE_ACTION_ALREADY_CONVERTED` | 이미 작업으로 만든 할 일이 있어요. |
| 400 | `P208` | `MINUTE_ACTION_NOT_CONVERTIBLE` | 연구실 회의의 할 일은 작업으로 만들 수 없어요. |
| 400 | `P209` | `MINUTE_ACTION_ASSIGNEE_NOT_PARTICIPANT` | 할 일 담당자가 이 프로젝트의 참여자가 아니에요. |
| — | `P211` | (비움) | 보관된 프로젝트는 30 문서의 `409 P003 PROJECT_ARCHIVED` 를 함께 씀 |
| 400 | `P212` | `MINUTE_TEMPLATE_NOT_FOUND` | 없는 회의록 양식이에요. |
| 400 | `P213` | `MINUTE_CALENDAR_EVENT_INVALID` | 연결할 공용 일정을 찾을 수 없어요. |
| 400 | `P214` | `MINUTE_ACTION_CHECK_NOT_ALLOWED` | 프로젝트 회의록의 할 일은 작업으로 관리해요. |
| 400 | `P215` | `MINUTE_LIMIT_EXCEEDED` | 첨부파일은 10개, 할 일은 50개까지 넣을 수 있어요. |
| 403 | `P216` | `MINUTE_TASK_CREATE_FORBIDDEN` | 작업은 프로젝트 참여자만 만들 수 있어요. |
| 404 | `P230` | `REPORT_NOT_FOUND` | 주간 보고를 찾을 수 없어요. |
| 403 | `P231` | `REPORT_WRITE_FORBIDDEN` | 주간 보고는 report-write 역할이 있는 재실 구성원만 쓸 수 있어요. |
| 409 | `P232` | `REPORT_CONFIRMED_LOCKED` | 확인된 보고는 고칠 수 없어요. |
| 400 | `P233` | `REPORT_INVALID_WEEK` | 주는 그 주 월요일 날짜로 보내 주세요. |
| 400 | `P234` | `REPORT_FUTURE_WEEK` | 아직 시작하지 않은 주의 보고는 쓸 수 없어요. |
| 400 | `P235` | `REPORT_REQUIRED_TEXT_MISSING` | 이번 주 한 일과 다음 주 계획을 채워야 제출할 수 있어요. |
| 400 | `P236` | `REPORT_INVALID_STATUS_CHANGE` | 지금 상태에서는 바꿀 수 없어요. |
| 409 | `P237` | `REPORT_NOT_SUBMITTED` | 제출한 보고만 확인할 수 있어요. |
| 400 | `P238` | `REPORT_TASK_NOT_LINKABLE` | 이 주의 보고에 연결할 수 없는 작업이에요. |
| 429 | `P239` | `GITHUB_REFRESH_TOO_SOON` | 방금 새로 받았어요. 잠시 뒤에 다시 눌러 주세요. |
| 400 | `P240` | `REPORT_QUERY_INVALID` | 주(weekStartOn)나 구성원(memberId) 중 하나만 골라 주세요. |
| 404 | `P241` | `GITHUB_REPOSITORY_NOT_FOUND` | 저장소를 찾을 수 없어요. |
| 400 | `P242` | `GITHUB_NO_REPOSITORY` | 참여 중인 프로젝트에 연결된 GitHub 저장소가 없어요. |

`P210`, `P217~P229`, `P243~P299` 는 비워 둡니다.

---

## 맞춰 본 결과

[README 3장](README.md#3-테이블-설계와-맞춰-본-결과)에 없는 것만 적습니다.

| # | 내용 | 근거 | 제안 |
|---|------|------|------|
| N1 | 회의록 양식(`PROJECT_CATEGORY.ref1`)을 구성원 누구나 읽어야 하는데, 지금 공통코드 조회 API 는 관리 권한(`sso-admin` → `code-manage`)이 있어야 한다. 카테고리 · 작업 유형 · 일정 종류 · 자료 카테고리 드롭다운도 같은 문제 | PRJ-3-03, backoffice | backoffice 에 로그인 읽기 전용 조회(`GET /backoffice/common-codes/{codeId}/details?enabledOnly=true`, 관리용 칸 · `SSO_APP` 제외)를 둔다 — 10-member 문서와 맞출 것 |
| N2 | 제출 현황의 **미제출**은 "그 주 `report-write` 를 가진 재실 구성원"인데, 역할 이력을 저장하지 않아 지난 주를 열면 **지금** 역할 · 상태로 계산된다 (나중에 들어온 인턴이 지난 주 미제출로 잡히고, 졸업생은 빠짐) | db 30 `weekly_reports` 설명, PRJ-4-04 | **2026-11-19 결정: 역할 이력을 둔다** (member `member_role_histories`). 대상 = 그 주(월 ~ 일, KST) 중 하루라도 `report-write` 를 가졌고, 재실이었고(`joined_on` ~ `left_on`), 휴학 중이 아니었던(휴학 처리일 ~ 복학한 날 전) 날이 있는 구성원 (`MemberQueryApi.findRoleHoldersBetween`). 마감 알림은 그중 지금 재실인 사람에게만. 배포 전의 지난 회수 기록은 없으므로 배포 시점에 가진 역할부터 정확함 |
| N3 | 주간 보고는 모두가 보는데(PRJ-4-06), 보고 안의 **작업 연동 · GitHub 활동**에는 비공개 프로젝트의 작업 제목 · 저장소 이름 · 커밋 메시지가 들어간다. 프로젝트 홈의 GitHub 요약은 "프로젝트를 볼 수 있는 사람만"(PRJ-4-27)이라 서로 맞지 않는다 | PRJ-4-06, 25, 27, CMN-2-02 | 볼 수 없는 프로젝트의 것은 개수만 준다 (`hiddenTaskCount`, `hidden: true` 줄). SRS PRJ-4 에 이 규칙을 적는다 |
| N4 | 회의록 안건 · 논의 내용 · 결정 사항, 주간 보고 세 칸, 회의록 할 일 개수에 상한이 SRS 에 없다 | PRJ-3, PRJ-4 데이터 항목 | Markdown 각 30,000자, 할 일 50개로 정한다 (작업 설명 · 체크리스트와 같음) |
| N5 | 연구실 회의록(프로젝트 없음)을 누가 지울 수 있는지가 없다. PRJ-3-11 은 "작성자 · PM · `project-manage`" 인데 연구실 회의에는 PM 이 없다 | PRJ-3-11 | 작성자 · `project-manage` 로 정한다 (위 권한 표). `content-manage` 로 할지 결정 필요 |
| N6 | 회의록 만들기에 쓸 일정 응답에 프로젝트 **키**가 있어야 MM-2 의 `projectKey` 를 채울 수 있다. `calendar_events` 에는 `project_id` 만 있다 | PRJ-3-02, db 20 `calendar_events` | 일정 응답에 `projectKey` 를 넣는다 (calendar 는 project 를 모르므로 화면이 `projectId` 로 프로젝트를 찾거나, MM-2 가 `projectId` 도 받는다) — 20-communication · 30-project 와 맞출 것 |
| N7 | "지금 새로 받기"는 github 모듈의 작업을 만든다. 50-infra 에 같은 성격의 API(저장소 다시 훑기)가 생기면 겹친다 | INF-3-12 | 50-infra 에 관리용 다시 훑기가 생기면 WR-7 은 그 command API 를 부르는 얇은 경로로 둔다 |
