// 통합 검색 화면 (CMN-2) — 상단 검색창에서 Enter 로 온다. /search?q=검색어&kind=TASK
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ClipboardList,
  FileText,
  FolderKanban,
  Megaphone,
  MessagesSquare,
  RefreshCw,
  Scale,
  Search,
  SquareCheck,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Card, Chip, Empty, ListItem, Loadable, PillTabs } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { MIN_KEYWORD, SEARCH_KINDS, searchMore, useUnifiedSearch, type SearchGroup, type SearchKind } from '../../api/search'
import { useGoSearch } from './useGoSearch'
import s from './SearchPage.module.css'

type KindFilter = 'ALL' | SearchKind

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  NOTICE: Megaphone,
  TASK: SquareCheck,
  DOCUMENT: FileText,
  MINUTE: ClipboardList,
  THREAD: MessagesSquare,
  POLICY: Scale,
  PROJECT: FolderKanban,
  MEMBER: Users,
}
const KIND_LABEL = Object.fromEntries(SEARCH_KINDS.map((k) => [k.kind, k.label])) as Record<SearchKind, string>
const isKind = (v: string | null): v is SearchKind => SEARCH_KINDS.some((k) => k.kind === v)

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const kindParam = params.get('kind')
  const kind: KindFilter = isKind(kindParam) ? kindParam : 'ALL'
  const setKind = (k: KindFilter) => setParams(k === 'ALL' ? { q } : { q, kind: k }, { replace: true })

  return (
    <>
      <PageHeader title="검색" subtitle="공지 · 작업 · 자료 · 회의록 · 스레드 · 정책 · 프로젝트 · 구성원을 한 번에 찾아요" />
      {/* 검색어가 바뀌면 "더 보기"로 더 받은 것도 처음부터 */}
      <SearchView key={q} q={q} kind={kind} onKind={setKind} />
    </>
  )
}

function SearchView({ q, kind, onKind }: { q: string; kind: KindFilter; onKind: (k: KindFilter) => void }) {
  const goSearch = useGoSearch()
  const [text, setText] = useState(q)
  const kw = q.trim()
  const enough = kw.length >= MIN_KEYWORD
  const result = useUnifiedSearch(kw)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void goSearch(text)
  }

  return (
    <Card className={s.card}>
      <form className={s.box} role="search" onSubmit={submit}>
        <Search size={18} />
        <input
          type="search"
          value={text}
          autoFocus={!kw}
          enterKeyHint="search"
          aria-label="검색어"
          placeholder="찾을 말 (2글자 이상) · 작업 번호(DEFME-12)면 그 작업으로 바로 가요"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className={s.go}>
          검색
        </button>
      </form>

      {!enough ? (
        <Empty>{kw ? `${MIN_KEYWORD}글자 이상 입력해 주세요.` : '찾을 말을 입력해 주세요.'}</Empty>
      ) : (
        <Loadable resource={result} label="검색">
          {(groups) => <Results q={kw} groups={groups} kind={kind} onKind={onKind} />}
        </Loadable>
      )}
    </Card>
  )
}

/** 종류별 "더 보기" · "다시 시도"로 받은 상태 (첫 결과를 대신한다) */
type MoreState = SearchGroup & { page: number; loading: boolean; moreError?: boolean }

function Results({ q, groups, kind, onKind }: { q: string; groups: SearchGroup[]; kind: KindFilter; onKind: (k: KindFilter) => void }) {
  const [more, setMore] = useState<Partial<Record<SearchKind, MoreState>>>({})
  const merged = groups.map((g): MoreState => more[g.kind] ?? { ...g, page: 0, loading: false })

  /** page 를 받아 붙인다 (page 0 이면 다시 시도라 새로 채운다) */
  const load = (g: MoreState, page: number) => {
    setMore((m) => ({ ...m, [g.kind]: { ...g, loading: true } }))
    searchMore(g.kind, q, page)
      .then((r) =>
        setMore((m) => ({
          ...m,
          [g.kind]: { kind: g.kind, error: null, page, loading: false, total: r.total, hasMore: r.hasMore, hits: page === 0 ? r.hits : [...g.hits, ...r.hits] },
        })),
      )
      .catch(() => setMore((m) => ({ ...m, [g.kind]: page === 0 ? { ...g, loading: false, error: '불러오지 못했어요' } : { ...g, loading: false, moreError: true } })))
  }

  const total = merged.reduce((n, g) => n + g.total, 0)
  const shown = kind === 'ALL' ? merged.filter((g) => g.hits.length > 0 || g.error) : merged.filter((g) => g.kind === kind)
  const anyError = merged.some((g) => g.error)

  return (
    <>
      <div className={s.kinds}>
        <PillTabs
          value={kind}
          onChange={onKind}
          options={[
            { value: 'ALL' as KindFilter, label: '전체', count: total },
            ...merged.map((g) => ({ value: g.kind as KindFilter, label: KIND_LABEL[g.kind], count: g.error ? undefined : g.total })),
          ]}
        />
      </div>

      {shown.length === 0 || (kind === 'ALL' && total === 0 && !anyError) ? (
        <Empty>
          “{q}” 에 맞는 {kind === 'ALL' ? '결과' : KIND_LABEL[kind]}가 없어요. 다른 말로 찾아 보세요.
        </Empty>
      ) : (
        shown.map((g) => <GroupBlock key={g.kind} q={q} g={g} onMore={() => load(g, g.page + 1)} onRetry={() => load(g, 0)} />)
      )}
    </>
  )
}

function GroupBlock({ q, g, onMore, onRetry }: { q: string; g: MoreState; onMore: () => void; onRetry: () => void }) {
  const Icon = KIND_ICON[g.kind]
  return (
    <section className={s.group} aria-label={KIND_LABEL[g.kind]}>
      <h2 className={s.groupHead}>
        <Icon size={18} />
        {KIND_LABEL[g.kind]}
        {!g.error && <Chip tone="count">{g.total}</Chip>}
      </h2>
      {g.error ? (
        <div className={s.fail} role="alert">
          <TriangleAlert size={16} />
          <span>{g.error}</span>
          <button type="button" onClick={onRetry} disabled={g.loading}>
            <RefreshCw size={14} /> 다시 시도
          </button>
        </div>
      ) : g.hits.length === 0 ? (
        <Empty>이 종류에는 맞는 것이 없어요.</Empty>
      ) : (
        <div className={s.hits}>
          {g.hits.map((h) => (
            <ListItem key={h.id} to={h.to ?? undefined} title={<Highlight text={h.title} keyword={q} />} meta={h.meta} />
          ))}
        </div>
      )}
      {!g.error && g.hasMore && (
        <button type="button" className={s.more} onClick={onMore} disabled={g.loading}>
          {g.loading ? '불러오는 중…' : g.moreError ? '불러오지 못했어요 · 다시 시도' : '더 보기'}
          {!g.loading && <ChevronDown size={14} />}
        </button>
      )}
    </section>
  )
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 검색어(띄어 쓴 낱말마다)를 칠한다 (CMN-2-05). 대소문자는 가리지 않는다 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const terms = keyword
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
  if (terms.length === 0) return <>{text}</>
  const parts = text.split(new RegExp(`(${terms.join('|')})`, 'gi'))
  // 잡는 괄호로 나누면 홀수 자리가 검색어와 맞은 부분이다
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className={s.mark}>{p}</mark> : p))}</>
}
