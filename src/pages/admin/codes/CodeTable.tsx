import type { CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import { Empty, Switch } from '../../../components/ui'
import { splitRef, type CodeRowView, type CodeTable as CodeTableData } from '../../../api/admin'
import s from '../CodesPage.module.css'

type Props = {
  table: CodeTableData
  cols: CSSProperties
  ssoApp: boolean
  /** secret 발급은 sso-admin 만 (아니면 버튼을 숨긴다) */
  showLock: boolean
  selectedRow: string
  onSelect: (code: string) => void
  onToggle: (r: CodeRowView, enabled: boolean) => void
  onIssueSecret: (app: string) => void
}

/** 상세 코드 표: 코드 · 표시 이름 · 참조 칸 · 사용 · secret 발급 */
export function CodeTable({ table, cols, ssoApp, showLock, selectedRow, onSelect, onToggle, onIssueSecret }: Props) {
  return (
    <>
      <div className={s.thead} style={cols}>
        <span>코드</span>
        <span>표시 이름</span>
        {table.columns.length === 0 && <span />}
        {table.columns.map((c) => (
          <span key={c.index}>{c.label}</span>
        ))}
        <span>사용</span>
        <span />
      </div>
      {table.rows.length === 0 && <Empty>이 그룹에는 상세 코드가 없어요.</Empty>}
      {table.rows.map((r) => (
        <div
          key={r.code}
          className={r.code === selectedRow ? `${s.row} ${s.rowOn}` : s.row}
          style={cols}
          onClick={() => onSelect(r.code)}
        >
          <strong>{r.code}</strong>
          <span>
            {r.name}
            {ssoApp && r.secretIssuedAt === null && <span className={s.noSecret}> · secret 발급 전</span>}
          </span>
          {table.columns.length === 0 && <span />}
          {table.columns.map((c) =>
            c.list ? (
              <span key={c.index} className={s.refs}>
                {splitRef(r.refs[c.index]).map((x) => (
                  <span key={x} className={s.ref}>
                    {x}
                  </span>
                ))}
              </span>
            ) : (
              <span key={c.index} className={s.wrap}>
                {r.refs[c.index]}
              </span>
            ),
          )}
          <Switch checked={r.enabled} onChange={(v) => onToggle(r, v)} label={`${r.code} 사용`} />
          {showLock ? (
            <button type="button" className={s.lock} onClick={() => onIssueSecret(r.code)} title="client secret 새로 발급">
              <Lock size={16} />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
    </>
  )
}
