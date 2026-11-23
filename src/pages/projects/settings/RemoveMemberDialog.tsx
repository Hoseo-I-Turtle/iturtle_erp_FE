import { useEffect, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { Button, Modal } from '../../../components/ui'
import { errText } from '../../../api/projectSettings'
import { fetchRemovalPreview, type RemovalPreview } from '../../../api/projectLinks'
import s from './panels.module.css'

const STATUS_NAME: Record<string, string> = { TODO: '할 일', IN_PROGRESS: '진행 중', REVIEW: '검토' }

type Props = {
  projectKey: string
  member: { memberId: number; name: string }
  /** 넘겨받을 수 있는 사람 (목업에서만 쓴다 — 실서버는 서버가 준다) */
  active: { memberId: number; name: string }[]
  onCancel: () => void
  /** 넘겨받을 사람(null = 담당 없음)과 넘길 작업으로 뺀다 */
  onConfirm: (preview: RemovalPreview, handoverTo: number | null) => void
  busy: boolean
}

/** 참여자 빼기 확인: 끝나지 않은 담당 작업을 보여 주고 넘겨받을 사람을 고른다 (기본: 담당 없음) */
export function RemoveMemberDialog({ projectKey, member, active, onCancel, onConfirm, busy }: Props) {
  const [preview, setPreview] = useState<RemovalPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [to, setTo] = useState<string>('')
  // 목업에서만 쓰는 후보 — 처음 연 때의 목록으로 고정한다 (렌더마다 새 배열이라 다시 부르지 않게)
  const [mockActive] = useState(active)

  useEffect(() => {
    let alive = true
    fetchRemovalPreview(projectKey, member.memberId, mockActive)
      .then((p) => alive && setPreview(p))
      .catch((e: unknown) => alive && setError(errText(e, '맡은 작업을 불러오지 못했어요.')))
    return () => {
      alive = false
    }
  }, [projectKey, member.memberId, mockActive])

  const tasks = preview?.openTasks ?? []
  const shown = tasks.slice(0, 5)

  return (
    <Modal
      title={`${member.name} 님을 프로젝트에서 뺄까요?`}
      onClose={onCancel}
      width={520}
      footer={
        <>
          <span className={s.grow} />
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button icon={UserMinus} disabled={!preview || busy} onClick={() => preview && onConfirm(preview, to ? Number(to) : null)}>
            빼기
          </Button>
        </>
      }
    >
      <div className={s.confirmBody}>
        <p>나간 참여자로 남고, 서비스 권한(Vault · Jenkins)도 함께 회수돼요. 언제든 다시 참여시킬 수 있어요.</p>
        {error && <p className={s.failText}>{error}</p>}
        {!preview && !error && <p className={s.muted}>맡은 작업을 확인하는 중이에요…</p>}
        {preview && tasks.length === 0 && <p className={s.muted}>끝나지 않은 담당 작업이 없어요.</p>}
        {preview && tasks.length > 0 && (
          <>
            <p>
              <strong>끝나지 않은 담당 작업 {tasks.length}개</strong>를 넘겨야 해요.
            </p>
            <ul className={s.formerList}>
              {shown.map((t) => (
                <li key={t.taskKey}>
                  <span className={s.muted}>{t.taskKey}</span> {t.title}
                  <span className={s.hint}>{STATUS_NAME[t.status] ?? t.status}</span>
                </li>
              ))}
              {tasks.length > shown.length && <li className={s.muted}>…그리고 {tasks.length - shown.length}개 더</li>}
            </ul>
            <label className={s.field}>
              <span className={s.label}>넘겨받을 사람</span>
              <span className={s.input}>
                <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="넘겨받을 사람">
                  <option value="">담당 없음 (나중에 정하기)</option>
                  {preview.candidates.map((c) => (
                    <option key={c.memberId} value={c.memberId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className={s.hint}>넘겨받는 사람에게 담당 알림이 가요.</span>
            </label>
          </>
        )}
      </div>
    </Modal>
  )
}
