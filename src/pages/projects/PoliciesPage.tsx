import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Database,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GitCommitHorizontal,
  History,
  Info,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  Quote,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, KeyValue, Loadable, Note, PillTabs, SectionHead, type ChipTone } from '../../components/ui'
import { CommentThread } from '../../components/comments/CommentThread'
import { LoadMore } from '../../components/ui/LoadMore'
import { useLoadMore } from '../../api/useLoadMore'
import { whenLive } from '../../api/useResource'
import { errorText } from '../../api/content'
import { ago } from '../../api/types'
import { useMe } from '../../api/members'
import {
  CATEGORY_LABEL,
  RELATION_LABEL,
  SOURCE_LABEL,
  SPEC_LIMITS,
  STATUS_LABEL,
  changePolicyStatus,
  createPolicy,
  isSpecEmpty,
  specOf,
  updatePolicy,
  fetchMorePolicies,
  usePolicies,
  usePolicy,
  type EvidenceKind,
  type Policy,
  type PolicyCategory,
  type PolicyCommit,
  type PolicyCommitRelation,
  type PolicyDetail,
  type PolicyEvidence,
  type PolicyInput,
  type PolicySource,
  type PolicySpec,
  type PolicyStatus,
  type PolicyVersion,
} from '../../api/policies'
import s from './PoliciesPage.module.css'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

const STATUS_TONE: Record<PolicyStatus, ChipTone> = {
  ACTIVE: 'brand',
  REVIEW_NEEDED: 'warning',
  BROKEN: 'danger',
  RETIRED: 'muted',
  SUPERSEDED: 'muted',
}
/** 종류별 색 (왼쪽 막대 · 칩) */
const CATEGORY_CLASS: Record<PolicyCategory, string> = {
  OPERATION: s.catOperation,
  DESIGN: s.catDesign,
  WORKFLOW: s.catWorkflow,
  AI_GUIDE: s.catAi,
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as PolicyCategory[]
type View = 'live' | 'attention' | 'inactive'
const VIEW_STATUSES: Record<View, PolicyStatus[] | undefined> = {
  live: undefined,
  attention: ['REVIEW_NEEDED', 'BROKEN'],
  inactive: ['RETIRED', 'SUPERSEDED'],
}

const who = (v: string | null) => (v === 'ai' ? 'AI' : v === 'human' ? '사람' : '—')
const shortSha = (sha: string) => sha.slice(0, 7)

/**
 * 프로젝트 › 정책 (ERP-41): 정한 규칙과 그 이유. 목록 · 상세(정형 규칙 · 근거 · 커밋 · 이력 · 댓글) · 남기기 · 고치기.
 * 연구실 전체 규칙은 ERP 프로젝트의 정책 탭 (LAB 프로젝트는 없앰, ERP-46). AI 는 MCP find_policies · save_policy 로 같은 정책을 읽고 남긴다.
 */
export function PoliciesPage() {
  const { key = '', policyKey } = useParams()
  const { pathname } = useLocation()
  if (pathname.endsWith('/policies/new')) return <PolicyForm projectKey={key} />
  if (policyKey && pathname.endsWith('/edit')) return <PolicyEdit projectKey={key} policyKey={policyKey} />
  if (policyKey) return <PolicyDetailView projectKey={key} policyKey={policyKey} />
  return <PolicyListView projectKey={key} />
}

// ─────────────── 목록 ───────────────

function PolicyListView({ projectKey }: { projectKey: string }) {
  const [category, setCategory] = useState<'ALL' | PolicyCategory>('ALL')
  const [view, setView] = useState<View>('live')
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const filter = { query: applied, categories: category === 'ALL' ? undefined : [category], statuses: VIEW_STATUSES[view] }
  const list = usePolicies(projectKey, filter)
  // 목록 끝에 닿으면 같은 조건의 다음 페이지를 이어 붙인다
  const more = useLoadMore(list, list.data?.hasNext, (d) => fetchMorePolicies(projectKey, filter, d))

  return (
    <Card className={s.main}>
      <div className={s.top}>
        <SectionHead icon={Scale} title="정책" />
        <span className={s.grow} />
        <form
          className={s.search}
          onSubmit={(e) => {
            e.preventDefault()
            setApplied(query)
          }}
        >
          <Search size={16} />
          <input type="search" value={query} placeholder="키 · 제목 · 규칙 · 이유" onChange={(e) => setQuery(e.target.value)} />
        </form>
        {list.data?.canWrite !== false && (
          <Link to={`/projects/${projectKey}/policies/new`}>
            <Button icon={Plus}>정책 남기기</Button>
          </Link>
        )}
      </div>
      <p className={s.hint}>
        프로젝트가 정한 규칙과 그 이유예요. 사람이 바뀌어도, 다른 사람의 AI 도 같은 규칙을 따라요.
        {projectKey === 'ERP' ? ' 연구실 전체 규칙도 여기에 남겨요.' : <> 연구실 전체 규칙은 <Link to="/projects/ERP/policies">ERP 정책</Link>에 있어요.</>}
      </p>
      <div className={s.filters}>
        <PillTabs
          value={category}
          onChange={setCategory}
          options={[{ value: 'ALL' as const, label: '전체' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]}
        />
        <span className={s.grow} />
        <PillTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'live' as const, label: '지키는 정책' },
            { value: 'attention' as const, label: '검토 필요' },
            { value: 'inactive' as const, label: '지난 정책' },
          ]}
        />
      </div>
      <Loadable resource={list} label="정책">
        {(d) =>
          d.policies.length === 0 ? (
            <Empty>{applied || category !== 'ALL' || view !== 'live' ? '조건에 맞는 정책이 없어요.' : '아직 남긴 정책이 없어요.'}</Empty>
          ) : (
            <>
              <ul className={s.list}>
                {d.policies.map((p) => (
                  <PolicyRow key={p.key} projectKey={projectKey} policy={p} />
                ))}
              </ul>
              <LoadMore more={more} />
            </>
          )
        }
      </Loadable>
    </Card>
  )
}

