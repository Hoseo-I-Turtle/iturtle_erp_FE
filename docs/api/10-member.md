# 10. 구성원 · 권한 API

[README](README.md) 의 공통 규칙(1.7 공통 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙)을 따릅니다.
경로는 모두 `/api/v1` 아래입니다 (공개 접수만 `/public/v1`). **(기존)** 은 지금 있는 API, **(기존 변경)** 은 있는 API 를 바꾸는 것입니다.

## 모듈 위치

| 기능 | 모듈 | 다른 모듈과 주고받는 방법 |
|------|------|---------------------------|
| 졸업 · 퇴실 처리 (MEM-4) | **member** (`member_departures`) | member 가 같은 트랜잭션 안에서 `MemberDepartedEvent` 를 낸다. project 가 받아(`@EventListener`) 이전 참여자로 바꾸고 작업 · PM 을 넘긴다. 실패하면 예외로 전체가 되돌려진다 (MEM-4-04). GitHub 조직에서는 자동으로 빼지 않는다 (2026-11-19, 필요하면 `github-manage` 가 G-6 으로). 확인 화면의 프로젝트 · 작업은 project 의 [P-9a](30-project.md) 가 준다 |
| 권한 신청 (INF-1), 내 서비스 권한 (PRJ-1-50) | **auth** (`access_requests`) | 연구실 역할은 `MemberCommandApi`, 프로젝트 서비스 수준 · PM 확인은 project 공개 API 를 부른다. auth → member · project 방향이고 project 는 auth 를 모르므로 순환이 없다 |

## 공통 모양

| 이름 | 필드 | 설명 |
|------|------|------|
| `MemberRef` | `memberId` number, `name` string, `memberType` `PROFESSOR\|STUDENT\|INTERN`, `status` `ACTIVE\|GRADUATED\|LEFT`, `photoUrl` string\|null | 사람을 가리킬 때. `photoUrl` 은 `/api/v1/files/{사진 publicId}/download?size=128` ([40](40-document-file.md)), 사진이 없으면 null (화면이 이름 첫 글자 이미지를 그림, MEM-1-05) |
| `RoleRef` | `code` string, `name` string, `category` `ADMIN\|FEATURE\|SERVICE` | 역할 |
| `MemberRole` | `RoleRef` + `source` `DIRECT\|PRESET\|REQUEST`, `presetId` number\|null, `grantedAt` 시각, `grantedBy` string\|null, `expiresAt` 시각\|null | 구성원이 가진 역할 한 줄 (`member_roles`) |
| `PresetRef` | `presetId` number, `name` string | 프리셋 |
| `ProjectRef` | `projectKey` string, `name` string | 프로젝트 ([30](30-project.md)) |
| `TaskRef` | `taskKey` string, `title` string, `status` string | 작업 ([31](31-task.md)) |
| `PageResponse<T>` | `content` T[], `page`, `size`, `totalElements`, `totalPages`, `hasNext` | common-code |

---

## API 목록

| # | 메서드 | 경로 | 권한 | 요약 |
|---|--------|------|------|------|
| 1-1 | GET | `/members/me` | 본인 | 내 정보 **(기존 변경)** |
| 1-2 | PATCH | `/members/me` | 본인 | 내 연락 정보 · 소개 바꾸기 |
| 1-3 | PUT | `/members/{memberId}/photo` | 본인, `member-manage` | 프로필 사진 바꾸기 |
| 1-4 | DELETE | `/members/{memberId}/photo` | 본인, `member-manage` | 프로필 사진 지우기 |
| 2-1 | GET | `/members` | 로그인 | 구성원 목록 (구성원 화면 · 관리 화면 공용) **(기존 변경)** |
| 2-2 | GET | `/members/{memberId}` | 로그인 | 구성원 상세 **(기존 변경)** |
| 3-1 | POST | `/members` | `member-manage` | 구성원 만들기 **(기존 변경)** |
| 3-2 | GET | `/members/identifier-check` | `member-manage` | 로그인 ID · 구성원 번호 사용 가능 여부, 다음 인턴 번호 |
| 3-3 | PATCH | `/members/{memberId}` | `member-manage` | 구성원 정보 바꾸기 **(기존 변경)** |
| 3-4 | PUT | `/members/{memberId}/roles` | `role-manage` | 역할 저장 |
| 3-5 | POST | `/members/{memberId}/preset-applications` | `role-manage` | 프리셋 추가 적용 |
| 3-6 | POST | `/members/{memberId}/disable` · `/enable` · `/unlock` · `/reset-password` | `member-manage` | 계정 조치 **(기존, 권한만 변경)** |
| 4-1 | GET | `/members/roles` | 로그인 | 역할 목록 **(기존 변경)** |
| 4-2 | PATCH | `/members/roles/{roleCode}` | `role-manage` | 신청 가능 여부 바꾸기 |
| 5-1 | GET | `/role-presets` | `role-manage`, `member-manage` | 프리셋 목록 |
| 5-2 | POST | `/role-presets` | `role-manage` | 프리셋 만들기 |
| 5-3 | PATCH | `/role-presets/{presetId}` | `role-manage` | 프리셋 바꾸기 · 사용 안 함 · 적용한 구성원에게 반영 |
| 6-1 | — | (확인 화면은 따로 두지 않음) | | 역할은 2-2, 프로젝트 · 작업은 [30 P-9a](30-project.md) |
| 6-2 | POST | `/members/{memberId}/departures` | `member-manage` | 졸업 · 퇴실 처리 |
| 6-3 | GET | `/members/{memberId}/departures` | `member-manage` | 처리 기록 |
| 6-4 | POST | `/members/{memberId}/departures/{departureId}/reinstate` | `member-manage` | 재실로 되돌리기 |
| 7-1 | GET | `/auth/service-access/me` | 본인 | 내 서비스 권한 |
| 7-2 | POST | `/auth/access-requests` | 로그인 | 권한 신청 |
| 7-3 | GET | `/auth/access-requests` | 로그인 (`scope` 에 따라) | 내 신청 · 처리할 신청 목록 |
| 7-4 | PATCH | `/auth/access-requests/{requestId}` | 본인 | 신청 취소 |
| 7-5 | POST | `/auth/access-requests/{requestId}/review` | `role-manage` 또는 그 프로젝트 PM | 승인 · 거절 |
| 8-1 | POST | `/public/v1/signup-applications` | 공개 | 가입 신청 접수 |
| 8-2 | GET | `/signup-applications` | `member-manage` | 가입 신청 목록 |
| 8-3 | POST | `/signup-applications/{applicationId}/review` | `member-manage` | 승인(계정 만들기) · 거절 |
| 9-1 | GET | `/backoffice/job-runs` | `code-manage` (제안) | 주기 작업 실행 기록 |
| 9-2 | — | 기존 API 권한 · 위치 변경 | | auth · backoffice · sso |

**만들지 않은 것** (README 1.11 규칙 1): 구성원 수 통계(→ 2-1 응답의 `counts`), 구성원 상세 카드 전용 API(→ 2-2), 프리셋 상세(→ 5-1 에 역할 포함), 프리셋 반영 미리보기(→ `GET /members?presetId=` 와 역할로 화면이 계산), 권한 신청 선택지(→ 4-1 의 `requestable` + 1-1 의 역할 + 7-1 로 화면이 계산), 가입 신청 상세(→ 8-2 에 모든 칸 포함).

---

## 1. 내 프로필 — MEM-1 (화면: 05 · 내 프로필)

### 1-1. 내 정보 (기존 변경)

`GET /api/v1/members/me`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (로그인) |
| 요구사항 | MEM-1-01, MEM-1-10 |
| 테이블 | `members`, `member_roles`, `roles` |
| 감사 로그 · 알림 | 없음 |

**요청 헤더** — 공통 · **파라미터** — 없음 · **요청 본문** — 없음

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `memberId` | number | **(기존 변경)** 추가 |
| `studentNumber` | string | 구성원 번호 (학번 · 교번 · `I2026001`). 기존 |
| `loginId` | string | 기존 |
| `name` | string | 기존 |
| `roles` | string[] | 역할 코드. 기존 |
| `passwordChangeRequired` | boolean | 기존 |
| `memberType` | string | **추가** `PROFESSOR\|STUDENT\|INTERN` |
| `status` | string | **추가** `ACTIVE` (로그인했으므로 늘 재실) |
| `joinedOn` | date | **추가** 입실일 |
| `email` | string\|null | **추가** |
| `phone` | string\|null | **추가** |
| `phonePublic` | boolean | **추가** |
| `intro` | string\|null | **추가** 200자 이하 |
| `photoUrl` | string\|null | **추가** 512px 주소 (`?size=512`) |

```json
{ "success": true, "error": null,
  "data": { "memberId": 3, "studentNumber": "20231234", "loginId": "minseo", "name": "김민서",
            "roles": ["penpot-member", "project-create", "project-view-public", "report-write"],
            "passwordChangeRequired": false, "memberType": "STUDENT", "status": "ACTIVE",
            "joinedOn": "2025-03-02", "email": "minseo@example.com", "phone": "010-9876-5432",
            "phonePublic": true, "intro": "백엔드 · SSO 담당", "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=512" } }
```

**에러** — 공통만

### 1-2. 내 연락 정보 · 소개 바꾸기

`PATCH /api/v1/members/me`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | MEM-1-02, MEM-1-09 (본인 변경은 감사 로그 남기지 않음) |
| 테이블 | `members` (`email`, `phone`, `phone_public`, `intro`) |
| 감사 로그 · 알림 | 없음 |

