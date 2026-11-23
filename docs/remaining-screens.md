# 남은 화면 메모

API 는 있는데 화면이 없거나 일부만 된 것입니다 (2026-11-24 기준, `docs/api/` 의 목록 표 149개 + 기존 API 표와 `src/api/` 를 대조).
Penpot 이 살아나면 디자인부터 그리고, 그 뒤에 구현합니다. 급하면 디자인 없이 아래 메모만으로도 구현할 수 있게 적었습니다.

상태: `대기` → `디자인 완료` → `구현 완료`

---

## 0. 진행 방법

### Penpot

- 새 페이지 `07 Screens · 보완` 을 만들어 그린다. **한 페이지에 보드 20장을 넘기지 않는다** (넘으면 `08` 페이지로). 많으면 Penpot 이 느려진다.
- 보드는 1600 × 1160, 이름은 `Screen · 이름`. 내용이 넘치면 높이만 늘린다.
- `06 Screens · 추가` 의 보드를 복제해 틀(사이드바 · 헤더 · 탭)로 쓴다. 다른 페이지의 보드는 복제가 안 되므로, 틀로 쓸 보드를 먼저 `07` 페이지에 하나 복사해 두거나 `06` 에서 만든 뒤 옮긴다.
- 작업하는 동안 Penpot 탭을 화면에 띄워 둔다 (가려지면 플러그인이 잠들어 끊긴다). 한 번 실행에 화면 하나씩 그린다 (2분 넘으면 시간 초과).
- 연구실 주소(`penpot.iturtle.win`)가 안 열리면 WARP 가 켜져 있는지 먼저 본다.

### 코드

- 화면 = `src/pages/…` (화면 + 같은 이름의 `.module.css`), 데이터 = `src/api/…` (`useResource(키, 목업, 실서버)`), 목업 = `src/mocks/…`.
- 저장한 뒤에는 `invalidateAll()` 을 불러 목록을 다시 받는다 (`src/api/useResource.ts`). 목업 모드에서는 목업 배열을 직접 고친 뒤 부른다.
- 폼 · 확인 창은 공통 컴포넌트를 쓴다: `Modal`, `ConfirmDialog`, `Field`, `TextInput`, `TextArea`, `Select block`, `ToggleChip`, `OptionCard`, `FormRow`, `FormError`, `SearchBox`, `SmallButton` (`src/components/ui/`).
- 색은 직접 적지 않고 `src/styles/tokens.css` 의 이름만 쓴다 (테마가 바뀌어도 따라가게).
- 디자인에는 있는데 명세에 없는 것은 빼고 `명세 확인 필요` 주석을 남긴다.
- 끝나면 `npx tsc -b`, `npx oxlint`, `npx vite build` (Git Bash 에서 `node` 를 못 찾으면 PowerShell 에서).

---

## 1. 화면이 아예 없는 것 (16건)

| # | 화면 · 창 | API (명세 위치) | 들어가는 곳 | 상태 |
|---|----------|----------------|------------|------|
| 1 | 공지 고치기 | N-4 `PATCH /notices/{id}` (20 · N-4) | 공지 상세의 연필 버튼 | 대기 |
| 2 | 공지 지우기 확인 | N-5 `DELETE /notices/{id}` | 공지 상세 더 보기 | 대기 |
| 3 | 일정 고치기 | CL-4 `PATCH /calendar-events/{id}` (20 · CL-4) | 캘린더에서 일정을 눌렀을 때 | 대기 |
| 4 | 일정 지우기 확인 | CL-5 `DELETE /calendar-events/{id}` | 일정 상세 | 대기 |
| 5 | 모임 날짜 고치기 · 확정 취소 · 모임 취소 | MP-7 `PATCH /meeting-polls/{id}` (20 · MP-7) | 모임 날짜 정하기 화면 (만든 사람만) | 대기 |
| 6 | 프로젝트 모임 날짜 만들기 | P-31 `POST /projects/{key}/meeting-polls` (30 · P-31) | 프로젝트 홈 · 새로 만들기 메뉴 | 대기 |
| 7 | 작업 지우기 확인 | T-6 `DELETE /tasks/{key}` (31 · T-6) | 작업 상세 더 보기 | 대기 |
| 8 | 체크리스트 항목 지우기 | T-10 `DELETE /tasks/{key}/checklist-items/{id}` | 작업 상세 체크리스트 | 대기 |
| 9 | 회의록 지우기 확인 | MM-5 `DELETE /meeting-minutes/{id}` (32 · MM-5) | 회의록 상세 | 대기 |
| 10 | 연구실 회의 할 일 체크 | MM-9 `PATCH /meeting-minutes/{id}/actions/{actionId}` | 회의록 목록 옆 "나에게 온 할 일", 회의록 상세 | 대기 |
| 11 | 댓글 고치기 | CM-3 `PATCH /comments/{id}` (60 · CM-3) | 공지 · 작업 · 스레드 · 주간 보고 · 자료의 내 댓글 | 대기 |
| 12 | 졸업 · 퇴실 처리 기록 | 6-3 `GET /members/{id}/departures` (10 · 6-3) | 관리 · 구성원에서 졸업생을 골랐을 때 | 대기 |
| 13 | 재실로 되돌리기 | 6-4 `POST …/departures/{id}/reinstate` (10 · 6-4) | 처리 기록의 맨 위 항목 | 대기 |
| 14 | 역할 "신청 가능" 켜기 · 끄기 | 4-2 `PATCH /members/roles/{code}` (10 · 4-2) | 관리 · 권한 프리셋에 역할 목록 칸 | 대기 |
| 15 | 올리던 파일 취소 | F-3 `DELETE /files/{publicId}` (40 · F-3) | 자료 올리기 · 공지 쓰기의 파일 줄 X 버튼 | 대기 |
| 16 | 로그아웃 | 서버의 폼 로그아웃 `POST /logout` (기존, 명세 표에는 없음) | 설정 화면 맨 아래 | 대기 |

