// 프로젝트 설정 › 연동 서비스 (P-11 ~ P-14) · 참여자 빼기 미리 보기 (P-9a)
import { api } from './client'
import { useResource } from './useResource'
import { getDataMode } from '../lib/dataMode'

const enc = encodeURIComponent

export type LinkService = 'GITHUB' | 'JENKINS' | 'PENPOT' | 'VAULT' | 'OTHER'

export const LINK_SERVICE_NAME: Record<LinkService, string> = {
  GITHUB: 'GitHub',
  JENKINS: 'Jenkins',
  PENPOT: 'Penpot',
  VAULT: 'Vault',
  OTHER: '기타',
}
/** 화면에 보이는 서비스 순서 (프로젝트 홈 연동 서비스 카드와 같다) */
export const LINK_SERVICE_ORDER: LinkService[] = ['GITHUB', 'JENKINS', 'PENPOT', 'VAULT', 'OTHER']

/** 주소 칸 안내 — 서버가 주소에서 저장소 · 작업 · 파일 · 경로를 꺼낸다 */
export const LINK_URL_HINT: Record<LinkService, string> = {
  GITHUB: 'https://github.com/조직/저장소',
  JENKINS: 'https://lab.iturtle.win/jenkins/job/조직/job/작업/',
  PENPOT: 'Penpot 파일 · 프로젝트 주소 (주소창 그대로)',
  VAULT: 'https://vault.iturtle.win/ui/vault/secrets-engines/secret/kv/list/경로/',
  OTHER: 'https://…',
}

export type ManagedLink = {
  linkId: number
  service: LinkService
  url: string
  displayName: string
  description: string | null
  externalRef: string | null
  displayOrder: number
}
export type LinkInput = { service: LinkService; url: string; displayName: string; description: string }

let mockSeq = 100
const MOCK_LINKS: ManagedLink[] = [
  { linkId: 1, service: 'GITHUB', url: 'https://github.com/Hoseo-I-Turtle/defme_BE', displayName: 'DEFME 백엔드', description: null, externalRef: 'Hoseo-I-Turtle/defme_BE', displayOrder: 0 },
  { linkId: 2, service: 'GITHUB', url: 'https://github.com/Hoseo-I-Turtle/defme_FE', displayName: 'DEFME 프론트엔드', description: null, externalRef: 'Hoseo-I-Turtle/defme_FE', displayOrder: 1 },
  { linkId: 3, service: 'JENKINS', url: 'https://lab.iturtle.win/jenkins/job/Hoseo-I-Turtle/job/defme_BE/', displayName: 'DEFME 배포', description: null, externalRef: 'Hoseo-I-Turtle/defme_BE', displayOrder: 0 },
  { linkId: 4, service: 'PENPOT', url: 'https://penpot.iturtle.win/#/workspace?team-id=t1&file-id=f1', displayName: 'DEFME 디자인', description: '홈 화면 시안', externalRef: 'file:f1', displayOrder: 0 },
  { linkId: 5, service: 'VAULT', url: 'https://vault.iturtle.win/ui/vault/secrets/secret/kv/list/projects/defme/', displayName: 'DEFME 비밀값', description: null, externalRef: 'secret/projects/defme/', displayOrder: 0 },
]

/** 링크 목록 (P-11) */
export function useProjectLinks(key: string) {
  return useResource<ManagedLink[]>(
    ['project-links', key],
    () => MOCK_LINKS.map((l) => ({ ...l })),
    async () => (await api<{ links: ManagedLink[] }>(`/projects/${enc(key)}/links`)).links,
  )
}

/** 서비스별로 모으고 각 묶음 안은 순서대로 */
export function groupLinks(links: ManagedLink[]) {
  return LINK_SERVICE_ORDER.map((service) => ({
    service,
    items: links.filter((l) => l.service === service).sort((a, b) => a.displayOrder - b.displayOrder || a.linkId - b.linkId),
  })).filter((g) => g.items.length > 0)
}

