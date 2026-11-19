import { useState } from 'react'
import { Check, Clock, GitBranch, RefreshCw, TriangleAlert, Users, X } from 'lucide-react'
import { Avatar, Button, Card, Loadable } from '../../components/ui'
import { whenLive } from '../../api/useResource'
import { errorText, isLive, removeFromOrg, sendLinkReminder, useGithubAdmin, type CleanupItem, type GithubAdminData } from '../../api/admin'
import a from './admin.module.css'
import s from './GithubPage.module.css'

export function GithubPage() {
  const res = useGithubAdmin()
  return (
    <Loadable resource={res} label="GitHub 연동">
      {(d) => <GithubView data={d} />}
    </Loadable>
  )
}

function GithubView({ data }: { data: GithubAdminData }) {
  const [notified, setNotified] = useState<number[]>([])
  const [cleanup, setCleanup] = useState(data.cleanup)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const { stats } = data

  const statCards = [
    { icon: GitBranch, value: `${stats.linked} / ${stats.active}`, label: '계정 연결한 재실 구성원', tone: '' },
    { icon: Users, value: stats.orgMembers === null ? '—' : String(stats.orgMembers), label: 'Hoseo-I-Turtle 조직 구성원', tone: '' },
    { icon: TriangleAlert, value: String(cleanup.length), label: '정리가 필요한 계정', tone: s.warnVal },
    { icon: RefreshCw, value: stats.lastWebhook, label: '마지막 웹훅 수신 (push)', tone: data.stale ? s.warnVal : s.okVal },
  ]

  const notify = async (memberId: number) => {
    setErr('')
    setNotified((n) => [...n, memberId])
    try {
      await whenLive(() => sendLinkReminder(memberId))
    } catch (e) {
      setErr(errorText(e, '알림을 보내지 못했어요.'))
      setNotified((n) => n.filter((x) => x !== memberId))
    }
  }

  // 조직에서 빼기 · 제거 다시 시도: 작업만 만들고(202) 결과는 다음 조회에 보인다
  const remove = async (c: CleanupItem) => {
    setErr('')
    setRetrying(c.login)
    try {
      if (isLive()) await removeFromOrg(c)
      else if (c.kind === 'failed') await new Promise((r) => window.setTimeout(r, 1200))
      setCleanup((cs) => cs.filter((x) => x.login !== c.login))
    } catch (e) {
      setErr(errorText(e, '조직 작업을 만들지 못했어요.'))
    } finally {
      setRetrying(null)
    }
  }

  return (
    <>
      <div className={s.stats}>
        {statCards.map(({ icon: Icon, value, label, tone }) => (
          <Card key={label} className={s.stat}>
            <span className={s.statIcon}>
              <Icon size={20} />
            </span>
            <span>
              <strong className={tone}>{value}</strong>
              <small>{label}</small>
            </span>
          </Card>
        ))}
      </div>

      <div className={a.layout}>
        <Card>
          <h2 className={a.h3}>
            <Users size={20} /> 구성원 연결 상태
          </h2>
          <div className={s.thead}>
            <span>구성원</span>
            <span>GitHub</span>
            <span>조직 팀</span>
            <span>상태</span>
            <span />
          </div>
          {data.members.map((m) => (
            <div key={m.memberId} className={s.row}>
              <span className={s.who}>
                <Avatar name={m.name} size={26} /> {m.name}
              </span>
              <span className={m.login ? undefined : s.muted}>{m.login ?? '연결 안 함'}</span>
              <span>{m.team}</span>
              <span>
                {m.state === 'MEMBER' ? (
                  <span className={`${a.state} ${a.ok}`}>
                    <Check size={12} /> 조직 소속
                  </span>
                ) : m.state === 'INVITED' ? (
                  <span className={`${a.state} ${a.warn}`}>
                    <Clock size={12} /> 초대 보냄 · 수락 대기
                  </span>
                ) : (
                  <span className={`${a.state} ${a.off}`}>연결 안 함</span>
                )}
              </span>
              <span>
                {m.state === 'NONE' && (
                  <Button variant="secondary" onClick={() => notify(m.memberId)} disabled={notified.includes(m.memberId)}>
                    {notified.includes(m.memberId) ? '보냄' : '알림 보내기'}
                  </Button>
                )}
              </span>
            </div>
          ))}
          {err && <p className={a.err}>{err}</p>}
        </Card>

        <div className={a.col}>
          <Card>
            <h2 className={a.h3}>
              <TriangleAlert size={20} /> 정리가 필요한 계정
            </h2>
            {data.orgUnavailable && <p className={a.err}>GitHub 조직 목록을 읽지 못했어요. 조직에만 있는 계정은 잠시 뒤 다시 확인해 주세요.</p>}
            {cleanup.length === 0 && <p className={a.muted}>정리할 계정이 없어요.</p>}
            {cleanup.map((c) => (
              <div key={c.login} className={c.kind === 'orphan' ? `${s.issue} ${s.issueWarn}` : `${s.issue} ${s.issueBad}`}>
                <span>
                  <strong>{c.login}</strong>
                  <small>{c.reason}</small>
                </span>
                {c.kind === 'orphan' ? (
                  <button type="button" aria-label="조직에서 빼기" onClick={() => remove(c)} disabled={retrying === c.login}>
                    <X size={16} />
                  </button>
                ) : (
                  <button type="button" aria-label="다시 시도" className={retrying === c.login ? s.spin : undefined} onClick={() => remove(c)}>
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            ))}
          </Card>

          <Card>
            <h2 className={a.h3}>
              <RefreshCw size={20} /> 웹훅 수신 기록
            </h2>
            <p className={a.muted}>경로 /webhooks/github 하나만 바깥에 열려 있어요 (Cloudflare Tunnel)</p>
            {data.stale && <p className={a.err}>마지막 웹훅을 받은 지 24시간이 넘었어요. GitHub App 웹훅 설정을 확인해 주세요.</p>}
            {data.webhooks.length === 0 && <p className={a.muted}>받은 웹훅이 없어요.</p>}
            {data.webhooks.map((w, i) => (
              <div key={i} className={s.hook}>
                <span className={s.hookAt}>{w.at}</span>
                <span className={s.event}>{w.event}</span>
                <span className={w.ok ? s.hookDetail : `${s.hookDetail} ${s.bad}`}>{w.detail}</span>
                {w.ok ? <Check size={16} className={s.ok} /> : <X size={16} className={s.bad} />}
              </div>
            ))}
            <p className={a.muted}>하루 한 번 저장소를 다시 훑어 빠진 커밋을 채워요 · 마지막 {data.rescan}</p>
          </Card>
        </div>
      </div>
    </>
  )
}
