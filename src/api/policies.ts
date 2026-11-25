// 프로젝트 정책 (ERP-40 · 41) — docs/api/30-project.md 정책 (PL-1 ~ PL-5)
// 정책 = 정한 규칙 하나와 그 이유. 키는 프로젝트마다 ERP-P12, 연구실 전체 규칙도 ERP 프로젝트에 둔다 (LAB 프로젝트는 없앰, ERP-46).
import { api } from './client'
import type { MemberRef, PageResponse } from './types'
import { useResource } from './useResource'
import { appendUnique, mergeNext, NOT_PAGED, pagedOf, type Paged } from './useLoadMore'

export type PolicyCategory = 'OPERATION' | 'DESIGN' | 'WORKFLOW' | 'AI_GUIDE'
export type PolicyStatus = 'ACTIVE' | 'REVIEW_NEEDED' | 'BROKEN' | 'RETIRED' | 'SUPERSEDED'
export type PolicySource = 'CHAT' | 'MINUTE' | 'THREAD' | 'COMMIT' | 'SCREEN' | 'IMPORT'

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  OPERATION: '운영',
  DESIGN: '설계',
  WORKFLOW: '작업 방식',
  AI_GUIDE: 'AI 지침',
}
export const STATUS_LABEL: Record<PolicyStatus, string> = {
  ACTIVE: '확정',
  REVIEW_NEEDED: '검토 필요',
  BROKEN: '근거 끊김',
  RETIRED: '내려감',
  SUPERSEDED: '대체됨',
}
export const SOURCE_LABEL: Record<PolicySource, string> = {
  CHAT: 'AI 와 대화',
  MINUTE: '회의록',
  THREAD: '스레드',
  COMMIT: '커밋 (예전)',
  SCREEN: '화면',
  IMPORT: '가져오기',
}

export type EvidenceKind = 'CODE' | 'TEST' | 'MIGRATION'

export type PolicyEvidence = {
  raw: string
  currentPath: string | null
  currentSymbol: string | null
  /** VERIFIED · UNVERIFIED · PENDING */
  verification: string
  /** OK · REVIEW_NEEDED · BROKEN */
  state: string
  /** 근거 파일을 바꾼 커밋 sha */
  lastChangeRef: string | null
  kind: EvidenceKind | null
  /** owner/repo */
  repository: string | null
  /** 파일의 GitHub 링크 (모르거나 BROKEN 이면 null) */
  url: string | null
  /** 근거 파일을 바꾼 커밋의 GitHub 링크 */
  lastChangeUrl: string | null
}

/** 정형 규칙. 안 쓰는 칸은 null · 빈 목록 */
export type PolicySpec = {
  appliesWhen: string | null
  musts: string[]
  mustNots: string[]
  exceptions: string[]
  goodExamples: string[]
  badExamples: string[]
}

export const EMPTY_SPEC: PolicySpec = { appliesWhen: null, musts: [], mustNots: [], exceptions: [], goodExamples: [], badExamples: [] }

/** 예전 응답처럼 spec 이 없거나 칸이 빠져도 빈 값으로 */
export const specOf = (p: { spec?: Partial<PolicySpec> | null }): PolicySpec => {
  const v = p.spec ?? {}
  return {
    appliesWhen: v.appliesWhen ?? null,
    musts: v.musts ?? [],
    mustNots: v.mustNots ?? [],
    exceptions: v.exceptions ?? [],
    goodExamples: v.goodExamples ?? [],
    badExamples: v.badExamples ?? [],
  }
}

export const isSpecEmpty = (v: PolicySpec) =>
  !v.appliesWhen?.trim() && !v.musts.length && !v.mustNots.length && !v.exceptions.length && !v.goodExamples.length && !v.badExamples.length

/** 정형 규칙 한도 (PolicySpecRequest) */
export const SPEC_LIMITS = { appliesWhen: 1000, items: 10, item: 500 }