### 항목별 메모

**1 · 2. 공지 고치기 · 지우기**
- 새 공지 창(`src/pages/notices/NoticeWriteModal.tsx`)을 고치기로도 쓰게 한다: 처음 값을 공지 상세(`useNoticeDetail`)에서 채우고, 저장은 `PATCH`.
- 보낸 필드만 바뀐다. `pinnedUntilOn: null` = 고정 해제. `attachmentFileIds` 는 통째로 바꾼다.
- 필독 공지만 `resetReads: true` (다시 읽음 확인) 를 보낼 수 있다 → 고치기 창에 "다시 읽음 확인 받기" 체크.
- 투표: 표가 하나라도 있으면 질문 · 선택지 · 복수 선택 · 결과 공개 · 대상은 못 바꾼다. 마감(`poll.closesAt`)은 언제나 바꿀 수 있고, `poll.closeNow: true` 는 지금 마감. **익명 여부는 보낼 수 없다** (400 `N006`) → 고치기 창에서는 익명 칩을 잠근다.
- 권한: 작성자 · `content-manage` (투표 부분은 작성자만). 상세 응답의 `canEdit` 으로 버튼을 보인다.
- 지우기: `ConfirmDialog` + "투표 · 댓글 · 첨부도 함께 숨겨져요". 끝나면 `/notices` 로.

**3 · 4. 일정 고치기 · 지우기 (+ 일정 상세)**
- 지금 캘린더는 일정 한 줄 정보만 보여 준다. 일정을 누르면 상세(CL-2 `GET /calendar-events/{id}`)를 창으로 띄우고 거기에 고치기 · 지우기 버튼을 둔다.
- 새 일정 창(`src/pages/calendar/EventCreateModal.tsx`)을 고치기로도 쓴다. `calendarType` 은 못 바꾼다 (공용 ↔ 개인).
- **반복 일정이면 먼저 범위를 묻는다**: `scope=THIS`(이 일정만) · `FOLLOWING`(이후 모두) · `ALL`(모두), 그리고 `occurrence=<그 회차의 원래 시작 시각>` 을 쿼리로 보낸다.
  - `THIS` 는 제목 · 시각 · 장소만 바꿀 수 있다 → 나머지 칸은 잠근다.
- 지우기도 같은 범위를 묻는다.
- 권한: 공용은 만든 사람 · `calendar-manage`, 개인은 본인.

**5. 모임 날짜 고치기 · 확정 취소 · 모임 취소**
- 화면: `src/pages/calendar/SchedulePollPage.tsx` (만든 사람에게만 버튼).
- 고칠 수 있는 것: 제목 · 설명 · 장소 · 온라인 링크 · 응답 마감(`OPEN` 일 때만). 후보 날짜 · 시간 범위 · 대상은 못 바꾼다.
- `status: "OPEN"` (확정 → 다시 응답 받기, 만든 일정 지움) · `status: "CANCELLED"` (모임 취소). 둘 다 확인 창 + "대상에게 취소 알림이 가요".

