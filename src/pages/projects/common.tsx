import { GitBranch, Image, Lock, Play, type LucideIcon } from 'lucide-react'
import { type ServiceCode } from '../../mocks/projects'
import { PROJECT_STATUS_LABEL, type ProjectStatusLive } from '../../api/projects'
import s from './common.module.css'

const SERVICE_ICON: Record<ServiceCode, LucideIcon> = {
  GITHUB: GitBranch,
  JENKINS: Play,
  VAULT: Lock,
  PENPOT: Image,
}

export function ServiceIcon({ code, size = 16, className }: { code: ServiceCode; size?: number; className?: string }) {
  const Icon = SERVICE_ICON[code]
  return <Icon size={size} className={className} aria-label={code} />
}

/** 프로젝트 상태 칩. 서버의 ON_HOLD(보류) 도 받는다 */
export function StatusChip({ status }: { status: ProjectStatusLive }) {
  const cls = status === 'ACTIVE' ? s.active : status === 'PREPARING' || status === 'ON_HOLD' ? s.prep : s.done
  return <span className={`${s.status} ${cls}`}>{PROJECT_STATUS_LABEL[status] ?? status}</span>
}