export type Policy = {
  /** ERP-P12 */
  key: string
  policyNo: number
  /** 댓글 대상 ID (PROJECT_POLICY) */
  nodeId: number
  uuid: string
  title: string
  /** 한 줄 요약 */
  rule: string
  why: string | null
  /** human · ai */
  whyBy: string | null
  decidedBy: string | null
  alternatives: string[]
  category: PolicyCategory
  modules: string[]
  status: PolicyStatus
  version: number
  supersedes: string | null
  supersededBy: string | null
  sourceType: PolicySource
  sourceRef: string | null
  recordedBy: MemberRef | null
  updatedBy: MemberRef | null
  createdAt: string
  updatedAt: string
  commentCount: number
  evidence: PolicyEvidence[]
  /** 정형 규칙 (언제 · 해야 할 것 · 하지 말 것 · 예외 · 좋은 예 · 나쁜 예) */
  spec: PolicySpec
}

/** DECIDED_IN 정함 · APPLIED_IN 적용함 */
export type PolicyCommitRelation = 'DECIDED_IN' | 'APPLIED_IN'

export const RELATION_LABEL: Record<PolicyCommitRelation, string> = { DECIDED_IN: '정함', APPLIED_IN: '적용함' }

export type PolicyCommit = {
  sha: string
  summary: string | null
  relation: PolicyCommitRelation | string
  at: string
  /** owner/repo */
  repository: string | null
  /** 커밋의 GitHub 링크 */
  url: string | null
  author: MemberRef | null
  /** 구성원과 이어지지 않으면 GitHub 로그인만 */
  authorLogin: string | null
  additions: number | null
  deletions: number | null
}

export type PolicyVersion = { version: number; snapshot: Record<string, unknown>; source: string; sourceRef: string | null; at: string }

export type PolicyDetail = {
  policy: Policy
  commits: PolicyCommit[]
  versions: PolicyVersion[]
  canWrite: boolean
  canComment: boolean
}

export type PolicyList = { policies: Policy[]; canWrite: boolean } & Paged
/**
 * PL-1 응답. 백엔드가 2026-11-24 에 { canWrite, page: PageResponse } 로 바꿨다 (정책 ERP-P32).
 * 그 전 모양 { policies, canWrite } 도 그대로 읽는다 (서버가 되돌아가도 화면이 죽지 않게).
 */
type PolicyListDto = { canWrite: boolean; page?: PageResponse<Policy>; policies?: Policy[] }
const toPolicyList = (d: PolicyListDto): PolicyList => ({
  policies: d.page?.content ?? d.policies ?? [],
  canWrite: d.canWrite,
  ...(d.page ? pagedOf(d.page) : NOT_PAGED),
})

export type PolicyFilter = { query?: string; categories?: PolicyCategory[]; statuses?: PolicyStatus[] }

/** 남기기 · 고치기 본문 (고칠 때는 보낸 칸만 바뀐다. spec 은 보내면 통째로 바뀐다) */
export type PolicyInput = {
  title?: string
  rule?: string
  why?: string
  whyBy?: string
  decidedBy?: string
  alternatives?: string[]
  category?: PolicyCategory
  modules?: string[]
  supersedes?: string
  sourceType?: PolicySource
  sourceRef?: string
  evidence?: string[]
  spec?: PolicySpec
  version?: number
}

// ─────────────── 목업 ───────────────

const ME: MemberRef = { memberId: 1, name: '박제민', memberType: 'STUDENT', status: 'ACTIVE', photoUrl: null }
const KIM: MemberRef = { memberId: 2, name: '김하늘', memberType: 'STUDENT', status: 'ACTIVE', photoUrl: null }
const REPO = 'Hoseo-I-Turtle/iturtle-be'
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const NOW = new Date().toISOString()

const mockEvidence = (
  raw: string,
  kind: EvidenceKind,
  path: string,
  symbol: string | null,
  state: 'OK' | 'REVIEW_NEEDED' | 'BROKEN' = 'OK',
  lastChangeRef: string | null = null,
): PolicyEvidence => ({
  raw,
  currentPath: state === 'BROKEN' ? null : path,
  currentSymbol: state === 'BROKEN' ? null : symbol,
  verification: state === 'BROKEN' ? 'VERIFIED' : kind === 'MIGRATION' ? 'PENDING' : 'VERIFIED',
  state,
  lastChangeRef,
  kind,
  repository: REPO,
  url: state === 'BROKEN' ? null : `https://github.com/${REPO}/blob/main/${path}`,
  lastChangeUrl: lastChangeRef ? `https://github.com/${REPO}/commit/${lastChangeRef}` : null,
})

