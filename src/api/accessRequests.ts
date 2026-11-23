// 권한 신청 — docs/api/10-member.md 7-1 ~ 7-5 (프로젝트 설정 · 권한 신청, 권한 신청하기 화면이 같이 쓴다)
import { api } from './client'
import { ago, dotDate, type MemberRef, type PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { projectRequests as mockRequests, type AccessRequestView, type RequestStatus } from '../mocks/projectSettings'

const LEVEL: Record<string, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기', BUILD: '빌드' }
const SERVICE: Record<string, string> = { VAULT: 'Vault', JENKINS: 'Jenkins' }
export const levelName = (l: string | null | undefined) => (l ? (LEVEL[l] ?? l) : null)

type AccessRequestDto = {
  requestId: number
  requester: MemberRef
  targetKind: 'PROJECT_SERVICE' | 'LAB_ROLE'
  project: { projectKey: string; name: string } | null
  service: string | null
  level: string | null
  currentLevel: string | null
  role: { code: string; name: string } | null
  reason: string
  expiresOn: string | null
  status: RequestStatus
  approverLabel: string
  canReview: boolean
  reviewer: MemberRef | null
  reviewedAt: string | null
  rejectReason: string | null
  createdAt: string
}
type AccessRequestList = { counts: Record<RequestStatus, number>; page: PageResponse<AccessRequestDto> }

const toView = (r: AccessRequestDto): AccessRequestView => ({
  requestId: r.requestId,
  requester: r.requester.name,
  ago: ago(r.createdAt),
  target: r.targetKind === 'LAB_ROLE' ? (r.role?.name ?? r.role?.code ?? '연구실 역할') : (SERVICE[r.service ?? ''] ?? r.service ?? ''),
  project: r.project?.name ?? null,
  currentLevel: levelName(r.currentLevel),
  level: levelName(r.level),
  reason: r.reason,
  expires: r.expiresOn ? dotDate(r.expiresOn) : '',
  expiresOn: r.expiresOn ?? '',
  status: r.status,
  reviewer: r.reviewer?.name ?? (r.status === 'EXPIRED' ? '시스템' : ''),
  note:
    r.status === 'REJECTED'
      ? (r.rejectReason ?? '')
      : r.status === 'APPROVED'
        ? r.expiresOn
          ? `${dotDate(r.expiresOn)} 만료`
          : '기한 없음'
        : r.status === 'EXPIRED'
          ? '기한 만료 · 기본값으로'
          : '',
  canReview: r.canReview,
  approverLabel: r.approverLabel,
})

export type AccessRequestData = { counts: Record<RequestStatus, number>; items: AccessRequestView[] }
const countOf = (items: AccessRequestView[]) => {
  const c: Record<RequestStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0, EXPIRED: 0 }
  items.forEach((r) => c[r.status]++)
  return c
}

/** 목업의 "내 신청" (권한 신청하기 화면) */
const mockMine: AccessRequestView[] = [
  { requestId: 51, requester: '김민서', ago: '어제', target: 'jenkins-admin', project: null, currentLevel: null, level: null, reason: '배포 파이프라인 점검', expires: '', expiresOn: '', status: 'PENDING', reviewer: '', note: '', canReview: false, approverLabel: 'role-manage' },
  { requestId: 47, requester: '김민서', ago: '11/16', target: 'Vault', project: '연구실 포털', currentLevel: '읽기', level: '쓰기', reason: '포털 DB 계정 추가', expires: '2026.11.30', expiresOn: '2026-11-30', status: 'APPROVED', reviewer: '박지훈', note: '11/30 까지', canReview: false, approverLabel: 'PORTAL 프로젝트 관리자' },
  { requestId: 44, requester: '김민서', ago: '11/12', target: 'Jenkins', project: '매트 센서 데이터 수집', currentLevel: '읽기', level: '빌드', reason: '수집기 재배포', expires: '', expiresOn: '', status: 'REJECTED', reviewer: '이정훈', note: '배포는 담당자만 해요', canReview: false, approverLabel: 'SENS 프로젝트 관리자' },
  { requestId: 39, requester: '김민서', ago: '10/27', target: 'Vault', project: 'DEFME 백엔드', currentLevel: '읽기', level: '쓰기', reason: 'OIDC 클라이언트 시크릿 교체', expires: '2026.11.10', expiresOn: '2026-11-10', status: 'EXPIRED', reviewer: '시스템', note: '11/10 기한 만료 · 기본값(읽기)으로', canReview: false, approverLabel: 'DEFME 프로젝트 관리자' },
]

/** 신청 목록 (7-3). scope=REVIEW + projectKey 는 프로젝트 설정, scope=MINE 은 내 신청 */
export function useAccessRequests(scope: 'MINE' | 'REVIEW', projectKey?: string) {
  return useResource<AccessRequestData>(
    ['access-requests', scope, projectKey],
    () => {
      const items = scope === 'MINE' ? mockMine : mockRequests
      return { counts: countOf(items), items }
    },
    async () => {
      const r = await api<AccessRequestList>('/auth/access-requests', { query: { scope, projectKey, size: 100 } })
      return { counts: r.counts, items: r.page.content.map(toView) }
    },
  )
}

