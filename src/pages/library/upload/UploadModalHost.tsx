import { useCallback, useState } from 'react'
import { useUploadRequests, type UploadOpen } from '../../../api/documents'
import { UploadModal } from './UploadModal'

/** 앱 어디서든 openUpload() 로 자료 올리기를 연다 (자료실 버튼 · 프로젝트 자료 탭 · 새로 만들기 메뉴) */
export function UploadModalHost() {
  const [open, setOpen] = useState<UploadOpen | null>(null)
  useUploadRequests(useCallback((d: UploadOpen) => setOpen(d), []))
  return open ? <UploadModal projectKey={open.projectKey ?? null} onClose={() => setOpen(null)} /> : null
}