const mockPolicy = (key: string, no: number, title: string, rule: string, category: PolicyCategory, extra: Partial<Policy> = {}): Policy => ({
  key: `${key}-P${no}`,
  policyNo: no,
  nodeId: 9000 + no,
  uuid: `0193a2b4-7c1d-7e2f-9a3b-${String(no).padStart(12, '0')}`,
  title,
  rule,
  why: '사용자가 정한 이유',
  whyBy: 'human',
  decidedBy: 'human',
  alternatives: [],
  category,
  modules: [],
  status: 'ACTIVE',
  version: 1,
  supersedes: null,
  supersededBy: null,
  sourceType: 'CHAT',
  sourceRef: '2026-11-23 대화',
  recordedBy: ME,
  updatedBy: ME,
  createdAt: NOW,
  updatedAt: NOW,
  commentCount: 0,
  evidence: [],
  spec: EMPTY_SPEC,
  ...extra,
})

export const mockPolicies = (key: string): Policy[] => [
  mockPolicy(key, 4, 'GitHub 웹훅은 서명으로 확인', '웹훅 요청은 X-Hub-Signature-256 을 비밀값으로 확인한 뒤에만 처리한다', 'DESIGN', {
    status: 'REVIEW_NEEDED',
    version: 2,
    modules: ['github'],
    why: 'IP 허용 목록은 GitHub 가 대역을 바꾸면 깨지고, 프록시 뒤에서는 원래 IP 를 믿을 수 없어요. 서명은 비밀값을 아는 쪽만 만들 수 있어요.',
    alternatives: ['GitHub IP 대역 허용 목록만 쓰기', '웹훅 URL 에 토큰 쿼리 붙이기'],
    sourceType: 'MINUTE',
    sourceRef: 'minute#12',
    createdAt: hoursAgo(24 * 9),
    updatedAt: hoursAgo(5),
    updatedBy: KIM,
    commentCount: 2,
    evidence: [
      mockEvidence(
        'src/main/java/win/iturtle/github/internal/webhook/WebhookSignatureVerifier.java#verify',
        'CODE',
        'src/main/java/win/iturtle/github/internal/webhook/WebhookSignatureVerifier.java',
        'verify',
      ),
      mockEvidence(
        'test:WebhookSignatureVerifierTest#rejectsWrongSignature',
        'TEST',
        'src/test/java/win/iturtle/github/internal/webhook/WebhookSignatureVerifierTest.java',
        'rejectsWrongSignature',
        'REVIEW_NEEDED',
        '9f3c2a17d5e04b8c1a2b3c4d5e6f708192a3b4c5',
      ),
      mockEvidence('migration:V42', 'MIGRATION', 'src/main/resources/db/migration/V42__github_webhook_secret.sql', null),
    ],
    spec: {
      appliesWhen: 'GitHub 웹훅을 받는 컨트롤러 · 필터를 만들거나 고칠 때 (/api/github/webhook)',
      musts: [
        'X-Hub-Signature-256 을 저장소별 비밀값으로 HMAC-SHA256 계산해 확인한다',
        '서명 비교는 MessageDigest.isEqual 처럼 시간이 일정한 비교로 한다',
        '서명이 없거나 틀리면 401 을 돌려주고 본문은 처리하지 않는다',
      ],
      mustNots: ['IP 허용 목록만으로 대신하지 않는다', '비밀값을 로그 · 오류 메시지에 남기지 않는다'],
      exceptions: ['로컬 개발(profile=local)에서는 서명 확인을 끌 수 있다'],
      goodExamples: ['if (!verifier.verify(secret, body, header)) {\n  return ResponseEntity.status(401).build();\n}'],
      badExamples: ['if (!ALLOWED_IPS.contains(request.getRemoteAddr())) {\n  return ResponseEntity.status(403).build();\n}'],
    },
  }),
  mockPolicy(key, 3, '서버 SSH 는 관리자가 고른 구성원만', 'Gateway 규칙 lab_server_ssh 에는 SSH 허용 목록의 구성원만 넣는다', 'OPERATION', {
    modules: ['member'],
    why: '졸업 · 휴학한 사람의 접근이 남지 않게, 누가 들어갈 수 있는지 한곳에서 관리해요.',
    alternatives: ['연구실 구성원 전체 허용'],
    createdAt: hoursAgo(24 * 20),
    updatedAt: hoursAgo(24 * 3),
    spec: {
      appliesWhen: 'Cloudflare Gateway 의 lab_server_ssh 규칙을 만들거나 구성원을 넣고 뺄 때',
      musts: ['관리자 화면의 SSH 허용 목록에 있는 구성원 이메일만 규칙에 넣는다', '구성원이 졸업 · 휴학하면 같은 날 목록에서 뺀다'],
      mustNots: ['규칙에 학교 이메일 도메인 전체를 넣지 않는다'],
      exceptions: [],
      goodExamples: [],
      badExamples: [],
    },
  }),
  mockPolicy(key, 2, '제출한 주간 보고의 작업 목록은 제출 때 그대로', '작성 중이 아니면 제출 때 저장한 목록을 쓴다', 'DESIGN', {
    status: 'REVIEW_NEEDED',
    modules: ['report'],
    createdAt: hoursAgo(24 * 30),
    updatedAt: hoursAgo(24 * 2),
    evidence: [
      mockEvidence(
        'src/main/java/win/iturtle/report/internal/service/WeeklyReportService.java#taskSnapshot',
        'CODE',
        'src/main/java/win/iturtle/report/internal/service/WeeklyReportService.java',
        'taskSnapshot',
        'REVIEW_NEEDED',
        'b41e0c9a72f3d6e5a4b3c2d1e0f9a8b7c6d5e4f3',
      ),
      mockEvidence(
        'src/main/java/win/iturtle/report/internal/LegacyReportMapper.java#map',
        'CODE',
        'src/main/java/win/iturtle/report/internal/LegacyReportMapper.java',
        'map',
        'BROKEN',
      ),
    ],
    spec: {
      appliesWhen: '주간 보고를 읽어 보여 줄 때 (상세 · 목록 · 내보내기)',
      musts: ['상태가 DRAFT 가 아니면 제출 때 저장한 tasks 스냅샷을 쓴다'],
      mustNots: ['제출된 보고에 지금 작업 목록을 다시 불러 덮어쓰지 않는다'],
      exceptions: ['관리자가 반려하면 다시 DRAFT 라 지금 목록을 쓴다'],
      goodExamples: [],
      badExamples: [],
    },
  }),
  mockPolicy(key, 1, 'ERP 작업은 지금 열린 마일스톤에', '작업을 만들 때 열린 마일스톤(v1.0.0)에 넣는다', 'WORKFLOW', { alternatives: ['마일스톤 없이 만들기'] }),
]

