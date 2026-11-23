import { useState } from 'react'
import { Copy, Lock, Plus, RefreshCw } from 'lucide-react'
import { Button, Card, Empty, Loadable, Switch } from '../../components/ui'
import { whenLive } from '../../api/useResource'
import {
  errorText,
  evictCodeCache,
  isLive,
  issueClientSecret,
  saveCodeEnabled,
  useCodeGroups,
  useCodeTable,
  type CodeGroupView,
  type CodeRowView,
} from '../../api/admin'
import { CodeGroupForm, CodeRowForm } from './CodeAddForms'
import a from './admin.module.css'
import s from './CodesPage.module.css'

export function CodesPage() {
  const groups = useCodeGroups()
  return (
    <Loadable resource={groups} label="공통코드 그룹">
      {(d) => <CodesView groups={d} />}
    </Loadable>
  )
}

function CodesView({ groups }: { groups: CodeGroupView[] }) {
  const [group, setGroup] = useState(() => (groups.some((g) => g.code === 'SSO_APP') ? 'SSO_APP' : (groups[0]?.code ?? '')))
  const [selectedRow, setSelectedRow] = useState('penpot')
  const [secret, setSecret] = useState<{ app: string; value: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [cacheMsg, setCacheMsg] = useState('')
  const [err, setErr] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [addingRow, setAddingRow] = useState(false)

  const g = groups.find((x) => x.code === group)
  const table = useCodeTable(g)

  const updateRow = (code: string, patch: Partial<CodeRowView>) =>
    table.setData((t) => (t ? { ...t, rows: t.rows.map((r) => (r.code === code ? { ...r, ...patch } : r)) } : t))

  const toggleEnabled = async (r: CodeRowView, enabled: boolean) => {
    setErr('')
    updateRow(r.code, { enabled })
    try {
      await whenLive(() => saveCodeEnabled(group, r.raw!, enabled))
    } catch (e) {
      setErr(errorText(e))
      updateRow(r.code, { enabled: !enabled })
    }
  }

  const issueSecret = async (app: string) => {
    setErr('')
    try {
      // 목업: 브라우저에서 만든 값. 실서버: 서버가 발급한 값 (한 번만 보임)
      const live = await whenLive(() => issueClientSecret(app))
      const value =
        live ??
        `${app.slice(0, 3)}_` +
          Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(36).padStart(2, '0'))
            .join('')
            .slice(0, 32)
      setSecret({ app, value })
      setCopied(false)
    } catch (e) {
      setErr(errorText(e, 'secret 을 발급하지 못했어요.'))
    }
  }
  const masked = (v: string) => v.slice(0, 8) + '•'.repeat(Math.max(0, v.length - 12)) + v.slice(-4)

  const evict = async () => {
    setErr('')
    try {
      await whenLive(evictCodeCache)
      setCacheMsg('캐시를 비웠어요')
      window.setTimeout(() => setCacheMsg(''), 2000)
    } catch (e) {
      setErr(errorText(e, '캐시를 비우지 못했어요.'))
    }
  }

  return (
    <div className={s.layout}>
      <Card className={s.groups}>
        <div className={a.muted}>그룹</div>
        {addingGroup ? (
          <CodeGroupForm
            existing={groups.map((x) => x.code)}
            onClose={() => setAddingGroup(false)}
            onCreated={(code) => {
              setAddingGroup(false)
              setGroup(code)
            }}
          />
        ) : (
          <Button variant="tint" icon={Plus} onClick={() => setAddingGroup(true)}>
            그룹 추가
          </Button>
        )}
        {groups.map((c) => (
          <button key={c.code} type="button" className={c.code === group ? `${s.group} ${s.groupOn}` : s.group} onClick={() => setGroup(c.code)}>
            <strong>
              {c.code}
              {c.isNew && <span className={s.new}>새</span>}
            </strong>
            <small>{c.name}</small>
          </button>
        ))}
        <Button variant="secondary" icon={RefreshCw} onClick={evict}>
          캐시 비우기
        </Button>
        {cacheMsg && <span className={a.muted}>{cacheMsg}</span>}
      </Card>

      <Card className={s.detail}>
        {!g ? (
          <Empty>공통코드 그룹이 없어요.</Empty>
        ) : (
          <>
            <div className={s.head}>
              <div>
                <h2>
                  {g.code} · {g.name}
                </h2>
                {table.data?.desc && <small>{table.data.desc}</small>}
              </div>
              <Button variant="tint" icon={Plus} onClick={() => setAddingRow(true)}>
                행 추가
              </Button>
            </div>
            {err && <p className={a.err}>{err}</p>}

            <Loadable resource={table} label="상세 코드">
              {(t) =>
                !t ? (
                  <Empty>{isLive() ? '이 그룹에는 상세 코드가 없어요.' : '이 그룹의 상세 코드는 목업에 없어요.'}</Empty>
                ) : (
                  <>
                    <div className={s.thead}>
                      <span>코드</span>
                      <span>표시 이름</span>
                      {t.columns.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                      <span />
                    </div>
                    {t.rows.length === 0 && !addingRow && <Empty>이 그룹에는 상세 코드가 없어요.</Empty>}
                    {t.rows.map((r) => (
                      <div
                        key={r.code}
                        className={r.code === selectedRow ? `${s.row} ${s.rowOn}` : s.row}
                        onClick={() => setSelectedRow(r.code)}
                      >
                        <strong>{r.code}</strong>
                        <span>{r.name}</span>
                        <span className={s.wrap}>{r.ref1}</span>
                        <span className={s.refs}>
                          {r.ref2.map((x) => (
                            <span key={x} className={s.ref}>
                              {x}
                            </span>
                          ))}
                        </span>
                        <span className={s.wrap}>{r.ref4}</span>
                        <Switch checked={r.enabled} onChange={(v) => toggleEnabled(r, v)} label={`${r.code} 사용`} />
                        {group === 'SSO_APP' ? (
                          <button type="button" className={s.lock} onClick={() => issueSecret(r.code)} title="client secret 새로 발급">
                            <Lock size={16} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    {addingRow && <CodeRowForm group={group} columns={t.columns} existing={t.rows.map((r) => r.code)} onClose={() => setAddingRow(false)} />}
                  </>
                )
              }
            </Loadable>
            {addingRow && !table.data && (
              <CodeRowForm group={group} columns={['ref1', 'ref2', 'ref4', '사용']} existing={[]} onClose={() => setAddingRow(false)} />
            )}
          </>
        )}

        {secret && group === 'SSO_APP' && (
          <div className={s.secret}>
            <strong>
              <Lock size={16} /> {secret.app} 의 새 client secret
            </strong>
            <div className={s.secretBox}>
              <code>{masked(secret.value)}</code>
              <Button
                variant="tint"
                icon={Copy}
                onClick={async () => {
                  await navigator.clipboard?.writeText(secret.value)
                  setCopied(true)
                }}
              >
                {copied ? '복사함' : '복사'}
              </Button>
            </div>
            <small>
              이 값은 지금 한 번만 보여요. 서버에는 해시만 저장하고, 감사 로그에도 값을 남기지 않아요. {secret.app} 설정도 함께 바꿔 주세요.
            </small>
          </div>
        )}
      </Card>
    </div>
  )
}
