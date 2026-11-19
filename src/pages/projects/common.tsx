import { GitBranch, Image, Lock, Play, type LucideIcon } from 'lucide-react'
import { PROJECT_STATUS_NAME, type ProjectStatus, type ServiceCode } from '../../mocks/projects'
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

export function StatusChip({ status }: { status: ProjectStatus }) {
  const cls = status === 'ACTIVE' ? s.active : status === 'PREPARING' ? s.prep : s.done
  return <span className={`${s.status} ${cls}`}>{PROJECT_STATUS_NAME[status]}</span>
}
