import { RefreshCw } from 'lucide-react'
import { Button, Card } from '../../../components/ui'
import type { CodeGroupView } from '../../../api/admin'
import a from '../admin.module.css'
import s from '../CodesPage.module.css'

type Props = { groups: CodeGroupView[]; selected: string; onPick: (code: string) => void; onEvict: () => void; cacheMsg: string }

/** 왼쪽 그룹 목록 · 캐시 비우기 */
export function CodeGroupList({ groups, selected, onPick, onEvict, cacheMsg }: Props) {
  return (
    <Card className={s.groups}>
      <div className={a.muted}>그룹</div>
      {groups.map((c) => (
        <button key={c.code} type="button" className={c.code === selected ? `${s.group} ${s.groupOn}` : s.group} onClick={() => onPick(c.code)}>
          <strong>
            {c.code}
            {c.isNew && <span className={s.new}>새</span>}
          </strong>
          <small>{c.name}</small>
        </button>
      ))}
      <Button variant="secondary" icon={RefreshCw} onClick={onEvict}>
        캐시 비우기
      </Button>
      {cacheMsg && <span className={a.muted}>{cacheMsg}</span>}
    </Card>
  )
}
