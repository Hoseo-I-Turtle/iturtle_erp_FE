// 프로젝트 설정: 참여자 · 연동 서비스 · 권한 신청 (Penpot 06 · 프로젝트 설정 · 참여자 / 연동 서비스 / 권한 신청)
import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, GitBranch, Info, Link2, Lock, Pencil, Play, Plus, Search, X, type LucideIcon } from 'lucide-react'
import { Avatar, Button, Card, Chip, ConfirmDialog, Empty, Field, FormError, FormRow, Loadable, Note, Segmented, Select, TextArea, TextInput, ToggleChip, type ChipTone } from '../../../components/ui'
import { reviewAccessRequest, useAccessRequests } from '../../../api/accessRequests'
import { errorText } from '../../../api/content'
import {
  addProjectMember,
  changeMemberRole,
  createLink,
  deleteLink,
  removeProjectMember,
  updateLink,
  useProjectLinks,
  useProjectMembers,
  type LinkDraft,
} from '../../../api/projectSettings'
import { todayKst } from '../../../api/projects'
import { getDataMode } from '../../../lib/dataMode'
import type { AccessRequestView, LinkService, ProjectLinkView, RequestStatus, SettingsMember } from '../../../mocks/projectSettings'
import { REQUEST_TEXT, REQUEST_TONE } from './requestTones'
import s from './settings.module.css'

const isLive = () => getDataMode() === 'live'
const ROLES = [
  { value: 'MANAGER' as const, label: '프로젝트 관리자' },
  { value: 'MEMBER' as const, label: '참여자' },
]

/** 저장 동작 공통 */
function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

/* ================= 참여자 ================= */

