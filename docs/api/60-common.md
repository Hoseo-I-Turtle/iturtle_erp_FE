# 60. 홈 · 검색 · 댓글 API (comment)

[README](README.md) 의 공통 규칙(1.7 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙)을 따릅니다. 경로 앞의 `/api/v1` 은 줄여 씁니다.
요구사항은 [srs/60-common.md](../srs/60-common.md), 댓글 테이블은 [db/60-common.md](../db/60-common.md) 입니다.

홈 대시보드와 통합 검색은 **따로 모듈 · API 를 두지 않습니다.** 화면이 각 모듈 API 를 함께 불러 그립니다 (README 1.11 규칙 1). 이 문서에는 화면이 무엇을 부르는지와 공통 댓글 API 를 적습니다.

## 공통 모양

| 이름 | 모양 | 비고 |
|------|------|------|
| `MemberRef` | `{ memberId, name, memberType, status, photoUrl }` | README 1.4 |
| `TaskRef` | `{ taskKey, title, status }` | README 1.4 |
| `FileRef` | `{ publicId, name, size, contentType, extension }` | [40](40-document-file.md) |
| `ProjectRef` | `{ projectKey, name }` | |
| `CalendarOccurrence` | `GET /calendar-events` 의 `occurrences[]` 한 항목 | [20](20-communication.md) |
| `PageResponse<T>` | `{ content, page, size, totalElements, totalPages, hasNext }` | common-code |

---

## API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| CM-1 | GET | `/comments` | 대상을 볼 수 있음 | 댓글 목록 (답글 포함) |
| CM-2 | POST | `/comments` | 대상에 쓸 수 있음 | 댓글 · 답글 쓰기 |
| CM-3 | PATCH | `/comments/{commentId}` | 작성자 | 댓글 고치기 |
| CM-4 | DELETE | `/comments/{commentId}` | 작성자, 대상의 관리 권한 | 댓글 지우기 |

---

## 1. 홈 대시보드 — CMN-1 (화면: 02 · 홈)

홈 API 는 없습니다. 화면이 아래 API 를 **동시에** 부르고, 칸마다 따로 그립니다.
그래서 한 칸의 API 가 실패해도 그 칸만 "불러오지 못했어요"가 되고 나머지는 보입니다 (CMN-1-03). 각 API 가 권한 안의 것만 주므로 칸도 권한 안의 것만 보입니다 (CMN-1-02).