**6. 프로젝트 모임 날짜 만들기**
- 모임 날짜 만들기 화면(`src/pages/calendar/PollCreatePage.tsx`)을 `/projects/:key/…` 에서도 열 수 있게 하고, 대상을 그 프로젝트 참여자로 채운다. 저장은 `POST /projects/{key}/meeting-polls` (서버가 참여자를 펼친다). 본문은 30 · P-31 확인.

**7 · 8. 작업 지우기 · 체크리스트 항목 지우기** — 아래 2장의 "작업 고치기"와 한 화면에서 같이 한다.
- 작업 지우기 권한: PM 급 · 만든 사람.

**9 · 10. 회의록 지우기 · 할 일 체크**
- 지우기 권한: 작성자 · PM · `project-manage`. 끝나면 회의록 목록으로.
- 할 일 체크는 `{ "done": true }` 만 보낸다. 회의록 버전을 올리지 않으므로 낙관적으로 바로 바꾼다.
- 회의록 목록의 "나에게 온 할 일"은 **모아 주는 API 가 없다** (`src/api/minutes.ts` 의 `명세 확인 필요`). 실서버에서는 비어 있다 → 명세에 더하거나 칸을 뺀다.

**11. 댓글 고치기**
- `{ body, attachmentFileIds? }`. 내 댓글에만 연필을 보이고, 고친 뒤 "수정됨"을 붙인다 (응답의 `editedAt`).
- 댓글 지우기(CM-4)는 지금 자료 상세에만 있다. 공지 · 작업 · 스레드 · 주간 보고에도 같이 넣는다.
- 댓글 화면이 화면마다 따로 구현돼 있다 (`NoticeDetailPage`, `TaskDetailPage`, `ThreadPage`, `WeeklyReportPage`, `DocumentDetailPage`). **이번에 공통 컴포넌트 하나(`components/Comments`)로 묶으면 고치기 · 지우기를 한 번만 만들면 된다.**

**12 · 13. 졸업 처리 기록 · 재실로 되돌리기**
- 기록 항목: 종류(`kind`), 처리한 날(`departedOn`), 거둔 역할(`revokedRoleCodes`), 이전 참여 프로젝트(`formerProjects`), GitHub 조직 제거 상태(`githubRemovalStatus`), 되돌린 시각(`restoredAt`), 처리한 사람.
- 되돌리기는 **마지막 처리 기록에만** 할 수 있다 (409 `M034`). `{ "restoreRoles": true|false }` — 거둔 역할을 다시 줄지 묻는다 (`true` 는 `role-manage` 도 필요).
- 안내 문구: "프로젝트 참여는 되돌리지 않아요. GitHub 조직은 다시 연결하면 초대돼요."

**14. 역할 "신청 가능"**
- `{ "requestable": true|false }`. `ADMIN` 분류 역할은 켤 수 없다 → 스위치를 잠근다.
- 역할 목록은 `GET /members/roles` (이미 `fetchRoles` 로 받고 있다, `src/api/admin.ts`).

**15. 올리던 파일 취소**
- 아직 글에 안 붙은 파일을 뺄 때 `DELETE /files/{publicId}` 를 부른다 (지금은 목록에서만 뺀다 → 서버에 24시간 남는다).
- 고칠 곳: `DocumentUploadModal`, `NoticeWriteModal`.

**16. 로그아웃**
- 설정 화면(`src/pages/settings/SettingsPage.tsx`)의 "기타" 묶음에 "로그아웃"을 넣는다.
- 실서버: 서버의 로그아웃을 부른 뒤(`src/api/client.ts` 에 `formLogout` 을 `formLogin` 옆에 만든다 — CSRF 헤더 필요) `/login?logout` 으로 보낸다. 목업: 바로 `/login?logout`.
- 비밀번호 변경 화면(`PasswordChangePage.tsx`)의 "로그아웃" 글자도 같은 함수를 쓰게 고친다 (지금은 화면만 옮겨 가서 세션이 남는다).
- 명세 확인 필요: 로그아웃 경로 · 방식 (기존 백엔드의 폼 로그아웃, 연동 서비스까지 로그아웃되는지).

---

## 2. 화면이 일부만 된 것 (10건)

