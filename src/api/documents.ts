// 자료 상세 · 올리기 · 프로젝트 자료 · 지운 자료 — docs/api/40-document-file.md D-1 ~ D-7, 60-common.md 댓글
import { api } from './client'
import { ago, dotDate, type MemberRef, type PageResponse } from './types'
import { invalidateAll, useResource } from './useResource'
import { fetchMe, formatBytes, kstHm, kstYmd } from './communication'
import { fileUrl, toDocument, type DocumentItem, type DocumentListResponse, type FileRef } from './content'
import { MOCK_ME } from './projects'
import {
  deletedDocuments as mockDeleted,
  documentDetailExtra as mockExtra,
  type DeletedDocument,
  type DocComment,
  type DocFileGroup,
  type DocFileVersion,
} from '../mocks/documentDetail'
import { CATEGORY_NAME, documents as mockDocuments, type DocumentCategory, type DocumentSummary } from '../mocks/documents'
import { projects as mockProjects } from '../mocks/projects'

export type DocumentDetail = {
  doc: DocumentSummary
  body: string
  links: { title: string; url: string }[]
  files: DocFileGroup[]
  comments: DocComment[]
  resolvedCommentId: number | null
  created: string
  edited: string
  permissions: { canEdit: boolean; canDelete: boolean; canPin: boolean; canResolve: boolean }
  me: string
}

type FileVersionDto = { documentFileId: number; version: number; file: FileRef; note: string | null; uploadedBy: MemberRef; createdAt: string }
type DocumentDetailDto = DocumentItem & {
  body: string | null
  links: { linkId: number; url: string; title: string }[]
  files: { logicalName: string; latest: FileVersionDto; previous: FileVersionDto[] }[]
  resolvedCommentId: number | null
  permissions: { canEdit: boolean; canDelete: boolean; canPin: boolean; canResolve: boolean; canRestore: boolean }
  updatedAt: string
  deletedAt: string | null
}
type CommentDto = { commentId: number; author: MemberRef; body: string | null; deleted: boolean; createdAt: string; editedAt: string | null; replies?: CommentDto[] }