/** 승인 · 거절 (7-5) */
export async function reviewAccessRequest(r: AccessRequestView, decision: 'APPROVE' | 'REJECT', isLive: boolean, o: { reason?: string; expiresOn?: string; me?: string }) {
  if (isLive) await api(`/auth/access-requests/${r.requestId}/review`, { method: 'POST', body: { decision, reason: o.reason || undefined, expiresOn: o.expiresOn || undefined } })
  else {
    r.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    r.reviewer = o.me ?? '나'
    r.note = decision === 'APPROVE' ? (o.expiresOn ? `${dotDate(o.expiresOn)} 만료` : '기한 없음') : (o.reason ?? '')
    r.canReview = false
  }
  invalidateAll()
}

/** 신청 취소 (7-4) */
export async function cancelAccessRequest(r: AccessRequestView, isLive: boolean) {
  if (isLive) await api(`/auth/access-requests/${r.requestId}`, { method: 'PATCH', body: { status: 'CANCELLED' } })
  else r.status = 'CANCELLED'
  invalidateAll()
}

/* ---------- 내 서비스 권한 (7-1) · 신청하기 (7-2) ---------- */

type ServiceLevel = { enabled: boolean; level: string; source: string; expiresAt: string | null }
export type MyProjectAccess = {
  projectKey: string
  name: string
  role: string
  vault: { enabled: boolean; level: string; until: string } | null
  jenkins: { enabled: boolean; level: string; until: string } | null
}
export type MyAccess = { labRoles: string[]; requestableRoles: { code: string; name: string }[]; projects: MyProjectAccess[] }

const until = (iso: string | null) => (iso ? `~${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

/** 지금 내 권한 + 신청할 수 있는 연구실 역할 (7-1, 4-1) */
export function useMyAccess() {
  return useResource<MyAccess>(
    'my-access',
    () => ({
      labRoles: ['Penpot 로그인', 'report-write'],
      requestableRoles: [
        { code: 'jenkins-admin', name: 'Jenkins 관리' },
        { code: 'notice-write', name: '공지 쓰기' },
        { code: 'calendar-manage', name: '공용 일정 관리' },
      ],
      projects: [
        { projectKey: 'DEFME', name: 'DEFME 백엔드', role: '프로젝트 관리자', vault: { enabled: true, level: 'WRITE', until: '' }, jenkins: { enabled: true, level: 'BUILD', until: '' } },
        { projectKey: 'SENS', name: '매트 센서 데이터 수집', role: '참여자', vault: { enabled: true, level: 'READ', until: '' }, jenkins: { enabled: true, level: 'READ', until: '' } },
        { projectKey: 'PORTAL', name: '연구실 포털', role: '참여자', vault: { enabled: true, level: 'WRITE', until: '~11/30' }, jenkins: null },
      ],
    }),
    async () => {
      const [a, roles, me] = await Promise.all([
        api<{
          labRoles: { code: string; name: string }[]
          projects: { project: { projectKey: string; name: string }; projectRole: string; vault: ServiceLevel; jenkins: ServiceLevel }[]
        }>('/auth/service-access/me'),
        // 명세 확인 필요: 역할 목록(4-1) 응답의 requestable 필드 이름
        api<{ code: string; name: string; requestable?: boolean }[]>('/members/roles').catch(() => []),
        api<{ roles: string[] }>('/members/me'),
      ])
      const lv = (s: ServiceLevel) => (s.enabled ? { enabled: true, level: s.level, until: until(s.expiresAt) } : null)
      return {
        labRoles: a.labRoles.map((r) => r.name),
        requestableRoles: roles.filter((r) => r.requestable && !me.roles.includes(r.code)).map((r) => ({ code: r.code, name: r.name })),
        projects: a.projects.map((p) => ({
          projectKey: p.project.projectKey,
          name: p.project.name,
          role: p.projectRole === 'MANAGER' ? '프로젝트 관리자' : '참여자',
          vault: lv(p.vault),
          jenkins: lv(p.jenkins),
        })),
      }
    },
  )
}

export type AccessRequestDraft = {
  targetKind: 'PROJECT_SERVICE' | 'LAB_ROLE'
  projectKey: string
  service: 'VAULT' | 'JENKINS'
  level: string
  roleCode: string
  reason: string
  expiresOn: string
}

/** 권한 신청 (7-2) */
export async function createAccessRequest(d: AccessRequestDraft, isLive: boolean, labels: { target: string; project: string | null; current: string | null; approver: string; me: string }) {
  if (isLive)
    await api('/auth/access-requests', {
      method: 'POST',
      body:
        d.targetKind === 'PROJECT_SERVICE'
          ? { targetKind: d.targetKind, projectKey: d.projectKey, service: d.service, level: d.level, reason: d.reason, expiresOn: d.expiresOn || undefined }
          : { targetKind: d.targetKind, roleCode: d.roleCode, reason: d.reason, expiresOn: d.expiresOn || undefined },
    })
  else
    mockMine.unshift({
      requestId: Math.max(...mockMine.map((r) => r.requestId)) + 1,
      requester: labels.me,
      ago: '방금 전',
      target: labels.target,
      project: labels.project,
      currentLevel: labels.current,
      level: d.targetKind === 'PROJECT_SERVICE' ? levelName(d.level) : null,
      reason: d.reason,
      expires: d.expiresOn ? dotDate(d.expiresOn) : '',
      expiresOn: d.expiresOn,
      status: 'PENDING',
      reviewer: '',
      note: '',
      canReview: false,
      approverLabel: labels.approver,
    })
  invalidateAll()
}
