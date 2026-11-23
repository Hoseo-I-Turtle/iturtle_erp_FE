import { useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { Button, Chip, Modal } from '../../components/ui'
import { ApiError } from '../../api/client'
import { notifyMilestonesChanged, updateMilestone, type MilestonePatch, type MilestoneRow } from '../../api/milestones'
import s from './MilestoneEditModal.module.css'

const NAME_MAX = 50

type Props = {
  projectKey: string
  milestone: MilestoneRow
  /** 남은 작업을 옮길 수 있는 다른 열린 마일스톤 */
  others: MilestoneRow[]
  onClose: () => void
  /** 목업: 화면에서 바로 바꾼다 */
  onSaved: (m: MilestoneRow) => void
}

/** 마일스톤 고치기 · 닫기 · 다시 열기 (P-30, ERP-12). 닫을 때 남은 작업은 다른 마일스톤으로 옮기거나 마일스톤에서 뺀다 (P038) */
export function MilestoneEditModal({ projectKey, milestone: m, others, onClose, onSaved }: Props) {
  const [name, setName] = useState(m.name)
  const [description, setDescription] = useState(m.description)
  const [startOn, setStartOn] = useState(m.startOn ?? '')
  const [dueOn, setDueOn] = useState(m.dueOn ?? '')
  const [closing, setClosing] = useState(false)
  const [action, setAction] = useState<'CLEAR' | 'MOVE'>('CLEAR')
  const [target, setTarget] = useState<number | null>(others[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badPeriod = !!startOn && !!dueOn && dueOn < startOn
  const nameOk = name.trim().length > 0 && name.length <= NAME_MAX

  const save = async (status?: 'OPEN' | 'CLOSED') => {
    if (!nameOk || badPeriod || saving) return
    const patch: MilestonePatch = {}
    if (name.trim() !== m.name) patch.name = name.trim()
    if (description.trim() !== m.description) patch.description = description.trim() || null
    if ((startOn || null) !== m.startOn) patch.startOn = startOn || null
    if ((dueOn || null) !== m.dueOn) patch.dueOn = dueOn || null
    if (status) patch.status = status
    if (status === 'CLOSED' && m.openTasks > 0) {
      patch.openTasks = action === 'MOVE' && target ? { action: 'MOVE', targetMilestoneId: target } : { action: 'CLEAR' }
    }
    setSaving(true)
    setError(null)
    try {
      await updateMilestone(projectKey, m.id, patch)
      notifyMilestonesChanged()
      onSaved({
        ...m,
        name: name.trim(),
        description: description.trim(),
        startOn: startOn || null,
        dueOn: dueOn || null,
        closed: status ? status === 'CLOSED' : m.closed,
        openTasks: status === 'CLOSED' ? 0 : m.openTasks,
      })
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '마일스톤을 고치지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="마일스톤 고치기"
      width={640}
      onClose={onClose}
      badge={m.closed ? <Chip tone="muted">닫힘</Chip> : undefined}
      footer={
        <>
          <span className={s.grow} />
          {error && (
            <span className={s.error}>
              <TriangleAlert size={14} /> {error}
            </span>
          )}
          {m.closed ? (
            <Button variant="secondary" onClick={() => save('OPEN')} disabled={saving}>
              다시 열기
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => (closing ? save('CLOSED') : setClosing(true))} disabled={saving}>
              {closing ? '닫기 확인' : '닫기'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={() => save()} disabled={!nameOk || badPeriod || saving}>
            저장
          </Button>
        </>
      }
    >
      <div className={s.form}>
      <label className={s.field}>
        <span className={s.label}>이름</span>
        <input className={s.input} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={s.field}>
        <span className={s.label}>설명</span>
        <textarea className={s.textarea} rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className={s.field}>
        <span className={s.label}>기간</span>
        <span className={s.row}>
          <input className={s.input} type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} aria-label="시작일" />
          <span>–</span>
          <input className={s.input} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="기한" />
        </span>
        {badPeriod && <small className={s.error}>기한은 시작일과 같거나 뒤여야 해요</small>}
      </div>
      {closing && !m.closed && (
        <div className={s.field}>
          <span className={s.label}>닫기</span>
          {m.openTasks > 0 ? (
            <>
              <small>끝나지 않은 작업 {m.openTasks}개를 어떻게 할까요?</small>
              <label className={s.row}>
                <input type="radio" checked={action === 'CLEAR'} onChange={() => setAction('CLEAR')} /> 마일스톤에서 빼기
              </label>
              <label className={s.row}>
                <input type="radio" checked={action === 'MOVE'} disabled={others.length === 0} onChange={() => setAction('MOVE')} /> 다른 마일스톤으로 옮기기
                {action === 'MOVE' && (
                  <select className={s.input} value={target ?? ''} onChange={(e) => setTarget(Number(e.target.value))}>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </>
          ) : (
            <small>남은 작업이 없어요. "닫기 확인" 을 누르면 닫혀요.</small>
          )}
        </div>
      )}
      </div>
    </Modal>
  )
}
