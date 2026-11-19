# 70. 지식 그래프 API (knowledge)

[README](README.md) 의 공통 규칙(1.7 헤더, 1.8 공통 에러, 1.10 형식, 1.11 규칙)을 따릅니다. 경로 앞의 `/api/v1` 은 줄여 씁니다.
테이블은 [db/70-knowledge.md](../db/70-knowledge.md), 동작은 [modules/knowledge.md](../modules/knowledge.md) 입니다.
SRS 에 없는 기능이라 요구사항 번호가 없습니다 (2026-11-19 추가, [M10-knowledge](../work-notes/M10-knowledge.md)).

## 공통 모양

| 이름 | 모양 | 비고 |
|------|------|------|
| `Term` | `{ termId, kind, name, title, description, status, aliases }` | 용어집 항목. `kind` = `SERVICE` · `STORE` · `DOMAIN_TERM`, `name` = 정규화한 이름(키), `title` = 처음 적은 이름 |
| `Node` | `{ nodeId, projectId, kind, key, title, description, status, version, attributes, updatedAt }` | `projectId` 0 = 용어집. `attributes` 는 JSON 그대로 (결정: `why` · `whyBy` · `decidedBy` · `alternatives` · `supersedes`) |
| `NodeRef` | `{ nodeId, kind, key, title }` | 관계의 양 끝 |
| `Evidence` | `{ evidenceId, raw, kind, currentPath, currentSymbol, originRef, verification, state, lastChangeRef }` | `kind` = `CODE` · `TEST` · `MIGRATION`, `verification` = `VERIFIED` · `UNVERIFIED` · `PENDING`, `state` = `OK` · `REVIEW_NEEDED` · `BROKEN` |
| `Edge` | `{ edgeId, relation, from: NodeRef, to: NodeRef, status, attributes, sourceKind, sourceRef, evidence: Evidence[] }` | `relation` = `USES` · `REQUIRES` · `STORED_IN` · `EXPOSES` · `IMPLEMENTS` · `SUPERSEDES` · `DECIDED_IN`, `sourceKind` = `COMMIT` · `IMPORT` · `ADMIN` · `AUTO` |
| `status` | `ACTIVE` · `UNCONFIRMED` · `REVIEW_NEEDED` · `BROKEN` · `RETIRED` · `SUPERSEDED` | 노드 · 관계 공통 (`NodeStatus`) |

---

## API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| K-1 | GET | `/knowledge/terms` | `knowledge-manage` | 용어집 |
| K-2 | POST | `/knowledge/terms` | `knowledge-manage` | 확정된 용어 만들기 |
| K-3 | POST | `/knowledge/terms/{termId}/confirm` | `knowledge-manage` | 미확인 용어 확정 |
| K-4 | POST | `/knowledge/terms/{termId}/merge` | `knowledge-manage` | 다른 용어의 별칭으로 합치기 |
| K-5 | GET | `/knowledge/projects/{projectId}/decisions` | `knowledge-manage` | 프로젝트의 결정 |
| K-6 | GET | `/knowledge/nodes/{nodeId}` | `knowledge-manage` | 노드 상세 (근거 · 관계 · 이전 버전) |
| K-7 | GET | `/knowledge/projects/{projectId}/attention` | `knowledge-manage` | 검토 필요 · 근거 끊김 |
| K-8 | POST | `/knowledge/projects/{projectId}/imports` | `knowledge-manage` | 지식 블록(YAML) 가져오기 |
| K-9 | GET | `/knowledge/convention` | `knowledge-manage` | 커밋 규격 · Skill · AGENTS.md 원본 |

`projectId` 는 프로젝트 **숫자 ID** 입니다 (프로젝트 키가 아님 — 커밋은 저장소의 `project_id` 로 들어오기 때문). 화면은 아직 없습니다.
커밋으로 들어오는 지식은 HTTP API 가 아니라 github 의 `GithubCommitIngestedEvent` 로 들어옵니다.

---

## 1. 용어집

### K-1. 용어집

