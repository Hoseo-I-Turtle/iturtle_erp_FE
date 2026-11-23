import type { JenkinsLevel, VaultLevel } from '../../../api/projects'

export const VAULT: Record<VaultLevel, string> = { NONE: '없음', READ: '읽기', WRITE: '쓰기' }
export const JENKINS: Record<JenkinsLevel, string> = { NONE: '없음', READ: '읽기', BUILD: '빌드' }
export const opts = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((v) => ({ value: v, label: m[v] }))

/** 프로비저닝 결과 칩 문구 */
export const SYNC_TEXT = {
  VAULT: { ok: '정책 · 그룹 만들어짐', fail: '정책 · 그룹 만들기 실패', pending: '정책 · 그룹 만드는 중' },
  JENKINS: { ok: '항목 역할 만들어짐', fail: '항목 역할 만들기 실패', pending: '항목 역할 만드는 중' },
}

export type SyncService = 'VAULT' | 'JENKINS'
