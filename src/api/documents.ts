// 자료실 · 폴더 · 올리기 (40-document-file.md D-1 ~ D-13, F-1 ~ F-3)
import { useEffect } from 'react'
import { api, ApiError } from './client'
import { useResource } from './useResource'
import { fileUrl, type FileRef } from './content'
import { ago, fetchEveryPage, type MemberRef, type PageResponse } from './types'
import { getDataMode } from '../lib/dataMode'

export type DocVisibility = 'LAB' | 'PROJECT_MEMBERS' | 'PRIVATE'
export const VISIBILITY_LABEL: Record<DocVisibility, string> = {
  LAB: '연구실 전체',
  PROJECT_MEMBERS: '프로젝트 참여자만',
  PRIVATE: '나만',
}

/* ---------- 올리기 제한 (D-13) ---------- */

export type DocumentPolicy = { maxFileMb: number; maxFilesPerUpload: number; maxFilesPerDocument: number }
const DEFAULT_POLICY: DocumentPolicy = { maxFileMb: 200, maxFilesPerUpload: 10, maxFilesPerDocument: 20 }

export function useDocumentPolicy() {
  return useResource<DocumentPolicy>('document-policy', () => DEFAULT_POLICY, () => api<DocumentPolicy>('/documents/policy'))
}

/* ---------- 폴더 (D-9 ~ D-12) ---------- */

export type Folder = { folderId: number; name: string; parentId: number | null; path: string; documentCount: number; editable: boolean }
export type FolderList = { folders: Folder[]; canCreate: boolean }

const MOCK_FOLDERS: Record<string, Folder[]> = {
  '': [
    { folderId: 1, name: 'KCC 2027 투고', parentId: null, path: 'KCC 2027 투고', documentCount: 2, editable: true },
    { folderId: 2, name: '원고', parentId: 1, path: 'KCC 2027 투고 / 원고', documentCount: 3, editable: true },
    { folderId: 3, name: '세미나 발표', parentId: null, path: '세미나 발표', documentCount: 5, editable: false },
  ],
  DEFME: [{ folderId: 10, name: '회의 자료', parentId: null, path: '회의 자료', documentCount: 4, editable: true }],
}

/** 한 범위(연구실이면 projectKey 없음)의 폴더 — 경로 순 */
export function useFolders(projectKey: string | null) {
  return useResource<FolderList>(
    ['document-folders', projectKey ?? ''],
    () => ({ folders: MOCK_FOLDERS[projectKey ?? ''] ?? [], canCreate: true }),
    async () => {
      const r = await api<FolderList>('/documents/folders', { query: { projectKey: projectKey ?? undefined } })
      return { ...r, folders: [...r.folders].sort((a, b) => a.path.localeCompare(b.path)) }
    },
  )
}

export const createFolder = (name: string, projectKey: string | null, parentId: number | null) =>
  api<Folder>('/documents/folders', { method: 'POST', body: { name, projectKey, parentId } })

export const renameFolder = (folderId: number, name: string) =>
  api<Folder>(`/documents/folders/${folderId}`, { method: 'PATCH', body: { name } })

export const deleteFolder = (folderId: number) =>
  api<{ folderId: number; parentId: number | null; movedDocumentCount: number }>(`/documents/folders/${folderId}`, { method: 'DELETE' })

/* ---------- 파일 올리기 (진행률 · 취소) ---------- */

type UploadStart = {
  publicId: string
  mode: 'SINGLE' | 'MULTIPART'
  single: { url: string; method: 'PUT'; headers: Record<string, string> | null } | null
  multipart: { partSize: number; parts: { partNumber: number; url: string }[] } | null
}

/** 서명 주소로 PUT (XHR — fetch 는 올리는 진행률을 못 받는다) */
function put(url: string, body: Blob, headers: Record<string, string> | null, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers ?? {}).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.getResponseHeader('ETag') ?? '')
        : reject(new ApiError(xhr.status, 'UPLOAD', '파일을 올리지 못했어요.'))
    xhr.onerror = () => reject(new ApiError(0, 'UPLOAD', '파일을 올리지 못했어요. 연결을 확인해 주세요.'))
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', '올리기를 취소했어요.'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

/**
 * 파일을 Garage 로 직접 올린다 (F-1 → PUT → F-2). onProgress 는 0~1.
 * 취소하면 서버의 올리기도 지운다 (F-3).
 */
