import type { SignupRequest } from '../../../mocks/admin'

export type SignupTab = SignupRequest['status']
export const STATUS_LABEL: Record<SignupTab, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절' }
