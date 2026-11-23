// 프로젝트 정책 (ERP-40 · 41) — docs/api/30-project.md 정책 (PL-1 ~ PL-5)
// 정책 = 정한 규칙 하나와 그 이유. 키는 프로젝트마다 ERP-P12, 연구실 전체 정책은 LAB 프로젝트.
import { api } from './client'
import type { MemberRef } from './types'
import { useResource } from './useResource'

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

export type PolicyEvidence = {
  raw: string
  currentPath: string | null
  currentSymbol: string | null
  /** VERIFIED · UNVERIFIED · PENDING */
  verification: string
  /** OK · REVIEW_NEEDED · BROKEN */
  state: string
  lastChangeRef: string | null
}

export type Policy = {
  /** ERP-P12 */
  key: string
  policyNo: number
  /** 댓글 대상 ID (PROJECT_POLICY) */
  nodeId: number
  uuid: string
  title: string
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
}

export type PolicyDetail = {
  policy: Policy
  commits: { sha: string; summary: string | null; relation: string; at: string }[]
  versions: { version: number; snapshot: Record<string, unknown>; source: string; sourceRef: string | null; at: string }[]
  canWrite: boolean
  canComment: boolean
}

export type PolicyList = { policies: Policy[]; canWrite: boolean }

export type PolicyFilter = { query?: string; categories?: PolicyCategory[]; statuses?: PolicyStatus[] }

/** 남기기 · 고치기 본문 (고칠 때는 보낸 칸만 바뀐다) */
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
  version?: number
}

const ME: MemberRef = { memberId: 1, name: '박제민', memberType: 'STUDENT', status: 'ACTIVE', photoUrl: null }
const NOW = new Date().toISOString()

const mockPolicy = (key: string, no: number, title: string, rule: string, category: PolicyCategory, status: PolicyStatus = 'ACTIVE'): Policy => ({
  key: `${key}-P${no}`,
  policyNo: no,
  nodeId: 9000 + no,
  uuid: `0193a2b4-7c1d-7e2f-9a3b-${String(no).padStart(12, '0')}`,
  title,
  rule,
  why: '사용자가 정한 이유',
  whyBy: 'human',
  decidedBy: 'human',
  alternatives: ['다른 방법'],
  category,
  modules: category === 'OPERATION' ? ['member'] : [],
  status,
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
  evidence:
    category === 'DESIGN'
      ? [{ raw: 'src/main/java/A.java#run', currentPath: 'src/main/java/A.java', currentSymbol: 'run', verification: 'VERIFIED', state: 'OK', lastChangeRef: null }]
      : [],
})

const mockList = (key: string): Policy[] => [
  mockPolicy(key, 3, '서버 SSH 는 관리자가 고른 구성원만', 'Gateway 규칙 lab_server_ssh 에는 SSH 허용 목록의 구성원만 넣는다', 'OPERATION'),
  mockPolicy(key, 2, '제출한 주간 보고의 작업 목록은 제출 때 그대로', '작성 중이 아니면 제출 때 저장한 목록을 쓴다', 'DESIGN', 'REVIEW_NEEDED'),
  mockPolicy(key, 1, 'ERP 작업은 지금 열린 마일스톤에', '작업을 만들 때 열린 마일스톤(v1.0.0)에 넣는다', 'WORKFLOW'),
]

const path = (key: string) => `/projects/${encodeURIComponent(key)}/policies`

const queryOf = (f: PolicyFilter) => ({
  query: f.query?.trim() || undefined,
  categories: f.categories?.length ? f.categories.join(',') : undefined,
  statuses: f.statuses?.length ? f.statuses.join(',') : undefined,
  limit: 200,
})

export function usePolicies(key: string | undefined, filter: PolicyFilter) {
  return useResource<PolicyList>(
    ['policies', key, filter],
    () => {
      const q = filter.query?.trim().toLowerCase()
      const live = (p: Policy) => (filter.statuses?.length ? filter.statuses.includes(p.status) : !['RETIRED', 'SUPERSEDED'].includes(p.status))
      return {
        canWrite: true,
        policies: mockList(key ?? 'ERP').filter(
          (p) => live(p) && (!filter.categories?.length || filter.categories.includes(p.category)) && (!q || `${p.key} ${p.title} ${p.rule}`.toLowerCase().includes(q)),
        ),
      }
    },
    () => api<PolicyList>(path(key ?? ''), { query: queryOf(filter) }),
  )
}

export function usePolicy(key: string | undefined, policyKey: string | undefined) {
  return useResource<PolicyDetail>(
    ['policy', key, policyKey],
    () => {
      const found = mockList(key ?? 'ERP').find((p) => p.key.toUpperCase() === (policyKey ?? '').toUpperCase()) ?? mockList(key ?? 'ERP')[0]
      return { policy: found, commits: [], versions: [], canWrite: true, canComment: true }
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