export async function uploadWithProgress(file: File, onProgress: (ratio: number) => void, signal: AbortSignal): Promise<FileRef> {
  const start = await api<UploadStart>('/files/uploads', {
    method: 'POST',
    body: { filename: file.name, size: file.size, contentType: file.type || 'application/octet-stream', purpose: 'ATTACHMENT' },
  })
  try {
    let parts: { partNumber: number; etag: string }[] | undefined
    if (start.mode === 'SINGLE' && start.single) {
      await put(start.single.url, file, start.single.headers, (loaded) => onProgress(loaded / Math.max(file.size, 1)), signal)
    } else if (start.multipart) {
      const { partSize } = start.multipart
      parts = []
      let done = 0
      for (const p of start.multipart.parts) {
        const chunk = file.slice((p.partNumber - 1) * partSize, p.partNumber * partSize)
        const etag = await put(p.url, chunk, null, (loaded) => onProgress((done + loaded) / Math.max(file.size, 1)), signal)
        done += chunk.size
        parts.push({ partNumber: p.partNumber, etag })
      }
    }
    onProgress(1)
    return await api<FileRef>(`/files/uploads/${start.publicId}/complete`, { method: 'POST', body: parts ? { parts } : {} })
  } catch (e) {
    // 올리다 멈춘 파일은 서버에서도 지운다 (실패해도 24시간 뒤 정리 작업이 지운다)
    api(`/files/${start.publicId}`, { method: 'DELETE' }).catch(() => undefined)
    throw e
  }
}

/** 목업: 진행률만 흉내 낸다 */
export function fakeUpload(file: File, onProgress: (ratio: number) => void, signal: AbortSignal): Promise<FileRef> {
  return new Promise((resolve, reject) => {
    let ratio = 0
    const timer = window.setInterval(() => {
      ratio = Math.min(1, ratio + 0.2)
      onProgress(ratio)
      if (ratio >= 1) {
        window.clearInterval(timer)
        resolve({ publicId: `mock-${file.name}`, name: file.name, size: file.size, contentType: file.type })
      }
    }, 250)
    signal.addEventListener('abort', () => {
      window.clearInterval(timer)
      reject(new ApiError(0, 'ABORTED', '올리기를 취소했어요.'))
    })
  })
}

/* ---------- 자료 만들기 (D-2) ---------- */

export type NewDocument = {
  categoryCode: string
  title: string
  body?: string
  projectKey: string | null
  visibility: DocVisibility
  folderId: number | null
  tags: string[]
  fileIds: string[]
}

export const createDocument = (d: NewDocument) =>
  api<{ documentId: number }>('/documents', {
    method: 'POST',
    body: {
      categoryCode: d.categoryCode,
      title: d.title,
      body: d.body ?? null,
      projectKey: d.projectKey,
      visibility: d.visibility,
      folderId: d.folderId,
      tags: d.tags,
      files: d.fileIds.map((fileId) => ({ fileId, note: null })),
    },
  })

/** 자료실이 다시 불러오게 알린다 (올리기 모달 → 목록) */
const CHANGED = 'iturtle:documents-changed'
export const notifyDocumentsChanged = () => window.dispatchEvent(new Event(CHANGED))
export function useDocumentsChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGED, reload)
    return () => window.removeEventListener(CHANGED, reload)
  }, [reload])
}

/** 어디서든 올리기 모달을 연다 (새로 만들기 메뉴 → 자료) */
const OPEN_UPLOAD = 'iturtle:open-upload'
export type UploadOpen = { projectKey?: string | null }
export const openUpload = (detail: UploadOpen = {}) => window.dispatchEvent(new CustomEvent<UploadOpen>(OPEN_UPLOAD, { detail }))
export function useUploadRequests(open: (d: UploadOpen) => void) {
  useEffect(() => {
    const on = (e: Event) => open((e as CustomEvent<UploadOpen>).detail ?? {})
    window.addEventListener(OPEN_UPLOAD, on)
    return () => window.removeEventListener(OPEN_UPLOAD, on)
  }, [open])
}

/* ---------- 자료 상세 (D-3) ---------- */

type FileVersionDto = { documentFileId: number; version: number; file: FileRef | null; note: string | null; uploadedBy: MemberRef | null; createdAt: string }
type DocumentDetailDto = {
  documentId: number
  categoryCode: string
  categoryName: string | null
  title: string
  author: MemberRef
  project: { projectKey: string; name: string } | null
  folder: { folderId: number; name: string; path: string } | null
  visibility: DocVisibility
  tags: string[]
  commentCount: number
  pinned: boolean
  body: string | null
  links: { linkId: number; url: string; title: string | null }[]
  files: { logicalName: string; latest: FileVersionDto; previous: FileVersionDto[] }[]
  permissions?: { canEdit: boolean; canDelete: boolean }
  createdAt: string
  updatedAt: string
}

