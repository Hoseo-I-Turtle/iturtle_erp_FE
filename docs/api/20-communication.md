# 20. 소통 · 일정 API (notice, calendar, notification)

[README](README.md) 의 공통 규칙(1장)을 따릅니다. 공통 헤더(1.7)와 공통 에러(1.8)는 API 마다 다시 적지 않습니다.
표의 경로는 `/api/v1` 을 줄여 씁니다. 상세 형식의 경로는 전체를 적습니다.

| 영역 | 모듈 | 요구사항 | 화면 |
|------|------|----------|------|
| [1. 공지 · 투표](#1-공지--투표--com-1) | notice | COM-1 | 02 · 공지 상세, 02 · 홈 |
| [2. 캘린더](#2-캘린더--com-4) | calendar | COM-4 | 02 · 캘린더 |
| [3. 모임 날짜 정하기](#3-모임-날짜-정하기--com-3) | calendar | COM-3 | 02 · 모임 날짜 정하기 |
| [4. 알림](#4-알림--com-5) | notification | COM-5 | 05 · 알림, 헤더 알림 미리보기, 05 · 내 프로필(알림 받기) |

공지 댓글은 공통 댓글 API(`/comments?targetType=NOTICE&targetId=`)를 씁니다 → [60 · 댓글](60-common.md).
첨부 · 본문 이미지 올리기는 공통 파일 API 를 씁니다 → [40 · 파일](40-document-file.md).

---

## 공통 모양

### MemberRef

| 필드 | 타입 | 설명 |
|------|------|------|
| `memberId` | number | |
| `name` | string | |
| `memberType` | string | `PROFESSOR`, `STUDENT`, `INTERN` |
| `status` | string | `ACTIVE`, `GRADUATED`, `LEFT` (졸업 · 퇴실이면 화면이 "졸업" 표시, MEM-4-07) |
| `photoUrl` | string \| null | 128px 사진 주소. 없으면 null (화면이 이름 첫 글자로 그림) |

### FileRef

| 필드 | 타입 | 설명 |
|------|------|------|
| `publicId` | string (UUID) | 내려받기 · 붙이기에 쓰는 ID |
| `name` | string | 원래 파일 이름 |
| `size` | number | 바이트 |
| `contentType` | string | MIME |

### PageResponse

`{ content: [...], page, size, totalElements, totalPages, hasNext }` — README 1.3. 요청은 `page`(기본 0), `size`(기본 20, 최대 100).

### 필드를 비우는 방법 (PATCH)

`PATCH` 본문에서 **필드를 빼면 그대로**, **`null` 을 보내면 비웁니다** (예: `"pinnedUntilOn": null` = 고정 해제).
목록 필드(`attachmentFileIds`, `attendeeIds`)는 보낸 목록으로 **통째로 바꿉니다**.

### 본문 이미지

Markdown 본문에 붙여 넣은 이미지는 `purpose = INLINE_IMAGE` 로 올린 뒤 본문에 `/api/v1/files/{publicId}/download` 주소로 넣습니다.
저장할 때 **서버가 본문에서 이 주소를 찾아 그 글에 붙입니다** (따로 보낼 필드 없음). 붙지 않은 파일은 24시간 뒤 지워집니다 (DOC-2-08).

---

## 1. 공지 · 투표 — COM-1

### API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| N-1 | GET | `/notices` | 로그인 | 공지 목록 (고정 먼저 → 최신 순, 검색) |
| N-2 | GET | `/notices/{noticeId}` | 로그인 | 공지 상세 + 투표 + 읽음 현황. 열면 읽음 처리 |
| N-3 | POST | `/notices` | `notice-write` | 공지 쓰기 (투표 함께) |
| N-4 | PATCH | `/notices/{noticeId}` | 작성자, `content-manage` (투표 부분은 작성자) | 고치기 · 고정 · 해제 · 다시 읽음 확인 · 투표 고치기 · 일찍 마감 |
| N-5 | DELETE | `/notices/{noticeId}` | 작성자, `content-manage` | 숨김 (투표 · 댓글 · 첨부 함께) |
| N-6 | PUT | `/notices/{noticeId}/poll/my-vote` | 투표 대상 | 투표 · 선택 바꾸기 (기명만) |

- **투표 결과는 N-2 상세 안에 있습니다.** 결과 공개 설정과 익명 여부에 따라 서버가 필드를 빼고 줍니다 (README 1.11 규칙 4). 결과만 따로 주는 API 는 없습니다.
- **읽은 사람 · 안 읽은 사람 명단도 N-2 안에 둡니다.** 같은 화면(공지 상세)에서 함께 보이고, 작성자 · `content-manage` 가 아니면 명단 필드만 빼면 되므로 API 를 나누는 것보다 단순합니다.
- 일찍 마감(COM-1-13)과 고정 해제(COM-1-03)는 N-4 의 필드입니다 (규칙 2).

### `Poll` 모양 (N-2, N-6 응답)

| 필드 | 타입 | 언제 빠짐 | 설명 |
|------|------|-----------|------|
| `pollId` | number | | |
| `question` | string | | 1~100자 |
| `multiple` | boolean | | 복수 선택 |
| `maxChoices` | number \| null | | 복수 선택일 때 최대 개수 |
| `anonymous` | boolean | | 익명 |
| `resultVisibility` | string | | `AFTER_VOTE`(투표한 뒤 바로), `AFTER_CLOSE`(마감 뒤) |
| `audienceMemberTypes` | string[] \| null | | null = 전체 구성원 |
| `audienceCount` | number | | 대상 재실 구성원 수 |
| `participantCount` | number | | 투표한 사람 수 (`poll_participants`) |
| `closesAt` | string | | 마감 시각 |
| `closedEarlyAt` | string \| null | | 일찍 마감한 시각 |
| `closed` | boolean | | 마감됨 (`closedEarlyAt` 이 있거나 `closesAt` 이 지남) |
| `audience` | boolean | | 내가 대상인지 |
| `voted` | boolean | | 내가 투표했는지 |
| `canChangeVote` | boolean | | 기명 · 마감 전 · 투표함이면 true. **익명이면 늘 false** |
| `myOptionIds` | number[] | **익명이면 빠짐** | 내가 고른 선택지. 익명은 서버도 모른다 (COM-1-12) |
| `resultVisible` | boolean | | 아래 규칙으로 계산한 결과 공개 여부 |
| `options[]` | object[] | | 선택지 (순서대로) |
| `options[].optionId` | number | | |
| `options[].label` | string | | 1~50자 |
| `options[].count` | number | `resultVisible = false` 면 빠짐 | 득표 수 |
| `options[].ratio` | number | 같음 | `count ÷ participantCount` (0~1) |
| `options[].voters` | MemberRef[] | 익명이거나 `resultVisible = false` 면 빠짐 | 그 선택지를 고른 사람 (COM-1-11) |

결과 공개(`resultVisible`) 규칙:

| 경우 | `AFTER_VOTE` | `AFTER_CLOSE` |
|------|--------------|---------------|
| 마감 뒤 | 모두 공개 | 모두 공개 |
| 마감 전, 투표한 사람 | 공개 | 비공개 |
| 마감 전, 투표 안 한 대상 | 비공개 | 비공개 |
| 마감 전, 대상이 아닌 사람 | 비공개 | 비공개 |
| 마감 전, 작성자 · `content-manage` | 공개 (숫자만. 익명이면 `voters` 없음) | 공개 (숫자만) |

> 대상이 아닌 사람과 작성자가 마감 전에 결과를 보는지는 SRS 에 없습니다. 위 표처럼 정하는 것을 제안합니다.

---

### N-1. 공지 목록

`GET /api/v1/notices`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | COM-1-02, COM-1-03, COM-1-16 |
| 테이블 | `notices` (`idx_notices_pinned`, `idx_notices_created`, `ft_notices`), `notice_reads`, `polls`, `poll_participants`, `comments`(개수, comment query API) |

**요청 헤더** — 공통

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `keyword` | string | X | 제목 · 본문 검색 (2자 이상, ngram) |
| `mustRead` | boolean | X | 필독만 |
| `unreadOnly` | boolean | X | 내가 안 읽은 것만 (홈 "꼭 확인할 것"은 `mustRead=true&unreadOnly=true`) |
| `page`, `size` | number | X | 기본 0, 20 (최대 100) |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `pinned[]` | NoticeSummary[] | 고정 기한 안의 공지 (최대 3개). 첫 페이지에만 넣고 `page` 목록에서는 뺀다 |
| `page` | PageResponse\<NoticeSummary\> | 나머지, 최신 순 |

`NoticeSummary`

| 필드 | 타입 | 설명 |
|------|------|------|
| `noticeId` | number | |
| `title` | string | |
| `mustRead` | boolean | |
| `pinnedUntilOn` | string \| null | 고정 기한 날짜 |
| `author` | MemberRef | |
| `createdAt` | string | |
| `editedAt` | string \| null | "수정됨" |
| `read` | boolean | 내가 읽었는지 |
| `commentCount` | number | |
| `attachmentCount` | number | |
| `poll` | object \| null | `{ closesAt, closed, audience, voted }` — 목록의 "투표 진행 중", 홈의 "아직 안 한 투표" |

```json
{
  "success": true,
  "data": {
    "pinned": [
      { "noticeId": 12, "title": "12월 연구실 회식 날짜를 정해요", "mustRead": true, "pinnedUntilOn": "2026-11-30",
        "author": { "memberId": 1, "name": "정재훈", "memberType": "PROFESSOR", "status": "ACTIVE", "photoUrl": null },
        "createdAt": "2026-11-17T00:12:00Z", "editedAt": "2026-11-17T01:00:00Z",
        "read": false, "commentCount": 2, "attachmentCount": 1,
        "poll": { "closesAt": "2026-11-20T09:00:00Z", "closed": false, "audience": true, "voted": false } }
    ],
    "page": { "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0, "hasNext": false }
  },
  "error": null
}
```

**에러** — 공통만

---

### N-2. 공지 상세

`GET /api/v1/notices/{noticeId}`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | COM-1-04, COM-1-05, COM-1-07, COM-1-11, COM-1-12 |
| 테이블 | `notices`, `notice_reads`, `polls`, `poll_options`, `poll_participants`, `poll_votes`, `files`, `members` |
| 부수 효과 | **열면 읽음 처리** (`notice_reads` 에 내 행이 없을 때만 추가. 여러 번 불러도 한 번). defme 알림 상세와 같은 방식 |

**경로 파라미터**

| 이름 | 타입 | 설명 |
|------|------|------|
| `noticeId` | number | 공지 ID |

**응답** `200 OK`

| 필드 | 타입 | 언제 빠짐 | 설명 |
|------|------|-----------|------|
| `noticeId` | number | | |
| `title` | string | | |
| `body` | string | | Markdown 원문 |
| `mustRead` | boolean | | |
| `pinnedUntilOn` | string \| null | | |
| `author` | MemberRef | | |
| `createdAt` | string | | |
| `editedAt` | string \| null | | 본문을 고친 시각 |
| `attachments` | FileRef[] | | |
| `poll` | Poll \| null | | 위 `Poll` 모양 |
| `canEdit` | boolean | | 내가 고칠 수 있는지 (작성자 · `content-manage`). 화면 버튼용, 서버가 다시 검사함 |
| `readSummary` | object \| null | 필독이 아니면 null | `{ readCount, unreadCount }` — 숫자는 모두에게 (README S4) |
| `readSummary.readers` | `{ member: MemberRef, readAt }[]` | **작성자 · `content-manage` 가 아니면 빠짐** | 읽은 사람 (COM-1-05) |
| `readSummary.unreaders` | MemberRef[] | 같음 | 안 읽은 사람 = 재실 구성원 − 읽은 사람 |
| `readsResetAt` | string \| null | | "다시 읽음 확인 받기"를 한 시각 |

```json
{
  "success": true,
  "data": {
    "noticeId": 12,
    "title": "12월 연구실 회식 날짜를 정해요",
    "body": "올해 마지막 회식 날짜를 정하려고 합니다. …",
    "mustRead": true,
    "pinnedUntilOn": "2026-11-30",
    "author": { "memberId": 1, "name": "정재훈", "memberType": "PROFESSOR", "status": "ACTIVE", "photoUrl": null },
    "createdAt": "2026-11-17T00:12:00Z",
    "editedAt": "2026-11-17T01:00:00Z",
    "attachments": [ { "publicId": "5c1f0c9e-…", "name": "회식_장소후보.pdf", "size": 1258291, "contentType": "application/pdf" } ],
    "poll": {
      "pollId": 4, "question": "가능한 날짜를 모두 골라 주세요", "multiple": true, "maxChoices": 3,
      "anonymous": false, "resultVisibility": "AFTER_VOTE", "audienceMemberTypes": null,
      "audienceCount": 11, "participantCount": 9,
      "closesAt": "2026-11-20T09:00:00Z", "closedEarlyAt": null, "closed": false,
      "audience": true, "voted": true, "canChangeVote": true, "myOptionIds": [41, 42], "resultVisible": true,
      "options": [
        { "optionId": 41, "label": "12/18(목) 저녁", "count": 7, "ratio": 0.78,
          "voters": [ { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null } ] }
      ]
    },
    "canEdit": true,
    "readSummary": {
      "readCount": 8, "unreadCount": 3,
      "readers": [ { "member": { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null }, "readAt": "2026-11-17T01:20:00Z" } ],
      "unreaders": [ { "memberId": 11, "name": "한유진", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null } ]
    },
    "readsResetAt": null
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `N001` | 공지가 없거나 지워짐 |

---

### N-3. 공지 쓰기

`POST /api/v1/notices`

| 항목 | 내용 |
|------|------|
| 권한 | `notice-write` |
| 요구사항 | COM-1-01, COM-1-03, COM-1-09 |
| 테이블 | `notices`, `polls`, `poll_options`, `files` (`target_type = NOTICE`) |
| 알림 | 필독이면 재실 구성원 전체에 `NOTICE_MUST_READ`. 투표가 있으면 대상에게 `POLL_OPENED` (작성자 본인 제외, COM-5-06) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `title` | string | O | 1~100자 |
| `body` | string | O | Markdown, 1~20,000자 |
| `mustRead` | boolean | O | 필독 |
| `pinnedUntilOn` | string (날짜) \| null | X | 고정 기한 날짜 (그날 끝까지 고정). 오늘 이후. null = 고정 안 함. 고정 중인 공지가 이미 3개면 거절 |
| `attachmentFileIds` | string[] | X | 첨부 `publicId`, 10개 이하. `purpose = ATTACHMENT` 이고 내가 올렸고 아직 어디에도 안 붙은 파일 |
| `poll` | object \| null | X | 투표 (0~1개) |
| `poll.question` | string | O | 1~100자 |
| `poll.options` | string[] | O | 2~20개, 각 1~50자, 서로 달라야 함 |
| `poll.multiple` | boolean | O | 복수 선택 |
| `poll.maxChoices` | number | 복수면 O | 2 이상, 선택지 수 이하. 단일이면 보내지 않음 |
| `poll.anonymous` | boolean | O | 익명. **만든 뒤 바꿀 수 없음** |
| `poll.resultVisibility` | string | O | `AFTER_VOTE`, `AFTER_CLOSE` |
| `poll.audienceMemberTypes` | string[] \| null | X | null 또는 빈 목록 = 전체 구성원. 값: `PROFESSOR`, `STUDENT`, `INTERN` |
| `poll.closesAt` | string | O | 지금 이후 |

```json
{
  "title": "12월 연구실 회식 날짜를 정해요",
  "body": "올해 마지막 회식 날짜를 정하려고 합니다. …\n\n![장소](/api/v1/files/9a2e…/download)",
  "mustRead": true,
  "pinnedUntilOn": "2026-11-30",
  "attachmentFileIds": ["5c1f0c9e-…"],
  "poll": {
    "question": "가능한 날짜를 모두 골라 주세요",
    "options": ["12/18(목) 저녁", "12/19(금) 저녁", "12/22(월) 저녁"],
    "multiple": true,
    "maxChoices": 3,
    "anonymous": false,
    "resultVisibility": "AFTER_VOTE",
    "audienceMemberTypes": null,
    "closesAt": "2026-11-20T09:00:00Z"
  }
}
```

**응답** `201 Created` (`Location: /api/v1/notices/12`) — 본문은 N-2 와 같은 상세

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `N003` | 고정 기한이 오늘보다 앞 |
| 409 | `N002` | 고정 중인 공지가 이미 3개 |
| 400 | `N014` | 첨부가 10개를 넘음 |
| 400 | `N012` | 선택지 개수 · 길이 · 중복이 규칙에 맞지 않음 |
| 400 | `N017` | 복수 선택인데 `maxChoices` 가 없거나 2 미만 · 선택지 수 초과, 단일 선택인데 `maxChoices` 를 보냄 |
| 400 | `N013` | 투표 마감이 지금보다 앞 |
| 400 · 404 | `F…` | 첨부 파일이 없거나 남의 파일 · 이미 붙은 파일 ([40 · 파일](40-document-file.md) 에러 표) |

---

### N-4. 공지 고치기

`PATCH /api/v1/notices/{noticeId}`

| 항목 | 내용 |
|------|------|
| 권한 | 공지 필드: 작성자, `content-manage`. `poll` 필드: **작성자만** (COM-1-09, 13) |
| 요구사항 | COM-1-01, COM-1-03, COM-1-07, COM-1-09, COM-1-13 |
| 테이블 | `notices` (`edited_at`, `reads_reset_at`, `pinned_until`), `notice_reads`, `polls`, `poll_options`, `files` |
| 감사 로그 | `content-manage` 로 **다른 사람의** 공지를 고치면 `CONTENT_EDITED` (INF-2 콘텐츠) |
| 알림 | 필독이 아니던 공지를 필독으로 바꾸거나 `resetReads` 를 하면 `NOTICE_MUST_READ` 다시 보냄. 투표를 새로 붙이면 `POLL_OPENED` |

**경로 파라미터** — `noticeId` (number)

**요청 본문** — 모든 필드 선택. 빼면 그대로, `null` 이면 비움

| 필드 | 타입 | 규칙 · 설명 |
|------|------|-------------|
| `title` | string | 1~100자 |
| `body` | string | 1~20,000자. 바뀌면 `editedAt` 이 새로 찍힘 |
| `mustRead` | boolean | |
| `pinnedUntilOn` | string \| null | 고정 · 기한 바꾸기 · `null` = 고정 해제. 새로 고정할 때 3개 검사 |
| `attachmentFileIds` | string[] | 보낸 목록으로 통째로 바꿈. 빠진 파일은 30일 뒤 지워짐 (DOC-2-09) |
| `resetReads` | boolean | true 면 읽음 기록 초기화 (COM-1-07). **필독 공지만** |
| `poll` | object \| null | 아래. 빼면 그대로, `null` 이면 투표 지우기 (표가 없을 때만) |
| `poll.question` | string | 표가 없을 때만 |
| `poll.options` | `{ optionId?, label }[]` | 표가 없을 때만. 통째로 바꿈 (`optionId` 가 있으면 그 선택지 유지, 없으면 새로) |
| `poll.multiple`, `poll.maxChoices`, `poll.resultVisibility`, `poll.audienceMemberTypes` | | 표가 없을 때만 |
| `poll.closesAt` | string | **언제나** 바꿀 수 있음 (마감 전). 지금 이후 |
| `poll.closeNow` | boolean | true 면 지금 마감 (COM-1-13). `closedEarlyAt` 기록 |
| `poll.anonymous` | — | **보낼 수 없음** (보내면 400 `N006`) |

투표가 없는 공지에 `poll` 객체를 보내면 새 투표를 붙입니다 (N-3 의 `poll` 규칙과 같음).

```json
{ "pinnedUntilOn": null }
```

```json
{ "body": "장소가 정해졌어요. …", "resetReads": true, "poll": { "closesAt": "2026-11-21T09:00:00Z" } }
```

```json
{ "poll": { "closeNow": true } }
```

**응답** `200 OK` — N-2 와 같은 상세

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `N001` | 공지가 없음 |
| 403 | `C003` | 작성자 · `content-manage` 가 아님, 또는 `content-manage` 가 `poll` 을 바꾸려 함 |
| 409 | `N002` | 새로 고정하려는데 이미 3개 |
| 400 | `N003` | 고정 기한이 오늘보다 앞 |
| 400 | `N015` | 필독이 아닌데 `resetReads` |
| 409 | `N005` | 표가 들어온 뒤 마감 시각 말고 다른 투표 값을 바꾸려 함 |
| 400 | `N006` | `poll.anonymous` 를 보냄 |
| 409 | `N016` | 표가 들어온 투표를 지우려 함 (`poll: null`) |
| 409 | `N007` | 이미 마감된 투표의 마감 시각을 바꾸거나 다시 마감하려 함 |
| 400 | `N012`, `N013`, `N014`, `N017` | N-3 과 같음 |

---

### N-5. 공지 지우기

`DELETE /api/v1/notices/{noticeId}`

| 항목 | 내용 |
|------|------|
| 권한 | 작성자, `content-manage` |
| 요구사항 | COM-1-15 |
| 테이블 | `notices` (소프트 삭제), `comments` (comment API 로 함께 소프트 삭제), `files.purge_at` (+30일) |
| 감사 로그 | 다른 사람의 공지를 지우면 `CONTENT_DELETED` |

**경로 파라미터** — `noticeId` (number)

**응답** `200 OK`

```json
{ "success": true, "data": null, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `N001` | 공지가 없거나 이미 지워짐 |
| 403 | `C003` | 작성자 · `content-manage` 가 아님 |

---

### N-6. 투표하기 · 선택 바꾸기

`PUT /api/v1/notices/{noticeId}/poll/my-vote`

| 항목 | 내용 |
|------|------|
| 권한 | 투표 대상 (재실 + `audienceMemberTypes` 에 맞는 구분) |
| 요구사항 | COM-1-10, COM-1-12 |
| 테이블 | 기명: `poll_participants` + `poll_votes` (바꿀 때 내 행을 지우고 새로). 익명: `poll_participants` 추가 + `poll_options.anonymous_vote_count` 증가를 **한 트랜잭션**에서. `poll_votes` 에는 쓰지 않음 |

**경로 파라미터** — `noticeId` (number)

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `optionIds` | number[] | O | 1개 이상. 단일 선택이면 1개, 복수면 `maxChoices` 이하. 중복 불가 |

```json
{ "optionIds": [41, 42] }
```

**응답** `200 OK` — 바뀐 `Poll` (N-2 의 `poll` 과 같은 모양)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `N001` | 공지가 없음 |
| 404 | `N004` | 이 공지에 투표가 없음 |
| 403 | `N008` | 투표 대상이 아님 |
| 409 | `N007` | 마감됨 (마감 시각이 지났거나 일찍 마감) — 수용 기준 "서버에서 거절" |
| 409 | `N009` | 익명 투표에 이미 투표함 (바꿀 수 없음) |
| 400 | `N010` | 고른 개수가 단일 · `maxChoices` 를 넘음 |
| 400 | `N011` | 이 투표의 선택지가 아닌 ID |

---

## 2. 캘린더 — COM-4

### API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| CL-1 | GET | `/calendar-events` | 로그인 | 기간 안의 일정을 회차로 펼쳐 줌 (공용 · 내 개인 · 구성원 공유) |
| CL-2 | GET | `/calendar-events/{eventId}` | 볼 수 있음 | 일정 상세 (한 회차) |
| CL-3 | POST | `/calendar-events` | 로그인 | 일정 만들기 (공용 · 개인) |
| CL-4 | PATCH | `/calendar-events/{eventId}` | 공용: 만든 사람 · `calendar-manage` / 개인: 본인 | 고치기 (반복은 이 일정만 · 이후 모두 · 모두) |
| CL-5 | DELETE | `/calendar-events/{eventId}` | 같음 | 지우기 (같은 범위) |
| CL-6 | GET | `/calendar-settings/me` | 본인 | 내 캘린더 보기 설정 |
| CL-7 | PUT | `/calendar-settings/me` | 본인 | 내 캘린더 보기 설정 저장 |

- 월 · 주 · 일 · 목록 보기(COM-4-06)는 모두 CL-1 하나로 그립니다. 보기 방식은 화면이 정합니다 (규칙 1).
- 모임 날짜 정하기 화면의 "내 개인 일정 겹쳐 보기"(COM-3-03)도 CL-1 을 `layers=PERSONAL` 로 부릅니다. 따로 API 를 두지 않습니다.
- 작업 기한 · 마일스톤(COM-4-09)은 calendar 가 project 를 모르게 하려고([README R3](README.md#31-모듈-의존이-순환함-설계-수정-필요)) 작업 기한은 `GET /tasks?mine=true&dueFrom=&dueTo=`, 마일스톤은 `GET /milestones` 를 화면이 따로 불러 겹칩니다 → [31 · 작업](31-task.md).
- "이 날 회의록 만들기"(COM-4-11)는 회의록 API 가 `calendarEventId` 를 받아 채웁니다 → [32 · 회의록](32-minute-report.md).

### 비공개 프로젝트에 연결된 공용 일정 (제안)

SRS 에 규칙이 없습니다. 공용 일정의 제목에 비공개 프로젝트 내용이 드러날 수 있으므로, **`projectId` 가 비공개 프로젝트면 그 프로젝트를 볼 수 있는 사람에게만** 보이게 하는 것을 제안합니다.
calendar 는 `projectId` 만 저장하고, 볼 수 있는지는 project 모듈이 구현하는 정책 빈(`CalendarProjectVisibility`, comment 의 `CommentTargetPolicy` 와 같은 방식)에 묻습니다. 볼 수 없으면 CL-1 에서 빠지고 CL-2 는 404 입니다.

### `Occurrence` 모양 (CL-1 응답)

| 필드 | 타입 | 언제 빠짐 | 설명 |
|------|------|-----------|------|
| `eventId` | number | | |
| `occurrenceStartsAt` | string | | 이 회차의 **원래** 시작 시각 (반복 회차를 가리키는 값. CL-2 · CL-4 · CL-5 의 `occurrence`) |
| `layer` | string | | `SHARED` 공용, `PERSONAL` 내 개인, `MEMBER_SHARED` 다른 구성원이 공유한 개인 일정 |
| `title` | string | **`busyOnly = true` 면 빠짐** | 제목 |
| `busyOnly` | boolean | | "바쁨"으로만 공유한 개인 일정 (COM-4-04). 화면은 `이름: 바쁨` |
| `owner` | MemberRef | `SHARED` 면 빠짐 | `MEMBER_SHARED` 는 `이름: 제목` 표시용 |
| `eventTypeCode` | string \| null | | 공용만. 공통코드 `CALENDAR_EVENT_TYPE` |
| `color` | string \| null | | 일정 종류의 색 (공통코드 `ref1`) |
| `allDay` | boolean | | |
| `startsAt`, `endsAt` | string | | 이 회차의 실제 시각 (예외로 바뀌었으면 바뀐 값) |
| `startsOn`, `endsOn` | string | 하루 종일이 아니면 빠짐 | 하루 종일 일정의 날짜 (끝 날짜 포함) |
| `location` | string \| null | `MEMBER_SHARED` 면 빠짐 | 장소 |
| `recurring` | boolean | | 반복 일정의 회차인지 |
| `modified` | boolean | | "이 일정만" 바뀐 회차인지 |
| `attendeeCount` | number | `SHARED` 가 아니면 빠짐 | 참석자 수 |
| `attending` | boolean | `SHARED` 가 아니면 빠짐 | 내가 참석자인지 |
| `projectId` | number \| null | `MEMBER_SHARED` 면 빠짐 | 연결 프로젝트 (이름은 화면이 프로젝트 API 로) |

`MEMBER_SHARED` 는 설명 · 장소 · 온라인 링크 · 참석자를 **응답에 넣지 않습니다** (COM-4-04). `busyOnly` 면 제목도 넣지 않습니다 (COM-4 수용 기준).

---

### CL-1. 일정 조회 (기간)

`GET /api/v1/calendar-events`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | COM-4-03, 04, 05, 06, 07, 12, 13 |
| 테이블 | `calendar_events` (`idx_calendar_events_shared`, `idx_calendar_events_owner`, `idx_calendar_events_recur`), `calendar_event_exceptions`, `calendar_event_attendees`, `member_calendar_settings`, `common_code_details`(색) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `from` | string (날짜) | O | 시작 날짜 (KST, 포함) |
| `to` | string (날짜) | O | 끝 날짜 (KST, 포함). `from` 이후, **최대 92일** |
| `layers` | string (쉼표) | X | `SHARED`, `PERSONAL`, `MEMBER_SHARED` 중. 빼면 내 설정(CL-6)을 따름: `showShared = false` 면 `SHARED` 빠짐, `showMemberEvents = false` 면 `MEMBER_SHARED` 빠짐 |
| `attendingOnly` | boolean | X | 공용 일정 중 내가 참석자인 것만 (COM-4-03). 빼면 내 설정의 `sharedScope` |
| `eventTypes` | string (쉼표) | X | 일정 종류 코드로 거르기 (공용만, COM-4-07) |
| `projectId` | number | X | 그 프로젝트에 연결된 공용 일정만 (COM-4-07). 볼 수 없는 프로젝트면 빈 목록 |

- 기간으로 범위가 정해지므로 **페이지로 나누지 않습니다** (NFR-PER-03 의 예외. 대신 92일 제한).
- 반복 일정은 서버가 RRULE 을 펼치고 `calendar_event_exceptions` 를 적용해 회차마다 한 항목으로 줍니다.
- 졸업 · 퇴실 구성원의 개인 일정은 `MEMBER_SHARED` 에서 뺍니다 (COM-4-13).

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `from`, `to` | string | 요청 기간 |
| `occurrences` | Occurrence[] | 시작 시각 순 |

```json
{
  "success": true,
  "data": {
    "from": "2026-11-01", "to": "2026-12-06",
    "occurrences": [
      { "eventId": 31, "occurrenceStartsAt": "2026-11-19T01:00:00Z", "layer": "SHARED",
        "title": "코드 리뷰 세미나", "busyOnly": false, "eventTypeCode": "SEMINAR", "color": "#7C3AED",
        "allDay": false, "startsAt": "2026-11-19T01:00:00Z", "endsAt": "2026-11-19T03:00:00Z",
        "location": "세미나실", "recurring": false, "modified": false,
        "attendeeCount": 9, "attending": true, "projectId": null },
      { "eventId": 77, "occurrenceStartsAt": "2026-11-19T06:00:00Z", "layer": "MEMBER_SHARED",
        "busyOnly": true, "owner": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
        "eventTypeCode": null, "color": null, "allDay": false,
        "startsAt": "2026-11-19T06:00:00Z", "endsAt": "2026-11-19T07:00:00Z", "recurring": false, "modified": false },
      { "eventId": 52, "occurrenceStartsAt": "2026-11-20T15:00:00Z", "layer": "SHARED",
        "title": "KCC 초록 마감", "busyOnly": false, "eventTypeCode": "DEADLINE", "color": "#DC2626",
        "allDay": true, "startsAt": "2026-11-20T15:00:00Z", "endsAt": "2026-11-21T15:00:00Z",
        "startsOn": "2026-11-21", "endsOn": "2026-11-21",
        "location": null, "recurring": false, "modified": false, "attendeeCount": 0, "attending": false, "projectId": 2 }
    ]
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `CL011` | 기간이 92일을 넘거나 `to` 가 `from` 보다 앞 |

---

### CL-2. 일정 상세

`GET /api/v1/calendar-events/{eventId}`

| 항목 | 내용 |
|------|------|
| 권한 | 볼 수 있음: 공용 = 로그인 (비공개 프로젝트 연결이면 그 프로젝트를 볼 수 있는 사람, 제안), 개인 = 주인. 공유된 개인 일정은 CL-1 의 공유 내용만 보이므로 상세는 주인만 |
| 요구사항 | COM-4-01, 02, 10 |
| 테이블 | `calendar_events`, `calendar_event_exceptions`, `calendar_event_attendees` |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `eventId` | number | O | |
| `occurrence` | string (시각) | 반복이면 O | 볼 회차의 원래 시작 시각 (`occurrenceStartsAt`) |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `eventId` | number | |
| `calendarType` | string | `SHARED`, `PERSONAL` |
| `eventTypeCode` | string \| null | 공용만 |
| `title` | string | 이 회차 값 |
| `description` | string \| null | Markdown |
| `location` | string \| null | |
| `onlineUrl` | string \| null | |
| `allDay` | boolean | |
| `startsAt`, `endsAt` | string | 이 회차 값 |
| `startsOn`, `endsOn` | string | 하루 종일일 때만 |
| `occurrenceStartsAt` | string \| null | 반복이면 이 회차의 원래 시작 |
| `recurrence` | Recurrence \| null | 아래 (CL-3 요청과 같은 모양) |
| `shareMode` | string \| null | 개인만. `NONE`, `TITLE`, `BUSY` |
| `attendees` | MemberRef[] | 공용만 |
| `projectId` | number \| null | |
| `meetingPollId` | number \| null | 모임 날짜 정하기로 만들어졌으면 |
| `owner` | MemberRef | 만든 사람 (공용) · 주인 (개인) |
| `canEdit` | boolean | 만든 사람 · `calendar-manage` · 주인 |
| `createdAt`, `updatedAt` | string | |

연결된 회의록은 calendar 가 모르므로 화면이 `GET /meeting-minutes?calendarEventId=` 로 따로 부릅니다 ([32](32-minute-report.md)).

```json
{
  "success": true,
  "data": {
    "eventId": 31, "calendarType": "SHARED", "eventTypeCode": "SEMINAR",
    "title": "코드 리뷰 세미나", "description": "발표: 김민서", "location": "세미나실", "onlineUrl": null,
    "allDay": false, "startsAt": "2026-11-19T01:00:00Z", "endsAt": "2026-11-19T03:00:00Z",
    "occurrenceStartsAt": null, "recurrence": null, "shareMode": null,
    "attendees": [ { "memberId": 3, "name": "김민서", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null } ],
    "projectId": null, "meetingPollId": null,
    "owner": { "memberId": 2, "name": "이정훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
    "canEdit": false,
    "createdAt": "2026-11-10T02:00:00Z", "updatedAt": "2026-11-10T02:00:00Z"
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL001` | 일정이 없음 · 지워짐 · 볼 수 없음 (남의 개인 일정 포함) |
| 400 | `CL008` | 반복 일정인데 `occurrence` 가 없음 |
| 404 | `CL009` | 그 시각에 이 일정의 회차가 없음 (취소된 회차 포함) |

---

### CL-3. 일정 만들기

`POST /api/v1/calendar-events`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 (공용 · 개인 모두, COM-4-01, 02) |
| 요구사항 | COM-4-01, 02, 04, 08, 10, 12 |
| 테이블 | `calendar_events`, `calendar_event_attendees` |
| 알림 | 공용 일정 참석자에게 `EVENT_ATTENDEE` (만든 사람 제외) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `calendarType` | string | O | `SHARED`, `PERSONAL`. 만든 뒤 바꿀 수 없음 |
| `eventTypeCode` | string | 공용이면 O | 공통코드 `CALENDAR_EVENT_TYPE` 의 사용 중인 코드. 개인이면 보내지 않음 |
| `title` | string | O | 1~100자 |
| `description` | string \| null | X | Markdown, 5,000자 이하 |
| `location` | string \| null | X | 200자 이하 |
| `onlineUrl` | string \| null | X | http/https, 500자 이하 |
| `allDay` | boolean | O | 하루 종일 |
| `startsAt`, `endsAt` | string (시각) | 하루 종일이 아니면 O | `endsAt` > `startsAt` |
| `startsOn`, `endsOn` | string (날짜) | 하루 종일이면 O | 끝 날짜 포함, `endsOn` ≥ `startsOn`. 서버가 KST 자정 기준 UTC 로 저장 |
| `recurrence` | Recurrence \| null | X | 반복 (아래) |
| `shareMode` | string | 개인이면 O | `NONE`(공유 안 함, 기본), `TITLE`(제목 공개), `BUSY`("바쁨"으로만). 공용이면 보내지 않음 |
| `attendeeIds` | number[] | X | 공용만. 재실 구성원, 중복 불가 |
| `projectId` | number \| null | X | 공용만. 연결 프로젝트 (볼 수 있는 프로젝트여야 함) |

`Recurrence`

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `freq` | string | O | `DAILY`, `WEEKLY`, `MONTHLY` |
| `byDay` | string[] | 매주면 O | `MO`~`SU`, 1개 이상 |
| `byMonthDay` | number | 매월이면 O | 1~31 (그 날이 없는 달은 건너뜀) |
| `until` | string (날짜) | `count` 와 둘 중 하나 | 끝나는 날 (포함) |
| `count` | number | `until` 과 둘 중 하나 | 횟수, 1~200 |

서버는 RRULE(`FREQ=WEEKLY;BYDAY=TU;UNTIL=…`)로 저장하고 `recurrence_until` 을 계산해 둡니다.

```json
{
  "calendarType": "SHARED",
  "eventTypeCode": "MEETING",
  "title": "연구실 주간 회의",
  "description": null,
  "location": "세미나실",
  "onlineUrl": null,
  "allDay": false,
  "startsAt": "2026-11-17T05:00:00Z",
  "endsAt": "2026-11-17T06:00:00Z",
  "recurrence": { "freq": "WEEKLY", "byDay": ["MO"], "until": "2027-02-22" },
  "attendeeIds": [2, 3, 4, 5],
  "projectId": null
}
```

```json
{
  "calendarType": "PERSONAL",
  "title": "치과",
  "allDay": false,
  "startsAt": "2026-11-19T06:00:00Z",
  "endsAt": "2026-11-19T07:00:00Z",
  "shareMode": "BUSY"
}
```

**응답** `201 Created` (`Location: /api/v1/calendar-events/31`) — 본문은 CL-2 와 같은 상세 (반복이면 첫 회차)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `CL002` | 끝이 시작보다 앞이거나 같음, 하루 종일인데 날짜가 아닌 시각을 보냄 (또는 그 반대) |
| 400 | `CL003` | 공용인데 `eventTypeCode` 가 없음 |
| 400 | `CL004` | 없거나 사용 안 함인 일정 종류 |
| 400 | `CL005` | 개인 일정에 `eventTypeCode` · `attendeeIds` · `projectId` 를 보냄, 공용 일정에 `shareMode` 를 보냄 |
| 400 | `CL006` | 개인 일정인데 `shareMode` 가 없음 |
| 400 | `CL007` | 반복 규칙이 맞지 않음 (매주인데 요일 없음, `until` · `count` 둘 다 · 둘 다 없음, 범위 밖) |
| 400 | `CL010` | 참석자에 재실이 아닌 구성원 · 없는 구성원 |
| 404 | `P…` | `projectId` 가 없거나 볼 수 없는 프로젝트 ([30](30-project.md)) |

---

### CL-4. 일정 고치기

`PATCH /api/v1/calendar-events/{eventId}`

| 항목 | 내용 |
|------|------|
| 권한 | 공용: 만든 사람, `calendar-manage`. 개인: 주인 |
| 요구사항 | COM-4-01, 02, 08 |
| 테이블 | `calendar_events`, `calendar_event_exceptions`, `calendar_event_attendees` |
| 알림 | 공용 일정의 시각 · 장소가 바뀌면 참석자에게 `EVENT_CHANGED`. 새로 더한 참석자에게 `EVENT_ATTENDEE` |
| 감사 로그 | `calendar-manage` 로 다른 사람의 공용 일정을 고치면 `CONTENT_EDITED` |

**경로 · 쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `eventId` | number | O | |
| `scope` | string | 반복이면 O | `THIS` 이 일정만, `FOLLOWING` 이후 모든 일정, `ALL` 모든 일정 (COM-4-08). 반복이 아니면 보내지 않음 |
| `occurrence` | string (시각) | `THIS` · `FOLLOWING` 이면 O | 고칠 회차의 원래 시작 시각 |

**요청 본문** — CL-3 의 필드 중 바꿀 것만 (빼면 그대로, `null` 이면 비움). `calendarType` 은 보낼 수 없습니다.

| 범위 | 바꿀 수 있는 필드 | 저장 방식 |
|------|------------------|-----------|
| 반복 아님 · `ALL` | CL-3 의 모든 필드 (`calendarType` 제외) | `calendar_events` 를 고침 |
| `THIS` | `title`, `startsAt`/`endsAt`(또는 `startsOn`/`endsOn`), `location` 만 | `calendar_event_exceptions` 에 `MODIFIED` 행 ([README T7](README.md#32-테이블--컬럼-보완): 설명 · 온라인 링크는 칸이 없어 못 바꿈) |
| `FOLLOWING` | CL-3 의 모든 필드 | 원래 일정의 `recurrence_until` 을 그 회차 앞에서 자르고 새 반복 일정을 만든다 |

```http
PATCH /api/v1/calendar-events/31?scope=THIS&occurrence=2026-11-24T05:00:00Z
```

```json
{ "startsAt": "2026-11-24T07:00:00Z", "endsAt": "2026-11-24T08:00:00Z" }
```

**응답** `200 OK` — 고친 회차의 CL-2 상세 (`FOLLOWING` 이면 새로 만든 일정)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL001` | 일정이 없음 · 볼 수 없음 |
| 403 | `C003` | 고칠 권한 없음 |
| 400 | `CL008` | 반복 일정인데 `scope` 가 없거나, `THIS` · `FOLLOWING` 인데 `occurrence` 가 없음 |
| 404 | `CL009` | 그 회차가 없음 |
| 400 | `CL025` | `THIS` 범위에서 제목 · 시각 · 장소 말고 다른 필드를 보냄 |
| 400 | `CL026` | `calendarType` 을 보냄 |
| 400 | `CL002`~`CL007`, `CL010` | CL-3 과 같음 |

---

### CL-5. 일정 지우기

`DELETE /api/v1/calendar-events/{eventId}`

| 항목 | 내용 |
|------|------|
| 권한 | CL-4 와 같음 |
| 요구사항 | COM-4-01, 02, 08 |
| 테이블 | `calendar_events` (소프트 삭제), `calendar_event_exceptions` (`THIS` 면 `CANCELLED` 행), `FOLLOWING` 이면 `recurrence_until` 자르기 |
| 알림 | 공용 일정이면 참석자에게 `EVENT_CANCELLED`* (README T6 제안) |

**경로 · 쿼리 파라미터** — CL-4 와 같음 (`eventId`, `scope`, `occurrence`)

모임 날짜 정하기로 확정된 일정(`meetingPollId` 가 있음)을 지우면 그 모임은 확정 취소(`OPEN`)로 돌아갑니다.

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL001` | 일정이 없음 |
| 403 | `C003` | 지울 권한 없음 |
| 400 | `CL008` | 반복인데 범위 · 회차가 없음 |
| 404 | `CL009` | 그 회차가 없음 |

---

### CL-6. 내 캘린더 설정 보기

`GET /api/v1/calendar-settings/me`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-4-03, 05, 09 |
| 테이블 | `member_calendar_settings` (행이 없으면 기본값) |

**응답** `200 OK`

| 필드 | 타입 | 기본 | 설명 |
|------|------|------|------|
| `showShared` | boolean | true | 개인 캘린더에 공용 일정 함께 보기 |
| `sharedScope` | string | `ALL` | `ALL`, `ATTENDING_ONLY` (내가 참석자인 것만) |
| `showMemberEvents` | boolean | true | 구성원이 공유한 개인 일정 층 |
| `showTaskDue` | boolean | true | 작업 기한 · 마일스톤 층 (화면이 `GET /tasks` · `GET /milestones` 를 부를지 정함) |

```json
{ "success": true, "data": { "showShared": true, "sharedScope": "ALL", "showMemberEvents": true, "showTaskDue": true }, "error": null }
```

**에러** — 공통만

---

### CL-7. 내 캘린더 설정 저장

`PUT /api/v1/calendar-settings/me`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-4-03, 05, 09 |
| 테이블 | `member_calendar_settings` (없으면 만듦) |

**요청 본문** — CL-6 응답의 네 필드 모두 필수

```json
{ "showShared": true, "sharedScope": "ATTENDING_ONLY", "showMemberEvents": false, "showTaskDue": true }
```

**응답** `200 OK` — CL-6 과 같음

**에러** — 공통만 (`sharedScope` 값이 틀리면 `C001`)

---

## 3. 모임 날짜 정하기 — COM-3

### API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| MP-1 | POST | `/meeting-polls` | 로그인 | 만들기 |
| MP-2 | GET | `/meeting-polls` | 로그인 | 내가 대상이거나 만든 목록 (홈의 "응답 안 한 것") |
| MP-3 | GET | `/meeting-polls/{pollId}` | 대상, 만든 사람 | 정보 + 내 응답 + 결과(히트맵 · 추천 · 미응답) |
| MP-4 | PUT | `/meeting-polls/{pollId}/my-response` | 대상 | 가능한 칸 저장 |
| MP-5 | POST | `/meeting-polls/{pollId}/remind` | 만든 사람 | 안 한 사람에게 알림 다시 보내기 |
| MP-6 | POST | `/meeting-polls/{pollId}/confirm` | 만든 사람 | 시간 확정 → 공용 일정 생성 |
| MP-7 | PATCH | `/meeting-polls/{pollId}` | 만든 사람 | 정보 · 마감 고치기, 확정 취소(`status: OPEN`), 모임 취소(`status: CANCELLED`) |

- 프로젝트 화면에서 만들기(COM-3-09)는 project 모듈의 `POST /projects/{projectKey}/meeting-polls` 가 참여자를 펼쳐 MP-1 과 같은 일을 합니다 → [30 · 프로젝트](30-project.md). 본문 · 응답 · 에러는 MP-1 과 같고 `targets` 대신 프로젝트 참여자가 들어갑니다.
- 응답 화면의 "내 개인 일정 겹쳐 보기"(COM-3-03)는 `GET /calendar-events?from=<첫 후보>&to=<마지막 후보>&layers=SHARED,PERSONAL` 을 씁니다 (CL-1).
- 확정(MP-6)은 공용 일정 · 참석자 · 알림을 만드는 부수 효과가 커서 동작 경로로 둡니다. 확정 취소 · 모임 취소는 상태 바꾸기라 MP-7 의 필드입니다 (규칙 2).

---

### MP-1. 모임 날짜 정하기 만들기

`POST /api/v1/meeting-polls`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | COM-3-01 |
| 테이블 | `meeting_polls`, `meeting_poll_dates`, `meeting_poll_targets` (대상을 구성원 목록으로 펼쳐 저장) |
| 알림 | 대상에게 `MEETING_POLL_REQUEST` (만든 사람 제외) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `title` | string | O | 1~100자 |
| `description` | string \| null | X | 1,000자 이하 |
| `candidateDates` | string[] (날짜) | O | 1~14개, 중복 불가, 연속이 아니어도 됨, 오늘 이후 |
| `dayStartTime` | string (`HH:mm`) | O | 하루 시작 (KST). `slotMinutes` 단위에 맞춤 |
| `dayEndTime` | string (`HH:mm`) | O | 하루 끝 (KST). 시작보다 뒤, 단위에 맞춤 |
| `slotMinutes` | number | O | `30` 또는 `60` |
| `durationMinutes` | number | O | 30 단위, 30 이상, 하루 범위 이하 |
| `location` | string \| null | X | 200자 이하 |
| `onlineUrl` | string \| null | X | http/https, 500자 이하 |
| `closesAt` | string (시각) | O | 응답 마감, 지금 이후 |
| `targets` | object | O | 참여 대상. 아래 셋의 **합집합**을 재실 구성원으로 펼침 |
| `targets.all` | boolean | O | 전체 재실 구성원 |
| `targets.memberTypes` | string[] | X | 구분 (`PROFESSOR`, `STUDENT`, `INTERN`) |
| `targets.memberIds` | number[] | X | 직접 고른 구성원 |

만든 사람은 대상으로 고르지 않으면 대상이 아닙니다 (결과 보기 · 확정만 함).

```json
{
  "title": "DEFME 중간 점검 회의",
  "description": null,
  "candidateDates": ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"],
  "dayStartTime": "10:00",
  "dayEndTime": "19:00",
  "slotMinutes": 60,
  "durationMinutes": 120,
  "location": "세미나실",
  "onlineUrl": "https://zoom.us/j/…",
  "closesAt": "2026-11-19T09:00:00Z",
  "targets": { "all": false, "memberTypes": [], "memberIds": [3, 4, 5, 6, 7, 8, 11, 12] }
}
```

**응답** `201 Created` (`Location: /api/v1/meeting-polls/9`) — 본문은 MP-3 과 같은 상세

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `CL017` | 후보 날짜가 0개 · 15개 이상 · 중복 · 오늘보다 앞 |
| 400 | `CL018` | 하루 시작 ≥ 끝, 시각이 칸 단위에 맞지 않음, `slotMinutes` 가 30 · 60 이 아님 |
| 400 | `CL019` | 모임 길이가 30 단위가 아니거나 하루 범위보다 김 |
| 400 | `CL024` | 응답 마감이 지금보다 앞 |
| 400 | `CL020` | 펼친 대상이 0명 |
| 400 | `CL010` | `memberIds` 에 재실이 아닌 · 없는 구성원 |

---

### MP-2. 모임 날짜 정하기 목록

`GET /api/v1/meeting-polls`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인. **내가 대상이거나 만든 것만** 나옴 |
| 요구사항 | COM-3-10 |
| 테이블 | `meeting_polls` (`idx_meeting_polls_status`), `meeting_poll_targets` |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string (쉼표) | X | `OPEN`, `CONFIRMED`, `CANCELLED`. 기본 `OPEN` |
| `pendingMine` | boolean | X | 내가 대상인데 아직 응답 안 한 것만 (홈 "꼭 확인할 것", COM-3-10) |
| `page`, `size` | number | X | |

**응답** `200 OK` — `PageResponse<MeetingPollSummary>`, 마감이 가까운 순

| 필드 | 타입 | 설명 |
|------|------|------|
| `pollId` | number | |
| `title` | string | |
| `creator` | MemberRef | |
| `status` | string | |
| `closesAt` | string | |
| `targetCount`, `respondedCount` | number | "응답 5/8명" |
| `iAmTarget` | boolean | |
| `iResponded` | boolean | |
| `projectId` | number \| null | |
| `confirmedStartsAt` | string \| null | |

```json
{
  "success": true,
  "data": {
    "content": [
      { "pollId": 9, "title": "DEFME 중간 점검 회의 시간 정하기",
        "creator": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
        "status": "OPEN", "closesAt": "2026-11-19T09:00:00Z", "targetCount": 8, "respondedCount": 5,
        "iAmTarget": true, "iResponded": false, "projectId": 1, "confirmedStartsAt": null }
    ],
    "page": 0, "size": 20, "totalElements": 1, "totalPages": 1, "hasNext": false
  },
  "error": null
}
```

**에러** — 공통만

---

### MP-3. 모임 날짜 정하기 상세 · 결과

`GET /api/v1/meeting-polls/{pollId}`

| 항목 | 내용 |
|------|------|
| 권한 | 대상, 만든 사람 (그 밖은 404) |
| 요구사항 | COM-3-04, 05, 06 |
| 테이블 | `meeting_polls`, `meeting_poll_dates`, `meeting_poll_targets`, `meeting_poll_slots` (결과 = `GROUP BY slot_starts_at`) |

**경로 파라미터** — `pollId` (number)

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `pollId`, `title`, `description`, `location`, `onlineUrl` | | MP-1 값 |
| `candidateDates` | string[] | |
| `dayStartTime`, `dayEndTime` | string | `HH:mm` KST |
| `slotMinutes`, `durationMinutes` | number | |
| `closesAt` | string | |
| `closed` | boolean | 응답 마감이 지남 |
| `status` | string | `OPEN`, `CONFIRMED`, `CANCELLED` |
| `creator` | MemberRef | |
| `projectId` | number \| null | |
| `iAmTarget` | boolean | |
| `mySlots` | string[] | 내가 가능으로 칠한 칸의 시작 시각 (대상일 때만) |
| `targets[]` | object[] | `{ member: MemberRef, respondedAt, remindedAt }` — 미응답 명단(COM-3-06)은 `respondedAt = null` 인 것 |
| `targetCount`, `respondedCount` | number | |
| `slots[]` | object[] | 한 명 이상 가능한 칸만. `{ startsAt, count, availableMemberIds }` — 히트맵 · 마우스 올리면 명단 (COM-3-04). 불가 명단 = 응답한 대상 − `availableMemberIds` (화면 계산) |
| `recommendations[]` | object[] | 상위 5개 (COM-3-05). `{ startsAt, endsAt, availableCount, respondedCount, unavailableMemberIds }`. 모임 길이만큼 이어진 칸에서 모두 가능한 사람이 많은 순, 같으면 이른 순 |
| `confirmed` | object \| null | `{ startsAt, endsAt, eventId }` |

```json
{
  "success": true,
  "data": {
    "pollId": 9, "title": "DEFME 중간 점검 회의", "description": null,
    "location": "세미나실", "onlineUrl": "https://zoom.us/j/…",
    "candidateDates": ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"],
    "dayStartTime": "10:00", "dayEndTime": "19:00", "slotMinutes": 60, "durationMinutes": 120,
    "closesAt": "2026-11-19T09:00:00Z", "closed": false, "status": "OPEN",
    "creator": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
    "projectId": 1, "iAmTarget": true,
    "mySlots": ["2026-11-26T05:00:00Z", "2026-11-26T06:00:00Z"],
    "targets": [
      { "member": { "memberId": 11, "name": "한유진", "memberType": "INTERN", "status": "ACTIVE", "photoUrl": null },
        "respondedAt": null, "remindedAt": null }
    ],
    "targetCount": 8, "respondedCount": 6,
    "slots": [ { "startsAt": "2026-11-26T05:00:00Z", "count": 6, "availableMemberIds": [3, 4, 5, 6, 7, 8] } ],
    "recommendations": [
      { "startsAt": "2026-11-26T05:00:00Z", "endsAt": "2026-11-26T07:00:00Z",
        "availableCount": 6, "respondedCount": 6, "unavailableMemberIds": [] }
    ],
    "confirmed": null
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL012` | 없거나, 대상 · 만든 사람이 아님 |

---

### MP-4. 내 응답 저장

`PUT /api/v1/meeting-polls/{pollId}/my-response`

| 항목 | 내용 |
|------|------|
| 권한 | 대상 |
| 요구사항 | COM-3-02, 08 |
| 테이블 | `meeting_poll_slots` (내 행을 지우고 새로), `meeting_poll_targets.responded_at` |

**경로 파라미터** — `pollId` (number)

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `slotStarts` | string[] (시각) | O | 가능한 칸의 시작 시각. 칠하지 않은 칸은 불가(기본). **빈 목록도 응답으로 기록**. 각 값은 후보 날짜 · 하루 범위 안, 칸 단위에 맞아야 함 |

```json
{ "slotStarts": ["2026-11-26T05:00:00Z", "2026-11-26T06:00:00Z", "2026-11-26T07:00:00Z"] }
```

**응답** `200 OK` — MP-3 과 같은 상세 (결과가 바로 바뀌어 보이게)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL012` | 없음 · 볼 수 없음 |
| 403 | `CL013` | 대상이 아님 (만든 사람이지만 대상이 아닌 경우) |
| 409 | `CL014` | 확정 · 취소된 모임 (COM-3-08) |
| 409 | `CL015` | 응답 마감이 지남 |
| 400 | `CL016` | 후보 날짜 · 하루 범위 밖이거나 칸 단위에 맞지 않는 칸 |

---

### MP-5. 알림 다시 보내기

`POST /api/v1/meeting-polls/{pollId}/remind`

| 항목 | 내용 |
|------|------|
| 권한 | 만든 사람 |
| 요구사항 | 화면 ("알림 다시 보내기") |
| 테이블 | `meeting_poll_targets.reminded_at` |
| 알림 | `MEETING_POLL_REQUEST` 를 다시 보냄 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `memberIds` | number[] | X | 보낼 미응답 대상. 빈 목록 · 생략이면 미응답 전원 |

```json
{ "memberIds": [11] }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `remindedCount` | number | 실제로 보낸 수 (이미 응답했거나 1시간 안에 보낸 사람은 뺌) |

```json
{ "success": true, "data": { "remindedCount": 1 }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL012` | 없음 |
| 403 | `C003` | 만든 사람이 아님 |
| 409 | `CL014` | 확정 · 취소된 모임 |
| 409 | `CL023` | 고른 사람 모두 1시간 안에 이미 보냄 (SRS 에 없음, 알림 남발 방지 제안) |

---

### MP-6. 시간 확정

`POST /api/v1/meeting-polls/{pollId}/confirm`

| 항목 | 내용 |
|------|------|
| 권한 | 만든 사람 |
| 요구사항 | COM-3-07, 08, 09 |
| 테이블 | `meeting_polls` (`status = CONFIRMED`, `confirmed_starts_at`, `confirmed_event_id`), `calendar_events` (공용, 종류 `MEETING`, `meeting_poll_id`, `project_id`), `calendar_event_attendees` (= 모든 대상) |
| 알림 | 대상에게 `MEETING_POLL_CONFIRMED` (참석자 추가 알림 `EVENT_ATTENDEE` 는 따로 보내지 않음) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `startsAt` | string (시각) | O | 후보 칸의 시작. `startsAt + durationMinutes` 가 그날 하루 범위 안 |

응답 마감 전에도 확정할 수 있습니다 (만든 사람의 판단).

```json
{ "startsAt": "2026-11-26T05:00:00Z" }
```

**응답** `200 OK` — MP-3 상세 (`status: CONFIRMED`, `confirmed.eventId` 채워짐)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL012` | 없음 |
| 403 | `C003` | 만든 사람이 아님 |
| 409 | `CL014` | 이미 확정 · 취소됨 |
| 400 | `CL021` | 후보 칸의 시작이 아니거나 모임 길이가 하루 범위를 넘음 |

---

### MP-7. 고치기 · 확정 취소 · 모임 취소

`PATCH /api/v1/meeting-polls/{pollId}`

| 항목 | 내용 |
|------|------|
| 권한 | 만든 사람 |
| 요구사항 | COM-3-08 |
| 테이블 | `meeting_polls`, `calendar_events` (확정 취소 · 모임 취소면 만든 일정을 지움) |
| 알림 | 확정 취소 · 모임 취소면 대상에게 `EVENT_CANCELLED`* |

**요청 본문** — 모두 선택 (빼면 그대로)

| 필드 | 타입 | 규칙 · 설명 |
|------|------|-------------|
| `title` | string | 1~100자 |
| `description` | string \| null | 1,000자 이하 |
| `location` | string \| null | 200자 이하 |
| `onlineUrl` | string \| null | http/https, 500자 |
| `closesAt` | string | 지금 이후 (`OPEN` 일 때만) |
| `status` | string | `OPEN`: `CONFIRMED` → 확정 취소 (만든 일정 지우고 다시 응답 받음). `CANCELLED`: `OPEN` · `CONFIRMED` → 모임 취소 (일정 있으면 지움). 그 밖의 이동은 거절 |

후보 날짜 · 시간 범위 · 칸 단위 · 대상은 응답과 맞지 않게 되므로 바꿀 수 없습니다 (SRS 에 고치기 요구사항 없음).

```json
{ "status": "OPEN" }
```

**응답** `200 OK` — MP-3 상세

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `CL012` | 없음 |
| 403 | `C003` | 만든 사람이 아님 |
| 409 | `CL022` | 허용되지 않는 상태 이동 (취소된 모임 다시 열기, `OPEN` → `OPEN` 등) |
| 400 | `CL024` | 마감이 지금보다 앞 |
| 400 | `CL027` | 후보 날짜 · 시간 범위 · 칸 단위 · 대상 필드를 보냄 |

---

## 4. 알림 — COM-5

### API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| NT-1 | GET | `/notifications` | 본인 | 내 알림 목록 (필터) |
| NT-2 | GET | `/notifications/unread-count` | 본인 | 안 읽은 수 (종 모양, 1분 이하 주기로 부름) |
| NT-3 | POST | `/notifications/read` | 본인 | 읽음 처리 (고른 것 또는 필터 안 전부) |
| NT-4 | GET | `/notifications/settings` | 본인 | 알림 받기 설정 (묶음별) |
| NT-5 | PUT | `/notifications/settings` | 본인 | 알림 받기 설정 저장 |

- 헤더 알림 미리보기와 알림 화면은 같은 NT-1 을 씁니다 (미리보기는 `size=5`).
- NT-2 를 NT-1 에서 떼어 둔 이유: 모든 화면이 1분마다 부르므로(COM-5-03, NFR-PER-04) 숫자 하나만 읽는 가벼운 조회가 필요합니다.
- 하나 읽음 · 모두 읽음은 NT-3 하나로 합니다 (defme 알림 읽음 API 와 같은 방식: 대상을 비우면 전부).

### 화면 필터 ↔ 알림 종류

| 필터 | `NotificationType` |
|------|--------------------|
| `ALL` | 전부 |
| `UNREAD` | 전부 중 안 읽은 것 |
| `MENTION` | `MENTIONED` |
| `TASK` | `TASK_ASSIGNED`, `TASK_WATCH`, `TASK_DUE`, `MINUTE_ACTION_ASSIGNED`, `PROJECT_MEMBER_ADDED`, `THREAD_REPLY`* |
| `NOTICE_CALENDAR` | `NOTICE_MUST_READ`, `POLL_OPENED`, `POLL_CLOSING`, `NOTICE_COMMENT`, `MEETING_POLL_REQUEST`, `MEETING_POLL_CLOSING`, `MEETING_POLL_CONFIRMED`, `EVENT_ATTENDEE`, `EVENT_CHANGED`, `EVENT_CANCELLED`*, `REPORT_DUE`, `REPORT_COMMENT`, `REPORT_CONFIRMED`* |
| `ACCESS` | `ACCESS_REQUEST`, `ACCESS_RESULT`, `ACCESS_EXPIRING`, `SIGNUP_REQUEST`, `VAULT_PATH_REQUEST`*, `GITHUB_LINK_REQUEST`*, `GITHUB_UNLINKED`*, `JOB_FAILED`* |

`*` 는 테이블 설계에 없어 더하자고 제안했던 종류입니다 ([README T6](README.md#32-테이블--컬럼-보완)). notification 모듈에 반영했습니다.

### 설정 묶음 (05 · 내 프로필의 "알림 받기" 6줄)

저장은 `member_notification_settings` 에 **종류별 행으로 펼쳐** 합니다. 행이 없는 종류는 받음(기본)입니다.

| 묶음 (`group`) | 화면 이름 | 종류 | 끌 수 있음 |
|----------------|-----------|------|-----------|
| `MUST_READ_NOTICE` | 필독 공지 | `NOTICE_MUST_READ` | X |
| `ACCESS` | 권한 변경 · 신청 결과 | `ACCESS_*`, `SIGNUP_REQUEST`, `VAULT_PATH_REQUEST`*, `GITHUB_LINK_REQUEST`*, `GITHUB_UNLINKED`*, `JOB_FAILED`* | X |
| `TASK_ASSIGN_MENTION` | 작업 배정 · @멘션 | `TASK_ASSIGNED`, `MENTIONED`, `MINUTE_ACTION_ASSIGNED`, `PROJECT_MEMBER_ADDED` | O |
| `TASK_WATCH` | 구독한 작업 변경 | `TASK_WATCH`, `TASK_DUE`, `THREAD_REPLY`* | O |
| `SCHEDULE_POLL` | 모임 날짜 · 투표 마감 | `POLL_OPENED`, `POLL_CLOSING`, `MEETING_POLL_*`, `EVENT_ATTENDEE`, `EVENT_CHANGED`, `EVENT_CANCELLED`*, `REPORT_DUE` | O |
| `COMMENT` | 공지 댓글 | `NOTICE_COMMENT`, `REPORT_COMMENT`, `REPORT_CONFIRMED`* | O |

`GITHUB_*`, `JOB_FAILED` 는 관리 알림이라 끌 수 없게 `ACCESS` 묶음에 넣는 것을 제안합니다.

---

### NT-1. 내 알림 목록

`GET /api/v1/notifications`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (받는 사람 = 나) |
| 요구사항 | COM-5-01, 02, 05 |
| 테이블 | `notifications` (`idx_notifications_recipient`) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `filter` | string | X | 위 표. 기본 `ALL` |
| `page`, `size` | number | X | 최신 순 (`updated_at` — 묶인 알림은 마지막으로 묶인 시각) |

**응답** `200 OK` — `PageResponse<NotificationItem>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `notificationId` | number | |
| `type` | string | `NotificationType` |
| `title` | string | 보낼 때 만든 제목 ("박지훈 님이 DEFME-44 에서 나를 멘션했어요"). 이름이 제목 안에 들어 있다 |
| `body` | string \| null | 한 줄 요약 (멘션된 댓글 첫 줄 등) |
| `actorMemberId` | number \| null | 일으킨 사람. notification 은 member 를 모르므로 이름 · 사진은 주지 않는다 (아래 참고) |
| `target` | object | `{ type, id, url }` — `url` 은 서버가 만든 화면 주소 (`/projects/DEFME/tasks/DEFME-44`). 누르면 이동 (COM-5-02) |
| `groupCount` | number | 묶인 건수 (기본 1, "외 변경 2건" → 3) |
| `readAt` | string \| null | |
| `createdAt`, `updatedAt` | string | |

```json
{
  "success": true,
  "data": {
    "content": [
      { "notificationId": 501, "type": "MENTIONED",
        "title": "박지훈 님이 DEFME-44 에서 나를 멘션했어요",
        "body": "미등록 돌아갈 주소일 때 응답 코드만 한 번 더 확인할게요.",
        "actorMemberId": 4,
        "target": { "type": "TASK", "id": "DEFME-44", "url": "/projects/DEFME/tasks/DEFME-44" },
        "groupCount": 1, "readAt": null,
        "createdAt": "2026-11-18T01:40:00Z", "updatedAt": "2026-11-18T01:40:00Z" },
      { "notificationId": 498, "type": "TASK_WATCH",
        "title": "DEFME-44 가 검토로 옮겨졌어요", "body": "구독한 작업 · 외 변경 2건",
        "actorMemberId": 4,
        "target": { "type": "TASK", "id": "DEFME-44", "url": "/projects/DEFME/tasks/DEFME-44" },
        "groupCount": 3, "readAt": null,
        "createdAt": "2026-11-18T00:55:00Z", "updatedAt": "2026-11-18T00:59:00Z" }
    ],
    "page": 0, "size": 20, "totalElements": 2, "totalPages": 1, "hasNext": false
  },
  "error": null
}
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `NT004` | 알 수 없는 `filter` |

---

### NT-2. 안 읽은 알림 수

`GET /api/v1/notifications/unread-count`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-5-03, NFR-PER-04 |
| 테이블 | `notifications` (`idx_notifications_recipient (recipient_member_id, read_at, …)` 로 숫자만) |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `count` | number | 안 읽은 알림 수 (묶인 알림은 1개로 셈) |

```json
{ "success": true, "data": { "count": 5 }, "error": null }
```

**에러** — 공통만. 세션이 끝났으면 `C002` (화면은 로그인으로 보냄)

---

### NT-3. 읽음 처리

`POST /api/v1/notifications/read`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-5-01 |
| 테이블 | `notifications.read_at` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `notificationIds` | number[] | X | 읽음 처리할 알림. 100개 이하. **비우거나 빼면 `filter` 안의 안 읽은 알림 전부** ("모두 읽음") |
| `filter` | string | X | `notificationIds` 가 비었을 때만 씀. 기본 `ALL` |

내 알림이 아닌 ID 는 조용히 건너뜁니다 (남의 알림이 있는지 알려 주지 않음).

```json
{ "notificationIds": [501] }
```

```json
{ "filter": "TASK" }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `updatedCount` | number | 이번에 읽음이 된 수 |
| `unreadCount` | number | 남은 안 읽은 수 (종 모양 숫자 바로 갱신) |

```json
{ "success": true, "data": { "updatedCount": 1, "unreadCount": 4 }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `NT004` | 알 수 없는 `filter` |
| 400 | `NT005` | `notificationIds` 가 100개를 넘음 |

---

### NT-4. 알림 받기 설정 보기

`GET /api/v1/notifications/settings`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-5-04 |
| 테이블 | `member_notification_settings` |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `groups[]` | object[] | 위 "설정 묶음" 표 순서 |
| `groups[].group` | string | 묶음 코드 |
| `groups[].label` | string | 화면 이름 |
| `groups[].enabled` | boolean | 받기. 묶음 안 종류가 하나라도 꺼져 있으면 false |
| `groups[].mandatory` | boolean | 끌 수 없음 (필독 공지 · 권한) |

```json
{
  "success": true,
  "data": {
    "groups": [
      { "group": "MUST_READ_NOTICE", "label": "필독 공지", "enabled": true, "mandatory": true },
      { "group": "ACCESS", "label": "권한 변경 · 신청 결과", "enabled": true, "mandatory": true },
      { "group": "TASK_ASSIGN_MENTION", "label": "작업 배정 · @멘션", "enabled": true, "mandatory": false },
      { "group": "TASK_WATCH", "label": "구독한 작업 변경", "enabled": false, "mandatory": false },
      { "group": "SCHEDULE_POLL", "label": "모임 날짜 · 투표 마감", "enabled": true, "mandatory": false },
      { "group": "COMMENT", "label": "공지 댓글", "enabled": true, "mandatory": false }
    ]
  },
  "error": null
}
```

**에러** — 공통만

---

### NT-5. 알림 받기 설정 저장

`PUT /api/v1/notifications/settings`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | COM-5-04 |
| 테이블 | `member_notification_settings` (묶음의 종류마다 행을 만들거나 고침) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `groups[]` | object[] | O | 바꿀 묶음만 보내도 됨 |
| `groups[].group` | string | O | 묶음 코드 |
| `groups[].enabled` | boolean | O | `mandatory` 묶음에 false 를 보내면 거절 |

```json
{ "groups": [ { "group": "TASK_WATCH", "enabled": false } ] }
```

**응답** `200 OK` — NT-4 와 같음

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `NT002` | 알 수 없는 묶음 코드 |
| 400 | `NT003` | 끌 수 없는 묶음을 끄려 함 |

---

## 5. 에러 코드

### notice (`N`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `N001` | `NOTICE_NOT_FOUND` | 공지를 찾을 수 없어요. |
| 409 | `N002` | `PIN_LIMIT_EXCEEDED` | 상단 고정은 3개까지 할 수 있어요. 다른 공지의 고정을 먼저 풀어 주세요. |
| 400 | `N003` | `PIN_UNTIL_IN_PAST` | 고정 기한은 오늘 이후로 골라 주세요. |
| 404 | `N004` | `POLL_NOT_FOUND` | 이 공지에는 투표가 없어요. |
| 409 | `N005` | `POLL_LOCKED_AFTER_VOTE` | 표가 들어온 뒤에는 마감 시각만 바꿀 수 있어요. |
| 400 | `N006` | `POLL_ANONYMOUS_IMMUTABLE` | 익명 여부는 투표를 만든 뒤 바꿀 수 없어요. |
| 409 | `N007` | `POLL_CLOSED` | 마감된 투표예요. |
| 403 | `N008` | `POLL_NOT_AUDIENCE` | 이 투표의 대상이 아니에요. |
| 409 | `N009` | `ANONYMOUS_VOTE_FINAL` | 익명 투표는 한 번 투표하면 바꿀 수 없어요. |
| 400 | `N010` | `POLL_CHOICE_COUNT_EXCEEDED` | 고를 수 있는 개수를 넘었어요. |
| 400 | `N011` | `POLL_OPTION_INVALID` | 이 투표의 선택지가 아니에요. |
| 400 | `N012` | `POLL_OPTIONS_INVALID` | 선택지는 2~20개, 각 50자 이하로 서로 다르게 입력해 주세요. |
| 400 | `N013` | `POLL_CLOSES_AT_IN_PAST` | 투표 마감은 지금 이후로 골라 주세요. |
| 400 | `N014` | `ATTACHMENT_LIMIT_EXCEEDED` | 첨부파일은 10개까지 붙일 수 있어요. |
| 400 | `N015` | `RESET_READS_NOT_MUST_READ` | 필독 공지만 읽음 확인을 다시 받을 수 있어요. |
| 409 | `N016` | `POLL_DELETE_AFTER_VOTE` | 표가 들어온 투표는 지울 수 없어요. |
| 400 | `N017` | `POLL_MAX_CHOICES_INVALID` | 복수 선택이면 최대 선택 수를 2 이상, 선택지 수 이하로 정해 주세요. |

### calendar (`CL`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `CL001` | `EVENT_NOT_FOUND` | 일정을 찾을 수 없어요. |
| 400 | `CL002` | `EVENT_TIME_INVALID` | 끝은 시작보다 뒤여야 해요. |
| 400 | `CL003` | `EVENT_TYPE_REQUIRED` | 공용 일정은 종류를 골라 주세요. |
| 400 | `CL004` | `EVENT_TYPE_UNAVAILABLE` | 쓸 수 없는 일정 종류예요. |
| 400 | `CL005` | `EVENT_FIELD_NOT_ALLOWED` | 이 캘린더에서는 쓸 수 없는 항목이 들어 있어요. (개인 일정: 종류 · 참석자 · 프로젝트, 공용 일정: 공유 방식) |
| 400 | `CL006` | `SHARE_MODE_REQUIRED` | 개인 일정은 공유 방식을 골라 주세요. |
| 400 | `CL007` | `RECURRENCE_INVALID` | 반복 규칙이 올바르지 않아요. |
| 400 | `CL008` | `OCCURRENCE_REQUIRED` | 반복 일정은 고칠 범위와 회차를 함께 보내 주세요. |
| 404 | `CL009` | `OCCURRENCE_NOT_FOUND` | 그 시각에는 이 일정이 없어요. |
| 400 | `CL010` | `MEMBER_NOT_ACTIVE` | 재실 구성원만 고를 수 있어요. |
| 400 | `CL011` | `RANGE_INVALID` | 조회 기간은 92일 이하, 끝이 시작 이후가 되게 골라 주세요. |
| 404 | `CL012` | `MEETING_POLL_NOT_FOUND` | 모임 날짜 정하기를 찾을 수 없어요. |
| 403 | `CL013` | `MEETING_POLL_NOT_TARGET` | 이 모임 날짜 정하기의 대상이 아니에요. |
| 409 | `CL014` | `MEETING_POLL_NOT_OPEN` | 확정했거나 취소한 모임이라 바꿀 수 없어요. |
| 409 | `CL015` | `MEETING_POLL_CLOSED` | 응답 마감이 지났어요. |
| 400 | `CL016` | `SLOT_OUT_OF_RANGE` | 후보 날짜 · 시간 범위 밖의 칸이 있어요. |
| 400 | `CL017` | `CANDIDATE_DATES_INVALID` | 후보 날짜는 오늘 이후로 1~14일, 겹치지 않게 골라 주세요. |
| 400 | `CL018` | `DAY_TIME_RANGE_INVALID` | 하루 시작 · 끝 시각과 칸 단위가 맞지 않아요. |
| 400 | `CL019` | `DURATION_INVALID` | 모임 길이는 30분 단위로, 하루 시간 범위 안에서 정해 주세요. |
| 400 | `CL020` | `TARGETS_EMPTY` | 참여 대상을 한 명 이상 골라 주세요. |
| 400 | `CL021` | `CONFIRM_SLOT_INVALID` | 확정 시각은 후보 칸의 시작이어야 하고, 모임 길이가 하루 범위 안에 들어가야 해요. |
| 409 | `CL022` | `MEETING_POLL_STATUS_INVALID` | 지금 상태에서는 그렇게 바꿀 수 없어요. |
| 409 | `CL023` | `REMIND_TOO_SOON` | 알림은 한 사람에게 1시간에 한 번만 다시 보낼 수 있어요. |
| 400 | `CL024` | `CLOSES_AT_IN_PAST` | 응답 마감은 지금 이후로 골라 주세요. |
| 400 | `CL025` | `EXCEPTION_FIELD_NOT_ALLOWED` | "이 일정만" 고칠 때는 제목 · 시각 · 장소만 바꿀 수 있어요. |
| 400 | `CL026` | `CALENDAR_TYPE_IMMUTABLE` | 공용 · 개인은 만든 뒤 바꿀 수 없어요. |
| 400 | `CL027` | `MEETING_POLL_FIELD_IMMUTABLE` | 후보 날짜 · 시간 범위 · 칸 단위 · 대상은 만든 뒤 바꿀 수 없어요. |

### notification (`NT`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `NT001` | `NOTIFICATION_NOT_FOUND` | 알림을 찾을 수 없어요. (예약 — 지금 API 에서는 쓰지 않음, NT-3 은 남의 ID 를 건너뜀) |
| 400 | `NT002` | `SETTING_GROUP_UNKNOWN` | 알 수 없는 알림 묶음이에요. |
| 400 | `NT003` | `SETTING_MANDATORY` | 필독 공지와 권한 관련 알림은 끌 수 없어요. |
| 400 | `NT004` | `FILTER_UNKNOWN` | 알 수 없는 알림 필터예요. |
| 400 | `NT005` | `READ_IDS_TOO_MANY` | 한 번에 100개까지 읽음 처리할 수 있어요. |

---

## 6. 이 문서에서 정한 것 (SRS · 테이블에 없던 값)

| 항목 | 정한 값 | 이유 |
|------|---------|------|
| 마감 전 결과 공개 (대상 아님 · 작성자) | 위 `resultVisible` 표 | SRS COM-1-11 은 투표한 사람 기준만 정함 |
| 투표 고치기 권한 | 작성자만 (`content-manage` 는 공지 필드만) | COM-1-09 · 13 이 "작성자"로 적음 |
| 고정 기한 | API 는 날짜(`pinnedUntilOn`), 저장은 그날 23:59:59.999 KST 를 UTC 로 | SRS 는 날짜, 테이블은 `datetime(6)` |
| 캘린더 조회 기간 | 최대 92일, 페이지 없음 | 기간으로 범위가 정해짐 |
| 반복 횟수 | 1~200 | SRS 에 상한 없음 |
| 모임 대상 | 만든 사람은 고르지 않으면 대상 아님 | SRS 에 없음 |
| 모임 알림 다시 보내기 | 한 사람에 1시간 1번 | SRS 에 없음 |
| 모임 상세 열람 | 대상 · 만든 사람만 (그 밖 404) | SRS 에 없음 |
| 본문 이미지 붙이기 | 서버가 본문의 파일 주소를 찾아 붙임 | 별도 필드보다 단순, 빠뜨릴 일이 없음 |