| 칸 | 부르는 API | 화면이 하는 일 | 요구사항 |
|----|-----------|----------------|----------|
| 꼭 확인할 것 · 필독 공지 | `GET /notices?mustRead=true&unreadOnly=true` ([20](20-communication.md)) | 비면 칸 숨김. 읽음 · 안 읽음 **숫자**는 응답에 있음, 명단은 공지 상세에서 작성자 · `content-manage` 만 ([README S4](README.md#33-화면--srs--테이블-불일치)) | COM-1-06 |
| 꼭 확인할 것 · 투표 | 같은 공지 목록의 `poll`(내가 대상 · 안 함 · 진행 중) | | COM-1-14 |
| 꼭 확인할 것 · 모임 날짜 | `GET /meeting-polls` ([20](20-communication.md)) 중 내가 대상이고 응답 안 한 것 | | COM-3-10 |
| 꼭 확인할 것 · 주간 보고 | `GET /weekly-reports/me/{weekStartOn}` ([32](32-minute-report.md)) | `report-write` 가 없으면 부르지 않음 (`GET /members/me` 의 역할로 판단) | PRJ-4-07 |
| 오늘 · 이번 주 일정 | `GET /calendar-events?from=오늘&to=+6일` ([20](20-communication.md)) | 비면 "일정 없음" | CMN-1 |
| 내 작업 | `GET /tasks?mine=true&sort=dueOn&size=10` ([31](31-task.md)) | 기한 지남 → 3일 안 → 나머지로 묶고 빨간색 표시 | PRJ-2-06 |
| 검토를 기다리는 작업 | `GET /tasks?awaitingMyReview=true&size=10` ([31](31-task.md)) | 비면 칸 숨김 | CMN-1-06 |
| 최근 공지 | `GET /notices?size=5` | 고정 먼저 (API 정렬 그대로) | CMN-1 |
| 내 프로젝트 | `GET /projects?mine=true&status=ACTIVE` ([30](30-project.md)) | 마일스톤 진행률 · 최근 활동 한 줄은 응답에 있음 | CMN-1 |
| 서비스 바로 가기 | `GET /sso/apps` (기존, `accessible` 추가 — [10 9-2](10-member.md)), GitHub 카드는 `GET /github/accounts/{memberId}` ([50](50-infra.md)) | 권한 없는 서비스는 흐리게. `/?denied=vault` 안내는 화면이 주소를 보고 그림 (CMN-1-05) | CMN-1-05 |
| 관리 대기 수 | `member-manage`: `GET /signup-applications?status=PENDING&size=1` 의 `totalElements`. `role-manage`: `GET /auth/access-requests?scope=REVIEW&status=PENDING&size=1` ([10](10-member.md)) | 역할이 없으면 부르지 않음 | CMN-1-07 |

- 2초 안(CMN-1-04)은 칸별 API 가 각자 1초 안(NFR-PER-01)이고 동시에 부르므로 맞춥니다.
- 위 API 중 `mustRead` · `unreadOnly` · `awaitingMyReview` 같은 필터는 각 문서에 있습니다. **없는 필터가 있으면 그 목록 API 에 파라미터로 더하고, 홈 전용 API 는 만들지 않습니다.**

## 2. 통합 검색 — CMN-2

검색 API 도 따로 두지 않습니다. 화면 위 검색창에 치면 아래 목록 API 를 `keyword` 로 **동시에** 부르고, 종류별로 묶어 보여 줍니다 (CMN-2-01). 권한 거르기는 각 API 가 SQL 안에서 하므로, 볼 수 없는 것은 결과와 `totalElements` 에 모두 없습니다 (CMN-2-02).

| 종류 | API | 찾는 곳 (FULLTEXT ngram) |
|------|-----|--------------------------|
| 공지 | `GET /notices?keyword=` ([20](20-communication.md)) | `ft_notices` |
| 자료 | `GET /documents?keyword=` ([40](40-document-file.md)) | `ft_documents`, `ft_files_name`, `document_tags` |
| 작업 | `GET /tasks?keyword=` ([31](31-task.md)) | `ft_tasks` |
| 작업 댓글 | `GET /comments?targetType=TASK&keyword=` (아래 CM-1) | `ft_comments` |
| 회의록 | `GET /meeting-minutes?keyword=` ([32](32-minute-report.md)) | `ft_meeting_minutes` |
| 프로젝트 스레드 | `GET /projects/threads?keyword=` ([31](31-task.md), 여러 프로젝트) | `ft_project_threads` |
| 프로젝트 | `GET /projects?keyword=` ([30](30-project.md)) | `ft_projects` |
| 구성원 | `GET /members?keyword=` ([10](10-member.md)) | `ft_members_name` (연락처 · 이메일은 결과에 없음, NFR-PRI-02) |

- 종류마다 `size=5` 로 부르고, "더 보기"는 그 종류의 API 를 `page` 로 넘깁니다.
- 거르기(CMN-2-04): 기간 · 프로젝트 · 작성자는 각 목록 API 의 `from` · `to` · `projectKey` · `authorId` 를 씁니다. 종류 거르기는 화면이 부를 API 를 고르는 것입니다.
- 강조(CMN-2-05)는 화면이 검색어로 칠합니다.
- 작업 번호(`DEFME-12`)를 치면 화면이 `GET /tasks/lookup?keys=DEFME-12` 로 바로 갑니다 (CMN-2-06).
- 2글자 미만은 화면이 부르지 않고, API 도 400 으로 거절합니다 (CMN-2-03).
- 첨부파일 **내용**은 찾지 않습니다. 파일 이름만 (CMN-2-08).
- 1초 안(CMN-2-07)은 종류별 API 를 동시에 부르므로 가장 느린 것 하나가 기준입니다.

## 3. 댓글 공통 규칙

공지 · 작업 · 프로젝트 스레드 · 주간 보고 · 자료의 댓글을 **API 하나**로 다룹니다 (README 1.11 규칙 3).
권한은 대상 모듈이 구현한 `CommentTargetPolicy`(`canRead`, `canWrite`, `canModerate`)가 판단하고, 알림 · @멘션 · 활동 기록 · 구독은 comment 가 내는 `CommentCreatedEvent` 를 대상 모듈이 받아 처리합니다 ([db 60](../db/60-common.md)).

### 대상별 규칙

| `targetType` | `targetId` | 읽기 | 쓰기 | 남의 댓글 지우기 | 본문 최대 | 첨부 최대 | 비고 |
|--------------|-----------|------|------|------------------|-----------|-----------|------|
| `NOTICE` | `noticeId` | 로그인 | 로그인 | `content-manage` | 2,000자 | 0 | COM-1-08 |
| `DOCUMENT` | `documentId` | 그 자료를 볼 수 있음 | 같음 | `content-manage` | 2,000자 | 0 | DOC-1-06 |
| `TASK` | 작업 ID (`GET /tasks/{taskKey}` 의 `taskId`) | 그 프로젝트를 볼 수 있음 | 참여자, `project-observe`, `project-manage` | PM, `project-manage` | 10,000자 | 5 | PRJ-2-50, 51 |
| `PROJECT_THREAD` | `threadId` | 같음 | 같음 | PM, `project-manage` | 10,000자 | 5 | PRJ-2-71 |
| `WEEKLY_REPORT` | `reportId` | 로그인 (작성 중인 보고는 본인만) | 새 코멘트: `report-review`. 답글: 보고 작성자, `report-review` | 없음 | 2,000자 | 0 | PRJ-4-04, 05 |

- 보관된 프로젝트의 작업 · 스레드에는 쓰지 못합니다 (PRJ-1-06, `CM004`).
- 길이 · 첨부 수 중 SRS 에 없는 값(자료 · 주간 보고 · 스레드 답글의 첨부, 주간 보고 길이)은 이 문서에서 정한 제안값입니다.

### CM-1. 댓글 목록

`GET /api/v1/comments`

| 항목 | 내용 |
|------|------|
| 권한 | 대상을 볼 수 있음 (`canRead`). 못 보면 404 `CM002` |
| 요구사항 | COM-1-08, PRJ-2-02, 50, 71, PRJ-4-04, DOC-1-06 |
| 테이블 | `comments` (`idx_comments_target`, `idx_comments_parent`), `files`(`target_type = COMMENT`) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `targetType` | string | O | 위 표 |
| `targetId` | number | △ | `keyword` 가 없으면 필수 |
| `keyword` | string | X | 2자 이상. **통합 검색용**: `targetId` 없이 `targetType` 의 댓글 중 볼 수 있는 것에서 찾는다 (최신 순, 답글도 한 줄씩). 응답 항목에 `target { type, id, key, title }` 가 더해진다. 지금은 `TASK` 만 (CMN-2 대상) |
| `page`, `size` | | | 원 댓글 기준 페이지. 기본 `size` 50, 최대 100. 오래된 순 고정 (`keyword` 일 때는 최신 순, 기본 `size` 20) |

**응답** `200 OK` — `PageResponse<Comment>` (원 댓글만, 답글은 `replies` 안에 전부)

| 필드 | 타입 | 설명 |
|------|------|------|
| `commentId` | number | |
| `parentId` | number \| null | |
| `author` | `MemberRef` | 졸업 · 퇴실이면 `status` 로 "졸업" 표시 |
| `body` | string \| null | 지운 댓글이면 null |
| `deleted` | boolean | true 면 화면이 "삭제된 댓글입니다"로 자리만 그림 |
| `kind` | `NORMAL` \| `REJECT_REASON` \| `STATUS_REASON` | 작업 반려 · 취소 사유는 칩으로 표시 |
| `attachments` | `FileRef[]` | 지운 댓글이면 빈 배열 |
| `editedAt` | string \| null | "수정됨" |
| `createdAt` | string | |
| `permissions` | `{ canEdit, canDelete }` | |
| `replies` | `Comment[]` | 원 댓글에만. 오래된 순 |

```json
{
  "success": true,
  "data": {
    "content": [
      { "commentId": 880, "parentId": null,
        "author": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
        "body": "@jihoon.park 6가지 다 통과했어요. 리뷰 부탁드려요!", "deleted": false, "kind": "NORMAL",
        "attachments": [ { "publicId": "3d2a…", "name": "logout-cases.png", "size": 245760, "contentType": "image/png", "extension": "png" } ],
        "editedAt": null, "createdAt": "2026-11-17T01:00:00Z", "permissions": { "canEdit": true, "canDelete": true },
        "replies": [
          { "commentId": 881, "parentId": 880, "author": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
            "body": null, "deleted": true, "kind": "NORMAL", "attachments": [], "editedAt": null,
            "createdAt": "2026-11-17T01:40:00Z", "permissions": { "canEdit": false, "canDelete": false }, "replies": [] } ] }
    ],
    "page": 0, "size": 50, "totalElements": 2, "totalPages": 1, "hasNext": false
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | `targetType` 이 위 표에 없음 |
| 404 | `CM002` | 대상이 없거나 볼 수 없음 |

### CM-2. 댓글 · 답글 쓰기

`POST /api/v1/comments`

| 항목 | 내용 |
|------|------|
| 권한 | 대상에 쓸 수 있음 (`canWrite`, 위 표) |
| 요구사항 | COM-1-08, PRJ-2-50, 52, 53, 71, 74, 80, PRJ-4-04, 05, DOC-1-06 |
| 테이블 | `comments`, `files`(`target_type = COMMENT`, `target_id = comments.id`) |
| 감사 로그 · 알림 | `CommentCreatedEvent` → 대상 모듈이 알림(`NOTICE_COMMENT`, `TASK_WATCH`, `MENTIONED`, `THREAD_REPLY`, `REPORT_COMMENT`), 구독 추가, 작업 활동 기록(`TASK_COMMENTED`), 스레드 `last_activity_at` 갱신 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `targetType` | string | O | |
| `targetId` | number | O | |
| `parentId` | number | | 답글이면 원 댓글. **답글에 답하면 그 원 댓글에 붙음** (한 단계). 같은 대상의 댓글이어야 함 |
| `body` | string | O | Markdown, 1자 이상, 대상별 최대 길이 |
| `attachmentFileIds` | string[] | | 대상별 최대 개수. `READY` 인 내 파일 |

- **멘션**: 본문의 `@로그인ID` 를 서버가 꺼냅니다. 그 대상을 **볼 수 있는 재실 구성원만** 멘션으로 인정하고 알림을 보냅니다 (볼 수 없는 사람은 본문에 글자로만 남고 알림 없음, PRJ-2 수용 기준). 화면의 자동 완성은 [README 1.12](README.md#112-여러-영역이-같이-쓰는-api) 의 @멘션 후보를 씁니다.
- `kind` 는 이 API 로 정할 수 없고 늘 `NORMAL` 입니다. 반려 · 취소 사유 댓글은 작업 상태 이동 API 가 만듭니다 ([31](31-task.md)).

```json
{ "targetType": "TASK", "targetId": 5044, "parentId": null,
  "body": "@jihoon.park 미등록 돌아갈 주소일 때 응답 코드만 한 번 더 확인할게요.", "attachmentFileIds": [] }
```

**응답** `201 Created` (`Location: /api/v1/comments/882`)

| 필드 | 타입 | 설명 |
|------|------|------|
| (CM-1 의 `Comment`) | | `replies` 는 빈 배열 |
| `mentions` | `MemberRef[]` | 멘션으로 인정돼 알림을 받은 사람 |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CM002` | 대상이 없거나 볼 수 없음 |
| 403 | `CM004` | 볼 수는 있지만 쓸 수 없음 (`project-view-public` 만 있음, 보관된 프로젝트, 주간 보고에 `report-review` 없이 새 코멘트) |
| 400 | `CM003` | 본문이 대상별 최대 길이를 넘음 |
| 400 | `CM006` | `parentId` 가 다른 대상의 댓글이거나 지운 댓글 |
| 400 | `CM007` | 첨부가 대상별 최대 개수를 넘음 (첨부를 받지 않는 대상 포함) |
| 400 · 403 · 409 | `F009` · `F010` · `F008` | 첨부 파일 상태 ([40](40-document-file.md)) |

### CM-3. 댓글 고치기

`PATCH /api/v1/comments/{commentId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자만 (관리 권한으로도 남의 댓글은 고치지 않음) |
| 요구사항 | COM-1-08, PRJ-2-51 |
| 테이블 | `comments` (`edited_at`), `files` |
| 감사 로그 · 알림 | 새로 더한 멘션에만 알림 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `body` | string | | CM-2 와 같은 규칙 |
| `attachmentFileIds` | string[] | | 통째로 바꿈. 빠진 파일은 30일 뒤 지움 |

```json
{ "body": "@jihoon.park 미등록 돌아갈 주소일 때 응답 코드 400 인지만 확인할게요." }
```

**응답** `200 OK` — `Comment`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CM001` | 댓글이 없거나 대상을 볼 수 없음 |
| 403 | `C003` | 작성자가 아님 |
| 409 | `CM005` | 지운 댓글 |
| 403 | `CM004` | 대상에 더 이상 쓸 수 없음 (프로젝트 보관 등) |
| 400 | `CM003`, `CM007` | 길이 · 첨부 수 |

### CM-4. 댓글 지우기

`DELETE /api/v1/comments/{commentId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, 또는 대상의 관리 권한(`canModerate`, 위 표) |
| 요구사항 | COM-1-08, PRJ-2-51, 60, INF-2 (콘텐츠) |
| 테이블 | `comments` (`deleted_at`, `deleted_by`), `files.purge_at` (+30일) |
| 감사 로그 · 알림 | 남의 댓글을 지우면 `CONTENT` / `CONTENT_DELETED`. 작업 댓글이면 활동 기록 |

답글이 있을 수 있어 행은 남기고 "삭제된 댓글입니다"로 보입니다.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CM001` | 댓글이 없거나 대상을 볼 수 없음 |
| 403 | `C003` | 작성자도 관리 권한자도 아님 |
| 409 | `CM005` | 이미 지움 |

## 4. Markdown

Markdown 편집 · 미리 보기 · 그리기(Mermaid 포함)는 **브라우저**가 하므로 API 가 없습니다 (CMN-3). 서버는 원문을 그대로 저장하고 돌려주며, 길이 검사만 합니다. 다이어그램 안의 글자도 원문에 있으므로 통합 검색에 걸립니다 (CMN-3-04). 본문의 작업 번호를 링크로 바꿀 때는 `GET /tasks/lookup` ([31](31-task.md))으로 볼 수 있는 것만 링크로 만듭니다 (PRJ-2-03).

---

## 에러 코드

### comment (`CM`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `CM001` | `COMMENT_NOT_FOUND` | 댓글을 찾을 수 없어요. |
| 404 | `CM002` | `COMMENT_TARGET_NOT_FOUND` | 댓글을 달 글을 찾을 수 없어요. |
| 400 | `CM003` | `COMMENT_TOO_LONG` | 댓글이 너무 길어요. {max}자까지 쓸 수 있어요. |
| 403 | `CM004` | `COMMENT_WRITE_NOT_ALLOWED` | 여기에는 댓글을 쓸 수 없어요. |
| 409 | `CM005` | `COMMENT_ALREADY_DELETED` | 지운 댓글이에요. |
| 400 | `CM006` | `PARENT_COMMENT_INVALID` | 같은 글의 댓글에만 답글을 달 수 있어요. |
| 400 | `CM007` | `TOO_MANY_COMMENT_ATTACHMENTS` | 이 댓글에는 첨부를 {max}개까지 붙일 수 있어요. |
