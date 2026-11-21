// 참여자가 맡은 일 태그 (ERP-4 서버 · ERP-14 화면). 권한 역할(PM · 참여자)과 상관없는 자유 태그 — 예: 백엔드 · 프론트 테스트 · 디자인.
// 서버: ProjectMemberRef.tags (P-3), PUT /projects/{key}/members/{memberId}/tags (P-8a), GET /projects/{key}/member-tags (P-8b)
import { api } from './client'
import { useResource } from './useResource'
import { getProject } from './projects'

const enc = encodeURIComponent

/** 정리 뒤 5개 · 태그마다 20자 (서버 P047 · P048 과 같은 규칙) */
export const MAX_TAGS = 5
export const MAX_TAG_LENGTH = 20

export type TagCount = { tag: string; memberCount: number }

/** 목업 모드: 이름 → 태그 (저장하면 이 표를 바꾼다 — 새로 고침하면 처음으로) */
const mockTags = new Map<string, string[]>([
  ['김민서', ['기획', '백엔드']],
  ['박지훈', ['백엔드']],
  ['최현우', ['프론트']],
  ['이정훈', ['프론트 테스트']],
  ['한유진', ['디자인']],
])
export const mockTagsOf = (name: string) => mockTags.get(name) ?? []
export const setMockTags = (name: string, tags: string[]) => mockTags.set(name, tags)

/** 서버와 같은 정리: 앞뒤 공백 · 앞의 # 떼기, 빈 것 버리기, 대소문자만 다른 같은 태그는 처음 것만 */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    const t = r.trim().replace(/^#+\s*/, '').trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

export const setMemberTags = (key: string, memberId: number, tags: string[]) =>
  api<{ tags: string[] }>(`/projects/${enc(key)}/members/${memberId}/tags`, { method: 'PUT', body: { tags } })

/** 자동 완성: 그 프로젝트의 지금 참여자가 쓰는 태그 (많이 쓴 순) */
export function useTagSuggestions(key: string | undefined) {
  return useResource<TagCount[]>(
    ['member-tags', key],
    () => {
      const counts = new Map<string, number>()
      mockTags.forEach((tags) => tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
      return [...counts.entries()].map(([tag, memberCount]) => ({ tag, memberCount })).sort((a, b) => b.memberCount - a.memberCount)
    },
    () => api<TagCount[]>(`/projects/${enc(key ?? '')}/member-tags`),
  )
}

/** 구성원 ID → 맡은 일 태그 (회의록 · 주간 보고처럼 참여자 목록을 따로 안 받는 화면용). 목업은 이름으로 찾는다 */
export function useMemberTagMap(key: string | undefined) {
  return useResource<Map<number, string[]>>(
    ['member-tag-map', key],
    () => new Map(),
    async () => {
      const d = await getProject(key ?? '')
      return new Map(d.members.map((m) => [m.member.memberId, m.tags ?? []]))
    },
  )
}

/** 화면에 쓸 태그: 실서버는 ID 로, 목업은 이름으로 */
export const tagsFor = (map: Map<number, string[]> | undefined, memberId: number, name: string) =>
  map && map.size > 0 ? (map.get(memberId) ?? []) : mockTagsOf(name)