export type DocVersion = { version: number; name: string; size: number; url: string | null; note: string | null; who: string; ago: string }
export type DocumentDetail = {
  documentId: number
  title: string
  category: string
  author: string
  ago: string
  edited: boolean
  project: { projectKey: string; name: string } | null
  folderPath: string | null
  visibility: DocVisibility
  tags: string[]
  body: string
  links: { url: string; title: string }[]
  files: { name: string; latest: DocVersion; previous: DocVersion[] }[]
  commentCount: number
  /** 고치기 창에 채울 원래 값 */
  categoryCode: string
  folderId: number | null
  canEdit: boolean
}

const toVersion = (v: FileVersionDto): DocVersion => ({
  version: v.version,
  name: v.file?.name ?? '(지운 파일)',
  size: v.file?.size ?? 0,
  url: v.file ? fileUrl(v.file.publicId) : null,
  note: v.note,
  who: v.uploadedBy?.name ?? '알 수 없음',
  ago: ago(v.createdAt),
})

const MOCK_DETAIL: DocumentDetail = {
  documentId: 1,
  title: 'KCC 2027 초안 v3',
  category: '논문',
  author: '김민서',
  ago: '2시간 전',
  edited: false,
  project: { projectKey: 'PAPER', name: 'KCC 2027 투고' },
  folderPath: 'KCC 2027 투고 / 원고',
  visibility: 'PROJECT_MEMBERS',
  tags: ['논문', '초안', 'KCC'],
  body: '심사 의견 반영 전 초안입니다. 3장 실험 결과 그래프는 **새 데이터**로 바꿨어요.',
  links: [{ url: 'https://www.kiise.or.kr', title: 'KCC 2027 투고 안내' }],
  files: [
    {
      name: 'KCC2027_초안.pdf',
      latest: { version: 3, name: 'KCC2027_초안_v3.pdf', size: 2_400_000, url: null, note: '3장 그래프 교체', who: '김민서', ago: '2시간 전' },
      previous: [{ version: 2, name: 'KCC2027_초안_v2.pdf', size: 2_100_000, url: null, note: null, who: '김민서', ago: '3일 전' }],
    },
  ],
  commentCount: 2,
  categoryCode: 'PAPER',
  folderId: null,
  canEdit: true,
}

export function useDocumentDetail(id: string | undefined) {
  return useResource<DocumentDetail>(['document', id], () => ({ ...MOCK_DETAIL, documentId: Number(id) || 1 }), async () => {
    const d = await api<DocumentDetailDto>(`/documents/${id}`)
    return {
      documentId: d.documentId,
      title: d.title,
      category: d.categoryName ?? d.categoryCode,
      author: d.author?.name ?? '알 수 없음',
      ago: ago(d.createdAt),
      edited: d.updatedAt !== d.createdAt,
      project: d.project,
      folderPath: d.folder?.path ?? null,
      visibility: d.visibility,
      tags: d.tags,
      body: d.body ?? '',
      links: d.links.map((l) => ({ url: l.url, title: l.title ?? l.url })),
      files: d.files.map((g) => ({ name: g.logicalName, latest: toVersion(g.latest), previous: g.previous.map(toVersion) })),
      commentCount: d.commentCount,
      categoryCode: d.categoryCode,
      folderId: d.folder?.folderId ?? null,
      canEdit: !!d.permissions?.canEdit,
    }
  })
}

/* ---------- 자료 고치기 (D-4) · 파일 새 버전 (D-7) ---------- */

export type DocumentEdit = {
  categoryCode: string
  title: string
  body: string
  visibility: DocVisibility
  folderId: number | null
  tags: string[]
}

/** 바뀐 칸만 보낸다 (본문 · 폴더는 비우면 null). 목업 모드면 보내지 않는다 */
export async function updateDocument(documentId: number, before: DocumentEdit, after: DocumentEdit): Promise<void> {
  if (getDataMode() !== 'live') return
  const body: Record<string, unknown> = {}
  if (after.categoryCode !== before.categoryCode) body.categoryCode = after.categoryCode
  if (after.title !== before.title) body.title = after.title
  if (after.body !== before.body) body.body = after.body.trim() ? after.body : null
  if (after.visibility !== before.visibility) body.visibility = after.visibility
  if (after.folderId !== before.folderId) body.folderId = after.folderId
  if (JSON.stringify(after.tags) !== JSON.stringify(before.tags)) body.tags = after.tags
  if (Object.keys(body).length === 0) return
  await api(`/documents/${documentId}`, { method: 'PATCH', body })
}

