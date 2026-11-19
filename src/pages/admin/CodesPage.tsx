import { useState, type CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { Button, Card, Empty, Loadable } from '../../components/ui'
import { whenLive } from '../../api/useResource'
import {
  createCodeDetail,
  errorText,
  evictCodeCache,
  isLive,
  issueClientSecret,
  setCodeEnabled,
  useCodeGroups,
  useCodeTable,
  type CodeColumn,
  type CodeGroupView,
  type CodeRowView,
} from '../../api/admin'
import { CodeAddForm } from './codes/CodeAddForm'
import { CodeGroupList } from './codes/CodeGroupList'
import { CodeTable } from './codes/CodeTable'
import { EMPTY_DRAFT, type CodeDraft } from './codes/draft'
import { SecretBox } from './codes/SecretBox'
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
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<CodeDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)

  const g = groups.find((x) => x.code === group)
  const table = useCodeTable(g)

  const pickGroup = (code: string) => {
    setGroup(code)
    setAdding(false)
    setDraft(EMPTY_DRAFT)
    setErr('')
  }

  const updateRow = (code: string, patch: Partial<CodeRowView>) =>
    table.setData((t) => (t ? { ...t, rows: t.rows.map((r) => (r.code === code ? { ...r, ...patch } : r)) } : t))

  const toggleEnabled = async (r: CodeRowView, enabled: boolean) => {
    setErr('')
    updateRow(r.code, { enabled })
    try {
      await whenLive(() => setCodeEnabled(group, r.code, enabled))
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
        live?.secret ??
        `${app.slice(0, 3)}_` +
          Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(36).padStart(2, '0'))
            .join('')
            .slice(0, 32)
      setSecret({ app, value })
      setCopied(false)
      updateRow(app, { secretIssuedAt: live?.issuedAt ?? new Date().toISOString() })
    } catch (e) {
      setErr(errorText(e, 'secret 을 발급하지 못했어요.'))
    }
  }

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

  const closeAdd = () => {
    setAdding(false)
    setDraft(EMPTY_DRAFT)
    setErr('')
  }

  const addRow = async (columns: CodeColumn[], rows: CodeRowView[]) => {
    const code = draft.code.trim()
    const name = draft.name.trim()
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(code)) return setErr("상세 코드는 영문, 숫자, '_', '-' 50자 이하예요.")
    if (!name) return setErr('표시 이름을 적어 주세요.')
    if (rows.some((r) => r.code === code)) return setErr('이미 있는 상세 코드예요.')
    // 쓰는 칸만 보내고 나머지는 비운다 (ref1~ref5 순서)
    const refs = draft.refs.map((v, i) => (columns.some((c) => c.index === i) ? v.trim() : ''))
    const displayOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0) + 1
    setBusy(true)
    setErr('')
    try {
      const created = (await whenLive(() => createCodeDetail(group, { detailCodeId: code, description: name, refs, displayOrder }))) ?? {
        code,
        name,
        refs,
        enabled: true,
        displayOrder,
      }
      table.setData((t) => (t ? { ...t, rows: [...t.rows, created] } : t))
      setSelectedRow(code)
      closeAdd()
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={s.layout}>
      <CodeGroupList groups={groups} selected={group} onPick={pickGroup} onEvict={evict} cacheMsg={cacheMsg} />

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
              {/* 백엔드 rowAddable 인 그룹만 상세 코드를 더할 수 있다 */}
              {g.rowAddable && table.data && (
                <Button variant="tint" icon={Plus} onClick={() => setAdding(true)} disabled={adding}>
                  행 추가
                </Button>
              )}
            </div>
            {err && <p className={a.err}>{err}</p>}

            <Loadable resource={table} label="상세 코드">
              {(t) => {
                if (!t) return <Empty>{isLive() ? '이 그룹에는 상세 코드가 없어요.' : '이 그룹의 상세 코드는 목업에 없어요.'}</Empty>
                // secret 발급은 sso-admin 만 (아니면 버튼을 숨긴다)
                const showLock = group === 'SSO_APP' && t.canIssueSecret
                const cols = { '--ref-cols': `repeat(${Math.max(1, t.columns.length)}, minmax(0, 1fr))` } as CSSProperties
                return (
                  <>
                    <CodeTable
                      table={t}
                      cols={cols}
                      ssoApp={group === 'SSO_APP'}
                      showLock={showLock}
                      selectedRow={selectedRow}
                      onSelect={setSelectedRow}
                      onToggle={toggleEnabled}
                      onIssueSecret={issueSecret}
                    />
                    {adding && (
                      <CodeAddForm columns={t.columns} draft={draft} onDraft={setDraft} busy={busy} onCancel={closeAdd} onAdd={() => addRow(t.columns, t.rows)} />
                    )}
                  </>
                )
              }}
            </Loadable>
          </>
        )}

        {secret && group === 'SSO_APP' && (
          <SecretBox
            secret={secret}
            copied={copied}
            onCopy={async () => {
              await navigator.clipboard?.writeText(secret.value)
              setCopied(true)
            }}
          />
        )}
      </Card>
    </div>
  )
}
