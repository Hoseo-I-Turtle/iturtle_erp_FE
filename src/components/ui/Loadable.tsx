import type { ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import type { Resource } from '../../api/useResource'
import s from './ui.module.css'

/** 불러오는 중 · 오류를 대신 보여 주고, 데이터가 있으면 children 을 그린다 */
export function Loadable<T>({ resource, children, label }: { resource: Resource<T>; children: (data: T) => ReactNode; label?: string }) {
  if (resource.error)
    return (
      <div className={s.loadError} role="alert">
        <TriangleAlert size={18} />
        <span>
          {label ? `${label}: ` : ''}
          {resource.error}
        </span>
        <button type="button" onClick={resource.reload}>
          <RefreshCw size={14} /> 다시 시도
        </button>
      </div>
    )
  if (resource.loading || resource.data === undefined)
    return (
      <div className={s.skeleton} aria-busy="true" aria-label="불러오는 중">
        <i />
        <i />
        <i />
      </div>
    )
  return <>{children(resource.data)}</>
}
