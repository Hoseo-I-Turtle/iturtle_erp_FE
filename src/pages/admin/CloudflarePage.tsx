import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, CloudOff, KeyRound, Mail, Plus, RefreshCw, Shield, TriangleAlert, UserX, X } from 'lucide-react'
import { Avatar, Button, Card, Loadable, Select } from '../../components/ui'
import { whenLive, type Resource } from '../../api/useResource'
import { errorText, useAdminMembers } from '../../api/admin'
import { ago } from '../../api/types'
import {
  grantSsh,
  revokeSsh,
  syncCloudflare,
  useCloudflareAccess,
  type CloudflareAccess,
  type CloudflarePolicy,
  type SshMember,
} from '../../api/cloudflare'
import { StateBadge } from './StateBadge'
import a from './admin.module.css'
import g from './GithubPage.module.css'
import s from './CloudflarePage.module.css'

/** 관리 › Cloudflare (ERP-37 · 38): 접속 허용 목록(Access 정책 iturtle-members), Gateway 규칙(VPN · SSH), SSH 허용 목록과 동기화 상태 */
export function CloudflarePage() {
  const res = useCloudflareAccess()
  return (
    <Loadable resource={res} label="Cloudflare">
      {(d) => <CloudflareView data={d} res={res} />}
    </Loadable>
  )
}

function CloudflareView({ data, res }: { data: CloudflareAccess; res: Resource<CloudflareAccess> }) {
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState('')
  const members = data.emails.filter((e) => e.memberId !== null).length
  const manual = data.emails.length - members

  const sync = async () => {
    setErr('')
    setSyncing(true)
    try {
      const next = await whenLive(syncCloudflare)
      res.setData((d) => next ?? { ...d, lastRunAt: new Date().toISOString(), lastSucceededAt: new Date().toISOString(), lastError: null, lastChanges: 0 })
    } catch (e) {
      setErr(errorText(e, '맞추지 못했어요. 잠시 뒤 다시 해 주세요.'))
    } finally {
      setSyncing(false)
    }
  }

  const stats = [
    { icon: data.enabled ? Cloud : CloudOff, value: data.enabled ? '켜짐' : '꺼짐', label: `정책 ${data.policyName}`, tone: data.enabled ? g.okVal : g.warnVal },
    { icon: Mail, value: String(data.emails.length), label: `허용 목록 (구성원 ${members} · 손으로 넣음 ${manual})`, tone: '' },
    { icon: UserX, value: String(data.missingEmailMembers.length), label: '이메일이 없어 못 넣은 구성원', tone: data.missingEmailMembers.length ? g.warnVal : '' },
    {
      icon: RefreshCw,
      value: data.lastRunAt ? ago(data.lastRunAt) : '아직 없음',
      label: data.lastError ? '마지막 맞춤 · 실패' : `마지막 맞춤 · 성공${data.lastChanges ? ` (${data.lastChanges}개 바뀜)` : ''}`,
      tone: data.lastError ? g.warnVal : g.okVal,
    },
  ]

  return (
    <>
      <div className={g.stats}>
        {stats.map(({ icon: Icon, value, label, tone }) => (
          <Card key={label} className={g.stat}>
            <span className={g.statIcon}>
              <Icon size={20} />
            </span>
            <span>
              <strong className={tone}>{value}</strong>
              <small>{label}</small>
            </span>
          </Card>
        ))}
      </div>

      {!data.enabled && (
        <p className={a.err}>
          토큰(ITURTLE_MEMBER_CLOUDFLARE_API_TOKEN)이 없어 동기화가 꺼져 있어요. 볼트 app 에 넣고 erp 를 다시 배포하면 켜져요.
        </p>
      )}
      {data.lastError && (
        <p className={a.err}>
          <TriangleAlert size={14} /> 마지막 맞추기 실패: {data.lastError}
        </p>
      )}
      {data.loadError && (
        <p className={a.err}>
          <TriangleAlert size={14} /> 정책을 읽지 못했어요: {data.loadError}
        </p>
      )}

      <div className={a.layout}>
        <Card>
          <div className={s.head}>
            <h2 className={a.h3}>
              <Mail size={20} /> 접속 허용 목록
            </h2>
            <Button variant="secondary" icon={RefreshCw} onClick={sync} disabled={!data.enabled || syncing}>
              {syncing ? '맞추는 중…' : '지금 맞추기'}
            </Button>
          </div>
          <p className={a.muted}>
            비활성이 아닌 구성원의 Cloudflare 가입 이메일을 넣고, 비활성이 되거나 이메일을 바꾸면 뺍니다. 손으로 넣은 이메일은 건드리지 않아요.
          </p>
          {data.emails.length === 0 && !data.loadError && <p className={a.muted}>목록이 비어 있어요.</p>}
          {data.emails.map((e) => (
            <div key={e.email} className={s.row}>
              <span className={s.email}>{e.email}</span>
              {e.memberId !== null ? (
                <span className={s.who}>
                  <Avatar name={e.memberName ?? '?'} size={22} /> {e.memberName}
                  {e.loginId && <small className={a.muted}>@{e.loginId}</small>}
                </span>
              ) : (
                <StateBadge tone="off">손으로 넣음</StateBadge>
              )}
            </div>
          ))}
          {err && <p className={a.err}>{err}</p>}
        </Card>

        <div className={a.col}>
          <Card>
            <h2 className={a.h3}>
              <UserX size={20} /> 이메일이 없어 못 넣은 구성원
            </h2>
            {data.missingEmailMembers.length === 0 && <p className={a.muted}>모두 이메일이 있어요.</p>}
            {data.missingEmailMembers.map((m) => (
              <div key={m.memberId} className={s.row}>
                <span className={s.who}>
                  <Avatar name={m.name} size={22} /> {m.name}
                  <small className={a.muted}>@{m.loginId}</small>
                </span>
                <Link to={`/admin/members?member=${m.memberId}`} className={s.link}>
                  이메일 넣기 →
                </Link>
              </div>
            ))}
            <p className={a.muted}>구성원 관리에서 이메일을 넣으면 30초 안에 허용 목록에 들어가요.</p>
          </Card>
        </div>
      </div>

      <div className={a.layout}>
        <SshCard data={data} res={res} />
        <div className={a.col}>
          <GatewayCard policies={(data.policies ?? []).filter((p) => p.kind === 'GATEWAY')} />
        </div>
      </div>
    </>
  )
}