/**
 * 파일 새 버전 (D-7): logicalName 이 같은 파일의 다음 버전이 된다 (없으면 새 파일로 붙는다).
 * 올리기는 자료 올리기와 같은 길(uploadWithProgress)을 쓴다. 목업이면 진행률만 흉내 낸다
 */
export async function addDocumentFile(documentId: number, file: File, logicalName: string | null, note: string | null, onProgress: (ratio: number) => void, signal: AbortSignal) {
  if (getDataMode() !== 'live') {
    await fakeUpload(file, onProgress, signal)
    return
  }
  const ref = await uploadWithProgress(file, onProgress, signal)
  await api(`/documents/${documentId}/files`, { method: 'POST', body: { fileId: ref.publicId, logicalName, note } })
}

/* ---------- 프로젝트 자료 (D-1 projectKey) ---------- */

type DocumentItemDto = {
  documentId: number
  categoryCode: string
  categoryName: string | null
  title: string
  author: MemberRef
  folder: { folderId: number; name: string; path: string } | null
  visibility: DocVisibility
  tags: string[]
  fileTypes: string[]
  commentCount: number
  createdAt: string
}
export type ProjectDocument = {
  documentId: number
  title: string
  category: string
  author: string
  ago: string
  folderId: number | null
  folderPath: string | null
  visibility: DocVisibility
  tags: string[]
  fileType: string | null
  commentCount: number
}

const MOCK_PROJECT_DOCS: ProjectDocument[] = [
  { documentId: 1, title: '11/17 주간 회의 자료', category: '발표자료', author: '박지훈', ago: '2일 전', folderId: 10, folderPath: '회의 자료', visibility: 'PROJECT_MEMBERS', tags: ['회의'], fileType: 'pptx', commentCount: 1 },
  { documentId: 2, title: 'SSO 로그인 흐름도', category: '개발 문서', author: '김민서', ago: '5일 전', folderId: null, folderPath: null, visibility: 'LAB', tags: ['SSO', '설계'], fileType: 'pdf', commentCount: 3 },
  { documentId: 3, title: '배포 체크리스트 초안', category: '개발 문서', author: '이정훈', ago: '1주 전', folderId: null, folderPath: null, visibility: 'PRIVATE', tags: ['배포'], fileType: 'md', commentCount: 0 },
]

export function useProjectDocuments(projectKey: string | undefined, folderId: number | null) {
  return useResource<ProjectDocument[]>(
    ['project-documents', projectKey, folderId],
    () => MOCK_PROJECT_DOCS.filter((d) => folderId === null || d.folderId === folderId),
    async () => {
      // 폴더 안의 자료를 한 화면에 놓고 고르므로 페이지를 끝까지 돌며 모두 받는다 (첫 100개에서 끊기지 않게)
      const { first: r, content } = await fetchEveryPage(
        (page) =>
          api<{ pinned: DocumentItemDto[]; page: PageResponse<DocumentItemDto> }>('/documents', {
            query: { projectKey, folderId: folderId ?? undefined, page, size: 100, sort: 'createdAt,desc' },
          }),
        (x) => x.page,
      )
      return [...r.pinned, ...content].map((d) => ({
        documentId: d.documentId,
        title: d.title,
        category: d.categoryName ?? d.categoryCode,
        author: d.author?.name ?? '알 수 없음',
        ago: ago(d.createdAt),
        folderId: d.folder?.folderId ?? null,
        folderPath: d.folder?.path ?? null,
        visibility: d.visibility,
        tags: d.tags,
        fileType: d.fileTypes[0] ?? null,
        commentCount: d.commentCount,
      }))
    },
  )
}

/** 사람이 읽는 크기 */
export function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

/* ---------- 카테고리 (공통코드 DOCUMENT_CATEGORY, GET /codes/{codeId}) ---------- */

export type DocCategory = { code: string; name: string }
const MOCK_CATEGORIES: DocCategory[] = [
  { code: 'PAPER', name: '논문' },
  { code: 'SLIDE', name: '발표자료' },
  { code: 'DEV_DOC', name: '개발 문서' },
  { code: 'DATA', name: '데이터' },
  { code: 'FORM', name: '서식' },
  { code: 'QNA', name: '질문 · 도움' },
  { code: 'FREE', name: '자유' },
]

export function useDocumentCategories() {
  return useResource<DocCategory[]>('document-categories', () => MOCK_CATEGORIES, () =>
    api<{ code: string; name: string }[]>('/codes/DOCUMENT_CATEGORY').then((rows) => rows.map((r) => ({ code: r.code, name: r.name }))),
  )
}