const mdHm = (iso: string) => {
  const d = kstYmd(iso)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${kstHm(iso)}`
}
const toVersion = (f: FileVersionDto): DocFileVersion => ({
  version: f.version,
  name: f.file.name,
  size: formatBytes(f.file.size),
  uploadedBy: f.uploadedBy.name,
  createdAt: mdHm(f.createdAt),
  note: f.note ?? '',
  url: fileUrl(f.file.publicId),
})
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '')

/** 목업에서 고친 값(고정 · 해결 · 댓글)을 자료마다 기억한다 */
const mockState = new Map<number, { pinned?: boolean; resolvedCommentId?: number | null; comments?: DocComment[]; files?: DocFileGroup[] }>()

/** 자료 상세 (D-3) + 댓글 (CM-1 DOCUMENT) */
export function useDocumentDetail(id: number) {
  return useResource<DocumentDetail>(
    ['document', id],
    () => {
      const base = mockDocuments.find((d) => d.documentId === id) ?? mockDocuments.find((d) => d.documentId === 212)!
      const st = mockState.get(id) ?? {}
      const isQna = base.categoryCode === 'QNA'
      return {
        doc: { ...base, pinned: st.pinned ?? base.pinned },
        body: mockExtra.body,
        links: mockExtra.links,
        files: st.files ?? (base.fileTypes.length ? mockExtra.files : []),
        comments: st.comments ?? mockExtra.comments,
        resolvedCommentId: st.resolvedCommentId !== undefined ? st.resolvedCommentId : isQna && base.resolved ? mockExtra.comments[0].id : null,
        created: mockExtra.created,
        edited: mockExtra.edited,
        permissions: { canEdit: true, canDelete: true, canPin: true, canResolve: isQna },
        me: MOCK_ME,
      }
    },
    async () => {
      const [d, comments, me] = await Promise.all([
        api<DocumentDetailDto>(`/documents/${id}`),
        api<PageResponse<CommentDto>>('/comments', { query: { targetType: 'DOCUMENT', targetId: id, size: 100 } }),
        fetchMe(),
      ])
      return {
        doc: toDocument(d),
        body: d.body ?? '',
        links: d.links.map((l) => ({ title: l.title || l.url, url: l.url })),
        files: d.files.map((g) => ({ logicalName: g.logicalName, ext: extOf(g.logicalName), latest: toVersion(g.latest), previous: g.previous.map(toVersion) })),
        comments: comments.content
          .flatMap((c) => [c, ...(c.replies ?? [])])
          .filter((c) => !c.deleted)
          .map((c) => ({ id: c.commentId, author: c.author.name, ago: ago(c.createdAt) + (c.editedAt ? ' · 수정됨' : ''), text: c.body ?? '', mine: c.author.memberId === me.memberId })),
        resolvedCommentId: d.resolvedCommentId,
        created: dotDate(d.createdAt),
        edited: mdHm(d.updatedAt),
        permissions: d.permissions,
        me: me.name,
      }
    },
  )
}

/** 고정 · 해결 표시 (D-4). 목업이면 기억만 한다 */
export async function patchDocument(id: number, isLive: boolean, patch: { pinned?: boolean; resolvedCommentId?: number | null }) {
  if (isLive) await api(`/documents/${id}`, { method: 'PATCH', body: patch })
  else mockState.set(id, { ...mockState.get(id), ...patch })
  invalidateAll()
}

/** 댓글 쓰기 (CM-2) */
export async function postDocumentComment(id: number, isLive: boolean, text: string, current: DocComment[]) {
  if (isLive) await api('/comments', { method: 'POST', body: { targetType: 'DOCUMENT', targetId: id, parentId: null, body: text, attachmentFileIds: [] } })
  else mockState.set(id, { ...mockState.get(id), comments: [...current, { id: Date.now(), author: MOCK_ME, ago: '방금 전', text, mine: true }] })
  invalidateAll()
}
/** 댓글 지우기 (CM-4) */
export async function deleteDocumentComment(id: number, isLive: boolean, commentId: number, current: DocComment[]) {
  if (isLive) await api(`/comments/${commentId}`, { method: 'DELETE' })
  else mockState.set(id, { ...mockState.get(id), comments: current.filter((c) => c.id !== commentId) })
  invalidateAll()
}

/** 파일 더하기 — 같은 이름이면 새 버전 (D-7) */
export async function addDocumentFile(id: number, isLive: boolean, file: { publicId: string; name: string; size: number }, note: string, current: DocFileGroup[]) {
  if (isLive) await api(`/documents/${id}/files`, { method: 'POST', body: { fileId: file.publicId, note: note || undefined } })
  else {
    const old = current.find((g) => g.logicalName === file.name)
    const ver: DocFileVersion = { version: (old?.latest.version ?? 0) + 1, name: file.name, size: formatBytes(file.size), uploadedBy: MOCK_ME, createdAt: '방금 전', note, url: '#' }
    const next = old
      ? current.map((g) => (g === old ? { ...g, latest: ver, previous: [g.latest, ...g.previous] } : g))
      : [...current, { logicalName: file.name, ext: extOf(file.name), latest: ver, previous: [] }]
    mockState.set(id, { ...mockState.get(id), files: next })
  }
  invalidateAll()
}

/** 지우기 (D-5) — 30일 뒤 완전 삭제 */
export async function deleteDocument(id: number, isLive: boolean) {
  if (isLive) await api(`/documents/${id}`, { method: 'DELETE' })
  else {
    const i = mockDocuments.findIndex((d) => d.documentId === id)
    if (i >= 0) {
      const [d] = mockDocuments.splice(i, 1)
      mockDeleted.unshift({
        documentId: d.documentId,
        title: d.title,
        categoryName: CATEGORY_NAME[d.categoryCode],
        ext: d.fileTypes[0] ?? null,
        contents: `파일 ${d.fileTypes.length}개 · 댓글 ${d.commentCount}`,
        author: d.author,
        deletedBy: MOCK_ME,
        deletedByNote: d.author === MOCK_ME ? '글쓴이' : 'content-manage',
        deletedOn: '오늘',
        daysLeft: 30,
      })
      mockRemoved.set(id, d)
    }
  }
  invalidateAll()
}
const mockRemoved = new Map<number, DocumentSummary>()

/* ---------- 올리기 (D-2) ---------- */

export type DocumentDraft = {
  categoryCode: DocumentCategory
  title: string
  body: string
  projectKey: string
  visibility: 'LAB' | 'PROJECT_MEMBERS'
  tags: string[]
  files: { publicId: string; name: string; size: number }[]
}
export type ProjectOption = { projectKey: string; name: string }

/** 올리기 창의 "프로젝트 연결" 선택지 (P-1 — 내가 참여한 프로젝트) */
export function useMyProjectOptions() {
  return useResource<ProjectOption[]>(
    'my-project-options',
    () => mockProjects.map((p) => ({ projectKey: p.projectKey, name: p.name })),
    async () => {
      const r = await api<{ page: PageResponse<{ projectKey: string; name: string }> }>('/projects', { query: { mine: true, size: 100 } })
      return r.page.content.map((p) => ({ projectKey: p.projectKey, name: p.name }))
    },
  )
}

/** 자료 올리기 (D-2). 새 자료 번호를 돌려준다 */
export async function createDocument(d: DocumentDraft, isLive: boolean, projects: ProjectOption[]) {
  let id: number
  if (isLive) {
    const made = await api<{ documentId: number }>('/documents', {
      method: 'POST',
      body: {
        categoryCode: d.categoryCode,
        title: d.title,
        body: d.body || undefined,
        projectKey: d.projectKey || undefined,
        visibility: d.visibility,
        tags: d.tags,
        links: [],
        files: d.files.map((f) => ({ fileId: f.publicId, note: '' })),
        inlineImageFileIds: [],
      },
    })
    id = made.documentId
  } else {
    id = Math.max(...mockDocuments.map((x) => x.documentId)) + 1
    mockDocuments.unshift({
      documentId: id,
      categoryCode: d.categoryCode,
      title: d.title,
      author: MOCK_ME,
      ago: '방금 전',
      ageMinutes: 0,
      project: projects.find((p) => p.projectKey === d.projectKey) ?? null,
      visibility: d.visibility,
      tags: d.tags,
      fileTypes: [...new Set(d.files.map((f) => extOf(f.name)).filter(Boolean))],
      latestVersion: 1,
      commentCount: 0,
      resolved: d.categoryCode === 'QNA' ? false : null,
      pinned: false,
    })
  }
  invalidateAll()
  return id
}

/* ---------- 프로젝트 자료 (D-1 projectKey) ---------- */

export type ProjectDocuments = { documents: DocumentSummary[]; total: number; labCount: number; privateCount: number; tags: { tag: string; count: number }[] }

export function useProjectDocuments(projectKey: string | undefined, keyword: string) {
  const summarize = (docs: DocumentSummary[], total: number): ProjectDocuments => {
    const counts = new Map<string, number>()
    docs.forEach((d) => d.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return {
      documents: docs,
      total,
      labCount: docs.filter((d) => d.visibility === 'LAB').length,
      privateCount: docs.filter((d) => d.visibility === 'PROJECT_MEMBERS').length,
      tags: [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    }
  }
  return useResource<ProjectDocuments>(
    ['project-documents', projectKey, keyword],
    () => {
      const kw = keyword.trim()
      // 목업의 다른 프로젝트 자료도 이 프로젝트 것처럼 보여 준다 (목업 프로젝트가 하나뿐이라)
      const docs = mockDocuments.filter((d) => d.project && (!kw || d.title.includes(kw) || d.tags.some((t) => t.includes(kw))))
      return summarize(docs, docs.length)
    },
    async () => {
      const kw = keyword.trim()
      const r = await api<DocumentListResponse>('/documents', { query: { projectKey, keyword: kw.length >= 2 ? kw : undefined, size: 100 } })
      const docs = [...r.pinned, ...r.page.content].map(toDocument)
      return summarize(docs, r.page.totalElements + r.pinned.length)
    },
  )
}

/* ---------- 지운 자료 (D-1 deleted=true, D-6) ---------- */

export function useDeletedDocuments(keyword: string) {
  return useResource<DeletedDocument[]>(
    ['deleted-documents', keyword],
    () => mockDeleted.filter((d) => !keyword.trim() || d.title.includes(keyword.trim())),
    async () => {
      const kw = keyword.trim()
      const r = await api<{ page: PageResponse<DocumentItem & { deletedAt: string | null }> }>('/documents', {
        query: { deleted: true, keyword: kw.length >= 2 ? kw : undefined, size: 100 },
      })
      return r.page.content.map((d) => {
        const deleted = d.deletedAt ?? new Date().toISOString()
        const left = 30 - Math.floor((Date.now() - Date.parse(deleted)) / 86400000)
        const day = kstYmd(deleted)
        return {
          documentId: d.documentId,
          title: d.title,
          categoryName: d.categoryName,
          ext: d.fileTypes[0] ?? null,
          contents: [d.fileTypes.length ? `파일 형식 ${d.fileTypes.join(', ')}` : null, `댓글 ${d.commentCount}`].filter(Boolean).join(' · '),
          author: d.author.name,
          // 명세 확인 필요: 목록에 "지운 사람"이 없다 (감사 로그에만 남음)
          deletedBy: '—',
          deletedByNote: '감사 로그에서 확인',
          deletedOn: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
          daysLeft: Math.max(0, left),
        }
      })
    },
  )
}

/** 되살리기 (D-6) */
export async function restoreDocument(id: number, isLive: boolean) {
  if (isLive) await api(`/documents/${id}/restore`, { method: 'POST' })
  else {
    const i = mockDeleted.findIndex((d) => d.documentId === id)
    if (i >= 0) {
      const [d] = mockDeleted.splice(i, 1)
      const back = mockRemoved.get(id)
      mockDocuments.unshift(
        back ?? {
          documentId: d.documentId,
          categoryCode: (Object.keys(CATEGORY_NAME) as DocumentCategory[]).find((c) => CATEGORY_NAME[c] === d.categoryName) ?? 'FREE',
          title: d.title,
          author: d.author,
          ago: '되살림',
          ageMinutes: 0,
          project: null,
          visibility: 'LAB',
          tags: [],
          fileTypes: d.ext ? [d.ext] : [],
          latestVersion: 1,
          commentCount: 0,
          resolved: null,
          pinned: false,
        },
      )
    }
  }
  invalidateAll()
}
