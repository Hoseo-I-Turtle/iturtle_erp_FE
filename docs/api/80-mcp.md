# 80. MCP (mcp)

AI 코딩 도구(Claude Code 등)가 부르는 **MCP 서버**입니다. REST API 가 아니라 MCP(Model Context Protocol, JSON-RPC 2.0) 이므로
[README](README.md) 의 공통 규칙 가운데 경로(1.1) · 응답 모양(1.3, `{ success, data, error }`) · 헤더(1.7)는 **따르지 않습니다**. 경로도 `/api/v1` 밖입니다.
동작 · 도구 · 인증은 [modules/mcp.md](../modules/mcp.md) 입니다. SRS 에 없는 기능이라 요구사항 번호가 없습니다 (2026-11-19 추가, [M11-mcp](../work-notes/M11-mcp.md)).

## API 목록

| 번호 | 메서드 | 경로 | 권한 | 요약 |
|------|--------|------|------|------|
| MC-1 | POST | `/mcp` | SSO `iturtle-mcp` 토큰 (Bearer) + 재실 구성원 | MCP 요청 (도구 목록 · 도구 부르기) |
| MC-2 | GET | `/.well-known/oauth-protected-resource/mcp` | 없음 | 보호 자원 정보 (RFC 9728) — AI 도구가 어디서 로그인할지 읽음 |

테이블은 쓰지 않습니다 (읽는 것은 member · project · github · knowledge 의 공개 API). Swagger 에는 나오지 않습니다 (`springdoc.paths-to-match: /api/**`).

---

### MC-1. MCP 요청

`POST /mcp`

| 항목 | 내용 |
|------|------|
| 권한 | `Authorization: Bearer <access 토큰>` — SSO 가 클라이언트 `iturtle-mcp` 에 준 JWT (서명 · 만료 · `iss` = SSO issuer · `aud` ∋ `iturtle-mcp`). 도구마다 재실 · 사용 중 · 잠기지 않은 구성원인지 다시 확인 |
| 방식 | MCP Streamable HTTP, **상태 없음**(`spring.ai.mcp.server.protocol: stateless`) — `Mcp-Session-Id` 없음, 세션 쿠키 없음 (`Set-Cookie` 를 보내지 않음) |
| 헤더 | `Content-Type: application/json`, `Accept: application/json, text/event-stream` |
| 테이블 | 없음 |

**요청 본문** — JSON-RPC 2.0. 쓰는 메서드: `initialize`, `tools/list`, `tools/call` (그 밖은 MCP 규격대로 라이브러리가 처리).

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "find_decisions", "arguments": { "project": "git@github.com:iturtle-lab/erp-be.git", "query": "웹훅" } } }
```

**도구** — 8개, 모두 읽기 전용. 인자 · 결과는 [modules/mcp.md › 도구](../modules/mcp.md#도구-8개).

| 도구 | 인자 (`*` 필수) |
|------|-----------------|
| `help` | `topic` (`start` · `commit` · `decisions`) |
| `my_tasks` | — |
| `find_decisions` | `project*`, `query`, `includeInactive`, `limit` (1~50, 기본 20) |
| `get_decision` | `project*`, `decisionId*` |
| `stale_knowledge` | `project*`, `paths` (string[]) |
| `impact` | `project*`, `target*` |
| `list_terms` | — |
| `deploy_notes` | `project*`, `since` (`YYYY-MM-DD` · ISO 시각, 기본 30일 전) |

`project` = 프로젝트 키(`ERP`) 또는 GitHub 저장소 이름(`owner/repo`, git remote 주소 그대로도 됨). 볼 수 없으면 없는 것과 같이 `MC002`.

**응답** `200 OK` — JSON-RPC 결과. 도구 결과는 `result.content[0].text` 에 JSON(또는 `help` 는 markdown) 글로 들어 있습니다.

```json
{ "jsonrpc": "2.0", "id": 1, "result": { "content": [ { "type": "text", "text": "[{\"id\":\"0193…\",\"title\":\"웹훅 대신 주기 수집\", …}]" } ], "isError": false } }
```

**에러**

| HTTP | 언제 |
|------|------|
| 401 | 토큰 없음 · 서명 틀림 · 만료 · issuer 다름 · **aud 가 `iturtle-mcp` 아님**(Vault 등 다른 서비스용 토큰). 헤더 `WWW-Authenticate: Bearer … resource_metadata="https://<ERP>/.well-known/oauth-protected-resource/mcp"` |
| 200 + `result.isError: true` | 도구 안의 오류 — `MC001` ~ `MC004` (아래). HTTP 상태는 바꾸지 않고 메시지로 AI 에게 보임 |

### MC-2. 보호 자원 정보

`GET /.well-known/oauth-protected-resource/mcp`

| 항목 | 내용 |
|------|------|
| 권한 | 없음 (로그인 없이) |
| 테이블 | 없음 (설정 `iturtle.mcp.*` — SSO issuer 에서 따라 나옴) |

MC-1 이 401 일 때 `resource_metadata` 로 알려 주는 주소입니다. AI 도구는 이것을 읽고 `authorization_servers` 의 SSO 로 로그인합니다
(클라이언트 `iturtle-mcp`, PKCE, 본인 PC `http://localhost:<포트>` 로 돌아옴 — [modules/sso.md](../modules/sso.md#기본-클라이언트-iturtle-mcp-ai-도구-2026-11-19)).

**응답** `200 OK` (공통 응답 모양이 아님). Spring Security 의 보호 자원 정보 필터가 만들고 `McpSecurityConfig` 가 아래 칸을 채웁니다 (주요 칸만).

```json
{ "resource": "https://lab.iturtle.win/mcp",
  "authorization_servers": ["https://lab.iturtle.win"],
  "scopes_supported": ["openid", "profile"],
  "bearer_methods_supported": ["header"],
  "resource_name": "iturtle ERP",
  "tls_client_certificate_bound_access_tokens": false }
```

**에러** — 없음

---

## 에러 코드

### mcp (`MC`)

도구 결과의 오류 메시지로만 보입니다 (HTTP 칸은 `ErrorCode` 에 적힌 값, MCP 응답은 200).

| HTTP | 코드 | 이름 | 메시지 |
|------|------|------|--------|
| 403 | `MC001` | `MEMBER_NOT_ACTIVE` | 재실 중인 사용 가능한 구성원만 MCP 를 쓸 수 있어요. |
| 404 | `MC002` | `PROJECT_NOT_FOUND` | 프로젝트를 찾을 수 없거나 볼 권한이 없어요. 프로젝트 키(예: ERP)나 GitHub 저장소 이름(owner/repo)을 확인해 주세요. |
| 404 | `MC003` | `DECISION_NOT_FOUND` | 결정을 찾을 수 없어요. find_decisions 로 id 를 확인해 주세요. |
| 400 | `MC004` | `INVALID_ARGUMENT` | 입력값이 올바르지 않아요. |
