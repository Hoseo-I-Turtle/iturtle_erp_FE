// 관리 › Cloudflare (ERP-37 · 38) — docs/api/10-member.md 3-13 ~ 3-17
import { api } from './client'
import { useResource } from './useResource'

export type CloudflareEmail = { email: string; memberId: number | null; memberName: string | null; loginId: string | null }
export type CloudflareMissing = { memberId: number; name: string; loginId: string; memberType: string }

/** 정책 하나 (ERP-38): MEMBERS = Access 정책 iturtle-members, VPN · SSH = Gateway 방화벽 규칙 */
export type CloudflareTarget = 'MEMBERS' | 'VPN' | 'SSH'
export type CloudflarePolicy = {
  target: CloudflareTarget
  kind: 'ACCESS' | 'GATEWAY'
  /** 설정에서 비웠으면 null */
  name: string | null
  /** 토큰이 없거나 이름을 비우면 false */
  enabled: boolean
  lastRunAt: string | null
  lastSucceededAt: string | null
  lastError: string | null
  lastChanges: number
  loadError: string | null
  emails: CloudflareEmail[]
}

/** SSH 허용 목록 (ERP-38) — Gateway 규칙 lab_server_ssh 에 이메일을 넣을 구성원 */
export type SshMember = {
  memberId: number
  memberName: string | null
  loginId: string | null
  email: string | null
  memberType: string | null
  /** 지금 규칙에 넣는 사람인지 (비활성이 아니고 이메일이 있음) */
  applied: boolean
  grantedAt: string
  grantedById: number | null
  grantedByName: string | null
}

export type CloudflareAccess = {
  /** false 면 토큰이 없어 동기화가 꺼져 있다 */
  enabled: boolean
  // policyName ~ emails = MEMBERS 정책 (policies[0] 과 같음)
  policyName: string
  lastRunAt: string | null
  lastSucceededAt: string | null
  lastError: string | null
  lastChanges: number
  /** 지금 정책을 못 읽었으면 사유 */
  loadError: string | null
  /** memberId 가 없으면 손으로 넣은 이메일 */
  emails: CloudflareEmail[]
  missingEmailMembers: CloudflareMissing[]
  /** 세 정책 (MEMBERS · VPN · SSH 순). 예전 백엔드면 없음 */
  policies?: CloudflarePolicy[]
  sshMembers?: SshMember[]
}

const MOCK_EMAILS: CloudflareEmail[] = [
  { email: 'guest@gmail.com', memberId: null, memberName: null, loginId: null },
  { email: 'jihoon@hoseo.edu', memberId: 3, memberName: '박지훈', loginId: 'jihoon' },
  { email: 'minseo@hoseo.edu', memberId: 2, memberName: '김민서', loginId: 'minseo' },
]
const MOCK_RUN = new Date(Date.now() - 3 * 60_000).toISOString()

const MOCK: CloudflareAccess = {
  enabled: true,
  policyName: 'iturtle-members',
  lastRunAt: MOCK_RUN,
  lastSucceededAt: MOCK_RUN,
  lastError: null,
  lastChanges: 1,
  loadError: null,
  emails: MOCK_EMAILS,
  missingEmailMembers: [{ memberId: 6, name: '한유진', loginId: 'yujin', memberType: 'INTERN' }],
  policies: [
    { target: 'MEMBERS', kind: 'ACCESS', name: 'iturtle-members', enabled: true, lastRunAt: MOCK_RUN, lastSucceededAt: MOCK_RUN,
      lastError: null, lastChanges: 1, loadError: null, emails: MOCK_EMAILS },
    { target: 'VPN', kind: 'GATEWAY', name: 'lab-vpn-members-only', enabled: true, lastRunAt: MOCK_RUN, lastSucceededAt: MOCK_RUN,
      lastError: null, lastChanges: 0, loadError: null, emails: MOCK_EMAILS },
    { target: 'SSH', kind: 'GATEWAY', name: 'lab_server_ssh', enabled: true, lastRunAt: MOCK_RUN, lastSucceededAt: MOCK_RUN,
      lastError: null, lastChanges: 0, loadError: null,
      emails: [
        { email: 'ops@hoseo.edu', memberId: null, memberName: null, loginId: null },
        { email: 'jihoon@hoseo.edu', memberId: 3, memberName: '박지훈', loginId: 'jihoon' },
      ] },
  ],
  sshMembers: [
    { memberId: 3, memberName: '박지훈', loginId: 'jihoon', email: 'jihoon@hoseo.edu', memberType: 'STUDENT', applied: true,
      grantedAt: MOCK_RUN, grantedById: 1, grantedByName: '박제민' },
  ],
}

const PATH = '/members/cloudflare-access'

export function useCloudflareAccess() {
  return useResource<CloudflareAccess>('cloudflare-access', () => MOCK, () => api<CloudflareAccess>(PATH))
}

/** 지금 맞추기 (실패해도 정책마다 lastError 에 사유가 담겨 온다) */
export const syncCloudflare = () => api<CloudflareAccess>(`${PATH}/sync`, { method: 'POST' })

type SshMembersResponse = { members: SshMember[] }

/** SSH 허용 목록에 넣기 (3-16). 이미 있으면 그대로. 규칙에는 30초 안에 들어간다 */
export const grantSsh = (memberId: number) =>
  api<SshMembersResponse>(`${PATH}/ssh-members/${memberId}`, { method: 'PUT' }).then((r) => r.members)

/** SSH 허용 목록에서 빼기 (3-17) */
export const revokeSsh = (memberId: number) =>
  api<SshMembersResponse>(`${PATH}/ssh-members/${memberId}`, { method: 'DELETE' }).then((r) => r.members)
