import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Folder, Info, Kanban, LayoutGrid, Megaphone, MessageCircle, MessageSquare, Search, Users, type LucideIcon } from 'lucide-react'
import { Avatar, Card, Chip, Empty, Loadable, Note, Select } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { useMyProjectOptions } from '../../api/documents'
import { lookupTask, useSearch, type SearchGroup, type SearchKind } from '../../api/search'
import { getDataMode } from '../../lib/dataMode'
import { STATUS_NAME } from '../../mocks/tasks'
import { STATUS_TONE } from '../projects/taskTones'
import s from './SearchPage.module.css'

const KIND: Record<SearchKind, { label: string; icon: LucideIcon }> = {
  task: { label: '작업', icon: Kanban },
  comment: { label: '작업 댓글', icon: MessageCircle },
  minute: { label: '회의록', icon: ClipboardList },
  thread: { label: '스레드', icon: MessageSquare },
  notice: { label: '공지', icon: Megaphone },
  document: { label: '자료', icon: Folder },
  project: { label: '프로젝트', icon: LayoutGrid },
  member: { label: '구성원', icon: Users },
}
const PERIODS = [
  { value: '0', label: '기간 전체' },
  { value: '1', label: '최근 1개월' },
  { value: '3', label: '최근 3개월' },
  { value: '12', label: '최근 1년' },
]

/** 찾은 말을 노랗게 칠한다 (CMN-2-05) */
function mark(text: string, q: string): ReactNode {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/** 검색 결과 (Penpot 06 · 검색 결과) — 통합 검색 CMN-2 */
export function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const q = (params.get('q') ?? '').trim()
  const [kind, setKind] = useState<SearchKind | 'all'>('all')
  const [projectKey, setProjectKey] = useState('')
  const [months, setMonths] = useState('0')
  const projects = useMyProjectOptions()
  const res = useSearch({ q, projectKey, months: Number(months) })
  const groups = res.data ?? []
  const total = groups.reduce((a, g) => a + g.total, 0)

  // 작업 번호를 쳤으면 그 작업으로 바로 간다
  useEffect(() => {
    let alive = true
    void lookupTask(q, getDataMode() === 'live').then((to) => alive && to && navigate(to, { replace: true }))
    return () => {
      alive = false
    }
  }, [q, navigate])

  const shown = groups.filter((g) => (kind === 'all' ? g.total > 0 : g.kind === kind))

  return (
    <>
      {/* key: 다른 말로 다시 찾으면 헤더 검색창도 새 값으로 */}
      <PageHeader key={q} title="검색" subtitle={q ? `"${q}" · 볼 수 있는 것만 나와요` : '찾을 말을 위 검색창에 적어 주세요'} action={null} />
      <div className={s.layout}>
        <Card className={s.side}>
          <p>종류</p>
          <button type="button" className={kind === 'all' ? s.kindOn : undefined} onClick={() => setKind('all')}>
            <Search size={16} />
            <span>전체</span>
            <b>{total}</b>
          </button>
          {(Object.keys(KIND) as SearchKind[]).map((k) => {
            const Icon = KIND[k].icon
            const n = groups.find((g) => g.kind === k)?.total ?? 0
            return (
              <button key={k} type="button" className={kind === k ? s.kindOn : undefined} onClick={() => setKind(k)}>
                <Icon size={16} />
                <span>{KIND[k].label}</span>
                <b className={n === 0 ? s.zero : undefined}>{n}</b>
              </button>
            )
          })}
          <hr />
          <p>거르기</p>
          <Select block value={months} options={PERIODS} onChange={setMonths} label="기간" />
          <Select block value={projectKey} options={[{ value: '', label: '프로젝트 전체' }, ...(projects.data ?? []).map((p) => ({ value: p.projectKey, label: p.name }))]} onChange={setProjectKey} label="프로젝트" />
        </Card>

        <div className={s.results}>
          <Note icon={Info}>작업 번호(예: DEFME-44)를 치면 그 작업으로 바로 가요 · 2글자부터 찾고, 첨부 파일은 이름만 찾아요</Note>
          {q.length < 2 ? (
            <Card>
              <Empty>두 글자 이상 적어 주세요.</Empty>
            </Card>
          ) : (
            <Loadable resource={res} label="검색">
              {() =>
                shown.length === 0 || shown.every((g) => g.total === 0) ? (
                  <Card>
                    <Empty>"{q}" 로 찾은 것이 없어요. 다른 말로 찾아 보세요.</Empty>
                  </Card>
                ) : (
                  <>
                    {shown.map((g) => (
                      <Group key={g.kind} g={g} q={q} onMore={kind === 'all' ? () => setKind(g.kind) : undefined} />
                    ))}
                  </>
                )
              }
            </Loadable>
          )}
        </div>
      </div>
    </>
  )
}

function Group({ g, q, onMore }: { g: SearchGroup; q: string; onMore?: () => void }) {
  const { label, icon: Icon } = KIND[g.kind]
  return (
    <Card className={s.group}>
      <div className={s.groupHead}>
        <Icon size={16} />
        <strong>{label}</strong>
        <span>{g.total}</span>
        {onMore && g.total > g.hits.length && (
          <button type="button" onClick={onMore}>
            {g.total - g.hits.length}개 더 있어요 · 이 종류만 보기
          </button>
        )}
      </div>
      {g.hits.map((h) => (
        <Link key={h.id} to={h.to} className={s.hit}>
          {h.badge && <span className={s.badge}>{h.badge}</span>}
          {h.avatar && <Avatar name={h.avatar} size={30} />}
          <span className={s.text}>
            <strong>{mark(h.title, q)}</strong>
            <small>{h.meta}</small>
          </span>
          {h.status && <Chip tone={STATUS_TONE[h.status]}>{STATUS_NAME[h.status]}</Chip>}
          {h.tag && <Chip tone={h.tag === '필독' ? 'danger' : 'plain'}>{h.tag}</Chip>}
        </Link>
      ))}
    </Card>
  )
}