`GET /api/v1/knowledge/terms`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`(범위 0, 용어 종류), `knowledge_aliases` |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string | | 없으면 모두. 미확인만 = `UNCONFIRMED` |

**응답** `200 OK` — `Term[]` (이름 순)

```json
{ "success": true, "data": [
  { "termId": 3, "kind": "SERVICE", "name": "cloudflare-tunnel", "title": "Cloudflare Tunnel", "description": "외부 공개 경로",
    "status": "ACTIVE", "aliases": ["cf-tunnel"] },
  { "termId": 9, "kind": "STORE", "name": "github-secrets", "title": null, "description": null, "status": "UNCONFIRMED", "aliases": [] }
], "error": null }
```

**에러** — 공통만

### K-2. 확정된 용어 만들기

`POST /api/v1/knowledge/terms`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`, `knowledge_aliases` |

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `kind` | string | O | `SERVICE` · `STORE` · `DOMAIN_TERM` |
| `name` | string | O | 200자 이하. 소문자 · 하이픈으로 정규화해 키로 (`Cloudflare Tunnel` → `cloudflare-tunnel`), 원문은 `title` |
| `description` | string | | 2,000자 이하 |
| `aliases` | string[] | | 같은 규칙으로 정규화, 이름과 같은 것 · 중복은 뺌 |

```json
{ "kind": "SERVICE", "name": "Cloudflare Tunnel", "description": "외부 공개 경로", "aliases": ["cf tunnel"] }
```

**응답** `201 Created` — `Term` (`status` = `ACTIVE`)

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 409 | `K003` | 같은 종류에 같은 이름, 또는 이름 · 별칭이 이미 별칭으로 있음 |
| 400 | `K006` | `kind` 가 용어 종류가 아님 |

### K-3. 미확인 용어 확정

`POST /api/v1/knowledge/terms/{termId}/confirm`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes` |

커밋 · 가져오기에서 처음 본 용어(`UNCONFIRMED`)를 `ACTIVE` 로 바꿉니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `description` | string | | 2,000자 이하. 있으면 설명을 바꿈 |

**응답** `200 OK` — `Term`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `K002` | 용어가 없음 |
| 400 | `K006` | 용어집 항목이 아님 (결정 · 설정 등의 노드 ID) |

### K-4. 다른 용어의 별칭으로 합치기

`POST /api/v1/knowledge/terms/{termId}/merge`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`(이 용어를 지움), `knowledge_aliases`, `knowledge_edges`, `knowledge_evidence`, `knowledge_node_versions` |

`termId` 용어를 `targetTermId` 의 별칭으로 합칩니다. 이 용어의 이름 · 별칭은 대상의 별칭이 되고, 이 용어를 가리키던 관계는 대상으로 옮깁니다.
대상에 같은 관계가 이미 있으면 이쪽 관계와 그 근거는 지웁니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `targetTermId` | number | O | 합칠 대상 |

```json
{ "targetTermId": 3 }
```

**응답** `200 OK` — 합친 뒤의 대상 `Term`

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `K002` | 용어 · 대상이 없음 |
| 400 | `K004` | 종류가 다름 (서비스 ↔ 저장 위치 등) |
| 400 | `K006` | 둘 중 하나가 용어집 항목이 아님 |

---

## 2. 그래프 보기

### K-5. 프로젝트의 결정

`GET /api/v1/knowledge/projects/{projectId}/decisions`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`(`kind = DECISION`) |

**쿼리 파라미터**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | string | | 없으면 모두 |

**응답** `200 OK` — `Node[]` (최신 순)

```json
{ "success": true, "data": [
  { "nodeId": 41, "projectId": 7, "kind": "DECISION", "key": "0193a2b4-7c1d-7e2f-9a3b-4c5d6e7f8a9b", "title": "웹훅 대신 주기 수집",
    "description": "…", "status": "ACTIVE", "version": 2,
    "attributes": { "why": "…", "whyBy": "human", "decidedBy": "human", "alternatives": ["웹훅만"], "supersedes": null },
    "updatedAt": "2026-11-19T05:12:00Z" }
], "error": null }
```

**에러** — 공통만 (없는 프로젝트는 빈 목록)

### K-6. 노드 상세

`GET /api/v1/knowledge/nodes/{nodeId}`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`, `knowledge_evidence`, `knowledge_edges`, `knowledge_node_versions` |

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `node` | `Node` | |
| `evidence` | `Evidence[]` | 이 노드에 붙은 근거 (결정) |
| `edges` | `Edge[]` | 이 노드에서 나가거나 들어오는 관계 (관계의 근거 포함) |
| `versions` | `{ version, snapshot, sourceKind, sourceRef, createdAt }[]` | 이전 버전 (최신 순). `snapshot` = 그 버전의 `title` · `description` · `status` · `attributes` |

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 404 | `K001` | 노드가 없음 |

### K-7. 검토 필요 · 근거 끊김