| # | 모자란 부분 | API | 지금 상태 | 상태 |
|---|------------|-----|----------|------|
| 17 | 작업 고치기 (제목 · 설명 · 유형 · 우선순위 · 담당자 · 요청자 · 기한 · 라벨 · 마일스톤 · 첨부) | T-4 `PATCH /tasks/{key}` (31 · T-4) | 보드에서 순서 바꾸기만 | 대기 |
| 18 | 체크리스트 항목 더하기 · 내용 고치기 · 순서 | T-8, T-9 | 만들 때만 넣고, 상세에서는 체크만 | 대기 |
| 19 | 자료 고치기 (제목 · 본문 · 카테고리 · 프로젝트 · 공개 범위 · 태그 · 링크 · 파일 빼기) | D-4 `PATCH /documents/{id}` (40 · D-4) | 버튼 비활성. 고정 · 해결 표시만 | 대기 |
| 20 | 마일스톤 고치기 (이름 · 설명 · 기한) | P-30 (30 · P-30) | 닫기 · 다시 열기만 | 대기 |
| 21 | 프로젝트 상태 바꾸기 (준비 · 진행 · 보류 · 완료) | P-4 `status` | 보관 · 보관 풀기만 | 대기 |
| 22 | 참여자 뺄 때 담당 작업을 누구에게 넘길지 고르기 | P-8, P-9a (30 · P-8) | 전부 "담당자 없음"으로 넘김 | 대기 |
| 23 | 스레드 글 · 답글에 첨부 넣기 | H-2, CM-2 | 첨부 없이 올림 (`ThreadPage.tsx` 의 TODO 두 곳) | 대기 |
| 24 | 연구실 회의록 (프로젝트에 속하지 않는 회의) | MM-1 `scope=LAB`, MM-2 (projectKey 없이) | 프로젝트 안에서만. 캘린더의 "이 날 회의록 만들기"도 연결 안 됨 | 대기 |
| 25 | 일정 상세 | CL-2 | 캘린더에서 한 줄 정보만 | 대기 (3 · 4 와 함께) |
| 26 | 관리 헤더의 "프리셋 만들기" 버튼 | 5-2 | 버튼이 아무 동작 안 함 (`AdminLayout.tsx`). 프리셋 화면 안에 만들기가 따로 있는지 확인 필요 | 대기 |

### 항목별 메모

**17 · 18 (+ 7 · 8). 작업 고치기**
- 화면: `src/pages/projects/TaskDetailPage.tsx`. 새 작업 창(`TaskCreateModal.tsx`)을 고치기로도 쓰거나, 상세에서 칸마다 바로 고치게 한다.
- **꼭 `version` 을 같이 보낸다** (T-3 에서 받은 값). 다르면 409 `P101` → "다른 사람이 먼저 저장했어요" 를 보이고 다시 불러온다.
- 상태는 여기서 못 바꾼다 (T-7 `transition`). 본문에 `status` 를 넣으면 400.
- `labelIds` · `attachmentFileIds` 는 통째로 바꾼다. `assigneeMemberId: null` = 담당자 없음.
- 체크리스트는 작업 버전과 따로다 (T-8 더하기 `{ content, assigneeMemberId?, afterItemId? }`, T-9 고치기 · 체크 · 순서, T-10 지우기).
- 선택지(참여자 · 라벨 · 마일스톤)는 `useTaskList(key)` 가 이미 준다 (`src/api/tasks.ts`).

**19. 자료 고치기**
- 올리기 창(`src/pages/library/DocumentUploadModal.tsx`)을 고치기로도 쓴다. 넣은 필드만 바뀐다.
- `tags` · `links` 는 통째로 바꾼다. 파일 빼기는 `removeFileNames: [이름]` (그 이름의 모든 버전). 빼고 나서 본문도 파일도 없으면 `D003`.
- `projectKey: null` 로 연결을 끊을 때 공개 범위가 "참여자만"이면 함께 `LAB` 으로 바꿔야 한다.

**20. 마일스톤 고치기 · 닫기**
- 화면: `src/pages/projects/TimelinePage.tsx` 의 마일스톤 보기 (지금은 닫기 버튼만). 새 마일스톤 창(`MilestoneCreateModal.tsx`)을 고치기로도 쓴다.
- 닫을 때 끝나지 않은 작업이 있으면 `openTasks: { action: 'MOVE', targetMilestoneId }` 또는 `{ action: 'CLEAR' }` 를 골라야 한다. 지금은 묻지 않고 `CLEAR` 로 보낸다 (`src/api/timeline.ts` 의 `setMilestoneClosed`) → 확인 창에서 고르게 한다.

**21. 프로젝트 상태**
- 설정 · 일반(`src/pages/projects/settings/BasicTabs.tsx` 의 `GeneralForm`)에 상태 고르기를 넣는다. `saveProjectGeneral` 의 본문에 `status` 를 더하면 된다.
- 보관(`ARCHIVED`)은 따로 있는 보관 · 삭제 탭에서만.