const TARGET_LABEL: Record<string, string> = { VPN: 'lab.iturtle.win 접속 (구성원 모두)', SSH: '서버 SSH (허용 목록만)' }

/** Gateway 방화벽 규칙 (ERP-38): 목록에 없는 사람을 막는 규칙이라 이메일이 곧 허용 목록 */
function GatewayCard({ policies }: { policies: CloudflarePolicy[] }) {
  return (
    <Card>
      <h2 className={a.h3}>
        <Shield size={20} /> Gateway 규칙
      </h2>
      {policies.length === 0 && <p className={a.muted}>백엔드가 아직 Gateway 규칙을 맞추지 않아요.</p>}
      {policies.map((p) => {
        const members = p.emails.filter((e) => e.memberId !== null).length
        const error = p.loadError ?? p.lastError
        return (
          <div key={p.target} className={s.policy}>
            <div className={s.row}>
              <span>
                <strong className={s.email}>{p.name ?? '(이름 없음)'}</strong>
                <small className={a.muted}> {TARGET_LABEL[p.target] ?? p.target}</small>
              </span>
              {!p.enabled ? (
                <StateBadge tone="off">꺼짐</StateBadge>
              ) : error ? (
                <StateBadge tone="bad">실패</StateBadge>
              ) : (
                <StateBadge tone="ok">맞춤</StateBadge>
              )}
            </div>
            {p.enabled && (
              <p className={a.muted}>
                이메일 {p.emails.length}개 (구성원 {members} · 손으로 넣음 {p.emails.length - members}) · 마지막 맞춤{' '}
                {p.lastRunAt ? ago(p.lastRunAt) : '아직 없음'}
                {p.lastChanges ? ` (${p.lastChanges}개 바뀜)` : ''}
              </p>
            )}
            {error && (
              <p className={a.err}>
                <TriangleAlert size={14} /> {error}
              </p>
            )}
          </div>
        )
      })}
      <p className={a.muted}>
        규칙의 identity 가 이메일 조건(not(identity.email == "…"))만으로 되어 있을 때만 맞춰요. 다른 조건을 섞으면 맞추지 않고 실패로 알려요.
      </p>
    </Card>
  )
}