const mockCommit = (sha: string, summary: string, relation: PolicyCommitRelation, h: number, author: MemberRef | null, login: string, add: number, del: number): PolicyCommit => ({
  sha,
  summary,
  relation,
  at: hoursAgo(h),
  repository: REPO,
  url: `https://github.com/${REPO}/commit/${sha}`,
  author,
  authorLogin: login,
  additions: add,
  deletions: del,
})

const mockCommits = (p: Policy): PolicyCommit[] =>
  p.evidence.length === 0
    ? []
    : [
        mockCommit('9f3c2a17d5e04b8c1a2b3c4d5e6f708192a3b4c5', '웹훅 서명 확인 테스트를 저장소별 비밀값으로', 'APPLIED_IN', 5, null, 'haneul-kim', 34, 12),
        mockCommit('2d7e81c0b9a4f3e2d1c0b9a8f7e6d5c4b3a29180', 'GitHub 웹훅 — X-Hub-Signature-256 확인', 'DECIDED_IN', 24 * 9, ME, 'Jam759', 128, 7),
      ]

const mockVersions = (p: Policy): PolicyVersion[] =>
  p.version > 1
    ? [
        {
          version: 1,
          snapshot: { title: p.title, description: 'GitHub 웹훅은 GitHub IP 대역에서 온 것만 받는다', status: 'ACTIVE' },
          source: 'MINUTE',
          sourceRef: 'minute#12',
          at: p.createdAt,
        },
      ]
    : []

