import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, FileCode2, GitCommitHorizontal, History, Pencil, Plus, Scale, Search, TriangleAlert, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, Loadable, Note, PillTabs, SectionHead, type ChipTone } from '../../components/ui'
import { CommentThread } from '../../components/comments/CommentThread'
import { whenLive } from '../../api/useResource'
import { errorText } from '../../api/content'
import { ago } from '../../api/types'
import { useMe } from '../../api/members'
import {
  CATEGORY_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  changePolicyStatus,
  createPolicy,
  updatePolicy,
  usePolicies,
  usePolicy,
  type Policy,
  type PolicyCategory,
  type PolicyDetail,
  type PolicyInput,
  type PolicySource,
  type PolicyStatus,
} from '../../api/policies'
import s from './PoliciesPage.module.css'

const STATUS_TONE: Record<PolicyStatus, ChipTone> = {
  ACTIVE: 'brand',
  REVIEW_NEEDED: 'warning',
  BROKEN: 'danger',
  RETIRED: 'muted',
  SUPERSEDED: 'muted',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as PolicyCategory[]
type View = 'live' | 'attention' | 'inactive'
const VIEW_STATUSES: Record<View, PolicyStatus[] | undefined> = {
  live: undefined,
  attention: ['REVIEW_NEEDED', 'BROKEN'],
  inactive: ['RETIRED', 'SUPERSEDED'],
}

/**
 * 프로젝트 › 정책 (ERP-41): 정한 규칙과 그 이유. 목록 · 상세(이력 · 근거 · 커밋 · 댓글) · 남기기 · 고치기.
 * 연구실 전체 정책은 LAB 프로젝트의 정책 탭. AI 는 MCP find_policies · save_policy 로 같은 정책을 읽고 남긴다.
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
  const list = usePolicies(projectKey, {
    query: applied,
    categories: category === 'ALL' ? undefined : [category],
    statuses: VIEW_STATUSES[view],
  })

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
        프로젝트가 정한 규칙과 그 이유예요. 사람이 바뀌어도, 다른 사람의 AI 도 같은 규칙을 따라요. 연구실 전체 규칙은 <Link to="/projects/LAB/policies">LAB 정책</Link>.
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
            <ul className={s.list}>
              {d.policies.map((p) => (
                <PolicyRow key={p.key} projectKey={projectKey} policy={p} />
              ))}
            </ul>
          )
        }
      </Loadable>
    </Card>
  )
}

function PolicyRow({ projectKey, policy: p }: { projectKey: string; policy: Policy }) {
  return (
    <li>
      <Link to={`/projects/${projectKey}/policies/${p.key}`} className={s.row}>
        <span className={s.key}>{p.key}</span>
        <span className={s.rowBody}>
          <strong>{p.title}</strong>
          <small>{p.rule}</small>
          <span className={s.meta}>
            {p.modules.length > 0 && <span>범위 {p.modules.join(' · ')}</span>}
            <span>{p.recordedBy?.name ?? SOURCE_LABEL[p.sourceType]}</span>
            <span>{ago(p.updatedAt)}</span>
            {p.evidence.length > 0 && <span>근거 {p.evidence.length}</span>}
            {p.commentCount > 0 && <span>댓글 {p.commentCount}</span>}
          </span>
        </span>
        <span className={s.chips}>
          <Chip tone="tint">{CATEGORY_LABEL[p.category]}</Chip>
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

  const who = (v: string | null) => (v === 'ai' ? 'AI' : v === 'human' ? '사람' : '—')

  return (
    <Card className={s.main}>
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
        <span className={s.key}>{p.key}</span>
        <h1>{p.title}</h1>
        <Chip tone="tint">{CATEGORY_LABEL[p.category]}</Chip>
        <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>
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

      <div className={s.field}>
        <span>규칙</span>
        <p className={s.readonly}>{p.rule}</p>
      </div>
      <div className={s.field}>
        <span>이유 (말한 사람: {who(p.whyBy)})</span>
        <p className={s.readonly}>{p.why || '—'}</p>
      </div>
      {p.alternatives.length > 0 && (
        <div className={s.field}>
          <span>검토했지만 고르지 않은 방법</span>
          <ul className={s.plain}>
            {p.alternatives.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className={s.facts}>
        <dt>고른 사람</dt>
        <dd>{who(p.decidedBy)}</dd>
        <dt>범위</dt>
        <dd>{p.modules.length ? p.modules.join(' · ') : '프로젝트 전체'}</dd>
        <dt>출처</dt>
        <dd>
          {SOURCE_LABEL[p.sourceType]}
          {p.sourceRef ? ` · ${p.sourceRef}` : ''}
        </dd>
        <dt>남긴 사람</dt>
        <dd className={s.who}>
          {p.recordedBy ? (
            <>
              <Avatar name={p.recordedBy.name} size={20} /> {p.recordedBy.name}
            </>
          ) : (
            '—'
          )}
          <small>{ago(p.createdAt)}</small>
        </dd>
        <dt>버전</dt>
        <dd>
          v{p.version}
          {p.updatedBy ? ` · ${p.updatedBy.name} ${ago(p.updatedAt)}` : ''}
        </dd>
        {p.supersedes && (
          <>
            <dt>대신한 정책</dt>
            <dd>
              <Link to={`${base}/${p.supersedes}`}>{p.supersedes}</Link>
            </dd>
          </>
        )}
      </dl>

      <section className={s.block}>
        <h3>
          <FileCode2 size={16} /> 근거 — 이 정책을 지키는 코드
        </h3>
        {p.evidence.length === 0 ? (
          <p className={s.hint}>근거가 없어요. 코드와 상관없는 정책이면 괜찮아요.</p>
        ) : (
          <ul className={s.evidence}>
            {p.evidence.map((e) => (
              <li key={e.raw}>
                <code>{e.currentPath ? `${e.currentPath}${e.currentSymbol ? `#${e.currentSymbol}` : ''}` : e.raw}</code>
                <Chip tone={e.state === 'OK' ? 'tint' : e.state === 'BROKEN' ? 'danger' : 'warning'}>
                  {e.state === 'OK' ? '그대로' : e.state === 'BROKEN' ? '사라짐' : '바뀜'}
                </Chip>
                {e.verification !== 'VERIFIED' && <small>{e.verification === 'PENDING' ? '확인 중' : '확인 안 됨'}</small>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.commits.length > 0 && (
        <section className={s.block}>
          <h3>
            <GitCommitHorizontal size={16} /> 커밋
          </h3>
          <ul className={s.evidence}>
            {d.commits.map((c) => (
              <li key={c.sha}>
                <code>{c.sha.slice(0, 7)}</code> {c.summary} <small>{ago(c.at)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.versions.length > 0 && (
        <section className={s.block}>
          <h3>
            <History size={16} /> 이전 버전
          </h3>
          <ul className={s.versions}>
            {d.versions.map((v) => (
              <li key={v.version}>
                <strong>v{v.version}</strong> {String(v.snapshot.title ?? '')}
                <small>
                  {String(v.snapshot.status ?? '')} · {v.sourceRef ?? v.source} · {ago(v.at)}
                </small>
                {v.snapshot.description != null && <p>{String(v.snapshot.description)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className={s.error}>{error}</p>}

      <section className={s.block}>
        <CommentThread targetType="PROJECT_POLICY" targetId={p.nodeId} meName={me?.name ?? '나'} mock={() => []} manage={d.canComment} />
      </section>
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

function PolicyForm({ projectKey, editing }: { projectKey: string; editing?: Policy }) {
  const navigate = useNavigate()
  const base = `/projects/${projectKey}/policies`
  const [title, setTitle] = useState(editing?.title ?? '')
  const [rule, setRule] = useState(editing?.rule ?? '')
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
  const save = async () => {
    if (!title.trim() || !rule.trim()) {
      setError('제목과 규칙은 꼭 적어 주세요.')
      return
    }
    setError('')
    setBusy(true)
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
        <span>규칙 * — 무엇을 정했나</span>
        <textarea rows={3} value={rule} onChange={(e) => setRule(e.target.value)} />
      </label>
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
