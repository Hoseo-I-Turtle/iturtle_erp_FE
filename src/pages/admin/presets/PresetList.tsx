import { Plus, Shield } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { PresetView } from '../../../api/admin'
import a from '../admin.module.css'
import s from '../PresetsPage.module.css'

type Props = { presets: PresetView[]; selectedId: string; onPick: (p: PresetView) => void; onNew: () => void }

/** 왼쪽: 프리셋 목록 · 새 프리셋 */
export function PresetList({ presets, selectedId, onPick, onNew }: Props) {
  return (
    <div className={a.col} style={{ gap: 12 }}>
      {presets.map((p) => (
        <button key={p.id} type="button" className={p.id === selectedId ? `${s.preset} ${s.presetOn}` : s.preset} onClick={() => onPick(p)}>
          <span className={s.presetTop}>
            <Shield size={18} />
            <strong>{p.name}</strong>
            {p.defaultFor && <span className={s.default}>{p.defaultFor} 기본값</span>}
          </span>
          <small>
            역할 {p.roles.length}개 · 적용한 구성원 {p.appliedCount}명{!p.active && ' · 사용 안 함'}
          </small>
        </button>
      ))}
      <Button variant="tint" icon={Plus} onClick={onNew}>
        새 프리셋
      </Button>
      <p className={a.muted}>프리셋은 템플릿이에요. 고쳐도 이미 적용한 구성원은 자동으로 바뀌지 않아요.</p>
    </div>
  )
}