const path = (key: string) => `/projects/${encodeURIComponent(key)}/policies`

/** 정책 목록 한 페이지 크기 (정책 ERP-P32 의 기본값) */
const POLICY_PAGE_SIZE = 20
const queryOf = (f: PolicyFilter, page: number) => ({
  query: f.query?.trim() || undefined,
  categories: f.categories?.length ? f.categories.join(',') : undefined,
  statuses: f.statuses?.length ? f.statuses.join(',') : undefined,
  page,
  size: POLICY_PAGE_SIZE,
})

/** 정책 목록의 다음 페이지 (useLoadMore 에 넘긴다) */
export const fetchMorePolicies = (key: string, filter: PolicyFilter, d: PolicyList) =>
  api<PolicyListDto>(path(key), { query: queryOf(filter, d.page + 1) }).then((r) =>
    mergeNext(d, (cur) => {
      const next = toPolicyList(r)
      return { ...cur, policies: appendUnique(cur.policies, next.policies, (p) => p.key), page: next.page, hasNext: next.hasNext }
    }),
  )

export function usePolicies(key: string | undefined, filter: PolicyFilter) {
  return useResource<PolicyList>(
    ['policies', key, filter],
    () => {
      const q = filter.query?.trim().toLowerCase()
      const live = (p: Policy) => (filter.statuses?.length ? filter.statuses.includes(p.status) : !['RETIRED', 'SUPERSEDED'].includes(p.status))
      return {
        canWrite: true,
        ...NOT_PAGED,
        policies: mockPolicies(key ?? 'ERP').filter(
          (p) => live(p) && (!filter.categories?.length || filter.categories.includes(p.category)) && (!q || `${p.key} ${p.title} ${p.rule}`.toLowerCase().includes(q)),
        ),
      }
    },
    () => api<PolicyListDto>(path(key ?? ''), { query: queryOf(filter, 0) }).then(toPolicyList),
  )
}

export function usePolicy(key: string | undefined, policyKey: string | undefined) {
  return useResource<PolicyDetail>(
    ['policy', key, policyKey],
    () => {
      const found = mockPolicies(key ?? 'ERP').find((p) => p.key.toUpperCase() === (policyKey ?? '').toUpperCase()) ?? mockPolicies(key ?? 'ERP')[0]
      return { policy: found, commits: mockCommits(found), versions: mockVersions(found), canWrite: true, canComment: true }
    },
    () => api<PolicyDetail>(`${path(key ?? '')}/${encodeURIComponent(policyKey ?? '')}`),
  )
}

/** PL-3 남기기 (참여자, 바로 확정) */
export const createPolicy = (key: string, body: PolicyInput) => api<PolicyDetail>(path(key), { method: 'POST', body })

/** PL-4 고치기 (보낸 칸만, 버전 +1. version 이 다르면 K009) */
export const updatePolicy = (key: string, policyKey: string, body: PolicyInput) =>
  api<PolicyDetail>(`${path(key)}/${encodeURIComponent(policyKey)}`, { method: 'PATCH', body })

/** PL-5 CONFIRM(근거는 바뀌었지만 그대로 맞음) · RETIRE(내림) */
export const changePolicyStatus = (key: string, policyKey: string, action: 'CONFIRM' | 'RETIRE', note?: string) =>
  api<PolicyDetail>(`${path(key)}/${encodeURIComponent(policyKey)}/status`, { method: 'POST', body: { action, note } })
