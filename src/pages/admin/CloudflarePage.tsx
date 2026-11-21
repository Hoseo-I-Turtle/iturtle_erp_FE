import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, CloudOff, Mail, RefreshCw, TriangleAlert, UserX } from 'lucide-react'
import { Avatar, Button, Card, Loadable } from '../../components/ui'
import { whenLive, type Resource } from '../../api/useResource'
import { errorText } from '../../api/admin'
import { ago } from '../../api/types'
import { syncCloudflare, useCloudflareAccess, type CloudflareAccess } from '../../api/cloudflare'
import { StateBadge } from './StateBadge'
import a from './admin.module.css'
import g from './GithubPage.module.css'
import s from './CloudflarePage.module.css'

/** 관리 › Cloudflare (ERP-37): 접속 허용 목록(Access 정책 iturtle-members)과 동기화 상태 */
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
                <Link to="/admin/members" className={s.link}>
                  이메일 넣기 →
                </Link>
              </div>
            ))}
            <p className={a.muted}>구성원 관리에서 이메일을 넣으면 30초 안에 허용 목록에 들어가요.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
