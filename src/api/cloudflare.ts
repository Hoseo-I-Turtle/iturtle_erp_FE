// 관리 › Cloudflare (ERP-37) — docs/api/10-member.md 3-13 · 3-14
import { api } from './client'
import { useResource } from './useResource'

export type CloudflareEmail = { email: string; memberId: number | null; memberName: string | null; loginId: string | null }
export type CloudflareMissing = { memberId: number; name: string; loginId: string; memberType: string }
export type CloudflareAccess = {
  /** false 면 토큰이 없어 동기화가 꺼져 있다 */
  enabled: boolean
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
}

const MOCK: CloudflareAccess = {
  enabled: true,
  policyName: 'iturtle-members',
  lastRunAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  lastSucceededAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  lastError: null,
  lastChanges: 1,
  loadError: null,
  emails: [
    { email: 'guest@gmail.com', memberId: null, memberName: null, loginId: null },
    { email: 'jihoon@hoseo.edu', memberId: 3, memberName: '박지훈', loginId: 'jihoon' },
    { email: 'minseo@hoseo.edu', memberId: 2, memberName: '김민서', loginId: 'minseo' },
  ],
  missingEmailMembers: [{ memberId: 6, name: '한유진', loginId: 'yujin', memberType: 'INTERN' }],
}

const PATH = '/members/cloudflare-access'

export function useCloudflareAccess() {
  return useResource<CloudflareAccess>('cloudflare-access', () => MOCK, () => api<CloudflareAccess>(PATH))
}

/** 지금 맞추기 (실패해도 lastError 에 사유가 담겨 온다) */
export const syncCloudflare = () => api<CloudflareAccess>(`${PATH}/sync`, { method: 'POST' })