export const createLink = (key: string, l: LinkInput) =>
  api<ManagedLink>(`/projects/${enc(key)}/links`, {
    method: 'POST',
    body: { service: l.service, url: l.url.trim(), displayName: l.displayName.trim(), description: l.description.trim() || null },
  })

/** 고치기 (P-13): 설명은 비우면 지운다 */
export const updateLink = (key: string, linkId: number, l: Omit<LinkInput, 'service'>) =>
  api<ManagedLink>(`/projects/${enc(key)}/links/${linkId}`, {
    method: 'PATCH',
    body: { url: l.url.trim(), displayName: l.displayName.trim(), description: l.description.trim() || null },
  })

export const deleteLink = (key: string, linkId: number) => api(`/projects/${enc(key)}/links/${linkId}`, { method: 'DELETE' })

/**
 * 같은 서비스 묶음 안에서 한 칸 위 · 아래로. 순서 값이 겹쳐 있으면(처음 만든 그대로 0, 0 …) 묶음을 0부터 다시 매긴다.
 * 바뀐 링크만 PATCH 한다.
 */
export function reorderPlan(group: ManagedLink[], linkId: number, dir: -1 | 1): { linkId: number; displayOrder: number }[] {
  const i = group.findIndex((l) => l.linkId === linkId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= group.length) return []
  const ordered = [...group]
  ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  return ordered.map((l, idx) => ({ linkId: l.linkId, displayOrder: idx })).filter((p) => group.find((l) => l.linkId === p.linkId)?.displayOrder !== p.displayOrder)
}

export const patchLinkOrder = (key: string, linkId: number, displayOrder: number) =>
  api(`/projects/${enc(key)}/links/${linkId}`, { method: 'PATCH', body: { displayOrder } })

export const mockCreateLink = (l: LinkInput): ManagedLink => ({
  linkId: ++mockSeq,
  service: l.service,
  url: l.url.trim(),
  displayName: l.displayName.trim(),
  description: l.description.trim() || null,
  externalRef: null,
  displayOrder: 99,
})

// ───────────────────────── 참여자 빼기 미리 보기 (P-9a) ─────────────────────────

export type RemovalTask = { taskKey: string; title: string; status: string }
export type RemovalPreview = { openTasks: RemovalTask[]; candidates: { memberId: number; name: string }[] }

type HandoverDto = {
  projects: {
    project: { projectKey: string }
    openTasks: { taskKey: string; title: string; status: string }[]
    candidates: { memberId: number; name: string }[]
  }[]
}

/** 빼려는 사람이 이 프로젝트에서 맡은 끝나지 않은 작업과, 넘겨받을 수 있는 사람 (재실 참여자) */
export async function fetchRemovalPreview(key: string, memberId: number, mockActive: { memberId: number; name: string }[]): Promise<RemovalPreview> {
  if (getDataMode() !== 'live') {
    return {
      openTasks: [
        { taskKey: `${key}-41`, title: '로그인 화면 리팩터링', status: 'IN_PROGRESS' },
        { taskKey: `${key}-47`, title: '알림 종류별 설정', status: 'TODO' },
      ],
      candidates: mockActive.filter((m) => m.memberId !== memberId),
    }
  }
  const h = await api<HandoverDto>('/projects/handover', { query: { memberId, projectKey: key } })
  const p = h.projects.find((x) => x.project.projectKey === key)
  return { openTasks: p?.openTasks ?? [], candidates: (p?.candidates ?? []).filter((c) => c.memberId !== memberId) }
}

/** 빼기 (P-8): 끝나지 않은 담당 작업을 모두 넘긴다 — 넘겨받을 사람이 없으면 담당 없음 */
export const removeMemberWithHandover = (key: string, memberId: number, tasks: RemovalTask[], handoverTo: number | null) =>
  api(`/projects/${enc(key)}/members/${memberId}/remove`, {
    method: 'POST',
    body: { taskReassignments: tasks.map((t) => ({ taskKey: t.taskKey, assigneeMemberId: handoverTo })) },
  })