**22. 참여자 빼기 · 작업 넘기기**
- 지금: `removeProjectMember` (`src/api/projectSettings.ts`) 가 그 사람의 끝나지 않은 작업을 모두 `null` 로 넘긴다.
- 고칠 것: 빼기 전에 `GET /projects/handover?memberId=&projectKey=` 를 불러 `openTasks` 와 `candidates` 를 받고, 작업마다 넘길 사람을 고르게 한다. `lastManager: true` 면 뺄 수 없다 (먼저 다른 사람을 관리자로).
- 관리 · 졸업 처리 화면이 같은 API 를 이미 쓴다 (`useHandover`, `src/api/admin.ts`) — 그 화면의 고르기 UI 를 참고.

**23. 스레드 첨부**
- `uploadFile` (`src/api/content.ts`) 로 올린 뒤 `attachmentFileIds` 에 넣는다. 글 20개 · 답글 5개까지. `createThread` · `replyToThread` 가 지금은 빈 배열을 보낸다.

**24. 연구실 회의록**
- 주소가 없다. `/minutes` (연구실 회의록 목록 · 쓰기 · 상세) 를 프로젝트 밖에 하나 만들고, 회의록 목록 · 쓰기 화면(`MinuteListPage`, `MinuteWritePage`)을 `projectKey` 없이도 돌게 한다.
- 캘린더의 "이 날 회의록 만들기" (`CalendarPage.tsx` 290줄 근처 주석) 를 여기로 잇는다: 일정 값(제목 · 시각 · 장소 · 참석자)으로 채우고 `calendarEventId` 를 보낸다.
- 지울 수 있는 사람이 명세에서 미정이다 (README 3.6 A3: 작성자 · `project-manage` 제안).

---

## 3. 화면이 필요 없는 API

- G-2 `GET /github/link/callback` — GitHub 이 돌려보내는 주소 (서버가 내 프로필로 넘긴다)
- G-9 `POST /webhooks/github` — GitHub 웹훅
- `GET /sso/clients` — 지금은 관리 · 공통코드가 `SSO_APP` 코드로 대신 보여 줘서 쓰지 않는다

---

## 4. Penpot 보드 계획 (`07 Screens · 보완`, 16장)

| # | 보드 | 담는 항목 |
|---|------|----------|
| 1 | 공지 고치기 | 1, 2 |
| 2 | 일정 상세 | 25 |
| 3 | 일정 고치기 · 지우기 (반복 범위) | 3, 4 |
| 4 | 모임 날짜 관리 | 5 |
| 5 | 프로젝트 모임 날짜 만들기 | 6 |
| 6 | 작업 고치기 | 7, 8, 17, 18 |
| 7 | 연구실 회의록 | 9, 10, 24 |
| 8 | 댓글 고치기 · 지우기 | 11 |
| 9 | 졸업 처리 기록 | 12, 13 |
| 10 | 역할 · 프리셋 | 14, 26 |
| 11 | 자료 고치기 | 19 |
| 12 | 마일스톤 고치기 · 닫기 | 20 |
| 13 | 프로젝트 상태 바꾸기 | 21 |
| 14 | 참여자 빼기 · 작업 넘기기 | 22 |
| 15 | 스레드 글쓰기 · 첨부 | 15, 23 |
| 16 | 설정 · 테마 · 로그아웃 | 16 (+ 이미 코드로 만든 설정 · 테마 화면을 디자인에도 남긴다) |

## 5. 구현 순서 제안

디자인 없이도 바로 할 수 있고 영향이 큰 것부터입니다.

1. 로그아웃 (16) — 실서버에서 꼭 필요
2. 작업 고치기 · 지우기 · 체크리스트 (7, 8, 17, 18) — 가장 자주 쓰는 화면
3. 댓글 공통 컴포넌트 + 고치기 · 지우기 (11)
4. 공지 고치기 · 지우기 (1, 2), 자료 고치기 (19) — 만들기 창을 고치기로 넓히는 같은 종류의 일
5. 일정 상세 · 고치기 · 지우기 (3, 4, 25)
6. 마일스톤 고치기 · 닫기 (20), 프로젝트 상태 (21), 참여자 빼기 (22)
7. 회의록 지우기 · 할 일 체크 · 연구실 회의록 (9, 10, 24)
8. 모임 날짜 관리 · 프로젝트 모임 (5, 6)
9. 졸업 처리 기록 · 되돌리기 (12, 13), 역할 신청 가능 · 프리셋 만들기 (14, 26)
10. 스레드 첨부 · 올리기 취소 (15, 23)
