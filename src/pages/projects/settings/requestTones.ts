import type { ChipTone } from '../../../components/ui'
import type { RequestStatus } from '../../../mocks/projectSettings'

/** 권한 신청 상태 칩 (프로젝트 설정 · 권한 신청, 권한 신청하기가 같이 쓴다) */
export const REQUEST_TONE: Record<RequestStatus, ChipTone> = { PENDING: 'warning', APPROVED: 'positive', REJECTED: 'danger', CANCELLED: 'gray', EXPIRED: 'gray' }
export const REQUEST_TEXT: Record<RequestStatus, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절', CANCELLED: '취소', EXPIRED: '만료' }
