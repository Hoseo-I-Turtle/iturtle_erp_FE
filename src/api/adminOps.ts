// 관리 화면 추가분 — 구성원 추가(10-member 3-1), 공통코드 추가(기존 backoffice), Vault 경로 묶기(30-project P-22 · P-23),
// 연동 상태(P-20 · 10-member 9-1), 파일 사용량(40-document-file F-5)
import { api } from './client'
import { ago, dotDate, type MemberRef, type PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { CODES, CODES_AT_ROOT } from './admin'
import { formatBytes, kstHm, kstYmd } from './communication'
import { MOCK_ME } from './projects'
import { adminMembers, presets as mockPresets } from '../mocks/admin'
import { codeGroups as mockCodeGroups, codeRows as mockCodeRows } from '../mocks/adminOps'

const mdHm = (iso: string) => {
  const d = kstYmd(iso)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${kstHm(iso)}`
}

/* ================= 구성원 추가 (3-1) ================= */

export type MemberDraft = {
  name: string
  loginId: string
  memberNo: string
  memberType: 'PROFESSOR' | 'STUDENT' | 'INTERN'
  joinedOn: string
  email: string
  phone: string
  /** 프리셋 id (없으면 '') */
  presetId: string
}
const TYPE_LABEL = { PROFESSOR: '교수', STUDENT: '학생', INTERN: '인턴' } as const

/** 구성원을 만들고 한 번만 보이는 임시 비밀번호를 돌려준다 */
export async function createMember(d: MemberDraft, isLive: boolean, roleCodes: string[]) {
  let temporaryPassword: string
  if (isLive) {
    const r = await api<{ memberId: number; loginId: string; temporaryPassword: string }>('/members', {
      method: 'POST',
      body: {
        studentNumber: d.memberNo,
        loginId: d.loginId,
        name: d.name,
        memberType: d.memberType,
        joinedOn: d.joinedOn,
        email: d.email || null,
        phone: d.phone || null,
        // 프리셋 id 는 실서버에서 숫자다
        presetIds: d.presetId ? [Number(d.presetId)] : [],
        roleCodes,
      },
    })
    temporaryPassword = r.temporaryPassword
  } else {
    const preset = mockPresets.find((p) => p.id === d.presetId)
    adminMembers.unshift({
      memberId: Math.max(...adminMembers.map((m) => m.memberId)) + 1,
      name: d.name,
      loginId: d.loginId,
      memberNo: d.memberNo,
      memberType: TYPE_LABEL[d.memberType],
      state: 'ACTIVE',
      graduated: false,
      presets: preset ? [preset.name] : [],
      roles: roleCodes,
      lastLogin: '아직 없음',
      tempPassword: true,
      failCount: 0,
    })
    const part = () => Math.random().toString(36).slice(2, 6)
    temporaryPassword = `${part()}-${part()}-${part()}`
  }
  invalidateAll()
  return temporaryPassword
}

/* ================= 공통코드 그룹 · 행 추가 ================= */

export type CodeRowDraft = { code: string; name: string; ref1: string; ref2: string; ref4: string; sortOrder: string; enabled: boolean }

// 명세 확인 필요: 기존 backoffice 공통코드 만들기의 경로 · 본문 (그룹 = POST /common-codes, 상세 = POST /common-codes/{codeId}/details 로 짐작)
export async function createCodeGroup(code: string, name: string, isLive: boolean) {
  if (isLive) await api(CODES, { method: 'POST', body: { codeId: code, codeName: name }, root: CODES_AT_ROOT })
  else {
    mockCodeGroups.push({ code, name, isNew: true })
    mockCodeRows[code] = { desc: '', columns: ['ref1', 'ref2', 'ref4', '사용'], rows: [] }
  }
  invalidateAll()
}

export async function createCodeRow(groupCode: string, d: CodeRowDraft, isLive: boolean) {
  if (isLive)
    await api(`${CODES}/${encodeURIComponent(groupCode)}/details`, {
      method: 'POST',
      body: { detailCode: d.code, detailName: d.name, ref1: d.ref1 || null, ref2: d.ref2 || null, ref4: d.ref4 || null, sortOrder: d.sortOrder ? Number(d.sortOrder) : undefined, enabled: d.enabled },
      root: CODES_AT_ROOT,
    })
  else {
    const t = (mockCodeRows[groupCode] ??= { desc: '', columns: ['ref1', 'ref2', 'ref4', '사용'], rows: [] })
    t.rows.push({ code: d.code, name: d.name, ref1: d.ref1, ref2: d.ref2.split(',').map((x) => x.trim()).filter(Boolean), ref4: d.ref4, enabled: d.enabled })
  }
  invalidateAll()
}

/* ================= Vault 경로 묶기 (P-22, P-23) ================= */

export type VaultPathStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type VaultPathRequest = {
  requestId: number
  requester: string
  projectKey: string
  projectName: string
  vaultPath: string
  status: VaultPathStatus
  requested: string
  reviewer: string
  note: string
}
type VaultPathDto = {
  requestId: number
  project: { projectKey: string; name: string }
  vaultPath: string
  status: VaultPathStatus
  requestedBy: MemberRef
  requestedAt: string
  reviewedBy: MemberRef | null
  reviewedAt: string | null
  rejectReason: string | null
}

const mockVaultPaths: VaultPathRequest[] = [
  { requestId: 3, requester: '김민서', projectKey: 'DEFME', projectName: 'DEFME 백엔드', vaultPath: 'secret/defme/', status: 'PENDING', requested: '11/16 11:00', reviewer: '', note: '' },
  { requestId: 2, requester: '박지훈', projectKey: 'SENS', projectName: '매트 센서 데이터 수집', vaultPath: 'secret/sensor/', status: 'APPROVED', requested: '11/10 09:20', reviewer: '정재훈', note: '11/10 승인 · Vault 정책 반영 완료' },
  { requestId: 1, requester: '이정훈', projectKey: 'LAB', projectName: '연구실 공용', vaultPath: 'secret/lab-common/', status: 'APPROVED', requested: '11/04 14:00', reviewer: '정재훈', note: '11/04 승인 · Vault 정책 반영 완료' },
  { requestId: 0, requester: '최현우', projectKey: 'PORTAL', projectName: '연구실 포털', vaultPath: 'secret/defme/api/', status: 'REJECTED', requested: '11/02 10:00', reviewer: '정재훈', note: 'secret/defme/ 아래는 DEFME 가 쓰고 있어요. LAB 에 묶어 주세요.' },
]

export function useVaultPathRequests() {
  return useResource<VaultPathRequest[]>(
    'vault-path-requests',
    () => mockVaultPaths,
    async () => {
      const r = await api<{ page: PageResponse<VaultPathDto> }>('/vault-path-requests', { query: { size: 100 } })
      return r.page.content.map((x) => ({
        requestId: x.requestId,
        requester: x.requestedBy.name,
        projectKey: x.project.projectKey,
        projectName: x.project.name,
        vaultPath: x.vaultPath,
        status: x.status,
        requested: mdHm(x.requestedAt),
        reviewer: x.reviewedBy?.name ?? '',
        note: x.status === 'REJECTED' ? (x.rejectReason ?? '') : x.reviewedAt ? `${mdHm(x.reviewedAt)} 승인` : '',
      }))
    },
  )
}

export async function reviewVaultPath(r: VaultPathRequest, decision: 'APPROVE' | 'REJECT', reason: string, isLive: boolean) {
  if (isLive) await api(`/vault-path-requests/${r.requestId}/review`, { method: 'POST', body: { decision, reason: reason || undefined } })
  else {
    r.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    r.reviewer = MOCK_ME
    r.note = decision === 'APPROVE' ? '방금 승인 · Vault 정책 반영 중' : reason
  }
  invalidateAll()
}

/* ================= 연동 상태 (P-20, 9-1) ================= */

export type DriftRow = { projectKey: string; projectName: string; service: 'Vault' | 'Jenkins'; state: 'FAILED' | 'DRIFT' | 'PENDING' | 'OK'; message: string; checked: string }
export type JobRun = { runId: number; jobName: string; desc: string; started: string; duration: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; processed: string; error: string }
export type OpsData = { drift: DriftRow[]; jobs: JobRun[] }

const JOB_DESC: Record<string, string> = {
  'service-access-reconcile': 'Vault · Jenkins 권한 대조',
  'github-rescan': 'GitHub 커밋 다시 모으기',
  'file-purge': '지운 파일 완전 삭제',
  'access-request-expire': '권한 기한 만료 · 3일 전 알림',
  'signup-purge': '처리한 가입 신청 정리',
}

const mockOps: OpsData = {
  drift: [
    { projectKey: 'DEFME', projectName: 'DEFME 백엔드', service: 'Jenkins', state: 'FAILED', message: 'Jenkins 가 응답하지 않았어요', checked: '오늘 05:00' },
    { projectKey: 'SENS', projectName: '매트 센서 데이터 수집', service: 'Vault', state: 'DRIFT', message: '정책에 없는 경로 secret/sens/legacy/ 가 Vault 에 남아 있어요', checked: '오늘 05:00' },
    { projectKey: 'LAB', projectName: '연구실 공용', service: 'Jenkins', state: 'DRIFT', message: '참여자 2명이 Jenkins 역할에 없어요', checked: '오늘 05:00' },
    { projectKey: 'PORTAL', projectName: '연구실 포털', service: 'Vault', state: 'PENDING', message: '구성원별 수준 변경 반영 중', checked: '방금 전' },
    { projectKey: 'PAPER', projectName: 'KCC 2027 투고', service: 'Vault', state: 'OK', message: '', checked: '오늘 05:00' },
  ],
  jobs: [
    { runId: 5, jobName: 'service-access-reconcile', desc: JOB_DESC['service-access-reconcile'], started: '11/23 05:00', duration: '실행 중', status: 'RUNNING', processed: '—', error: '' },
    { runId: 4, jobName: 'github-rescan', desc: JOB_DESC['github-rescan'], started: '11/23 04:00', duration: '—', status: 'FAILED', processed: '—', error: 'GitHub API 한도를 넘었어요 (403 rate limit)' },
    { runId: 3, jobName: 'file-purge', desc: JOB_DESC['file-purge'], started: '11/23 03:30', duration: '12초', status: 'SUCCEEDED', processed: '31건', error: '' },
    { runId: 2, jobName: 'access-request-expire', desc: JOB_DESC['access-request-expire'], started: '11/23 00:05', duration: '1초', status: 'SUCCEEDED', processed: '2건', error: '' },
    { runId: 1, jobName: 'signup-purge', desc: JOB_DESC['signup-purge'], started: '11/23 00:00', duration: '1초', status: 'SUCCEEDED', processed: '0건', error: '' },
  ],
}

type DriftDto = { project: { projectKey: string; name: string }; service: 'VAULT' | 'JENKINS'; enabled: boolean; provisionStatus: 'PENDING' | 'DONE' | 'FAILED'; provisionError: string | null; reconciledAt: string | null; driftDetected: boolean }
type JobRunDto = { runId: number; jobName: string; startedAt: string; finishedAt: string | null; status: JobRun['status']; processedCount: number | null; errorMessage: string | null }

export function useOps() {
  return useResource<OpsData>(
    'admin-ops',
    () => mockOps,
    async () => {
      // 두 목록은 권한이 다르다 (sso-admin · code-manage). 한쪽을 못 봐도 다른 쪽은 보여 준다
      const [drift, jobs] = await Promise.all([
        api<PageResponse<DriftDto>>('/projects/service-access', { query: { size: 100 } }).catch(() => null),
        api<PageResponse<JobRunDto>>('/backoffice/job-runs', { query: { size: 30 } }).catch(() => null),
      ])
      return {
        drift: (drift?.content ?? [])
          .filter((d) => d.enabled)
          .map((d) => ({
            projectKey: d.project.projectKey,
            projectName: d.project.name,
            service: d.service === 'VAULT' ? 'Vault' : 'Jenkins',
            state: d.provisionStatus === 'FAILED' ? 'FAILED' : d.driftDetected ? 'DRIFT' : d.provisionStatus === 'PENDING' ? 'PENDING' : 'OK',
            message: d.provisionError ?? (d.driftDetected ? 'ERP 설정과 실제 권한이 달라요' : d.provisionStatus === 'PENDING' ? '반영 중' : ''),
            checked: d.reconciledAt ? ago(d.reconciledAt) : '아직 대조 전',
          })),
        jobs: (jobs?.content ?? []).map((j) => {
          const sec = j.finishedAt ? Math.round((Date.parse(j.finishedAt) - Date.parse(j.startedAt)) / 1000) : null
          return {
            runId: j.runId,
            jobName: j.jobName,
            desc: JOB_DESC[j.jobName] ?? '',
            started: mdHm(j.startedAt),
            duration: sec === null ? '실행 중' : sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`,
            status: j.status,
            processed: j.processedCount === null ? '—' : `${j.processedCount}건`,
            error: j.errorMessage ?? '',
          }
        }),
      }
    },
  )
}