function PolicyRow({ projectKey, policy: p }: { projectKey: string; policy: Policy }) {
  const spec = specOf(p)
  return (
    <li>
      <Link to={`/projects/${projectKey}/policies/${p.key}`} className={cx(s.row, CATEGORY_CLASS[p.category])}>
        <span className={s.key}>{p.key}</span>
        <span className={s.rowBody}>
          <strong>{p.title}</strong>
          <small>{p.rule}</small>
          <span className={s.meta}>
            {(spec.musts.length > 0 || spec.mustNots.length > 0) && (
              <span className={s.specBadges}>
                {spec.musts.length > 0 && <span className={s.badgeMust}>지킬 것 {spec.musts.length}</span>}
                {spec.mustNots.length > 0 && <span className={s.badgeMustNot}>금지 {spec.mustNots.length}</span>}
              </span>
            )}
            {p.modules.length > 0 && <span>범위 {p.modules.join(' · ')}</span>}
            <span>{p.recordedBy?.name ?? SOURCE_LABEL[p.sourceType]}</span>
            <span>{ago(p.updatedAt)}</span>
            {p.evidence.length > 0 && <span>근거 {p.evidence.length}</span>}
            {p.commentCount > 0 && <span>댓글 {p.commentCount}</span>}
          </span>
        </span>
        <span className={s.chips}>
          <span className={s.catChip}>{CATEGORY_LABEL[p.category]}</span>
          <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>
        </span>
      </Link>
    </li>
  )
}

// ─────────────── 상세 ───────────────

function PolicyDetailView({ projectKey, policyKey }: { projectKey: string; policyKey: string }) {
  const detail = usePolicy(projectKey, policyKey)
  return (
    <Loadable resource={detail} label="정책">
      {(d) => <PolicyDetailBody projectKey={projectKey} d={d} onChange={(next) => detail.setData(() => next)} />}
    </Loadable>
  )
}

