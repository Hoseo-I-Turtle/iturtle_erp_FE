import { useEffect, useRef, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import {
  Calendar,
  ChevronDown,
  FileText,
  FlaskConical,
  Info,
  LayoutGrid,
  Lock,
  Megaphone,
  MessageSquare,
  Plus,
  SquareCheck,
  Upload,
  type LucideIcon,
  Scale,
} from 'lucide-react'
import { Button } from '../components/ui'
import { useMe } from '../api/members'
import { openTaskCreate } from '../api/tasks'
import { openUpload } from '../api/documents'
import { NoticeWriteModal } from '../pages/notices/NoticeWriteModal'
import s from './NewMenu.module.css'

type Item = { key: string; icon: LucideIcon; label: string; desc: string; role?: string; run: () => void }

/**
 * 머리의 "새로 만들기" (Penpot 06 "새로 만들기 메뉴"). 프로젝트 안이면 그 프로젝트 항목을 먼저 보여 준다.
 * 메뉴가 열려 있을 때 단축키(오른쪽 글자)로 바로 고른다. 권한이 없는 항목은 흐리게 두고 "권한 필요"를 단다 (서버도 막는다).
 * 회의록은 쓰기 화면(minutes/new)으로, 일정 · 프로젝트 · 마일스톤은 그 화면으로 보내고 ?new=1 을 붙인다 (그 화면이 만들기 창을 연다).
 */
export function NewMenu() {
  const navigate = useNavigate()
  const match = useMatch('/projects/:key/*')
  const key = match?.params.key
  const me = useMe()
  const roles = me.data?.roles ?? null
  const can = (role?: string) => !role || roles === null || roles.includes(role)
  const [open, setOpen] = useState(false)
  const [writing, setWriting] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const base = key ? `/projects/${key}` : ''
  const project: Item[] = key
    ? [
        { key: 'C', icon: SquareCheck, label: '작업', desc: '보드 · 작업 목록에 올라가요', run: () => openTaskCreate({}) },
        { key: 'M', icon: FileText, label: '회의록', desc: '할 일을 작업으로 이어요', run: () => navigate(`${base}/minutes/new`) },
        { key: 'S', icon: FlaskConical, label: '마일스톤', desc: '작업을 묶어 기한을 봐요', run: () => navigate(`${base}/milestones?new=1`) },
        { key: 'T', icon: MessageSquare, label: '스레드 글', desc: '프로젝트 토론', run: () => navigate(`${base}/threads/new`) },
        { key: 'R', icon: Scale, label: '정책', desc: '정한 규칙과 이유 남기기', run: () => navigate(`${base}/policies/new`) },
      ]
    : []
  const lab: Item[] = [
    { key: 'E', icon: Calendar, label: '일정', desc: '캘린더 · 회의 · 마감', run: () => navigate('/calendar?new=1') },
    { key: 'U', icon: Upload, label: '자료', desc: '자료실에 파일 올리기', run: () => openUpload({ projectKey: key ?? null }) },
    { key: 'N', icon: Megaphone, label: '공지', desc: '필독 · 투표 · 대상 지정', role: 'notice-write', run: () => setWriting(true) },
    { key: 'P', icon: LayoutGrid, label: '프로젝트', desc: '새 프로젝트 만들기', role: 'project-create', run: () => navigate('/projects?new=1') },
  ]
  const all = [...project, ...lab]

  const pick = (item: Item) => {
    if (!can(item.role)) return
    setOpen(false)
    item.run()
  }

  // 바깥을 누르면 닫고, 열려 있을 때 단축키로 고른다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const item = all.find((x) => x.key === e.key.toUpperCase())
      if (item) {
        e.preventDefault()
        pick(item)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  })

  const row = (item: Item) => {
    const allowed = can(item.role)
    const Icon = item.icon
    return (
      <li key={item.key}>
        <button type="button" role="menuitem" className={allowed ? s.item : `${s.item} ${s.locked}`} disabled={!allowed} onClick={() => pick(item)}>
          <span className={s.icon}>
            <Icon size={18} />
          </span>
          <span className={s.text}>
            <strong>{item.label}</strong>
            <small>{item.desc}</small>
          </span>
          {allowed ? (
            <kbd className={s.key}>{item.key}</kbd>
          ) : (
            <span className={s.need}>
              <Lock size={12} /> 권한 필요
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className={s.wrap} ref={box}>
      <Button icon={Plus} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        새로 만들기
        <ChevronDown size={16} className={open ? s.chevOpen : s.chev} />
      </Button>
      {open && (
        <div className={s.menu} role="menu" aria-label="새로 만들기">
          {project.length > 0 && (
            <>
              <p className={s.group}>이 프로젝트에</p>
              <ul className={s.list}>{project.map(row)}</ul>
              <hr className={s.sep} />
            </>
          )}
          <p className={s.group}>연구실</p>
          <ul className={s.list}>{lab.map(row)}</ul>
          <p className={s.foot}>
            <Info size={12} /> 메뉴를 연 뒤 오른쪽 글자 키로 바로 골라요 · 공지는 공지 쓰기 역할이 필요해요
          </p>
        </div>
      )}
      {writing && <NoticeWriteModal onClose={() => setWriting(false)} />}
    </div>
  )
}
