import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchiveRestore, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button, Card } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import { errText, restoreProject, useDeletedProjects } from '../../../api/projectSettings'
import s from './DeletedProjects.module.css'

const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

/** 지운 프로젝트 (P-5c) — project-manage 만. 지운 지 30일 안이면 되돌리기 (P-5d) */
export function DeletedProjects({ enabled }: { enabled: boolean }) {
  const deleted = useDeletedProjects(enabled)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 화면을 연 때 기준 (렌더마다 시계를 읽지 않는다)
  const [now] = useState(() => Date.now())
  const list = deleted.data ?? []
  if (!enabled || list.length === 0) return null

  const restore = (key: string) => {
    setBusy(key)
    setError(null)
    whenLive(() => restoreProject(key))
      .then(() => navigate(`/projects/${key}`))
      .catch((e: unknown) => setError(errText(e, '되돌리지 못했어요.')))
      .finally(() => setBusy(null))
  }

  return (
    <Card className={s.card}>
      <button type="button" className={s.fold} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Trash2 size={16} /> 지운 프로젝트 {list.length}개 <small>30일 안에 되돌릴 수 있어요</small>
      </button>
      {open && (
        <ul className={s.list}>
          {list.map((p) => {
            const expired = new Date(p.restorableUntil).getTime() < now
            return (
              <li key={p.projectKey} className={s.row}>
                <span className={s.key}>{p.projectKey}</span>
                <span className={s.name}>{p.name}</span>
                <span className={s.meta}>
                  {ymd(p.deletedAt)} 지움{p.deletedBy ? ` · ${p.deletedBy}` : ''} · {expired ? '되돌릴 수 있는 기간이 지났어요' : `${ymd(p.restorableUntil)}까지`}
                </span>
                <Button variant="secondary" icon={ArchiveRestore} onClick={() => restore(p.projectKey)} disabled={expired || busy === p.projectKey}>
                  되돌리기
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className={s.fail}>{error}</p>}
    </Card>
  )
}
