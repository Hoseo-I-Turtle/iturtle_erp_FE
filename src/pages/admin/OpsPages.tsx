// 관리 추가 화면: Vault 경로 묶기 · 연동 상태 · 파일 사용량
// (Penpot 06 · 관리 · Vault 경로 묶기 / 관리 · 연동 상태 / 관리 · 파일 사용량)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Check, Clock, Folder, Info, Lock, TriangleAlert, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Empty, FormError, Loadable, Note, Progress, Segmented, TextInput, type ChipTone } from '../../components/ui'
import { bigBytes, reviewVaultPath, useFileUsage, useOps, useVaultPathRequests, type DriftRow, type JobRun, type UsageGroupBy, type VaultPathRequest, type VaultPathStatus } from '../../api/adminOps'
import { errorText } from '../../api/content'
import { getDataMode } from '../../lib/dataMode'
import { RoleRequestsPage } from './RoleRequestsPage'
import s from './ops.module.css'

const isLive = () => getDataMode() === 'live'

/* ================= 권한 신청 탭: 권한 신청 | Vault 경로 묶기 ================= */

export function AccessAdminPage() {
  const [view, setView] = useState<'requests' | 'vault'>('requests')
  const vault = useVaultPathRequests()
  const pending = vault.data?.filter((r) => r.status === 'PENDING').length
  return (
    <>
      <Segmented
        value={view}
        options={[
          { value: 'requests', label: '권한 신청' },
          { value: 'vault', label: `Vault 경로 묶기${pending ? ` ${pending}` : ''}` },
        ]}
        onChange={setView}
      />
      {view === 'requests' ? (
        <RoleRequestsPage />
      ) : (
        <Loadable resource={vault} label="Vault 경로 묶기 신청">
          {(list) => <VaultPaths list={list} />}
        </Loadable>
      )}
    </>
  )
}

const VP_TEXT: Record<VaultPathStatus, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절' }