**요청 본문** — 보낸 필드만 바꿉니다. 값을 `null` 로 보내면 지웁니다 (`phonePublic` 은 null 불가).

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `email` | string\|null | X | 이메일 형식, 254자 이하, 다른 구성원과 겹치면 안 됨. Penpot 로그인 이메일(`학번@iturtle.local`)은 바뀌지 않음 |
| `phone` | string\|null | X | 숫자와 `-`, 9~20자 |
| `phonePublic` | boolean | X | false 면 `contact-view` 를 가진 사람만 연락처를 봄 |
| `intro` | string\|null | X | 200자 이하 |

```json
{ "phone": "010-9876-5432", "phonePublic": false, "intro": "백엔드 · SSO 담당" }
```

**응답** `200 OK` — 1-1 과 같은 모양

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `M012` | 이메일이 다른 구성원에게 있음 |

### 1-3. 프로필 사진 바꾸기

`PUT /api/v1/members/{memberId}/photo`

| 항목 | 내용 |
|------|------|
| 권한 | 본인(`memberId` = 나), `member-manage` (다른 사람, 졸업 · 퇴실 구성원 포함) |
| 요구사항 | MEM-1-03, MEM-1-04, MEM-1-06 |
| 테이블 | `members.photo_file_id`, `files` (512px 행 + `variant_of` 로 이어진 128px 행) |
| 감사 로그 · 알림 | 관리자가 바꾸면 `MEMBER_UPDATED` (본인은 남기지 않음, MEM-1-09) |

먼저 [파일 올리기](40-document-file.md)로 `purpose = PROFILE_PHOTO` 파일을 올리고, 그 `publicId` 와 자를 영역을 보냅니다.
서버는 정사각형으로 잘라 512px · 128px 두 파일을 만들고, 올린 원본 파일과 이전 사진은 지웁니다 (원본 보관 안 함).

**경로 파라미터**

| 이름 | 타입 | 설명 |
|------|------|------|
| `memberId` | number | 구성원 ID |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `fileId` | string (UUID) | O | 올린 파일의 `publicId`. 내가 올렸고, 아직 어디에도 안 붙었고, `PROFILE_PHOTO` 여야 함 |
| `crop.x` | number | O | 원본 기준 왼쪽 위 x (px, 0 이상) |
| `crop.y` | number | O | 원본 기준 왼쪽 위 y (px, 0 이상) |
| `crop.size` | number | O | 정사각형 한 변 (px, 1 이상, 원본 안에 들어가야 함) |

```json
{ "fileId": "5c1f0a9e-3b2d-4c11-9a7e-0f6b2d1c8e44", "crop": { "x": 120, "y": 40, "size": 800 } }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `photoUrl` | string | 512px 주소 |
| `thumbnailUrl` | string | 128px 주소 |

```json
{ "success": true, "error": null,
  "data": { "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=512", "thumbnailUrl": "/api/v1/files/7d2e9c1a-…/download?size=128" } }
