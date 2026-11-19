import type { AdminDetail, AdminRow } from '../../../api/admin'

/** 목록 행 + 고른 사람 상세(역할 · 프리셋 · GitHub) */
export type SelectedMember = AdminRow & Partial<AdminDetail>