/** SSH 허용 목록 (ERP-38): 여기 있는 구성원 이메일이 lab_server_ssh 에 들어간다. 비활성이 되면 목록에서도 지운다 */
function SshCard({ data, res }: { data: CloudflareAccess; res: Resource<CloudflareAccess> }) {
  const members = useAdminMembers()
  const list = data.sshMembers ?? []
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const inList = new Set(list.map((m) => m.memberId))
  const candidates = (members.data?.members ?? []).filter(
    (m) => m.state !== 'DISABLED' && !m.graduated && m.noEmail !== true && !inList.has(m.memberId),
  )

  const apply = (next: SshMember[] | undefined, fallback: (prev: SshMember[]) => SshMember[]) =>
    res.setData((d) => ({ ...d, sshMembers: next ?? fallback(d.sshMembers ?? []) }))

  const add = async () => {
    const row = candidates.find((m) => String(m.memberId) === pick)
    if (!row) return
    setErr('')
    setBusy(true)
    try {
      const next = await whenLive(() => grantSsh(row.memberId))
      apply(next, (prev) => [
        ...prev,
        {
          memberId: row.memberId,
          memberName: row.name,
          loginId: row.loginId,
          email: row.email ?? null,
          memberType: null,
          applied: true,
          grantedAt: new Date().toISOString(),
          grantedById: null,
          grantedByName: null,
        },
      ])
      setPick('')
    } catch (e) {
      setErr(errorText(e, '넣지 못했어요. 잠시 뒤 다시 해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (memberId: number) => {
    setErr('')
    setBusy(true)
    try {
      const next = await whenLive(() => revokeSsh(memberId))
      apply(next, (prev) => prev.filter((m) => m.memberId !== memberId))
    } catch (e) {
      setErr(errorText(e, '빼지 못했어요. 잠시 뒤 다시 해 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className={a.h3}>
        <KeyRound size={20} /> SSH 허용 목록
      </h2>
      <p className={a.muted}>
        여기 넣은 구성원의 Cloudflare 가입 이메일이 Gateway 규칙 lab_server_ssh 에 들어가요 (30초 안). 비활성이 되면 목록에서도 지워요.
        규칙에 손으로 넣은 이메일은 건드리지 않아요.
      </p>
      {list.length === 0 && <p className={a.muted}>목록이 비어 있어요.</p>}
      {list.map((m) => (
        <div key={m.memberId} className={s.row}>
          <span className={s.who}>
            <Avatar name={m.memberName ?? '?'} size={22} /> {m.memberName ?? '(없는 구성원)'}
            {m.loginId && <small className={a.muted}>@{m.loginId}</small>}
          </span>
          <span className={s.email}>{m.email ?? '이메일 없음'}</span>
          <span className={s.who}>
            {!m.applied && <StateBadge tone="warn">규칙에 안 들어감</StateBadge>}
            <small className={a.muted}>
              {m.grantedByName ? `${m.grantedByName} · ` : ''}
              {ago(m.grantedAt)}
            </small>
            <Button variant="secondary" icon={X} onClick={() => remove(m.memberId)} disabled={busy}>
              빼기
            </Button>
          </span>
        </div>
      ))}
      <div className={s.addRow}>
        <Select
          label="넣을 구성원"
          value={pick}
          onChange={setPick}
          options={[
            { value: '', label: candidates.length ? '구성원 고르기' : '넣을 수 있는 구성원이 없어요' },
            ...candidates.map((m) => ({ value: String(m.memberId), label: `${m.name} (@${m.loginId})` })),
          ]}
        />
        <Button icon={Plus} onClick={add} disabled={!pick || busy}>
          넣기
        </Button>
      </div>
      <p className={a.muted}>비활성이 아니고 이메일이 있는 재실 · 휴학 구성원만 고를 수 있어요.</p>
      {err && <p className={a.err}>{err}</p>}
    </Card>
  )
}