```

**에러** — 실패하면 이전 사진은 그대로입니다.

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | 남의 사진인데 `member-manage` 가 없음 |
| 404 | `M001` | 구성원이 없음 |
| 404 · 400 · 409 · 403 | `F001` · `F005` · `F008` · `F010` | 파일이 없음 · `PROFILE_PHOTO` 가 아님 · 이미 붙음 · 내가 올린 것이 아님 (**구현: 명세의 M019 대신 file 코드**) |
| 400 | `F013` | 자를 영역이 사진 밖 (**구현: 명세의 M020 대신**) |
| 400 | `F014` | 사진을 읽을 수 없음 |
| 400 | `F` 코드 | 형식(JPG · PNG · WEBP 아님) · 크기(5MB 초과) — 올릴 때 file 모듈이 먼저 거른다 ([40](40-document-file.md)) |

### 1-4. 프로필 사진 지우기

`DELETE /api/v1/members/{memberId}/photo`

| 항목 | 내용 |
|------|------|
| 권한 | 본인, `member-manage` |
| 요구사항 | MEM-1-03, MEM-1-05 |
| 테이블 | `members.photo_file_id` → NULL, `files` (두 행 숨김 + `purge_at`) |
| 감사 로그 · 알림 | 관리자가 지우면 `MEMBER_UPDATED` |

**응답** `200 OK` — `data: null`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |
| 404 | `M021` | 사진이 없음 |

### 1-5. 프로필 사진 보기 — 따로 두지 않음

다른 파일과 같은 [`GET /api/v1/files/{publicId}/download?size=128|512`](40-document-file.md) 를 씁니다 (README 1.11 규칙 1). `MemberRef.photoUrl` 에 이 주소가 들어 있으므로 화면은 `<img src>` 에 그대로 씁니다. 사진이 없으면 `photoUrl` 이 null 이고, 화면이 이름 첫 글자 이미지를 그립니다 (MEM-1-05).

---

## 2. 구성원 목록 · 상세 — MEM-2 (화면: 02 · 구성원, 04 · 관리 · 구성원)

구성원 화면과 관리 화면은 **같은 API** 를 씁니다. 관리 칸(잠김, 마지막 로그인, 역할 등)은 권한이 있는 사람에게만 응답에 들어갑니다 (README 1.11 규칙 4).

### 2-1. 구성원 목록 (기존 변경)

`GET /api/v1/members`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 **(기존 변경: `sso-admin` → 로그인)**. 관리 필터 · 칸은 아래 "보이는 사람" |
| 요구사항 | MEM-2-01~06, NFR-PRI-02, README 5.3 |
| 테이블 | `members` (`idx_members_status_type`, `ft_members_name`), `member_roles`, `member_preset_applications`, `role_presets` |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `group` | string | X | `ACTIVE`(재실, 기본) · `ON_LEAVE`(휴학) · `ALUMNI`(졸업 · 퇴실) · `ALL` |
| `memberType` | string | X | `PROFESSOR` · `STUDENT` · `INTERN` |
| `keyword` | string | X | 이름 · 로그인 ID · 구성원 번호 (2글자 이상이면 부분 일치) |
| `enabled` | boolean | X | `member-manage` 만. `false` = 비활성 |
| `locked` | boolean | X | `member-manage` 만. `true` = 잠김 |
| `presetId` | number | X | `role-manage` 만. 그 프리셋을 적용받은 구성원 (프리셋 반영 대상 고르기, MEM-5-06) |
| `page`, `size` | number | X | 기본 0, 20 (최대 100) |

- 정렬: 재실은 구분(교수 → 학생 → 인턴) → 입실일, 졸업생은 졸업 · 퇴실일 최신 순 (MEM-2-03, 04). 졸업생의 연도별 묶음은 화면이 `leftOn` 으로 묶습니다.
- 관리 전용 파라미터를 권한 없이 보내면 403 `C003`.

**응답** `200 OK`

| 필드 | 타입 | 보이는 사람 | 설명 |
|------|------|------------|------|
| `counts.active` | number | 로그인 | 재실 수 (탭) |
| `counts.onLeave` | number | 로그인 | 휴학 수 |
| `counts.alumni` | number | 로그인 | 졸업 · 퇴실 수 |
| `counts.disabled` | number | `member-manage` | 재실 중 비활성 수 |
| `counts.locked` | number | `member-manage` | 지금 잠긴 수 |
| `page` | `PageResponse<MemberListItem>` | | |

`MemberListItem`

| 필드 | 타입 | 보이는 사람 | 설명 |
|------|------|------------|------|
| `MemberRef` 필드 | | 로그인 | `memberId`, `name`, `memberType`, `status`, `photoUrl` |
| `studentNumber` | string | 로그인 | 구성원 번호 |
| `loginId` | string | 로그인 | (로그인 ID 로 검색하므로 공개, MEM-2-06) |
| `intro` | string\|null | 로그인 | 카드 소개 |
| `joinedOn` | date | 로그인 | |
| `leftOn` | date\|null | 로그인 | 졸업 · 퇴실일 |
| `email` | string\|null | 로그인 | |
| `phone` | string\|null | 공개했거나 `contact-view` · 본인 | **공개하지 않았으면 필드를 빼고** `phoneHidden: true` 를 준다 |
| `enabled`, `locked`, `failedLoginCount`, `lastLoginAt` | | `member-manage` | 관리 칸 |
| `roleCount` | number | `member-manage`, `role-manage` | |
| `appliedPresets` | `PresetRef[]` | `member-manage`, `role-manage` | "학생 기본 + 랩장" |

```json
{ "success": true, "error": null,
  "data": {
    "counts": { "active": 10, "onLeave": 1, "alumni": 24 },
    "page": { "content": [
      { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE",
        "photoUrl": "/api/v1/files/7d2e9c1a-…/download?size=128", "studentNumber": "20221187", "loginId": "jihoon.park",
        "intro": "인프라 · 배포 자동화", "joinedOn": "2024-09-01", "leftOn": null,
        "email": null, "phoneHidden": true }
    ], "page": 0, "size": 20, "totalElements": 10, "totalPages": 1, "hasNext": false } } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | 관리 전용 파라미터를 권한 없이 보냄 |

### 2-2. 구성원 상세 (기존 변경)

`GET /api/v1/members/{memberId}`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 **(기존 변경: `sso-admin` → 로그인)**. 관리 칸은 2-1 과 같은 규칙 |
| 요구사항 | MEM-2-05, MEM-5-04, MEM-5-07, INF-2-04 |
| 테이블 | `members`, `member_roles`, `roles`, `member_preset_applications` |

상세 카드의 "참여 중인 프로젝트"는 `GET /projects?memberId=` ([30](30-project.md)), GitHub 아이디는 `GET /github/accounts/{memberId}` ([50](50-infra.md)), 감사 로그는 `GET /audit-logs?targetType=MEMBER&targetId=` ([50](50-infra.md))를 화면이 함께 부릅니다 (member 는 그 모듈을 모름).

**응답** `200 OK` — `MemberListItem` 의 모든 필드 + 아래

| 필드 | 타입 | 보이는 사람 | 설명 |
|------|------|------------|------|
| `lockedUntil` | 시각\|null | `member-manage` | 기존 |
| `passwordChangeRequired` | boolean | `member-manage` | 기존 |
| `roles` | `MemberRole[]` | `member-manage`, `role-manage`, 본인 | **(기존 변경)** 코드 목록 → 출처 · 기한이 있는 목록 |
| `presetApplications` | `{ preset: PresetRef, appliedAt, appliedBy }[]` | `member-manage`, `role-manage` | MEM-5-07 |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | `member-manage` | 기존 |

```json
{ "success": true, "error": null,
  "data": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "ACTIVE",
            "studentNumber": "20221187", "loginId": "jihoon.park", "joinedOn": "2024-09-01",
            "enabled": true, "locked": false, "lockedUntil": null, "failedLoginCount": 0,
            "lastLoginAt": "2026-11-17T01:32:00Z", "passwordChangeRequired": false,
            "roles": [ { "code": "notice-write", "name": "공지 쓰기", "category": "FEATURE",
                         "source": "PRESET", "presetId": 4, "grantedAt": "2026-03-02T00:00:00Z",
                         "grantedBy": "minseo", "expiresAt": null } ],
            "presetApplications": [ { "preset": { "presetId": 2, "name": "학생 기본" },
                                      "appliedAt": "2024-09-01T00:00:00Z", "appliedBy": "minseo" } ] } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |

---

## 3. 관리 · 구성원 — MEM-1, MEM-5 (화면: 04 · 관리 · 구성원)

### 3-1. 구성원 만들기 (기존 변경)

`POST /api/v1/members`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` **(기존 변경: `sso-admin`)** |
| 요구사항 | MEM-1-07, MEM-5-02, MEM-5-11 |
| 테이블 | `members`, `member_roles`, `member_preset_applications` |
| 감사 로그 · 알림 | `MEMBER_CREATED` (구분 · 프리셋 · 임시 비밀번호 발급 여부, 비밀번호 값은 남기지 않음) |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `studentNumber` | string | O | 구성원 번호. **(기존 변경)** 숫자만 → 영문 대문자 · 숫자 1~20자(`^[A-Z0-9]{1,20}$`, 예 `20231234`, `P2019001`, `I2026001`). 겹치면 안 됨. 바꿀 수 없음 |
| `loginId` | string | O | 기존 규칙 (영문 소문자로 시작 4~30자, 소문자 · 숫자 · `.` `_` `-`). 바꿀 수 없음 |
| `name` | string | O | 1~30자 (SRS. 기존 검사는 50자) |
| `memberType` | string | O | **추가** `PROFESSOR\|STUDENT\|INTERN` |
| `joinedOn` | date | O | **추가** 입실일 |
| `email` | string | X | **추가** 1-2 와 같은 규칙 |
| `phone` | string | X | **추가** 1-2 와 같은 규칙 |
| `presetIds` | number[] | X | **추가** 고른 프리셋. 적용 기록(`member_preset_applications`)과 역할 출처(`source = PRESET`)에만 씀 |
| `roleCodes` | string[] | O | 최종 역할 목록 (프리셋을 펼친 뒤 더하고 뺀 결과). 없으면 빈 목록. 기존 |

- 화면은 구분을 고르면 그 구분의 기본 프리셋을 미리 고르고(5-1 의 `defaultMemberType`), 학번 없는 인턴이면 3-2 의 `suggestedInternNumber` 를 채웁니다.
- `roleCodes` 중 `presetIds` 의 프리셋에 들어 있는 역할은 `source = PRESET`, 나머지는 `DIRECT` 로 저장합니다.

```json
{ "studentNumber": "I2026003", "loginId": "haneul", "name": "강하늘", "memberType": "INTERN",
  "joinedOn": "2026-11-18", "email": null, "phone": "010-1234-5678",
  "presetIds": [3], "roleCodes": ["report-write", "penpot-member"] }
```

**응답** `201 Created` (`Location: /api/v1/members/42`) — 기존 `TemporaryPasswordResponse`

| 필드 | 타입 | 설명 |
|------|------|------|
| `memberId` | number | |
| `loginId` | string | |
| `temporaryPassword` | string | **이 응답에서 한 번만** 보임 |

```json
{ "success": true, "error": null, "data": { "memberId": 42, "loginId": "haneul", "temporaryPassword": "q7Lm-2xkP-wd9R" } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `M011` | 구성원 번호 형식이 틀림 |
| 400 | `M006` | 로그인 ID 형식이 틀림 (기존) |
| 409 | `M008` | 구성원 번호가 이미 있음 (기존) |
| 409 | `M009` | 로그인 ID 가 이미 있음 (기존) |
| 409 | `M012` | 이메일이 이미 있음 |
| 400 | `M007` | 없는 역할 코드 (기존) |
| 404 | `M013` | 없는 프리셋 |
| 400 | `M016` | 사용 안 함인 프리셋 |

### 3-2. 로그인 ID · 구성원 번호 확인

`GET /api/v1/members/identifier-check`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` (공개 사이트에는 두지 않음, [README S5](README.md#33-화면--srs--테이블-불일치)) |
| 요구사항 | MEM-1-07 (인턴 번호 제안), MEM-3-06 (승인 화면 "사용 가능") |
| 테이블 | `members` |

**쿼리 파라미터** — 둘 다 선택. 안 보낸 것은 응답에서 null.

| 이름 | 타입 | 설명 |
|------|------|------|
| `loginId` | string | 확인할 로그인 ID |
| `studentNumber` | string | 확인할 구성원 번호 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `loginId` | `{ value, valid, available }`\|null | `valid` = 형식, `available` = 아무도 안 씀 |
| `studentNumber` | `{ value, valid, available }`\|null | |
| `suggestedInternNumber` | string | 올해 다음 인턴 번호 (`I` + 연도 + 순번 3자리) |

```json
{ "success": true, "error": null,
  "data": { "loginId": { "value": "haneul", "valid": true, "available": true },
            "studentNumber": null, "suggestedInternNumber": "I2026003" } }
```

**에러** — 공통만 (형식이 틀려도 400 이 아니라 `valid: false`)

### 3-3. 구성원 정보 바꾸기 (기존 변경)

`PATCH /api/v1/members/{memberId}`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` **(기존 변경: `sso-admin`)** |
| 요구사항 | MEM-1-06, MEM-1-08, MEM-1-09 |
| 테이블 | `members`, (기본 프리셋 적용 시) `member_roles`, `member_preset_applications` |
| 감사 로그 · 알림 | `MEMBER_UPDATED` (바뀐 칸 전 → 후). 역할이 바뀌면 `PRESET_APPLIED` + 세션 끊기(`MemberAccessChangedEvent`) |

**(기존 변경)** 역할(`roleCodes`)은 이 API 에서 빠지고 3-4 로 옮깁니다. 보낸 필드만 바꿉니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `name` | string | X | 1~30자 |
| `memberType` | string | X | 구분. 권한은 바뀌지 않음 (MEM-1-08) |
| `applyDefaultPreset` | boolean | X | `memberType` 을 바꿀 때만. true 면 새 구분의 기본 프리셋을 추가 적용 (`role-manage` 도 있어야 함) |
| `joinedOn` | date | X | 졸업 · 퇴실일보다 앞이어야 함 |
| `email` | string\|null | X | 1-2 규칙 |
| `phone` | string\|null | X | 1-2 규칙 |

```json
{ "memberType": "PROFESSOR", "applyDefaultPreset": true }
```

**응답** `200 OK` — 2-2 와 같은 모양

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |
| 409 | `M012` | 이메일이 이미 있음 |
| 400 | `M029` | 입실일이 졸업 · 퇴실일보다 뒤 |
| 403 | `C003` | `applyDefaultPreset` 인데 `role-manage` 가 없음 |
| 409 | `M015` | 새 구분의 기본 프리셋이 없거나 사용 안 함 (**구현: 5-2 와 같은 409**) |

### 3-4. 역할 저장

`PUT /api/v1/members/{memberId}/roles`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage` |
| 요구사항 | MEM-5-04, MEM-5-08, MEM-5-11, README 5.4 |
| 테이블 | `member_roles` |
| 감사 로그 · 알림 | `ROLE_CHANGED` (`[전] → [후]`), 세션 끊기 |

역할 목록을 통째로 보냅니다. 목록에 남은 역할은 출처 · 기한을 그대로 두고, 새로 들어온 역할은 `source = DIRECT`, 빠진 역할은 지웁니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `roleCodes` | string[] | O | 최종 역할 코드 목록 |

```json
{ "roleCodes": ["report-write", "project-create", "penpot-member"] }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `roles` | `MemberRole[]` | 저장 뒤 역할 |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |
| 400 | `M007` | 없는 역할 코드 (기존) |
| 400 | `M010` | 자기 자신의 `role-manage` 를 뺌 (기존 코드, 규칙을 넓힘) |
| 400 | `M017` | `role-manage` · `member-manage` 를 가진 마지막 재실 구성원에게서 그 역할을 뺌 |
| 400 | `M018` | 졸업 · 퇴실 구성원에게 역할을 더함 |

### 3-5. 프리셋 추가 적용

`POST /api/v1/members/{memberId}/preset-applications`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage` |
| 요구사항 | MEM-5-03, MEM-5-07, MEM-5-08 |
| 테이블 | `member_roles` (`source = PRESET`, `preset_id`), `member_preset_applications` |
| 감사 로그 · 알림 | `PRESET_APPLIED`, 역할이 하나라도 더해지면 세션 끊기 |

프리셋의 역할을 더합니다. 이미 가진 역할은 출처를 바꾸지 않고 그대로 둡니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `presetId` | number | O | 사용 중인 프리셋 |

**응답** `201 Created`

| 필드 | 타입 | 설명 |
|------|------|------|
| `addedRoleCodes` | string[] | 새로 더해진 역할 |
| `roles` | `MemberRole[]` | 적용 뒤 역할 |

```json
{ "success": true, "error": null, "data": { "addedRoleCodes": ["notice-write", "calendar-manage", "content-manage"], "roles": [ "…" ] } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |
| 404 | `M013` | 프리셋이 없음 |
| 400 | `M016` | 사용 안 함인 프리셋 |
| 400 | `M018` | 졸업 · 퇴실 구성원 |

### 3-6. 계정 조치 (기존, 권한만 변경)

| 메서드 · 경로 | 하는 일 | 응답 | 감사 로그 | 에러 |
|---------------|---------|------|-----------|------|
| `POST /members/{memberId}/disable` | 일시 정지 (상태는 재실 그대로, MEM-4-08). 세션 끊기 | `200`, `data: null` | `MEMBER_DISABLED` | `M001`, `M010` 자기 자신, `M017` 마지막 관리 역할 보유자 **(추가)** |
| `POST /members/{memberId}/enable` | 다시 사용 | `200`, `data: null` | `MEMBER_ENABLED` | `M001`, `M018` 졸업 · 퇴실 구성원 **(추가)** — 되돌리기는 6-4 |
| `POST /members/{memberId}/unlock` | 잠금 해제 | `200`, `data: null` | `MEMBER_UNLOCKED` | `M001` |
| `POST /members/{memberId}/reset-password` | 임시 비밀번호 재발급 (잠금도 풀림) | `200`, `TemporaryPasswordResponse` (한 번만) | `TEMP_PASSWORD_ISSUED` (값 없음) | `M001`, `M018` |

- 권한 `sso-admin` → `member-manage`. 요청 본문은 없습니다.

---

## 4. 역할 — README 5.2

### 4-1. 역할 목록 (기존 변경)

`GET /api/v1/members/roles`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 **(기존 변경: `sso-admin` → 로그인)**. 권한 신청 화면이 `requestable` 을 보고 선택지를 만듦 |
| 요구사항 | MEM-5-04, INF-1-02 |
| 테이블 | `roles` |

**응답** `200 OK` — 배열 (20개, 페이지 없음)

| 필드 | 타입 | 설명 |
|------|------|------|
| `code` | string | 기존 |
| `name` | string | 기존 |
| `description` | string\|null | 할 수 있는 일. 기존 |
| `category` | string | **추가** `ADMIN\|FEATURE\|SERVICE` (관리 화면의 관리 · 기능 · 서비스 묶음) |
| `requestable` | boolean | **추가** 구성원이 신청할 수 있는지 |

```json
{ "success": true, "error": null,
  "data": [ { "code": "penpot-member", "name": "Penpot 로그인", "description": "Penpot 로그인", "category": "SERVICE", "requestable": true },
            { "code": "role-manage", "name": "역할 관리", "description": "구성원에게 역할 주기 · 빼기, 권한 프리셋, 연구실 역할 신청 승인", "category": "ADMIN", "requestable": false } ] }
```

### 4-2. 신청 가능 여부 바꾸기

`PATCH /api/v1/members/roles/{roleCode}`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage` |
| 요구사항 | INF-1-02 |
| 테이블 | `roles.requestable` |
| 감사 로그 · 알림 | `ROLE_UPDATED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `requestable` | boolean | O | `ADMIN` 분류는 true 로 바꿀 수 없음 |

**응답** `200 OK` — 4-1 의 항목 하나

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M028` | 역할이 없음 |
| 400 | `M027` | `ADMIN` 역할을 신청 가능으로 바꿈 |

---

## 5. 권한 프리셋 — MEM-5 (화면: 04 · 관리 · 권한 프리셋)

### 5-1. 프리셋 목록

`GET /api/v1/role-presets`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage`, `member-manage` (구성원 만들기 · 가입 승인에서 고름) |
| 요구사항 | MEM-5-01, MEM-5-02 |
| 테이블 | `role_presets`, `role_preset_roles`, `roles`, `member_preset_applications` |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `includeDisabled` | boolean | X | 기본 false. 관리 화면은 true |

**응답** `200 OK` — 배열 (페이지 없음)

| 필드 | 타입 | 설명 |
|------|------|------|
| `presetId` | number | |
| `name` | string | |
| `description` | string\|null | |
| `defaultMemberType` | string\|null | 이 구분의 기본 프리셋 ("교수 기본값") |
| `enabled` | boolean | |
| `roles` | `RoleRef[]` | 들어 있는 역할 |
| `appliedMemberCount` | number | 적용한 구성원 수 (중복 없이) |

```json
{ "success": true, "error": null,
  "data": [ { "presetId": 2, "name": "학생 기본", "description": "학부연구생 · 대학원생 기본 권한",
              "defaultMemberType": "STUDENT", "enabled": true, "appliedMemberCount": 7,
              "roles": [ { "code": "project-create", "name": "프로젝트 만들기", "category": "FEATURE" } ] } ] }
```

### 5-2. 프리셋 만들기

`POST /api/v1/role-presets`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage` |
| 요구사항 | MEM-5-01 |
| 테이블 | `role_presets`, `role_preset_roles` |
| 감사 로그 · 알림 | `PRESET_CREATED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `name` | string | O | 1~30자, 겹치면 안 됨 |
| `description` | string | X | 200자 이하 |
| `defaultMemberType` | string | X | 구분마다 사용 중인 기본 프리셋은 하나 |
| `roleCodes` | string[] | O | 1개 이상 |

```json
{ "name": "랩장", "description": "공지 · 일정 · 콘텐츠 관리", "defaultMemberType": null,
  "roleCodes": ["notice-write", "calendar-manage", "content-manage"] }
```

**응답** `201 Created` (`Location: /api/v1/role-presets/4`) — 5-1 의 항목 하나

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `M014` | 이름이 겹침 |
| 409 | `M015` | 그 구분의 기본 프리셋이 이미 있음 |
| 400 | `M007` | 없는 역할 코드 |

### 5-3. 프리셋 바꾸기 · 사용 안 함 · 반영

`PATCH /api/v1/role-presets/{presetId}`

| 항목 | 내용 |
|------|------|
| 권한 | `role-manage` |
| 요구사항 | MEM-5-01, MEM-5-05, MEM-5-06, MEM-5-08, MEM-5-11 |
| 테이블 | `role_presets`, `role_preset_roles`, (반영 시) `member_roles`, `member_preset_applications` |
| 감사 로그 · 알림 | `PRESET_UPDATED`, 반영하면 `PRESET_APPLIED`(대상 수) + 대상 세션 끊기 |

보낸 필드만 바꿉니다. 프리셋은 템플릿이라 **`propagateToMemberIds` 를 보내지 않으면 구성원의 역할은 바뀌지 않습니다** (MEM-5-05).

반영 미리보기는 따로 부르지 않습니다. 화면이 `GET /members?presetId={presetId}` (2-1)로 적용했던 구성원과 그 역할을 받아, 새로 더해질 역할을 계산해 보여 주고, 확인한 구성원 ID 만 보냅니다.
반영은 **더하기만** 합니다. 프리셋에서 뺀 역할을 구성원에게서 빼지 않습니다 (다른 경로로 받은 같은 역할까지 빠질 수 있어서. SRS MEM-5-06 에 명시 필요).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `name` | string | X | 5-2 규칙 |
| `description` | string\|null | X | |
| `defaultMemberType` | string\|null | X | null 이면 기본 프리셋 아님 |
| `roleCodes` | string[] | X | 새 역할 목록 (통째로) |
| `enabled` | boolean | X | false = 사용 안 함 (지우지 않음). 기본 프리셋을 끄면 그 구분의 기본 프리셋이 없어짐 |
| `propagateToMemberIds` | number[] | X | 이 프리셋을 적용했던 재실 구성원 중 반영할 사람 |

```json
{ "roleCodes": ["project-create", "project-view-public", "report-write", "penpot-member"],
  "propagateToMemberIds": [9, 10] }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `preset` | 5-1 항목 | 바뀐 프리셋 |
| `propagated` | `{ memberId, addedRoleCodes }[]` | 반영 결과 (보낸 경우만) |

```json
{ "success": true, "error": null,
  "data": { "preset": { "presetId": 2, "name": "학생 기본", "...": "..." },
            "propagated": [ { "memberId": 9, "addedRoleCodes": ["penpot-member"] },
                            { "memberId": 10, "addedRoleCodes": ["penpot-member"] } ] } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M013` | 프리셋이 없음 |
| 409 | `M014` | 이름이 겹침 |
| 409 | `M015` | 그 구분의 기본 프리셋이 이미 있음 |
| 400 | `M007` | 없는 역할 코드 |
| 400 | `M022` | 반영 대상에 이 프리셋을 적용받지 않았거나 재실이 아닌 구성원이 있음 |
| 400 | `M016` | 사용 안 함으로 바꾸면서 반영함 |

---

## 6. 졸업 · 퇴실 · 휴학 처리 — MEM-4 (화면: 04 · 관리 · 졸업 처리) · member 모듈

**휴학도 같은 API 로 처리합니다** (2026-11-19 결정, 새 API 를 두지 않음). `kind` 가 `MILITARY_LEAVE`(군휴학) · `LEAVE_OF_ABSENCE`(일반휴학)이면:

| | 졸업 · 퇴실 | 휴학 |
|---|---|---|
| 상태 | `GRADUATED` · `LEFT` | `ON_LEAVE` |
| 로그인 | 막음 (`enabled = false`) | ERP 는 됨. 연동 서비스(Vault · Jenkins · Penpot) SSO 는 막음 |
| 역할 | 모두 회수 | 그대로 |
| 프로젝트 | 모두 이전 참여자 | 자리는 그대로, **PM 은 내려놓고(참여자로)** 끝나지 않은 담당 작업은 넘김 |
| 연락처 1년 뒤 삭제 | 대상 | 대상 아님 (`left_on` 을 두지 않음) |
| 재실 집계 (필독 · 투표 · 작업 담당 · 주간 보고 대상) | 빠짐 | 빠짐 |
| 되돌리기(6-4) | 재입학 | **복학** (`restoreRoles: false` 로 부르면 됨) |

넘긴 PM · 작업은 처리 기록의 `handovers` 에 남아 복학할 때 누구에게서 되돌려 받을지 볼 수 있습니다 (졸업 · 퇴실도 같이 남김).

### 6-1. 확인 화면 — 따로 두지 않음

확인 화면(MEM-4-02)은 이미 있는 API 를 화면이 함께 부릅니다 (README 1.11 규칙 1).

| 칸 | API |
|----|-----|
| 회수할 역할 | [2-2](#2-2-구성원-상세-기존-변경) `GET /members/{memberId}` 의 `roles` 중 `category = SERVICE` |
| 참여 프로젝트 · 마지막 PM 여부 · 끝나지 않은 담당 작업 · 새 담당자 후보 · 함께 사라질 프로젝트 서비스 권한 | [30 P-9a](30-project.md) `GET /projects/handover?memberId=` (`member-manage` 는 비공개 프로젝트도 봄 — 넘길 작업을 알아야 하므로) |
| 조직에서 뺄 GitHub 계정 | [50](50-infra.md) `GET /github/accounts/{memberId}` |

자기 자신 · 마지막 관리 역할 보유자 같은 "처리할 수 없는 이유"는 6-2 가 에러로 알려 줍니다.

### 6-2. 졸업 · 퇴실 · 휴학 처리

`POST /api/v1/members/{memberId}/departures`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` |
| 요구사항 | MEM-4-01, 03, 04, 06, PRJ-1-48, INF-3-05 |
| 테이블 | `members` (`status`, `left_on`, `enabled`), `member_roles`, `member_departures`, `project_members` (`FORMER`, `left_at`), `tasks`, `project_activities`, `github_sync_jobs` (`ORG_REMOVE`) |
| 감사 로그 · 알림 | `MEMBER_DEPARTED`, 넘긴 작업마다 작업 활동 기록 · 새 담당자에게 `TASK_ASSIGNED`, 세션 끊기 |

한 트랜잭션으로 처리합니다. member 가 상태 · 역할을 바꾸고 `MemberDepartedEvent`(작업 넘기기 · PM 넘기기 목록 포함)를 내면, project 가 같은 트랜잭션 안에서 받아 이전 참여자 · 작업 · PM 을 처리합니다. project 쪽 검사가 실패하면(`P011`, `P012`, `P040`) 전체가 되돌려집니다.
GitHub 조직에서는 빼지 않습니다 (2026-11-19 결정). 빼야 하면 GitHub 관리 화면에서 손으로 뺍니다 ([50](50-infra.md) G-6).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `kind` | string | O | `GRADUATED` 졸업 · `LEFT` 퇴실 · `MILITARY_LEAVE` 군휴학 · `LEAVE_OF_ABSENCE` 일반휴학 |
| `departedOn` | date | O | 입실일 이후 (휴학이면 휴학 시작일). 화면 기본값 오늘 |
| `expectedReturnOn` | date | X | 휴학일 때만, 복학 예정일 (`departedOn` 이후). 졸업 · 퇴실에 보내면 `M035` |
| `taskReassignments` | `{ taskKey, assigneeMemberId }[]` | O | P-9a 의 `openTasks` **모두**. `assigneeMemberId: null` = 담당자 없음 |
| `projectManagerHandovers` | `{ projectKey, newManagerMemberId }[]` | 조건부 | P-9a 에서 `lastManager: true` 인 프로젝트 모두 ([README S3](README.md#33-화면--srs--테이블-불일치) 제안) |

```json
{ "kind": "GRADUATED", "departedOn": "2027-02-20",
  "taskReassignments": [ { "taskKey": "DEFME-46", "assigneeMemberId": 3 },
                         { "taskKey": "DEFME-52", "assigneeMemberId": null } ],
  "projectManagerHandovers": [] }
```

**응답** `201 Created` (`Location: /api/v1/members/4/departures/15`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `departureId` | number | |
| `member` | `MemberRef` | 바뀐 상태 |
| `revokedRoleCodes` | string[] | 회수한 역할 |
| `formerProjects` | `{ projectKey, projectRole }[]` | 이전 참여자가 된 프로젝트 (휴학이면 빈 배열) |
| `handovers` | `{ kind, projectKey, taskKey, taskTitle, toMemberId }[]` | 넘긴 것. `kind` = `PROJECT_MANAGER`(PM 이던 프로젝트, `toMemberId` = 새 PM · 없으면 다른 PM 이 있어 내려놓기만) · `TASK`(넘긴 작업, `toMemberId` null = 담당자 없음) |
| `githubRemovalStatus` | string | 항상 `NOT_NEEDED` (2026-11-19 부터 GitHub 조직에서 자동으로 빼지 않음) |

```json
{ "success": true, "error": null,
  "data": { "departureId": 15, "member": { "memberId": 4, "name": "박지훈", "memberType": "STUDENT", "status": "GRADUATED", "photoUrl": null },
            "revokedRoleCodes": ["penpot-member"], "formerProjects": [ { "projectKey": "DEFME", "projectRole": "MANAGER" } ],
            "githubRemovalStatus": "PENDING" } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M001` | 구성원이 없음 |
| 400 | `M032` | 자기 자신 |
| 400 | `M017` | `role-manage` · `member-manage` 를 가진 마지막 재실 구성원 |
| 400 | `M018` | 이미 졸업 · 퇴실 (휴학 중에는 다시 휴학할 수 없음. 졸업 · 퇴실은 됨) |
| 400 | `M035` | 복학 예정일이 휴학이 아닌데 있거나 시작일보다 앞 |
| 400 | `M029` | 졸업 · 퇴실일이 입실일보다 앞 |
| 400 | `P011` | 끝나지 않은 담당 작업 중 빠진 것이 있음 (그사이 새 작업이 배정된 경우 포함 — P-9a 를 다시 부름) |
| 400 | `P012` | 새 담당자가 그 프로젝트의 재실 참여자가 아님 |
| 400 | `P040` | 마지막 PM 인 프로젝트의 새 관리자가 없거나 참여자가 아님 |

### 6-3. 처리 기록

`GET /api/v1/members/{memberId}/departures`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` |
| 요구사항 | MEM-4-05 (되돌릴 때 회수한 역할을 보여 줌) |
| 테이블 | `member_departures` |

**응답** `200 OK` — 배열 (최신 순, 페이지 없음)

| 필드 | 타입 | 설명 |
|------|------|------|
| `departureId` | number | |
| `kind` | string | |
| `departedOn` | date | |
| `expectedReturnOn` | date\|null | 휴학일 때 복학 예정일 |
| `revokedRoleCodes` | string[] | |
| `formerProjects` | `{ projectKey, projectRole }[]` | |
| `handovers` | `{ kind, projectKey, taskKey, taskTitle, toMemberId }[]` | 6-2 와 같음 |
| `githubRemovalStatus` | string | `NOT_NEEDED\|PENDING\|DONE\|FAILED` |
| `restoredAt` | 시각\|null | |
| `restoredRoles` | boolean\|null | |
| `createdAt`, `createdBy` | | 처리한 시각 · 사람 |

### 6-4. 재실로 되돌리기 (재입학 · 복학)

`POST /api/v1/members/{memberId}/departures/{departureId}/reinstate`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` (`restoreRoles: true` 면 `role-manage` 도) |
| 요구사항 | MEM-4-05 |
| 테이블 | `members` (`status = ACTIVE`, `left_on = NULL`, `enabled = true`), `member_roles`, `member_departures` (`restored_at`, `restored_roles`) |
| 감사 로그 · 알림 | `MEMBER_REINSTATED` |

프로젝트 참여는 되돌리지 않습니다 (졸업 · 퇴실은 이전 참여자 그대로, 휴학은 참여자로 남아 있음. 넘긴 PM · 작업은 `handovers` 를 보고 PM 이 다시 줌). GitHub 조직은 구성원이 다시 연결하면 초대됩니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `restoreRoles` | boolean | O | true 면 `revokedRoleCodes` 를 다시 준다 (`source = DIRECT`) |

**응답** `200 OK` — 6-3 의 항목 하나

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M033` | 처리 기록이 없음 |
| 409 | `M034` | 이미 되돌렸거나, 그 구성원의 마지막 처리 기록이 아님 |
| 403 | `C003` | `restoreRoles` 인데 `role-manage` 가 없음 |

---

## 7. 서비스 권한 · 권한 신청 — PRJ-1-50, INF-1 · auth 모듈

### 7-1. 내 서비스 권한

`GET /api/v1/auth/service-access/me`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 |
| 요구사항 | PRJ-1-50, INF-1-01 (신청 화면이 지금 수준을 보고 선택지를 만듦) |
| 테이블 | `member_roles`, `roles`, `project_members`, `project_member_service_levels`, `project_service_settings` |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `labRoles` | `RoleRef[]` | 연구실 전체 서비스 역할 (`SERVICE` 분류)과 기한 `expiresAt` |
| `projects[].project` | `ProjectRef` | 참여 중인 프로젝트 (보관 제외) |
| `projects[].projectRole` | string | `MANAGER\|MEMBER` |
| `projects[].vault` · `jenkins` | `{ enabled, level, source, expiresAt }` | `enabled` = 그 프로젝트가 서비스를 켰는지, `level` = 실제 수준(`NONE\|READ\|WRITE\|BUILD`), `source` = `DEFAULT\|MANUAL\|REQUEST` |

```json
{ "success": true, "error": null,
  "data": { "labRoles": [ { "code": "penpot-member", "name": "Penpot 로그인", "category": "SERVICE", "expiresAt": null } ],
            "projects": [ { "project": { "projectKey": "DEFME", "name": "DEFME 백엔드" }, "projectRole": "MANAGER",
                            "vault": { "enabled": true, "level": "WRITE", "source": "DEFAULT", "expiresAt": null },
                            "jenkins": { "enabled": true, "level": "BUILD", "source": "DEFAULT", "expiresAt": null } } ] } }
```

### 7-2. 권한 신청

`POST /api/v1/auth/access-requests`

| 항목 | 내용 |
|------|------|
| 권한 | 로그인 |
| 요구사항 | INF-1-01, INF-1-02, INF-1-07, INF-1-08 |
| 테이블 | `access_requests` |
| 감사 로그 · 알림 | `ACCESS_REQUESTED`, 승인할 사람(`role-manage` 또는 그 프로젝트 PM)에게 `ACCESS_REQUEST` |

신청 화면의 선택지는 4-1(`requestable` 역할) · 1-1(내 역할) · 7-1(프로젝트별 지금 수준)로 화면이 만듭니다. 프로젝트 카드의 "권한 신청"에서 오면 `projectKey` · `service` 를 미리 채웁니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `targetKind` | string | O | `PROJECT_SERVICE` · `LAB_ROLE` |
| `projectKey` | string | 조건부 | `PROJECT_SERVICE` 일 때. 참여 중인 프로젝트 |
| `service` | string | 조건부 | `PROJECT_SERVICE` 일 때 `VAULT` · `JENKINS` |
| `level` | string | 조건부 | `PROJECT_SERVICE` 일 때. Vault `READ\|WRITE`, Jenkins `READ\|BUILD`. 지금보다 높아야 함 |
| `roleCode` | string | 조건부 | `LAB_ROLE` 일 때. `requestable` 이고 아직 없는 역할 |
| `reason` | string | O | 10~1,000자 |
| `expiresOn` | date | X | 사용 기한. 오늘 이후 |

```json
{ "targetKind": "PROJECT_SERVICE", "projectKey": "SENS", "service": "VAULT", "level": "WRITE",
  "reason": "센서 수집기 DB 비밀번호 교체", "expiresOn": "2026-11-24" }
```

**응답** `201 Created` (`Location: /api/v1/auth/access-requests/31`) — `AccessRequest` (7-3)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `A003` | 같은 대상으로 대기 중인 신청이 있음 |
| 400 | `A004` | 이미 가진 권한 (같거나 높은 수준) |
| 400 | `A005` | 신청할 수 없는 역할 (관리 역할 · `requestable = false`) |
| 400 | `M007` | 없는 역할 코드 |
| 404 | project `PROJECT_NOT_FOUND` | 프로젝트가 없거나 볼 수 없음 ([30](30-project.md)) |
| 400 | `A006` | 볼 수는 있지만 참여하지 않은 프로젝트 |
| 400 | `A007` | 그 프로젝트가 그 서비스 권한을 켜지 않음 |
| 400 | `A008` | 서비스와 맞지 않는 수준 (Vault 에 `BUILD` 등) |
| 400 | `A011` | 사용 기한이 오늘이나 그 전 |

### 7-3. 신청 목록

`GET /api/v1/auth/access-requests`

| 항목 | 내용 |
|------|------|
| 권한 | `scope=MINE`: 로그인. `scope=REVIEW`: `role-manage` 또는 PM 인 프로젝트가 하나 이상 |
| 요구사항 | INF-1-03, INF-1-04 |
| 테이블 | `access_requests` (`idx_access_requests_*`), `roles`, `projects` |

관리 화면 · 프로젝트 설정의 "권한 신청" · 내 프로필의 내 신청이 같은 API 를 씁니다.
`REVIEW` 는 `role-manage` 면 연구실 역할 신청과 **모든 프로젝트 신청**을, PM 이면 자기 프로젝트 신청만 돌려줍니다 (`role-manage` 는 프로젝트 신청을 보기만 하고 승인하지 못함, `canReview: false`).

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `scope` | string | O | `MINE` · `REVIEW` |
| `status` | string | X | `PENDING\|APPROVED\|REJECTED\|CANCELLED\|EXPIRED`. 없으면 전체 |
| `projectKey` | string | X | 그 프로젝트 신청만 (프로젝트 설정 화면) |
| `page`, `size` | number | X | |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `counts` | `{ PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED }` | 같은 `scope` · `projectKey` 안의 상태별 수 (탭) |
| `page` | `PageResponse<AccessRequest>` | 최신 순 |

`AccessRequest`

| 필드 | 타입 | 설명 |
|------|------|------|
| `requestId` | number | |
| `requester` | `MemberRef` | |
| `targetKind` | string | |
| `project` | `ProjectRef`\|null | |
| `service` · `level` | string\|null | |
| `currentLevel` | string\|null | 신청 때의 수준 (`READ → WRITE` 표시) |
| `role` | `RoleRef`\|null | |
| `reason` | string | |
| `expiresOn` | date\|null | |
| `status` | string | |
| `approverLabel` | string | "SENS 프로젝트 관리자" · "role-manage" |
| `canReview` | boolean | 보는 사람이 승인 · 거절할 수 있는지 |
| `reviewer` | `MemberRef`\|null | null 이고 `EXPIRED` 면 "시스템" |
| `reviewedAt` | 시각\|null | |
| `rejectReason` | string\|null | |
| `expireNotifiedAt` | 시각\|null | 기한 3일 전 알림 보낸 시각 |
| `createdAt` | 시각 | |

```json
{ "success": true, "error": null,
  "data": { "counts": { "PENDING": 2, "APPROVED": 8, "REJECTED": 1, "CANCELLED": 0, "EXPIRED": 3 },
            "page": { "content": [
              { "requestId": 31, "requester": { "memberId": 5, "name": "최현우", "memberType": "STUDENT", "status": "ACTIVE", "photoUrl": null },
                "targetKind": "PROJECT_SERVICE", "project": { "projectKey": "SENS", "name": "매트 센서 데이터 수집" },
                "service": "VAULT", "level": "WRITE", "currentLevel": "READ", "role": null,
                "reason": "센서 수집기 DB 비밀번호 교체", "expiresOn": "2026-11-24", "status": "PENDING",
                "approverLabel": "SENS 프로젝트 관리자", "canReview": false, "reviewer": null, "reviewedAt": null,
                "rejectReason": null, "expireNotifiedAt": null, "createdAt": "2026-11-17T01:10:00Z" }
            ], "page": 0, "size": 20, "totalElements": 2, "totalPages": 1, "hasNext": false } } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 403 | `C003` | `REVIEW` 인데 `role-manage` 도 없고 PM 인 프로젝트도 없음, 또는 `projectKey` 의 PM 이 아님 (`role-manage` 제외) |

### 7-4. 신청 취소

`PATCH /api/v1/auth/access-requests/{requestId}`

| 항목 | 내용 |
|------|------|
| 권한 | 본인 (신청자) |
| 요구사항 | INF-1-03, INF-1-07 |
| 테이블 | `access_requests.status` |
| 감사 로그 · 알림 | `ACCESS_REQUEST_CANCELLED` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `status` | string | O | `CANCELLED` 만 |

**응답** `200 OK` — `AccessRequest`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `A002` | 신청이 없거나 내 신청이 아님 |
| 409 | `A009` | 대기 중이 아님 |
| 400 | `C001` | `status` 가 `CANCELLED` 가 아님 |

### 7-5. 승인 · 거절

`POST /api/v1/auth/access-requests/{requestId}/review`

| 항목 | 내용 |
|------|------|
| 권한 | 연구실 역할 신청 → `role-manage`, 프로젝트 신청 → 그 프로젝트 PM |
| 요구사항 | INF-1-04, INF-1-05, INF-1-07 |
| 테이블 | `access_requests`, 승인 시 `member_roles` (`source = REQUEST`, `access_request_id`, `expires_at`) 또는 `project_member_service_levels` (`source = REQUEST`, `expires_at`) |
| 감사 로그 · 알림 | `ACCESS_REQUEST_APPROVED` · `ACCESS_REQUEST_REJECTED`, 신청자에게 `ACCESS_RESULT`. 연구실 역할 승인이면 세션 끊기. 반영은 다음 로그인부터 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `decision` | string | O | `APPROVE` · `REJECT` |
| `reason` | string | 조건부 | `REJECT` 일 때 필수, 500자 이하 |
| `expiresOn` | date\|null | X | `APPROVE` 일 때 기한을 바꿈 (안 보내면 신청한 값). 기한의 끝은 그날 23:59:59 KST 로 저장 |

```json
{ "decision": "APPROVE", "expiresOn": "2026-11-24" }
```

**응답** `200 OK` — `AccessRequest`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `A002` | 신청이 없음 (PM 이 아닌 사람에게 비공개 프로젝트 신청도 404) |
| 403 | `A012` | 볼 수는 있지만 승인할 사람이 아님 (`role-manage` 가 프로젝트 신청을 승인 등) |
| 409 | `A009` | 대기 중이 아님 |
| 400 | `A010` | 거절 사유가 없음 |
| 400 | `A011` | 사용 기한이 오늘이나 그 전 |
| 400 | `A007` | 그사이 그 프로젝트가 서비스 권한을 끔 |
| 400 | `A006` | 그사이 신청자가 프로젝트에서 빠짐 |

---

## 8. 가입 신청 — MEM-3 (화면: 05 · 가입 신청 (공개 사이트), 04 · 관리 · 가입 신청)

### 8-1. 가입 신청 접수

`POST /public/v1/signup-applications`

| 항목 | 내용 |
|------|------|
| 권한 | 공개 (로그인 · CSRF 없음) |
| 요구사항 | MEM-3-01~03, MEM-3-10, NFR-SEC-09 |
| 테이블 | `signup_applications` (`status = PENDING`, `client_ip`, `privacy_agreed_at`) |
| 감사 로그 · 알림 | `SIGNUP_RECEIVED`, `member-manage` 에게 `SIGNUP_REQUEST` |

**바깥에는 Cloudflare Tunnel 로 이 경로 하나만 엽니다** (2026-11-19 결정, 공개 사이트가 직접 부름). 봇 확인은 두지 않고 같은 IP 횟수 제한으로만 막습니다.

**요청 헤더**

| 헤더 | 값 |
|------|----|
| `Content-Type` | `application/json` |
| `Cookie`, `X-XSRF-TOKEN` | 쓰지 않음 |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `name` | string | O | 1~30자 |
| `studentNumber` | string | X | 숫자 1~20자 |
| `desiredLoginId` | string | O | 로그인 ID 규칙 (형식만 검사) |
| `email` | string | X | 이메일 형식, 254자 이하 |
| `phone` | string | O | 숫자와 `-`, 9~20자 |
| `reason` | string | O | 1~1,000자 |
| `privacyAgreed` | boolean | O | true 여야 함 |

```json
{ "name": "강하늘", "studentNumber": "20261055", "desiredLoginId": "haneul", "email": null,
  "phone": "010-1234-5678", "reason": "정재훈 교수님 연구실에서 겨울 인턴으로 참여하고 싶습니다.",
  "privacyAgreed": true }
```

- 이미 쓰는 로그인 ID · 구성원 번호여도 **거절하지 않고 받습니다.** 바깥에서 연구실 계정 ID · 학번이 있는지 알아낼 수 없게 하려는 것이고, 승인할 때 관리자가 다른 값을 넣습니다 (MEM-3-06). SRS MEM-3 신청 항목의 "이미 쓰는 ID 면 거절"을 바꿔야 합니다 ([README S5](README.md#33-화면--srs--테이블-불일치)).

**응답** `201 Created` — 신청 ID 는 돌려주지 않습니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `receivedAt` | 시각 | 접수 시각 |

```json
{ "success": true, "error": null, "data": { "receivedAt": "2026-11-16T23:40:00Z" } }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `C001` | 칸 형식이 틀림 (동의 안 함 포함) |
| 400 | `M006` | 희망 로그인 ID 형식이 틀림 |
| 409 | `M025` | 같은 학번 · 같은 희망 로그인 ID 로 대기 중인 신청이 있음 (MEM-3-02) |
| 429 | `M024` | 요청이 너무 잦음 (응답 헤더 `Retry-After`) |

### 8-2. 가입 신청 목록

`GET /api/v1/signup-applications`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` |
| 요구사항 | MEM-3-04 |
| 테이블 | `signup_applications` (`idx_signup_applications_status`), `members` (희망 ID 사용 여부) |

목록에 신청서의 모든 칸을 넣습니다 (상세 API 없음).

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string | X | `PENDING`(기본) · `APPROVED` · `REJECTED` |
| `page`, `size` | number | X | 최신 순 |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `counts` | `{ PENDING, APPROVED, REJECTED }` | 탭 숫자 |
| `page` | `PageResponse<SignupApplication>` | |

`SignupApplication`

| 필드 | 타입 | 설명 |
|------|------|------|
| `applicationId` | number | |
| `name`, `studentNumber`, `desiredLoginId`, `email`, `phone`, `reason` | | 신청 칸 |
| `memberType` | string | 늘 `INTERN` |
| `privacyAgreedAt` | 시각 | |
| `desiredLoginIdTaken` | boolean | 희망 ID 를 이미 누가 씀 ("희망 ID 사용 중") |
| `studentNumberTaken` | boolean | 학번을 이미 누가 씀 |
| `status` | string | |
| `reviewer` | `MemberRef`\|null | |
| `reviewedAt` | 시각\|null | |
| `rejectReason` | string\|null | |
| `createdMember` | `MemberRef`\|null | 승인으로 만든 구성원 |
| `purgeAfter` | 시각\|null | 지워질 시각 (승인 · 거절은 처리 90일 뒤, 대기는 30일이 지나면 그때부터 90일 뒤) |
| `createdAt` | 시각 | 신청 시각 |

**에러** — 공통만

### 8-3. 승인 · 거절

`POST /api/v1/signup-applications/{applicationId}/review`

| 항목 | 내용 |
|------|------|
| 권한 | `member-manage` (역할 · 프리셋을 고치려면 `role-manage` 는 필요 없음 — 구성원 만들기와 같음) |
| 요구사항 | MEM-3-05~08, MEM-3-10 |
| 테이블 | `signup_applications` (`status`, `reviewed_*`, `reject_reason`, `created_member_id`, `purge_after`), 승인 시 3-1 의 테이블 |
| 감사 로그 · 알림 | `SIGNUP_APPROVED` + `MEMBER_CREATED` · `SIGNUP_REJECTED` |

시스템은 결과를 신청자에게 보내지 않습니다. 승인한 사람이 로그인 ID 와 임시 비밀번호를 직접 전달합니다 (MEM-3-08).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `decision` | string | O | `APPROVE` · `REJECT` |
| `reason` | string | 조건부 | `REJECT` 일 때 필수, 500자 이하 |
| `loginId` | string | 조건부 | `APPROVE` 일 때. 기본은 희망 ID, 이미 쓰면 다른 ID |
| `studentNumber` | string\|null | X | `APPROVE` 일 때. 비우면 신청서 학번, 그것도 없으면 다음 `I` 번호 |
| `joinedOn` | date | 조건부 | `APPROVE` 일 때 |
| `presetIds` | number[] | X | 기본은 "인턴 기본" |
| `roleCodes` | string[] | 조건부 | `APPROVE` 일 때. 3-1 과 같은 뜻 |

```json
{ "decision": "APPROVE", "loginId": "haneul", "studentNumber": null, "joinedOn": "2026-11-18",
  "presetIds": [3], "roleCodes": ["report-write", "penpot-member"] }
```

```json
{ "decision": "REJECT", "reason": "이번 학기 인턴 모집이 끝났어요." }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `application` | `SignupApplication` | |
| `account` | `{ memberId, loginId, temporaryPassword }`\|null | 승인일 때만. 임시 비밀번호는 **한 번만** |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `M023` | 신청이 없음 (지워진 것 포함) |
| 409 | `M030` | 이미 처리한 신청 |
| 400 | `M031` | 거절 사유가 없음 |
| 400 | `M032` | `CANNOT_DEPART_SELF` | 자기 자신은 졸업 · 퇴실 처리할 수 없어요. |
| 404 | `M033` | `DEPARTURE_NOT_FOUND` | 졸업 · 퇴실 처리 기록을 찾을 수 없어요. |
| 409 | `M034` | `DEPARTURE_NOT_RESTORABLE` | 이미 되돌렸거나 마지막 처리 기록이 아니에요. |
| 409 | `M009` | 로그인 ID 가 이미 있음 |
| 409 | `M008` | 구성원 번호가 이미 있음 |
| 400 | `M006`, `M011` | 로그인 ID · 구성원 번호 형식 |
| 400 | `M007`, `M016` / 404 `M013` | 역할 · 프리셋 |

---

## 9. 기존 API 변경 · 주기 작업 기록

### 9-1. 주기 작업 실행 기록

`GET /api/v1/backoffice/job-runs`

| 항목 | 내용 |
|------|------|
| 권한 | `code-manage` (SRS 에 없음 → 제안) |
| 요구사항 | NFR-OPS-05 |
| 테이블 | `scheduled_job_runs` (`idx_scheduled_job_runs_job`) |

실패하면 `code-manage` 를 가진 사람에게 `JOB_FAILED` 알림이 갑니다 ([README T6](README.md#32-테이블--컬럼-보완) 제안).

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `jobName` | string | X | 예 `access-request-expire`, `signup-purge`, `file-purge`, `github-rescan` |
| `status` | string | X | `RUNNING\|SUCCEEDED\|FAILED` |
| `from`, `to` | date | X | 시작 날짜 범위 |
| `page`, `size` | number | X | 최신 순 |

**응답** `200 OK` — `PageResponse<JobRun>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `runId` | number | |
| `jobName` | string | |
| `startedAt`, `finishedAt` | 시각 | |
| `status` | string | |
| `processedCount` | number\|null | |
| `errorMessage` | string\|null | 1,000자 이하 |

### 9-2. 기존 API 변경

| API | 변경 | 근거 |
|-----|------|------|
| `PATCH /auth/password` | 그대로 (`currentPassword`, `newPassword`, 에러 `M002~M005`) | |
| `GET·POST·PUT /backoffice/common-codes/**`, `POST /backoffice/common-codes/cache/evict` | 권한 `sso-admin` → `code-manage` | README 5.3 |
| `GET /sso/clients`, `POST /sso/clients/{clientId}/secret` | 그대로 `sso-admin` | README 5.2 |
| `GET /sso/apps` | 그대로. 홈 화면의 "서비스 바로 가기"가 부른다. 응답에 `accessible` 을 더해 권한 없는 서비스도 흐리게 보여 준다 (홈 화면) | CMN-1 |
| `GET /members`, `GET /members/{id}` | 권한을 로그인으로 넓히고 관리 칸은 권한별로 (2-1, 2-2) | MEM-2 |
| `POST /members`, `PATCH /members/{id}` | 3-1, 3-3 | MEM-1-07 |
| `POST /members/{id}/disable·enable·unlock·reset-password` | 권한 `member-manage` (3-6) | README 5.3 |
| OIDC `groups` 클레임 (HTTP API 아님) | `prj-<키>-vault-read` 등 프로젝트 그룹과 `jenkins-user` 를 더함. `SSO_APP.ref2` 의 `@project` 처리 | PRJ-1-51, 52 |

---

## 에러 코드

### member (`M`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `M001` | `MEMBER_NOT_FOUND` | 회원을 찾을 수 없습니다. (기존) |
| 400 | `M002` | `CURRENT_PASSWORD_MISMATCH` | 현재 비밀번호가 올바르지 않습니다. (기존) |
| 400 | `M003` | `PASSWORD_LENGTH` | (기존) |
| 400 | `M004` | `PASSWORD_SAME_AS_LOGIN_ID` | (기존) |
| 400 | `M005` | `PASSWORD_SAME_AS_CURRENT` | (기존) |
| 400 | `M006` | `INVALID_LOGIN_ID` | (기존) |
| 400 | `M007` | `ROLE_NOT_FOUND` | 존재하지 않는 역할입니다. (기존) |
| 409 | `M008` | `DUPLICATE_STUDENT_NUMBER` | 이미 등록된 학번입니다. (기존 — "구성원 번호"로 문구 변경 제안) |
| 409 | `M009` | `DUPLICATE_LOGIN_ID` | 이미 사용 중인 로그인 ID 입니다. (기존) |
| 400 | `M010` | `CANNOT_REMOVE_OWN_ADMIN` | 자기 자신을 비활성화하거나 자신의 관리자 역할을 뺄 수 없습니다. (기존 — `role-manage` 까지 넓힘) |
| 400 | `M011` | `INVALID_MEMBER_NUMBER` | 구성원 번호는 영문 대문자와 숫자로 된 20자 이하예요. |
| 409 | `M012` | `DUPLICATE_EMAIL` | 다른 구성원이 이미 쓰는 이메일이에요. |
| 404 | `M013` | `PRESET_NOT_FOUND` | 권한 프리셋을 찾을 수 없어요. |
| 409 | `M014` | `DUPLICATE_PRESET_NAME` | 같은 이름의 프리셋이 있어요. |
| 409 | `M015` | `DEFAULT_PRESET_CONFLICT` | 이 구분의 기본 프리셋이 이미 있거나, 쓸 수 있는 기본 프리셋이 없어요. |
| 400 | `M016` | `PRESET_DISABLED` | 사용 안 함으로 된 프리셋이에요. |
| 400 | `M017` | `LAST_ADMIN_ROLE_HOLDER` | role-manage · member-manage 를 가진 재실 구성원이 한 명은 남아 있어야 해요. |
| 400 | `M018` | `MEMBER_NOT_ACTIVE` | 졸업 · 퇴실한 구성원에게는 할 수 없어요. |
| — | ~~`M019`~~ | — | 쓰지 않음: file 모듈 코드(F001 · F005 · F008 · F010)로 대신 |
| — | ~~`M020`~~ | — | 쓰지 않음: file 모듈 `F013` 으로 대신 |
| 404 | `M021` | `PHOTO_NOT_FOUND` | 프로필 사진이 없어요. |
| 400 | `M022` | `INVALID_PROPAGATION_TARGET` | 반영 대상에 이 프리셋을 적용받지 않은 구성원이 있어요. |
| 404 | `M023` | `SIGNUP_NOT_FOUND` | 가입 신청을 찾을 수 없어요. |
| 429 | `M024` | `SIGNUP_TOO_MANY_REQUESTS` | 잠시 뒤에 다시 신청해 주세요. |
| 409 | `M025` | `DUPLICATE_PENDING_SIGNUP` | 같은 학번이나 희망 로그인 ID 로 처리 중인 신청이 있어요. |
| 400 | `M027` | `ADMIN_ROLE_NOT_REQUESTABLE` | 관리 역할은 신청 가능으로 바꿀 수 없어요. |
| 404 | `M028` | `ROLE_CODE_NOT_FOUND` | 역할을 찾을 수 없어요. (경로의 역할. 본문의 없는 코드는 `M007`) |
| 400 | `M029` | `INVALID_MEMBER_DATES` | 졸업 · 퇴실일은 입실일 이후여야 해요. |
| 409 | `M030` | `SIGNUP_ALREADY_REVIEWED` | 이미 처리한 가입 신청이에요. |
| 400 | `M031` | `SIGNUP_REJECT_REASON_REQUIRED` | 거절할 때는 사유를 적어 주세요. |

### auth (`A`) — 권한 신청

기존 `A001` 다음 번호입니다.

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `A002` | `ACCESS_REQUEST_NOT_FOUND` | 권한 신청을 찾을 수 없어요. |
| 409 | `A003` | `DUPLICATE_PENDING_REQUEST` | 같은 대상으로 처리 중인 신청이 있어요. |
| 400 | `A004` | `ALREADY_HAS_ACCESS` | 이미 가진 권한이에요. |
| 400 | `A005` | `ROLE_NOT_REQUESTABLE` | 신청할 수 없는 역할이에요. 관리 역할은 신청할 수 없어요. |
| 400 | `A006` | `NOT_PROJECT_PARTICIPANT` | 참여 중인 프로젝트의 권한만 신청할 수 있어요. |
| 400 | `A007` | `PROJECT_SERVICE_DISABLED` | 이 프로젝트는 그 서비스 권한을 켜지 않았어요. |
| 400 | `A008` | `INVALID_SERVICE_LEVEL` | Vault 는 읽기 · 쓰기, Jenkins 는 읽기 · 빌드만 신청할 수 있어요. |
| 409 | `A009` | `REQUEST_NOT_PENDING` | 처리 중인 신청만 승인 · 거절 · 취소할 수 있어요. |
| 400 | `A010` | `REJECT_REASON_REQUIRED` | 거절할 때는 사유를 적어 주세요. |
| 400 | `A011` | `INVALID_EXPIRES_ON` | 사용 기한은 내일 이후 날짜여야 해요. |
| 403 | `A012` | `NOT_REQUEST_REVIEWER` | 이 신청을 처리할 수 있는 사람이 아니에요. |

`A` 의 마지막 관리 역할 보유자 검사는 member 의 `M017` 을 그대로 씁니다.

### project (`P`) — 졸업 처리 중 project 가 내는 것

졸업 처리(6-2)의 이벤트를 받은 project 가 검사에 실패하면 이 코드로 전체를 되돌립니다. 정의는 [30](30-project.md) 에 있습니다.

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 400 | `P011` | `TASK_REASSIGNMENT_MISSING` | 끝나지 않은 담당 작업마다 새 담당자나 '담당자 없음'을 골라 주세요. |
| 400 | `P012` | `INVALID_REASSIGNEE` | 새 담당자는 그 프로젝트의 재실 참여자여야 해요. |
| 400 | `P040` | `PROJECT_MANAGER_HANDOVER_MISSING` | 마지막 프로젝트 관리자인 프로젝트의 새 관리자를 골라 주세요. |

### backoffice · sso

새 코드 없음. 기존 `B001~B009`, `S001~S002` 를 그대로 씁니다.
