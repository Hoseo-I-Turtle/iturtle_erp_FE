import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, FileText, FlaskConical, Info, LayoutGrid, Lock, Megaphone, MessageSquare, Plus, SquareCheck, Upload, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui'
import { api } from '../api/client'
import { useResource } from '../api/useResource'
import { EventCreateModal } from '../pages/calendar/EventCreateModal'
import { DocumentUploadModal } from '../pages/library/DocumentUploadModal'
import { NoticeWriteModal } from '../pages/notices/NoticeWriteModal'
import { MilestoneCreateModal } from '../pages/projects/MilestoneCreateModal'
import { ProjectCreateModal } from '../pages/projects/ProjectCreateModal'
import { TaskCreateModal } from '../pages/projects/TaskCreateModal'
import s from './NewMenu.module.css'

type Kind = 'task' | 'minute' | 'milestone' | 'thread' | 'event' | 'document' | 'notice' | 'project'
type Item = { kind: Kind; icon: LucideIcon; title: string; desc: string; key: string }

const PROJECT_ITEMS: Item[] = [
  { kind: 'task', icon: SquareCheck, title: '작업', desc: '보드 · 작업 목록에 올라가요', key: 'C' },
  { kind: 'minute', icon: FileText, title: '회의록', desc: '할 일을 작업으로 이어요', key: 'M' },
  { kind: 'milestone', icon: FlaskConical, title: '마일스톤', desc: '작업을 묶어 기한을 봐요', key: 'S' },
  { kind: 'thread', icon: MessageSquare, title: '스레드 글', desc: '프로젝트 토론', key: 'T' },
]
const LAB_ITEMS: Item[] = [
  { kind: 'event', icon: Calendar, title: '일정', desc: '캘린더 · 회의 · 마감', key: 'E' },
  { kind: 'document', icon: Upload, title: '자료', desc: '자료실에 파일 올리기', key: 'U' },
  { kind: 'notice', icon: Megaphone, title: '공지', desc: '필독 · 투표 · 대상 지정', key: 'N' },
  { kind: 'project', icon: LayoutGrid, title: '프로젝트', desc: '새 프로젝트 만들기', key: 'P' },
]

/** 헤더 "새로 만들기": 무엇을 만들지 고르는 메뉴 (Penpot 06 · 새로 만들기 메뉴) */
export function NewMenu() {
  const { key: projectKey } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<Kind | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  // 공지 쓰기 · 프로젝트 만들기는 역할이 있어야 한다 (목업은 모두 있음)
  const roles = useResource<string[]>('my-roles', () => ['notice-write', 'project-create'], () => api<{ roles: string[] }>('/members/me').then((m) => m.roles))
  const locked = (k: Kind) => (k === 'notice' && !roles.data?.includes('notice-write')) || (k === 'project' && !roles.data?.includes('project-create'))
  const items = [...(projectKey ? PROJECT_ITEMS : []), ...LAB_ITEMS]

  const pick = (k: Kind) => {
    if (locked(k)) return
    setOpen(false)
    if (k === 'minute') navigate(`/projects/${projectKey}/minutes/new`)
    else if (k === 'thread') navigate(`/projects/${projectKey}/threads/new`)
    else setModal(k)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      const it = items.find((x) => x.key === e.key.toUpperCase())
      if (it && !(e.target instanceof HTMLInputElement)) pick(it.kind)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectKey, roles.data])

  const row = (it: Item) => (
    <button key={it.kind} type="button" role="menuitem" className={locked(it.kind) ? `${s.item} ${s.locked}` : s.item} onClick={() => pick(it.kind)}>
      <i>
        <it.icon size={16} />
      </i>
      <span>
        <strong>{it.title}</strong>
        <small>{it.desc}</small>
      </span>
      {locked(it.kind) ? (
        <em className={s.need}>
          <Lock size={12} />
          권한 필요
        </em>
      ) : (
        <kbd>{it.key}</kbd>
      )}
    </button>
  )
  const close = () => setModal(null)

  return (
    <div className={s.wrap} ref={ref}>
      <Button icon={Plus} aria-expanded={open} onClick={() => setOpen(!open)}>
        새로 만들기
      </Button>
      {open && (
        <div className={s.menu} role="menu">
          {projectKey && (
            <>
              <p>이 프로젝트에</p>
              {PROJECT_ITEMS.map(row)}
              <hr />
            </>
          )}
          <p>연구실</p>
          {LAB_ITEMS.map(row)}
          <small className={s.hint}>
            <Info size={12} />
            메뉴가 열려 있을 때 글자 키로 고를 수 있어요 · 공지는 공지 쓰기 역할이 필요해요
          </small>
        </div>
      )}
      {modal === 'task' && projectKey && <TaskCreateModal projectKey={projectKey} onClose={close} onCreated={(k) => { close(); navigate(`/projects/${projectKey}/tasks/${k}`) }} />}
      {modal === 'milestone' && projectKey && <MilestoneCreateModal projectKey={projectKey} onClose={close} onCreated={() => { close(); navigate(`/projects/${projectKey}/milestones`) }} />}
      {modal === 'event' && <EventCreateModal onClose={close} onCreated={() => { close(); navigate('/calendar') }} />}
      {modal === 'document' && <DocumentUploadModal projectKey={projectKey} onClose={close} onCreated={(id) => { close(); navigate(`/library/${id}`) }} />}
      {modal === 'notice' && <NoticeWriteModal onClose={close} onCreated={(id) => { close(); navigate(id === null ? '/notices' : `/notices/${id}`) }} />}
      {modal === 'project' && <ProjectCreateModal onClose={close} onCreated={(k, failed) => { close(); navigate(failed.length ? `/projects/${k}/settings` : `/projects/${k}`) }} />}
    </div>
  )
}