function VaultPaths({ list }: { list: VaultPathRequest[] }) {
  const [tab, setTab] = useState<VaultPathStatus>('PENDING')
  const [openId, setOpenId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = list.filter((r) => r.status === tab)
  const open = openId ?? (tab === 'PENDING' ? rows[0]?.requestId : null)

  const decide = async (r: VaultPathRequest, decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT' && !reason.trim()) return setError('거절할 때는 사유가 필요해요.')
    setBusy(true)
    setError(null)
    try {
      await reviewVaultPath(r, decision, reason.trim(), isLive())
      setOpenId(null)
      setReason('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={s.card}>
      <div className={s.toolbar}>
        <Segmented value={tab} options={(Object.keys(VP_TEXT) as VaultPathStatus[]).map((k) => ({ value: k, label: `${VP_TEXT[k]} ${list.filter((r) => r.status === k).length}` }))} onChange={setTab} />
        <span className={s.right}>sso-admin 만 승인할 수 있어요</span>
      </div>
      {rows.length === 0 ? (
        <Empty>{tab === 'PENDING' ? '기다리는 신청이 없어요.' : '해당하는 신청이 없어요.'}</Empty>
      ) : (
        <div className={s.table}>
          <div className={`${s.vaultRow} ${s.thead}`}>
            <span>신청한 사람</span>
            <span>프로젝트</span>
            <span>묶을 Vault 경로</span>
            <span>신청</span>
            <span />
          </div>
          {rows.map((r) => {
            const on = open === r.requestId && r.status === 'PENDING'
            return (
              <div key={r.requestId} className={on ? `${s.item} ${s.itemOpen}` : s.item}>
                <div className={s.vaultRow}>
                  <span className={s.person}>
                    <Avatar name={r.requester} size={32} />
                    <span>
                      <strong>{r.requester}</strong>
                      <small>{r.projectKey} 프로젝트 관리자</small>
                    </span>
                  </span>
                  <span className={s.project}>
                    <b>{r.projectKey}</b>
                    {r.projectName}
                  </span>
                  <span>
                    <Chip icon={Lock}>{r.vaultPath}</Chip>
                  </span>
                  <span className={s.muted}>{r.requested}</span>
                  <span className={s.end}>
                    {r.status === 'PENDING' ? (
                      !on && (
                        <button type="button" className={s.small} onClick={() => { setOpenId(r.requestId); setReason(''); setError(null) }}>
                          검토
                        </button>
                      )
                    ) : (
                      <Chip tone={r.status === 'APPROVED' ? 'positive' : 'danger'}>{VP_TEXT[r.status]}</Chip>
                    )}
                  </span>
                </div>
                {r.status !== 'PENDING' && (
                  <p className={s.note}>
                    {r.note}
                    <em>처리 · {r.reviewer}</em>
                  </p>
                )}
                {on && (
                  <>
                    <Note icon={Info}>
                      승인하면 {r.projectKey} 의 Vault 정책에 이 경로가 더해져요. 이미 다른 프로젝트에 묶였거나 서로 품는 경로면 서버가 거절해요 (기본 경로 secret/projects/{r.projectKey.toLowerCase()}/ 는 그대로).
                    </Note>
                    <div className={s.review}>
                      <TextInput value={reason} onChange={(v) => setReason(v.slice(0, 500))} placeholder="거절할 때는 사유가 필요해요 (500자 이하)" />
                      <Button variant="secondary" icon={X} disabled={busy} onClick={() => decide(r, 'REJECT')}>
                        거절
                      </Button>
                      <Button icon={Check} disabled={busy} onClick={() => decide(r, 'APPROVE')}>
                        승인
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <FormError>{error}</FormError>
      {/* 명세 확인 필요: 묶은 경로를 푸는 API 가 없다 (T13 — 상태 REVOKED 제안) */}
      <Note icon={TriangleAlert} tone="warning">
        묶은 경로를 푸는 기능은 아직 없어요. 필요하면 Vault 에서 직접 정책을 고쳐야 해요.
      </Note>
    </Card>
  )
}

/* ================= 연동 상태 ================= */

const DRIFT: Record<DriftRow['state'], { text: string; tone: ChipTone }> = {
  FAILED: { text: '반영 실패', tone: 'danger' },
  DRIFT: { text: '불일치', tone: 'warning' },
  PENDING: { text: '반영 대기', tone: 'gray' },
  OK: { text: '정상', tone: 'positive' },
}
const JOB: Record<JobRun['status'], { text: string; tone: ChipTone }> = {
  RUNNING: { text: '실행 중', tone: 'brand' },
  SUCCEEDED: { text: '성공', tone: 'positive' },
  FAILED: { text: '실패', tone: 'danger' },
}

export function OpsPage() {
  const ops = useOps()
  const [problemsOnly, setProblemsOnly] = useState<'problems' | 'all'>('problems')
  const [failedOnly, setFailedOnly] = useState(false)
  return (
    <Loadable resource={ops} label="연동 상태">
      {({ drift, jobs }) => {
        const count = (st: DriftRow['state']) => drift.filter((d) => d.state === st).length
        const problems = drift.filter((d) => d.state !== 'OK')
        const failedJobs = jobs.filter((j) => j.status === 'FAILED')
        const rows = problemsOnly === 'problems' ? problems : drift
        return (
          <>
            <div className={s.stats}>
              <Stat label="프로비저닝 실패" value={count('FAILED')} sub="Vault · Jenkins 에 반영하지 못함" danger={count('FAILED') > 0} />
              <Stat label="권한 불일치" value={count('DRIFT')} sub="ERP 설정과 실제 권한이 다름" danger={count('DRIFT') > 0} />
              <Stat label="반영 대기" value={count('PENDING')} sub="다시 시도 중" />
              <Stat label="주기 작업 실패" value={failedJobs.length} sub={`최근 ${jobs.length}회 실행 중`} danger={failedJobs.length > 0} />
            </div>

            <Card className={s.card}>
              <div className={s.toolbar}>
                <div className={s.head}>
                  <h2>프로젝트 서비스 권한</h2>
                  <p>ERP 설정과 Vault · Jenkins 의 실제 권한이 다른 프로젝트예요 · sso-admin 만 볼 수 있어요</p>
                </div>
                <Segmented
                  value={problemsOnly}
                  options={[
                    { value: 'problems', label: `문제만 ${problems.length}` },
                    { value: 'all', label: `전체 ${drift.length}` },
                  ]}
                  onChange={setProblemsOnly}
                />
              </div>
              {rows.length === 0 ? (
                <Empty>{drift.length === 0 ? '서비스 권한을 켠 프로젝트가 없거나 볼 권한이 없어요.' : '문제가 있는 프로젝트가 없어요.'}</Empty>
              ) : (
                <div className={s.table}>
                  <div className={`${s.driftRow} ${s.thead}`}>
                    <span>프로젝트</span>
                    <span>서비스</span>
                    <span>상태</span>
                    <span>내용</span>
                    <span>마지막 대조</span>
                    <span />
                  </div>
                  {rows.map((d) => (
                    <div key={`${d.projectKey}-${d.service}`} className={d.state === 'FAILED' ? `${s.item} ${s.driftRow} ${s.failed}` : `${s.item} ${s.driftRow}`}>
                      <span className={s.project}>
                        <b>{d.projectKey}</b>
                        {d.projectName}
                      </span>
                      <span>{d.service}</span>
                      <span>
                        <Chip tone={DRIFT[d.state].tone}>{DRIFT[d.state].text}</Chip>
                      </span>
                      <span className={s.muted}>{d.message || '—'}</span>
                      <span className={s.muted}>{d.checked}</span>
                      <span className={s.end}>
                        <Link to={`/projects/${d.projectKey}/settings`} className={s.small}>
                          프로젝트 설정
                        </Link>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Note icon={Info}>다시 시도는 그 프로젝트의 설정 · 서비스 권한에서 프로젝트 관리자가 해요. 여기서는 어디가 어긋났는지만 봅니다.</Note>
            </Card>

            <Card className={s.card}>
              <div className={s.toolbar}>
                <div className={s.head}>
                  <h2>주기 작업 실행 기록</h2>
                  <p>실패하면 code-manage 에게 알림이 가요</p>
                </div>
                <button type="button" className={failedOnly ? `${s.small} ${s.smallOn}` : s.small} onClick={() => setFailedOnly(!failedOnly)}>
                  실패만
                </button>
              </div>
              {jobs.length === 0 ? (
                <Empty>실행 기록이 없거나 볼 권한이 없어요.</Empty>
              ) : (
                <div className={s.table}>
                  <div className={`${s.jobRow} ${s.thead}`}>
                    <span>작업</span>
                    <span>시작</span>
                    <span>걸린 시간</span>
                    <span>상태</span>
                    <span>처리</span>
                    <span>오류</span>
                  </div>
                  {(failedOnly ? failedJobs : jobs).map((j) => (
                    <div key={j.runId} className={`${s.item} ${s.jobRow}`}>
                      <span className={s.job}>
                        <strong>{j.jobName}</strong>
                        {j.desc && <small>{j.desc}</small>}
                      </span>
                      <span>{j.started}</span>
                      <span>{j.duration}</span>
                      <span>
                        <Chip tone={JOB[j.status].tone}>{JOB[j.status].text}</Chip>
                      </span>
                      <span>{j.processed}</span>
                      <span className={j.error ? s.error : s.muted}>{j.error || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )
      }}
    </Loadable>
  )
}

function Stat({ label, value, sub, danger }: { label: string; value: number; sub: string; danger?: boolean }) {
  return (
    <Card className={s.stat}>
      <small>{label}</small>
      <p>
        <b className={danger ? s.danger : undefined}>{value}</b>
        <span>{sub}</span>
      </p>
    </Card>
  )
}

/* ================= 파일 사용량 ================= */

const GROUP_BY: { value: UsageGroupBy; label: string; head: string }[] = [
  { value: 'TARGET_TYPE', label: '붙은 곳', head: '붙은 곳' },
  { value: 'MEMBER', label: '구성원', head: '올린 사람' },
  { value: 'PURPOSE', label: '용도', head: '용도' },
]

export function FilesPage() {
  const [groupBy, setGroupBy] = useState<UsageGroupBy>('TARGET_TYPE')
  const usage = useFileUsage(groupBy)
  return (
    <Loadable resource={usage} label="파일 사용량">
      {(u) => {
        const max = Math.max(1, ...u.groups.map((g) => g.bytes))
        return (
          <>
            <div className={s.stats}>
              <Usage icon={Folder} label="쓰고 있는 용량" value={bigBytes(u.total.bytes)} sub={`파일 ${u.total.fileCount.toLocaleString()}개`} />
              <Usage icon={Archive} label="30일 뒤 지울 파일" value={bigBytes(u.pendingPurge.bytes)} sub={`${u.pendingPurge.fileCount}개 · 지운 글의 첨부`} />
              <Usage icon={Clock} label="아직 안 붙은 파일" value={bigBytes(u.unattached.bytes)} sub={`${u.unattached.fileCount}개 · 24시간 뒤 정리`} />
            </div>
            <Card className={s.card}>
              <div className={s.toolbar}>
                <div className={s.head}>
                  <h2>어디에 쓰고 있나요</h2>
                  <p>file-manage 만 볼 수 있어요</p>
                </div>
                <Segmented value={groupBy} options={GROUP_BY.map((g) => ({ value: g.value, label: g.label }))} onChange={setGroupBy} />
              </div>
              {u.groups.length === 0 ? (
                <Empty>올린 파일이 없어요.</Empty>
              ) : (
                <div className={s.table}>
                  <div className={`${s.usageRow} ${s.thead}`}>
                    <span>{GROUP_BY.find((g) => g.value === groupBy)?.head}</span>
                    <span>용량</span>
                    <span />
                    <span>파일</span>
                  </div>
                  {u.groups.map((g) => (
                    <div key={g.key} className={`${s.item} ${s.usageRow}`}>
                      <strong>{g.label}</strong>
                      <Progress value={(g.bytes / max) * 100} height={8} />
                      <b>{bigBytes(g.bytes)}</b>
                      <span className={s.muted}>{g.fileCount.toLocaleString()}개</span>
                    </div>
                  ))}
                </div>
              )}
              <Note icon={Info}>
                첨부 하나의 최대 크기 · 보관 기간은 <Link to="/admin/codes">공통코드 FILE_POLICY</Link> 에서 바꿔요. 지운 파일은 30일 뒤, 안 붙은 파일은 24시간 뒤에 정리돼요.
              </Note>
            </Card>
          </>
        )
      }}
    </Loadable>
  )
}

function Usage({ icon: Icon, label, value, sub }: { icon: typeof Folder; label: string; value: string; sub: string }) {
  return (
    <Card className={`${s.stat} ${s.usage}`}>
      <i>
        <Icon size={20} />
      </i>
      <span>
        <small>{label}</small>
        <p>
          <b>{value}</b>
          <span>{sub}</span>
        </p>
      </span>
    </Card>
  )
}