/* ================= 파일 사용량 (F-5) ================= */

export type UsageGroup = { key: string; label: string; fileCount: number; bytes: number }
export type FileUsage = {
  total: { fileCount: number; bytes: number }
  pendingPurge: { fileCount: number; bytes: number }
  unattached: { fileCount: number; bytes: number }
  groups: UsageGroup[]
}
export type UsageGroupBy = 'TARGET_TYPE' | 'MEMBER' | 'PURPOSE'

const GB = 1024 ** 3
const MB = 1024 ** 2
const mockUsage: Record<UsageGroupBy, UsageGroup[]> = {
  TARGET_TYPE: [
    { key: 'DOCUMENT', label: '자료실', fileCount: 2210, bytes: 56 * GB },
    { key: 'TASK', label: '작업', fileCount: 1104, bytes: 9.8 * GB },
    { key: 'PROJECT_THREAD', label: '프로젝트 스레드', fileCount: 512, bytes: 5.3 * GB },
    { key: 'MEETING_MINUTE', label: '회의록', fileCount: 205, bytes: 3.1 * GB },
    { key: 'NOTICE', label: '공지', fileCount: 96, bytes: 1.6 * GB },
    { key: 'MEMBER_PHOTO', label: '프로필 사진', fileCount: 83, bytes: 0.2 * GB },
  ],
  MEMBER: [
    { key: '3', label: '박지훈', fileCount: 912, bytes: 18.2 * GB },
    { key: '2', label: '김민서', fileCount: 804, bytes: 14.7 * GB },
    { key: '4', label: '이정훈', fileCount: 655, bytes: 9.4 * GB },
    { key: '5', label: '최현우', fileCount: 410, bytes: 6.1 * GB },
    { key: '9', label: '한유진', fileCount: 122, bytes: 2.3 * GB },
  ],
  PURPOSE: [
    { key: 'ATTACHMENT', label: '첨부 파일', fileCount: 3890, bytes: 74.6 * GB },
    { key: 'INLINE_IMAGE', label: '본문에 붙여넣은 이미지', fileCount: 237, bytes: 1.2 * GB },
    { key: 'PROFILE_PHOTO', label: '프로필 사진', fileCount: 83, bytes: 0.2 * GB },
  ],
}

export function useFileUsage(groupBy: UsageGroupBy) {
  return useResource<FileUsage>(
    ['file-usage', groupBy],
    () => ({
      total: { fileCount: 4210, bytes: 76 * GB },
      pendingPurge: { fileCount: 31, bytes: 870 * MB },
      unattached: { fileCount: 4, bytes: 12 * MB },
      groups: mockUsage[groupBy],
    }),
    async () => {
      const r = await api<Omit<FileUsage, 'groups'> & { groups: PageResponse<UsageGroup> }>('/files/usage', { query: { groupBy, size: 50 } })
      return { ...r, groups: [...r.groups.content].sort((a, b) => b.bytes - a.bytes) }
    },
  )
}

/** 76.0 GB · 870 MB 처럼 */
export const bigBytes = (n: number) => (n >= GB ? `${(n / GB).toFixed(1)} GB` : n >= MB ? `${Math.round(n / MB)} MB` : formatBytes(n))

export { dotDate }
