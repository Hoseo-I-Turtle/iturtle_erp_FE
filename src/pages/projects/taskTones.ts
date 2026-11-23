import type { ChipTone } from '../../components/ui'
import type { TaskPriority, TaskStatus } from '../../mocks/tasks'

/** 작업 상태 · 우선순위 칩 색 (작업 목록 · 내 작업 · 검색이 같이 쓴다) */
export const STATUS_TONE: Record<TaskStatus, ChipTone> = { TODO: 'tint', IN_PROGRESS: 'brand', REVIEW: 'warning', DONE: 'positive' }
export const PRIORITY_TONE: Record<TaskPriority, ChipTone> = { URGENT: 'danger', HIGH: 'warning', NORMAL: 'plain', LOW: 'plain' }