`GET /api/v1/knowledge/projects/{projectId}/attention`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_nodes`, `knowledge_edges`, `knowledge_evidence` |

사람(또는 AI)이 손봐야 하는 것: 상태가 `REVIEW_NEEDED` · `BROKEN` 인 노드와 관계.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `nodes` | `{ node: Node, evidence: Evidence[] }[]` | 결정 등 노드 |
| `relations` | `Edge[]` | uses · requires · exposes 관계 |

**에러** — 공통만

---

## 3. 가져오기 · 규격

### K-8. 지식 블록(YAML) 가져오기

`POST /api/v1/knowledge/projects/{projectId}/imports`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | `knowledge_*` 모두 |
| 외부 호출 | `repositoryId` · `ref` 가 있으면 GitHub contents API · git trees API (근거 확인) |

초기 수집 · AI 검토 스크립트가 씁니다. 커밋의 `---iturtle` 블록과 **같은 YAML · 같은 규칙**으로 넣고 근거를 확인합니다. **결과는 바로 반영됩니다** (검토 대기 없음).

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 · 설명 |
|------|------|------|-------------|
| `yaml` | string | O | 200,000자 이하. `decisions` · `uses` · `requires` · `exposes` · `confirms` · `retires` ([규격 4장](../../src/main/resources/knowledge/commit-convention.md)) |
| `modules` | string[] | | uses · requires · exposes 의 주어 모듈. 비면 프로젝트 자체 |
| `repositoryId` | number | | 근거를 확인할 저장소 (없으면 근거는 `UNVERIFIED`) |
| `ref` | string | | 근거를 확인할 시점 (커밋 sha · 브랜치), 100자 이하 |
| `note` | string | | 출처 메모 (예: `초기 수집`), 200자 이하. 관계 · 버전의 `sourceRef` 가 됨 (없으면 `import`) |

```json
{ "yaml": "decisions:\n  - id: 0193a2b4-…\n    title: …", "modules": ["github"], "repositoryId": 2, "ref": "main", "note": "초기 수집" }
```

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `decisions` | number | 넣은 결정 수 |
| `relations` | number | 넣은 uses · requires · exposes 관계 수 (주어 수만큼) |
| `unconfirmedTerms` | string[] | 새로 생긴 미확인 용어 (K-3 · K-4 로 정리) |
| `unresolved` | string[] | 찾지 못한 `confirms` · `retires` 참조 |
| `violations` | string[] | 규격 위반 (막지 않고 알림. 예: `evidence-missing`, `evidence-line-number`, `decision-id`) |

```json
{ "success": true, "data": { "decisions": 12, "relations": 30, "unconfirmedTerms": ["garage"], "unresolved": [], "violations": [] }, "error": null }
```

**에러**

| HTTP | 코드 | 언제 |
|------|------|------|
| 400 | `K005` | YAML 을 읽지 못함 (메시지에 위반 이유) |

### K-9. 커밋 규격 · AI 지침 원본

`GET /api/v1/knowledge/convention`

| 항목 | 내용 |
|------|------|
| 권한 | `knowledge-manage` |
| 테이블 | 없음 (classpath `knowledge/` 의 파일) |

ERP 가 규격 문서와 AI 용 지침의 원본을 들고 있고, 각 저장소는 여기서 내려받아 넣습니다.

**응답** `200 OK`

| 필드 | 타입 | 설명 |
|------|------|------|
| `spec` | string | `commit-convention.md` (iturtle-commit/1) |
| `skill` | string | `SKILL.md` (AI 코딩 도구 Skill) |
| `agents` | string | `AGENTS.md` (저장소 공통 규칙) |

**에러** — 공통만

---

## 에러 코드

### knowledge (`K`)

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 404 | `K001` | `NODE_NOT_FOUND` | 지식 항목을 찾을 수 없어요. |
| 404 | `K002` | `TERM_NOT_FOUND` | 용어를 찾을 수 없어요. |
| 409 | `K003` | `TERM_ALREADY_EXISTS` | 이미 있는 용어나 별칭이에요. |
| 400 | `K004` | `TERM_KIND_MISMATCH` | 같은 종류의 용어끼리만 합칠 수 있어요. |
| 400 | `K005` | `IMPORT_INVALID` | 지식 블록(YAML)을 읽지 못했어요. 형식을 확인해 주세요. |
| 400 | `K006` | `NOT_A_TERM` | 용어집 항목(서비스 · 저장 위치 · 도메인 용어)이 아니에요. |