export function MembersTab({ projectKey }: { projectKey: string }) {
  const res = useProjectMembers(projectKey)
  const { busy, error, setError, run } = useRun()
  const [keyword, setKeyword] = useState('')
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const [role, setRole] = useState<'MANAGER' | 'MEMBER'>('MEMBER')
  const [removing, setRemoving] = useState<SettingsMember | null>(null)
  const [showFormer, setShowFormer] = useState(false)

  return (
    <Loadable resource={res} label="참여자">
      {({ members, former, candidates, meId, canManage }) => {
        const kw = keyword.trim().toLowerCase()
        const list = members.filter((m) => !kw || m.name.toLowerCase().includes(kw) || m.loginId.toLowerCase().includes(kw))
        const managers = members.filter((m) => m.role === 'MANAGER').length
        const setMemberRole = (m: SettingsMember, r: 'MANAGER' | 'MEMBER') => {
          // 프로젝트 관리자는 한 명 이상 있어야 한다 (PRJ-1-04)
          if (m.role === 'MANAGER' && r === 'MEMBER' && managers <= 1) return setError('프로젝트 관리자는 한 명 이상 있어야 해요.')
          void run(() => changeMemberRole(projectKey, m, r, isLive()))
        }
        return (
          <Card className={s.panel}>
            <div className={s.headRow}>
              <div className={s.sectionHead}>
                <h2>참여자 {members.length}명</h2>
                <p>프로젝트 관리자는 참여자를 더하고 역할을 바꿀 수 있어요</p>
              </div>
              <label className={s.search}>
                <Search size={16} />
                <input type="search" placeholder="이름 · 아이디 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </label>
              {canManage && (
                <Button icon={Plus} onClick={() => setAdding(!adding)}>
                  참여자 추가
                </Button>
              )}
            </div>
            {adding && (
              <div className={s.inlineForm}>
                <Select
                  block
                  value={pick}
                  options={[{ value: '', label: candidates.length ? '더할 구성원 고르기' : '더할 수 있는 구성원이 없어요' }, ...candidates.map((c) => ({ value: String(c.memberId), label: `${c.name} · ${c.typeText}` }))]}
                  onChange={setPick}
                  label="구성원"
                />
                <Select value={role} options={ROLES} onChange={setRole} label="역할" width={150} />
                <Button variant="secondary" onClick={() => setAdding(false)}>
                  취소
                </Button>
                <Button
                  icon={Check}
                  disabled={busy || !pick}
                  onClick={() => {
                    const c = candidates.find((x) => String(x.memberId) === pick)
                    if (c) void run(() => addProjectMember(projectKey, c, role, isLive()), () => { setPick(''); setAdding(false) })
                  }}
                >
                  추가
                </Button>
              </div>
            )}
            <FormError>{error}</FormError>
            <div className={s.table}>
              <div className={`${s.memberRow} ${s.thead}`}>
                <span>이름</span>
                <span>구분</span>
                <span>역할</span>
                <span>참여일</span>
                <span>서비스 권한</span>
                <span />
              </div>
              {list.map((m) => (
                <div key={m.memberId} className={`${s.memberRow} ${s.item}`}>
                  <span className={s.person}>
                    <Avatar name={m.name} size={32} />
                    <span>
                      <strong>
                        {m.name}
                        {m.memberId === meId && <em>나</em>}
                      </strong>
                      {m.loginId && <small>{m.loginId}</small>}
                    </span>
                  </span>
                  <span>{m.typeText}</span>
                  <span>{canManage ? <Select value={m.role} options={ROLES} onChange={(r) => setMemberRole(m, r)} label={`${m.name} 역할`} width={170} /> : ROLES.find((r) => r.value === m.role)?.label}</span>
                  <span>{m.joinedOn}</span>
                  <span>{m.access ? <Chip tone={m.access === '기본' ? 'plain' : 'brand'} className={m.access === '기본' ? s.softChip : undefined}>{m.access}</Chip> : '—'}</span>
                  <span className={s.rowActions}>
                    {canManage && (
                      <button type="button" aria-label={`${m.name} 빼기`} title="프로젝트에서 빼기" onClick={() => (m.role === 'MANAGER' && managers <= 1 ? setError('마지막 프로젝트 관리자는 뺄 수 없어요.') : setRemoving(m))}>
                        <X size={16} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {list.length === 0 && <Empty>찾는 참여자가 없어요.</Empty>}
            </div>
            {former.length > 0 && (
              <>
                <button type="button" className={s.former} aria-expanded={showFormer} onClick={() => setShowFormer(!showFormer)}>
                  {showFormer ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <strong>나간 참여자 {former.length}명</strong>
                  <span>· 남긴 작업 · 기록은 그대로 있어요</span>
                </button>
                {showFormer &&
                  former.map((f) => (
                    <div key={f.memberId} className={s.formerRow}>
                      <Avatar name={f.name} size={26} />
                      <strong>{f.name}</strong>
                      <span>{f.leftOn} 나감</span>
                    </div>
                  ))}
              </>
            )}
            <Note icon={Info}>프로젝트 관리자는 한 명 이상 있어야 해요. 역할을 바꾸면 Vault · Jenkins 권한이 다음 로그인부터 맞춰져요</Note>
            {removing && (
              <ConfirmDialog
                title={`${removing.name} 님을 프로젝트에서 뺄까요?`}
                confirmLabel="빼기"
                icon={X}
                danger
                busy={busy}
                onClose={() => setRemoving(null)}
                onConfirm={() => run(() => removeProjectMember(projectKey, removing, isLive()), () => setRemoving(null))}
              >
                <p>맡고 있던 끝나지 않은 작업은 "담당자 없음"이 되고, Vault · Jenkins 권한은 거둬져요. 남긴 작업 · 댓글 · 회의록은 그대로 남아요.</p>
                <FormError>{error}</FormError>
              </ConfirmDialog>
            )}
          </Card>
        )
      }}
    </Loadable>
  )
}

/* ================= 연동 서비스 ================= */

const SERVICES: { value: LinkService; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'PENPOT', label: 'Penpot', icon: Pencil, hint: 'https://penpot.iturtle.win/ 로 시작해야 해요' },
  { value: 'VAULT', label: 'Vault', icon: Lock, hint: 'https://vault.iturtle.win/ 로 시작해야 해요 · 바로 가기만 만들어요' },
  { value: 'JENKINS', label: 'Jenkins', icon: Play, hint: 'https://lab.iturtle.win/jenkins/ 로 시작해야 해요 · 작업은 주소에서 알아서 찾아요' },
  { value: 'GITHUB', label: 'GitHub', icon: GitBranch, hint: 'https://github.com/<조직>/ 으로 시작해야 해요 · GitHub App 이 설치된 저장소만' },
  { value: 'OTHER', label: '기타', icon: Link2, hint: 'http · https 주소면 돼요' },
]
const svc = (v: LinkService) => SERVICES.find((x) => x.value === v)!
const LINK_TONE: Record<ProjectLinkView['status'], ChipTone> = { OK: 'positive', UNAVAILABLE: 'danger', NOT_SUPPORTED: 'gray' }
const LINK_TEXT: Record<ProjectLinkView['status'], string> = { OK: '정상', UNAVAILABLE: '응답 없음', NOT_SUPPORTED: '상태 없음' }

export function LinksTab({ projectKey }: { projectKey: string }) {
  const res = useProjectLinks(projectKey)
  const { busy, error, setError, run } = useRun()
  const [adding, setAdding] = useState(false)
  const [d, setD] = useState<LinkDraft>({ service: 'GITHUB', url: '', displayName: '', description: '' })
  const [editing, setEditing] = useState<{ link: ProjectLinkView; displayName: string; description: string } | null>(null)
  const [patterns, setPatterns] = useState<Record<number, string>>({})
  const [removing, setRemoving] = useState<ProjectLinkView | null>(null)

  const add = () => {
    if (!/^https?:\/\//.test(d.url.trim())) return setError('주소는 http:// 또는 https:// 로 시작해야 해요.')
    if (!d.displayName.trim()) return setError('표시 이름을 적어 주세요.')
    void run(() => createLink(projectKey, { ...d, url: d.url.trim(), displayName: d.displayName.trim() }, isLive()), () => {
      setD({ service: d.service, url: '', displayName: '', description: '' })
      setAdding(false)
    })
  }

  return (
    <Loadable resource={res} label="연동 서비스">
      {({ links, canManage }) => (
        <Card className={s.panel}>
          <div className={s.headRow}>
            <div className={s.sectionHead}>
              <h2>연동 서비스 {links.length}개</h2>
              <p>프로젝트 홈의 바로 가기 카드로 보여요. 연결하고 끊는 건 프로젝트 관리자만</p>
            </div>
            {canManage && (
              <Button icon={Plus} onClick={() => setAdding(!adding)}>
                서비스 연결
              </Button>
            )}
          </div>
          {adding && (
            <div className={s.linkForm}>
              <div className={s.pills}>
                <b>서비스</b>
                {SERVICES.map((x) => (
                  <ToggleChip key={x.value} on={d.service === x.value} icon={x.icon} onClick={() => setD({ ...d, service: x.value })}>
                    {x.label}
                  </ToggleChip>
                ))}
              </div>
              <FormRow>
                <Field label="주소" required help={svc(d.service).hint} className={s.grow2}>
                  <TextInput icon={Link2} type="url" value={d.url} onChange={(v) => setD({ ...d, url: v.slice(0, 500) })} placeholder="https://" autoFocus />
                </Field>
                <Field label="표시 이름" required>
                  <TextInput value={d.displayName} onChange={(v) => setD({ ...d, displayName: v.slice(0, 50) })} placeholder="카드 제목" />
                </Field>
                <Field label="설명">
                  <TextInput value={d.description} onChange={(v) => setD({ ...d, description: v.slice(0, 200) })} placeholder="카드 아래 한 줄" />
                </Field>
              </FormRow>
              <div className={s.foot}>
                <span>{d.service === 'GITHUB' ? '줄 수 제외 패턴은 기본값으로 채워져요.' : ''}</span>
                <Button variant="secondary" onClick={() => setAdding(false)}>
                  취소
                </Button>
                <Button icon={Check} disabled={busy} onClick={add}>
                  연결
                </Button>
              </div>
            </div>
          )}
          <FormError>{error}</FormError>
          {links.length === 0 ? (
            <Empty>아직 연결한 서비스가 없어요.</Empty>
          ) : (
            <div className={s.table}>
              <div className={`${s.linkRow} ${s.thead}`}>
                <span>서비스</span>
                <span>연결 대상</span>
                <span>상태 (5분마다 새로 받음)</span>
                <span />
              </div>
              {links.map((l) => {
                const Icon = svc(l.service).icon
                const edit = editing?.link.linkId === l.linkId ? editing : null
                const pat = patterns[l.linkId] ?? l.locExcludePatterns ?? ''
                return (
                  <div key={l.linkId} className={s.linkItem}>
                    <div className={s.linkRow}>
                      <span className={s.person}>
                        <i className={s.svcIcon}>
                          <Icon size={16} />
                        </i>
                        <span>
                          <strong>{l.displayName}</strong>
                          <small>{svc(l.service).label}</small>
                        </span>
                      </span>
                      <a href={l.url} target="_blank" rel="noreferrer" className={s.ref}>
                        {l.externalRef}
                      </a>
                      <span className={s.linkStatus}>
                        <Chip tone={LINK_TONE[l.status]}>{LINK_TEXT[l.status]}</Chip>
                        <small>{l.statusText}</small>
                      </span>
                      <span className={s.rowActions}>
                        {canManage && (
                          <>
                            <button type="button" aria-label={`${l.displayName} 고치기`} onClick={() => setEditing(edit ? null : { link: l, displayName: l.displayName, description: l.description })}>
                              <Pencil size={16} />
                            </button>
                            <button type="button" aria-label={`${l.displayName} 연결 끊기`} onClick={() => setRemoving(l)}>
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    {edit && (
                      <div className={s.inlineForm}>
                        <TextInput value={edit.displayName} onChange={(v) => setEditing({ ...edit, displayName: v.slice(0, 50) })} placeholder="표시 이름" />
                        <TextInput value={edit.description} onChange={(v) => setEditing({ ...edit, description: v.slice(0, 200) })} placeholder="설명" />
                        <Button variant="secondary" onClick={() => setEditing(null)}>
                          취소
                        </Button>
                        <Button icon={Check} disabled={busy || !edit.displayName.trim()} onClick={() => run(() => updateLink(projectKey, l, { displayName: edit.displayName.trim(), description: edit.description }, isLive()), () => setEditing(null))}>
                          저장
                        </Button>
                      </div>
                    )}
                    {l.service === 'GITHUB' && l.locExcludePatterns !== undefined && (
                      <div className={s.patterns}>
                        <div>
                          <strong>줄 수에서 뺄 파일</strong>
                          <small>gitignore 형식 · 한 줄에 하나 · 바꾸면 이미 모은 커밋도 다시 계산해요</small>
                          {canManage && (
                            <Button disabled={busy || pat === l.locExcludePatterns} onClick={() => run(() => updateLink(projectKey, l, { locExcludePatterns: pat }, isLive()))}>
                              저장
                            </Button>
                          )}
                        </div>
                        <TextArea value={pat} disabled={!canManage} rows={Math.min(8, pat.split('\n').length + 1)} onChange={(v) => setPatterns({ ...patterns, [l.linkId]: v })} aria-label="줄 수 제외 패턴" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <Note icon={Info}>마지막 Jenkins 작업을 끊으려면 먼저 "서비스 권한"에서 Jenkins 를 꺼야 해요. GitHub 연결을 끊어도 이미 모은 커밋은 지워지지 않아요.</Note>
          {removing && (
            <ConfirmDialog title={`"${removing.displayName}" 연결을 끊을까요?`} confirmLabel="연결 끊기" icon={X} danger busy={busy} onClose={() => setRemoving(null)} onConfirm={() => run(() => deleteLink(projectKey, removing.linkId, isLive()), () => setRemoving(null))}>
              <p>프로젝트 홈의 바로 가기 카드가 사라져요. {svc(removing.service).label} 쪽 자원은 지워지지 않아요.</p>
              <FormError>{error}</FormError>
            </ConfirmDialog>
          )}
        </Card>
      )}
    </Loadable>
  )
}

/* ================= 권한 신청 ================= */

const TABS: { value: RequestStatus; label: string }[] = [
  { value: 'PENDING', label: '대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '거절' },
  { value: 'EXPIRED', label: '만료' },
]

export function RequestsTab({ projectKey, me }: { projectKey: string; me?: string }) {
  const res = useAccessRequests('REVIEW', projectKey)
  const { busy, error, setError, run } = useRun()
  const [tab, setTab] = useState<RequestStatus>('PENDING')
  const [open, setOpen] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [expiresOn, setExpiresOn] = useState('')

  const review = (r: AccessRequestView, decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT' && !reason.trim()) return setError('거절할 때는 사유가 필요해요.')
    void run(() => reviewAccessRequest(r, decision, isLive(), { reason: reason.trim(), expiresOn: expiresOn || r.expiresOn, me }), () => {
      setOpen(null)
      setReason('')
      setExpiresOn('')
    })
  }

  return (
    <Loadable resource={res} label="권한 신청">
      {({ counts, items }) => {
        const list = items.filter((r) => r.status === tab)
        const firstOpen = open ?? (tab === 'PENDING' ? list.find((r) => r.canReview)?.requestId : undefined) ?? null
        return (
          <Card className={s.panel}>
            <div className={s.headRow}>
              <div className={s.sectionHead}>
                <h2>권한 신청</h2>
                <p>이 프로젝트의 Vault · Jenkins 수준을 올려 달라는 신청이에요. 프로젝트 관리자가 승인해요</p>
              </div>
              <Segmented value={tab} options={TABS.map((t) => ({ value: t.value, label: `${t.label} ${counts[t.value] ?? 0}` }))} onChange={setTab} />
            </div>
            {list.length === 0 ? (
              <Empty>{tab === 'PENDING' ? '기다리는 신청이 없어요.' : '해당하는 신청이 없어요.'}</Empty>
            ) : (
              <div className={s.table}>
                <div className={`${s.reqRow} ${s.thead}`}>
                  <span>신청자</span>
                  <span>신청 대상</span>
                  <span>사유</span>
                  <span>사용 기한</span>
                  <span />
                </div>
                {list.map((r) => {
                  const on = firstOpen === r.requestId && r.canReview
                  return (
                    <div key={r.requestId} className={on ? `${s.reqItem} ${s.reqOpen}` : s.reqItem}>
                      <div className={s.reqRow}>
                        <span className={s.person}>
                          <Avatar name={r.requester} size={32} />
                          <span>
                            <strong>{r.requester}</strong>
                            <small>{r.ago}</small>
                          </span>
                        </span>
                        <span className={s.target}>
                          <Chip tone="plain">{r.target}</Chip>
                          {r.currentLevel && r.level && (
                            <>
                              <small>{r.currentLevel}</small>
                              <ChevronRight size={14} />
                              <Chip>{r.level}</Chip>
                            </>
                          )}
                        </span>
                        <span>{r.reason}</span>
                        <span>{r.expires || '기한 없음'}</span>
                        <span className={s.rowActions}>
                          {r.status === 'PENDING' ? (
                            r.canReview && !on ? (
                              <button type="button" className={s.textBtn} onClick={() => { setOpen(r.requestId); setReason(''); setExpiresOn('') }}>
                                검토
                              </button>
                            ) : null
                          ) : (
                            <Chip tone={REQUEST_TONE[r.status]}>{REQUEST_TEXT[r.status]}</Chip>
                          )}
                        </span>
                      </div>
                      {r.status !== 'PENDING' && (r.note || r.reviewer) && (
                        <p className={s.reqNote}>
                          {r.note}
                          {r.reviewer && <em>처리 · {r.reviewer}</em>}
                        </p>
                      )}
                      {on && (
                        <div className={s.review}>
                          <label className={s.expires}>
                            사용 기한
                            <input type="date" value={expiresOn || r.expiresOn} min={todayKst()} onChange={(e) => setExpiresOn(e.target.value)} />
                          </label>
                          <TextInput value={reason} onChange={(v) => setReason(v.slice(0, 500))} placeholder="거절할 때는 사유가 필요해요" />
                          <Button variant="secondary" icon={X} disabled={busy} onClick={() => review(r, 'REJECT')}>
                            거절
                          </Button>
                          <Button icon={Check} disabled={busy} onClick={() => review(r, 'APPROVE')}>
                            승인
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <FormError>{error}</FormError>
            <Note icon={Info}>승인한 수준은 "서비스 권한"의 구성원별 표에 "신청"으로 표시돼요. 반영은 그 사람이 다음에 로그인할 때부터예요.</Note>
          </Card>
        )
      }}
    </Loadable>
  )
}
