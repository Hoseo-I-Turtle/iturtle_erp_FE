import { useState } from 'react'
import { Calendar, Check, Info, ListChecks, Plus, X } from 'lucide-react'
import { Button, Chip, Field, FormError, FormRow, Modal, TextArea, TextInput } from '../../components/ui'
import { errorText } from '../../api/content'
import { addMockMilestone, createMilestone, useTimeline, type MilestoneDraft } from '../../api/timeline'
import { getDataMode } from '../../lib/dataMode'
import s from './MilestoneCreateModal.module.css'

type Props = { projectKey: string; onClose: () => void; onCreated: () => void }

/** 새 마일스톤 (Penpot 06 · 마일스톤 만들기) — P-29 */
export function MilestoneCreateModal({ projectKey, onClose, onCreated }: Props) {
  const tl = useTimeline(projectKey)
  const data = tl.data
  const [f, setF] = useState<MilestoneDraft>({ name: '', description: '', startOn: '', dueOn: '', taskKeys: [] })
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof MilestoneDraft>(k: K, v: MilestoneDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  // 묶을 수 있는 작업: 끝나지 않았고 아직 마일스톤이 없는 것 먼저
  const candidates = (data?.tasks ?? [])
    .filter((t) => t.status !== 'DONE' && !f.taskKeys.includes(t.taskKey))
    .sort((a, b) => Number(a.milestoneId !== null) - Number(b.milestoneId !== null))
  const picked = (data?.tasks ?? []).filter((t) => f.taskKeys.includes(t.taskKey))

  const submit = async () => {
    const name = f.name.trim()
    if (!name) return setError('이름을 적어 주세요.')
    if (!f.dueOn) return setError('기한을 정해 주세요.')
    if (f.startOn && f.startOn > f.dueOn) return setError('시작일이 기한보다 뒤예요.')
    if (data?.milestones.some((m) => m.name === name)) return setError('같은 이름의 마일스톤이 이미 있어요.')
    setBusy(true)
    setError(null)
    try {
      if (getDataMode() === 'live') await createMilestone(projectKey, { ...f, name })
      else addMockMilestone({ ...f, name })
      onCreated()
    } catch (e) {
      setError(errorText(e, '마일스톤을 만들지 못했어요.'))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="새 마일스톤"
      badge={data && <Chip tone="tint">{data.projectName}</Chip>}
      width={720}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span>
            <Info size={14} />
            진행률은 묶인 작업의 완료 비율이에요
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={Check} onClick={submit} disabled={busy || !data}>
            {busy ? '만드는 중…' : '마일스톤 만들기'}
          </Button>
        </div>
      }
    >
      <Field label="이름" required>
        <TextInput value={f.name} onChange={(v) => set('name', v.slice(0, 50))} placeholder="예: v1.3 — 프로젝트 화면" trailing={`${f.name.length} / 50`} autoFocus />
      </Field>
      <Field label="설명">
        <TextArea value={f.description} onChange={(v) => set('description', v.slice(0, 2000))} placeholder="이 마일스톤에서 끝낼 것" rows={3} />
      </Field>
      <FormRow>
        <Field label="시작일" help="비워 두면 이전 마일스톤 기한 다음 날부터로 그려요">
          <TextInput type="date" icon={Calendar} value={f.startOn} max={f.dueOn || undefined} onChange={(v) => set('startOn', v)} aria-label="시작일" />
        </Field>
        <Field label="기한" required help="일정표 · 캘린더에 ◆ 로 보여요">
          <TextInput type="date" icon={Calendar} value={f.dueOn} min={f.startOn || undefined} onChange={(v) => set('dueOn', v)} aria-label="기한" />
        </Field>
      </FormRow>

      <section className={s.tasks}>
        <div className={s.tasksHead}>
          <ListChecks size={16} />
          <strong>작업 묶기</strong>
          <b>{picked.length}개</b>
          <small>나중에 작업 상세에서도 고를 수 있어요</small>
        </div>
        <div className={s.chips}>
          {picked.map((t) => (
            <button key={t.taskKey} type="button" className={s.chip} onClick={() => set('taskKeys', f.taskKeys.filter((k) => k !== t.taskKey))}>
              <X size={12} />
              {t.taskKey} {t.title}
            </button>
          ))}
          <button type="button" className={`${s.chip} ${s.add}`} aria-expanded={picking} onClick={() => setPicking(!picking)}>
            <Plus size={12} />
            작업 고르기
          </button>
        </div>
        {picking && (
          <div className={s.pick}>
            {candidates.length === 0 && <em>묶을 수 있는 작업이 없어요</em>}
            {candidates.map((t) => (
              <button key={t.taskKey} type="button" onClick={() => set('taskKeys', [...f.taskKeys, t.taskKey])}>
                <b>{t.taskKey}</b>
                <span>{t.title}</span>
                {t.milestoneId !== null && <small>{data?.milestones.find((m) => m.id === t.milestoneId)?.name} 에서 옮김</small>}
              </button>
            ))}
          </div>
        )}
      </section>

      <FormError>{error ?? tl.error}</FormError>
    </Modal>
  )
}