function PolicyDetailBody({ projectKey, d, onChange }: { projectKey: string; d: PolicyDetail; onChange: (d: PolicyDetail) => void }) {
  const me = useMe().data
  const p = d.policy
  const spec = specOf(p)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = `/projects/${projectKey}/policies`

  const status = async (action: 'CONFIRM' | 'RETIRE') => {
    setError('')
    setBusy(true)
    try {
      const next = await whenLive(() => changePolicyStatus(projectKey, p.key, action))
      onChange(next ?? { ...d, policy: { ...p, status: action === 'RETIRE' ? 'RETIRED' : 'ACTIVE', version: p.version + 1 } })
    } catch (e) {
      setError(errorText(e, '바꾸지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cx(s.detail, CATEGORY_CLASS[p.category])}>
      <Card className={s.headCard}>
        <div className={s.top}>
          <Link to={base} className={s.back}>
            <ChevronLeft size={16} /> 정책
          </Link>
          <span className={s.grow} />
          {d.canWrite && (
            <>
              {(p.status === 'REVIEW_NEEDED' || p.status === 'BROKEN') && (
                <Button variant="secondary" icon={Check} onClick={() => status('CONFIRM')} disabled={busy}>
                  그대로 맞음
                </Button>
              )}
              <Link to={`${base}/${p.key}/edit`}>
                <Button variant="secondary" icon={Pencil}>
                  고치기
                </Button>
              </Link>
              {p.status !== 'RETIRED' && p.status !== 'SUPERSEDED' && (
                <Button variant="secondary" icon={X} onClick={() => status('RETIRE')} disabled={busy}>
                  내리기
                </Button>
              )}
            </>
          )}
        </div>
        <div className={s.head}>
          <span className={s.keyChip}>{p.key}</span>
          <h1>{p.title}</h1>
          <span className={s.headChips}>
            <span className={s.catChip}>{CATEGORY_LABEL[p.category]}</span>
            <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>
          </span>
        </div>
        {p.status === 'REVIEW_NEEDED' && (
          <Note icon={TriangleAlert} tone="warning">
            근거 파일이 바뀌었어요. 정책이 그대로 맞으면 "그대로 맞음", 바뀌었으면 고쳐 주세요.
          </Note>
        )}
        {p.status === 'BROKEN' && (
          <Note icon={TriangleAlert} tone="warning">
            근거가 사라졌어요. 고치기에서 새 근거를 주거나, 더는 지키지 않으면 내려 주세요.
          </Note>
        )}
        {p.supersededBy && (
          <Note icon={History}>
            이 정책은 <Link to={`${base}/${p.supersededBy}`}>{p.supersededBy}</Link> 로 바뀌었어요.
          </Note>
        )}
        {error && <p className={s.error}>{error}</p>}
      </Card>

      <div className={s.layout}>
        <div className={s.mainCol}>
          <Card className={s.summary}>
            <span className={s.overline}>
              <Quote size={14} /> 규칙 요약
            </span>
            <p>{p.rule}</p>
          </Card>

          <SpecCard spec={spec} canWrite={d.canWrite} />

          <div className={s.pair}>
            <Card className={s.card}>
              <SectionHead icon={Lightbulb} title="이유" extra={p.whyBy ? <Chip tone="tint">말한 사람: {who(p.whyBy)}</Chip> : undefined} />
              {p.why ? <p className={s.prose}>{p.why}</p> : <p className={s.hint}>아직 이유가 없어요.</p>}
            </Card>
            {p.alternatives.length > 0 && (
              <Card className={s.card}>
                <SectionHead icon={Ban} title="고르지 않은 방법" />
                <ul className={s.iconList}>
                  {p.alternatives.map((a, i) => (
                    <li key={i} className={s.itemMuted}>
                      <Ban size={16} />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <div className={s.sideCol}>
          <InfoCard p={p} base={base} />
          <EvidenceCard evidence={p.evidence} />
          <CommitsCard commits={d.commits} />
        </div>

        <div className={s.footCol}>
          {d.versions.length > 0 && <VersionsCard versions={d.versions} />}
          <Card className={s.card}>
            <SectionHead icon={MessageSquare} title="댓글" />
            <CommentThread targetType="PROJECT_POLICY" targetId={p.nodeId} meName={me?.name ?? '나'} mock={() => []} manage={d.canComment} />
          </Card>
        </div>
      </div>
    </div>
  )
}

/** 정형 규칙: 언제 · 해야 할 것 · 하지 말 것 · 예외 · 예시 */
function SpecCard({ spec, canWrite }: { spec: PolicySpec; canWrite: boolean }) {
  if (isSpecEmpty(spec)) {
    if (!canWrite) return null
    return <p className={s.specEmpty}>정형 규칙이 아직 없어요 — 고치기에서 언제 · 해야 할 것 · 하지 말 것을 채워 주세요.</p>
  }
  const hasExamples = spec.goodExamples.length > 0 || spec.badExamples.length > 0
  return (
    <Card className={s.card}>
      <SectionHead icon={ListChecks} title="정형 규칙" />
      {spec.appliesWhen?.trim() && (
        <div className={s.when}>
          <span className={s.whenLabel}>언제 적용</span>
          <p>{spec.appliesWhen}</p>
        </div>
      )}
      <SpecList title="해야 할 것" icon={CircleCheck} tone={s.itemMust} items={spec.musts} />
      <SpecList title="하지 말 것" icon={CircleX} tone={s.itemMustNot} items={spec.mustNots} />
      <SpecList title="예외" icon={Info} tone={s.itemException} items={spec.exceptions} />
      {hasExamples && (
        <div className={s.specGroup}>
          <h4>예시</h4>
          <div className={s.examples}>
            {spec.goodExamples.length > 0 && <ExampleBlock good items={spec.goodExamples} />}
            {spec.badExamples.length > 0 && <ExampleBlock good={false} items={spec.badExamples} />}
          </div>
        </div>
      )}
    </Card>
  )
}

function SpecList({ title, icon: Icon, tone, items }: { title: string; icon: LucideIcon; tone: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className={s.specGroup}>
      <h4>
        {title} <span className={s.count}>{items.length}</span>
      </h4>
      <ul className={s.iconList}>
        {items.map((t, i) => (
          <li key={i} className={tone}>
            <Icon size={18} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExampleBlock({ good, items }: { good: boolean; items: string[] }) {
  const Icon = good ? ThumbsUp : ThumbsDown
  return (
    <div className={cx(s.example, good ? s.exampleGood : s.exampleBad)}>
      <span className={s.exampleHead}>
        <Icon size={14} /> {good ? '좋은 예' : '나쁜 예'}
      </span>
      {items.map((t, i) => (
        <pre key={i}>
          <code>{t}</code>
        </pre>
      ))}
    </div>
  )
}

function InfoCard({ p, base }: { p: Policy; base: string }) {
  const items: [string, ReactNode][] = [
    ['고른 사람', who(p.decidedBy)],
    [
      '범위',
      p.modules.length ? (
        <span className={s.modules}>
          {p.modules.map((m) => (
            <code key={m}>{m}</code>
          ))}
        </span>
      ) : (
        '프로젝트 전체'
      ),
    ],
    ['출처', `${SOURCE_LABEL[p.sourceType]}${p.sourceRef ? ` · ${p.sourceRef}` : ''}`],
    [
      '남긴 사람',
      p.recordedBy ? (
        <span className={s.who}>
          <Avatar name={p.recordedBy.name} size={20} /> {p.recordedBy.name} <small>{ago(p.createdAt)}</small>
        </span>
      ) : (
        '—'
      ),
    ],
    [
      '버전',
      <>
        v{p.version}
        {p.updatedBy && <small className={s.mutedInline}> · {p.updatedBy.name} {ago(p.updatedAt)}</small>}
      </>,
    ],
  ]
  if (p.supersedes) items.push([
      '대신한 정책',
      <Link key="supersedes" to={`${base}/${p.supersedes}`}>
        {p.supersedes}
      </Link>,
    ])
  return (
    <Card className={s.card}>
      <SectionHead icon={Info} title="정보" />
      <div className={s.info}>
        <KeyValue items={items} />
      </div>
    </Card>
  )
}

const KIND_ICON: Record<EvidenceKind, LucideIcon> = { CODE: FileCode2, TEST: FlaskConical, MIGRATION: Database }
const KIND_LABEL: Record<EvidenceKind, string> = { CODE: '코드', TEST: '테스트', MIGRATION: '마이그레이션' }

const kindOf = (e: PolicyEvidence): EvidenceKind =>
  e.kind ?? (e.raw.startsWith('test:') ? 'TEST' : e.raw.startsWith('migration:') ? 'MIGRATION' : 'CODE')

/** 파일 이름 · 폴더로 나눔 (경로를 모르면 raw 그대로) */
const splitPath = (e: PolicyEvidence) => {
  if (!e.currentPath) return { name: e.raw, dir: null }
  const i = e.currentPath.lastIndexOf('/')
  return i < 0 ? { name: e.currentPath, dir: null } : { name: e.currentPath.slice(i + 1), dir: e.currentPath.slice(0, i) }
}

const EVIDENCE_STATE: Record<string, { label: string; cls: string }> = {
  OK: { label: '그대로', cls: s.stateOk },
  REVIEW_NEEDED: { label: '바뀜', cls: s.stateChanged },
  BROKEN: { label: '사라짐', cls: s.stateGone },
}

function EvidenceCard({ evidence }: { evidence: PolicyEvidence[] }) {
  return (
    <Card className={s.card}>
      <SectionHead icon={FileCode2} title="근거" extra={evidence.length > 0 ? <span className={s.count}>{evidence.length}</span> : undefined} />
      {evidence.length === 0 ? (
        <p className={s.hint}>근거가 없어요. 코드와 상관없는 정책이면 괜찮아요.</p>
      ) : (
        <>
          <p className={s.hint}>이 정책을 지키는 코드예요. 바뀌면 검토 필요로 알려 줘요.</p>
          <ul className={s.evidence}>
            {evidence.map((e) => {
              const kind = kindOf(e)
              const Icon = KIND_ICON[kind]
              const { name, dir } = splitPath(e)
              const state = EVIDENCE_STATE[e.state] ?? EVIDENCE_STATE.OK
              return (
                <li key={e.raw} className={s.ev}>
                  <span className={cx(s.evIcon, s[`kind${kind}`])} title={KIND_LABEL[kind]}>
                    <Icon size={16} />
                  </span>
                  <div className={s.evBody}>
                    <div className={s.evName} title={e.repository ? `${e.repository} · ${e.currentPath ?? e.raw}` : (e.currentPath ?? e.raw)}>
                      <strong>{name}</strong>
                      {e.currentSymbol && <code className={s.symbol}>#{e.currentSymbol}</code>}
                    </div>
                    {dir && <small className={s.evDir}>{dir}</small>}
                    <div className={s.evMeta}>
                      <span className={cx(s.state, state.cls)}>
                        <i /> {state.label}
                      </span>
                      {e.verification !== 'VERIFIED' && <small>{e.verification === 'PENDING' ? '확인 중' : '확인 안 됨'}</small>}
                      {e.state === 'REVIEW_NEEDED' && e.lastChangeUrl && e.lastChangeRef && (
                        <a href={e.lastChangeUrl} target="_blank" rel="noreferrer" className={s.changeLink}>
                          바꾼 커밋 <code>{shortSha(e.lastChangeRef)}</code>
                        </a>
                      )}
                    </div>
                  </div>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className={s.ext} aria-label="GitHub 에서 열기" title="GitHub 에서 열기">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}

function CommitsCard({ commits }: { commits: PolicyCommit[] }) {
  return (
    <Card className={s.card}>
      <SectionHead icon={GitCommitHorizontal} title="커밋" extra={commits.length > 0 ? <span className={s.count}>{commits.length}</span> : undefined} />
      {commits.length === 0 ? (
        <p className={s.hint}>아직 이 정책과 이어진 커밋이 없어요.</p>
      ) : (
        <ol className={s.timeline}>
          {commits.map((c) => (
            <li key={c.sha} className={c.relation === 'DECIDED_IN' ? s.tlDecided : undefined}>
              <div className={s.tlTop}>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className={s.sha} title={c.repository ?? undefined}>
                    {shortSha(c.sha)}
                  </a>
                ) : (
                  <code className={s.sha}>{shortSha(c.sha)}</code>
                )}
                <span className={s.relation}>{RELATION_LABEL[c.relation as PolicyCommitRelation] ?? c.relation}</span>
                <span className={s.grow} />
                <small className={s.time}>{ago(c.at)}</small>
              </div>
              {c.summary && <p className={s.tlSummary}>{c.summary}</p>}
              <div className={s.tlMeta}>
                {c.author ? (
                  <span className={s.who} title={c.authorLogin ? `@${c.authorLogin}` : undefined}>
                    <Avatar name={c.author.name} size={18} /> {c.author.name}
                  </span>
                ) : (
                  c.authorLogin && <span className={s.login}>@{c.authorLogin}</span>
                )}
                {(c.additions != null || c.deletions != null) && (
                  <span className={s.diff}>
                    <span className={s.add}>+{c.additions ?? 0}</span> <span className={s.del}>−{c.deletions ?? 0}</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function VersionsCard({ versions }: { versions: PolicyVersion[] }) {
  return (
    <Card className={s.card}>
      <SectionHead icon={History} title="이전 버전" extra={<span className={s.count}>{versions.length}</span>} />
      <ol className={s.timeline}>
        {versions.map((v) => {
          const st = String(v.snapshot.status ?? '')
          const rule = v.snapshot.rule ?? v.snapshot.description
          return (
            <li key={v.version}>
              <div className={s.tlTop}>
                <span className={s.sha}>v{v.version}</span>
                <strong className={s.tlTitle}>{String(v.snapshot.title ?? '')}</strong>
                <span className={s.grow} />
                <small className={s.time}>{ago(v.at)}</small>
              </div>
              {rule != null && <p className={s.tlSummary}>{String(rule)}</p>}
              <div className={s.tlMeta}>
                {st && <span>{STATUS_LABEL[st as PolicyStatus] ?? st}</span>}
                <span>{v.sourceRef ?? v.source}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

// ─────────────── 남기기 · 고치기 ───────────────

function PolicyEdit({ projectKey, policyKey }: { projectKey: string; policyKey: string }) {
  const detail = usePolicy(projectKey, policyKey)
  return (
    <Loadable resource={detail} label="정책">
      {(d) => <PolicyForm projectKey={projectKey} editing={d.policy} />}
    </Loadable>
  )
}

const SOURCES: PolicySource[] = ['SCREEN', 'CHAT', 'MINUTE', 'THREAD']

type SpecListKey = 'musts' | 'mustNots' | 'exceptions' | 'goodExamples' | 'badExamples'
const SPEC_FIELDS: { key: SpecListKey; label: string; placeholder: string; code?: boolean; icon: LucideIcon; tone: string }[] = [
  { key: 'musts', label: '해야 할 것', placeholder: 'X-Hub-Signature-256 을 비밀값으로 확인한다', icon: CircleCheck, tone: s.itemMust },
  { key: 'mustNots', label: '하지 말 것', placeholder: 'IP 허용 목록만으로 대신하지 않는다', icon: CircleX, tone: s.itemMustNot },
  { key: 'exceptions', label: '예외', placeholder: '로컬 개발(profile=local)에서는 끌 수 있다', icon: Info, tone: s.itemException },
  { key: 'goodExamples', label: '좋은 예', placeholder: 'if (!verifier.verify(secret, body, header)) return 401', code: true, icon: ThumbsUp, tone: s.itemMust },
  { key: 'badExamples', label: '나쁜 예', placeholder: 'if (!ALLOWED_IPS.contains(ip)) return 403', code: true, icon: ThumbsDown, tone: s.itemMustNot },
]

function PolicyForm({ projectKey, editing }: { projectKey: string; editing?: Policy }) {
  const navigate = useNavigate()
  const base = `/projects/${projectKey}/policies`
  const initialSpec = editing ? specOf(editing) : undefined
  const [title, setTitle] = useState(editing?.title ?? '')
  const [rule, setRule] = useState(editing?.rule ?? '')
  const [appliesWhen, setAppliesWhen] = useState(initialSpec?.appliesWhen ?? '')
  const [lists, setLists] = useState<Record<SpecListKey, string[]>>(() => ({
    musts: initialSpec?.musts.length ? initialSpec.musts : [''],
    mustNots: initialSpec?.mustNots.length ? initialSpec.mustNots : [''],
    exceptions: initialSpec?.exceptions ?? [],
    goodExamples: initialSpec?.goodExamples ?? [],
    badExamples: initialSpec?.badExamples ?? [],
  }))
  const [why, setWhy] = useState(editing?.why ?? '')
  const [alternatives, setAlternatives] = useState((editing?.alternatives ?? []).join('\n'))
  const [category, setCategory] = useState<PolicyCategory>(editing?.category ?? 'DESIGN')
  const [modules, setModules] = useState((editing?.modules ?? []).join(', '))
  const [source, setSource] = useState<PolicySource>(editing && SOURCES.includes(editing.sourceType) ? editing.sourceType : 'SCREEN')
  const [sourceRef, setSourceRef] = useState(editing?.sourceRef ?? '')
  const [supersedes, setSupersedes] = useState(editing?.supersedes ?? '')
  const [evidence, setEvidence] = useState((editing?.evidence ?? []).map((e) => e.raw).join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
  const setList = (k: SpecListKey, next: string[]) => setLists((prev) => ({ ...prev, [k]: next }))
  /** 빈 줄은 뺌. 예시는 줄바꿈 · 들여쓰기를 살리고 끝 공백만 정리 */
  const clean = (k: SpecListKey) => lists[k].map((x) => (k === 'goodExamples' || k === 'badExamples' ? x.replace(/\s+$/, '') : x.trim())).filter((x) => x.trim())

  const save = async () => {
    if (!title.trim() || !rule.trim()) {
      setError('제목과 규칙은 꼭 적어 주세요.')
      return
    }
    setError('')
    setBusy(true)
    const spec: PolicySpec = {
      appliesWhen: appliesWhen.trim() || null,
      musts: clean('musts'),
      mustNots: clean('mustNots'),
      exceptions: clean('exceptions'),
      goodExamples: clean('goodExamples'),
      badExamples: clean('badExamples'),
    }
    const body: PolicyInput = {
      title: title.trim(),
      rule: rule.trim(),
      why: why.trim(),
      whyBy: 'human',
      decidedBy: 'human',
      alternatives: lines(alternatives),
      category,
      modules: modules.split(',').map((m) => m.trim()).filter(Boolean),
      supersedes: supersedes.trim() || undefined,
      sourceType: source,
      sourceRef: sourceRef.trim() || undefined,
      evidence: lines(evidence).length ? lines(evidence) : undefined,
      spec,
      version: editing?.version,
    }
    try {
      const saved = await whenLive(() => (editing ? updatePolicy(projectKey, editing.key, body) : createPolicy(projectKey, body)))
      navigate(`${base}/${saved?.policy.key ?? editing?.key ?? ''}`)
    } catch (e) {
      setError(errorText(e, '정책을 남기지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Card className={s.main}>
      <div className={s.top}>
        <Link to={editing ? `${base}/${editing.key}` : base} className={s.back}>
          <ChevronLeft size={16} /> {editing ? editing.key : '정책'}
        </Link>
        <span className={s.grow} />
        <Button icon={Check} onClick={save} disabled={busy}>
          {editing ? '고치기 (새 버전)' : '정책 남기기'}
        </Button>
      </div>
      <p className={s.hint}>
        {editing ? '고치면 버전이 오르고 이전 모습은 이력에 남아요.' : '남기면 바로 확정이에요. 번호는 프로젝트마다 붙어요.'} 비밀값(토큰 · 비밀번호)은 적지 마세요.
      </p>
      <label className={s.input}>
        <span>제목 *</span>
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="서버 SSH 는 관리자가 고른 구성원만" />
      </label>
      <label className={s.field}>
        <span>규칙 (한 줄 요약) *</span>
        <textarea rows={2} value={rule} onChange={(e) => setRule(e.target.value)} placeholder="웹훅 요청은 서명을 확인한 뒤에만 처리한다" />
      </label>

      <fieldset className={s.specFieldset}>
        <legend>
          <ListChecks size={16} /> 정형 규칙
        </legend>
        <label className={s.field}>
          <span>언제 적용 — 상황 · 대상 코드 · 화면</span>
          <textarea
            rows={2}
            value={appliesWhen}
            maxLength={SPEC_LIMITS.appliesWhen}
            onChange={(e) => setAppliesWhen(e.target.value)}
            placeholder="GitHub 웹훅을 받는 컨트롤러 · 필터를 만들거나 고칠 때"
          />
        </label>
        {SPEC_FIELDS.map((f) => (
          <ListInput key={f.key} field={f} values={lists[f.key]} onChange={(next) => setList(f.key, next)} />
        ))}
        <p className={s.hint}>언제 · 해야 할 것은 꼭 채워 주세요. 다른 사람(과 AI)이 이것만 보고 따라 할 수 있게 구체적으로.</p>
      </fieldset>

      <label className={s.field}>
        <span>이유 — 나중에 볼 사람을 위해 한 줄이라도</span>
        <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <label className={s.field}>
        <span>검토했지만 고르지 않은 방법 (한 줄에 하나)</span>
        <textarea rows={2} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} />
      </label>
      <div className={s.inputRow}>
        <div className={s.input}>
          <span>종류</span>
          <PillTabs value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
        </div>
        <label className={s.input}>
          <span>범위 모듈 (쉼표, 비우면 프로젝트 전체)</span>
          <input value={modules} onChange={(e) => setModules(e.target.value)} placeholder="member, project" />
        </label>
      </div>
      <div className={s.inputRow}>
        <div className={s.input}>
          <span>정해진 곳</span>
          <PillTabs value={source} onChange={setSource} options={SOURCES.map((v) => ({ value: v, label: SOURCE_LABEL[v] }))} />
        </div>
        <label className={s.input}>
          <span>출처 (minute#12 · thread#3 · 메모)</span>
          <input value={sourceRef} maxLength={300} onChange={(e) => setSourceRef(e.target.value)} />
        </label>
      </div>
      {!editing && (
        <label className={s.input}>
          <span>대신할 정책 (그 정책은 대체됨으로)</span>
          <input value={supersedes} onChange={(e) => setSupersedes(e.target.value)} placeholder={`${projectKey}-P3`} />
        </label>
      )}
      <label className={s.field}>
        <span>근거 — 이 정책을 지키는 코드 (한 줄에 하나: 파일경로#심볼 · test:클래스#메서드 · migration:버전, 줄 번호 금지)</span>
        <textarea rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </label>
      {error && <p className={s.error}>{error}</p>}
    </Card>
  )
}

/** 한 줄씩 더하고 빼는 목록 입력 (최대 10개) */
function ListInput({ field: f, values, onChange }: { field: (typeof SPEC_FIELDS)[number]; values: string[]; onChange: (next: string[]) => void }) {
  const Icon = f.icon
  const full = values.length >= SPEC_LIMITS.items
  return (
    <div className={s.listInput}>
      <span className={s.listInputLabel}>
        {f.label}
        <small>
          {values.filter((v) => v.trim()).length}/{SPEC_LIMITS.items}
        </small>
      </span>
      {values.map((v, i) => (
        <div key={i} className={s.listRow}>
          <span className={cx(s.listRowIcon, f.tone)}>
            <Icon size={16} />
          </span>
          {f.code ? (
            <textarea
              className={s.codeInput}
              rows={3}
              value={v}
              maxLength={SPEC_LIMITS.item}
              placeholder={i === 0 ? f.placeholder : undefined}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ) : (
            <input
              value={v}
              maxLength={SPEC_LIMITS.item}
              placeholder={i === 0 ? f.placeholder : undefined}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
          )}
          <button type="button" className={s.removeRow} aria-label={`${f.label} ${i + 1} 빼기`} onClick={() => onChange(values.filter((_, j) => j !== i))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" className={s.addRow} disabled={full} onClick={() => onChange([...values, ''])}>
        <Plus size={14} /> {full ? `${f.label} 최대 ${SPEC_LIMITS.items}개` : `${f.label} 더하기`}
      </button>
    </div>
  )
}
