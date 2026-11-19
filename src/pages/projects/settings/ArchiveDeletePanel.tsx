import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, Check, TriangleAlert, X } from 'lucide-react'
import { Button, Card, Modal } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import { deleteProject, errText, updateProject, type ProjectSettings, type ServiceResources } from '../../../api/projectSettings'
import s from './panels.module.css'

type Props = { settings: ProjectSettings; onChange: (p: Partial<ProjectSettings>) => void }

/** 설정 › 보관 · 삭제 (P-4 status · P-5). 보관은 읽기 전용 + 언제든 풀기, 삭제는 30일 안 관리자가 되돌릴 수 있음 */
export function ArchiveDeletePanel({ settings, onChange }: Props) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const archived = settings.status === 'ARCHIVED'
  const lab = settings.projectKey === 'LAB'

  const toggleArchive = () => {
    const status = archived ? 'ACTIVE' : 'ARCHIVED'
    setBusy(true)
    setError(null)
    whenLive(() => updateProject(settings.projectKey, { status }))
      .then(() => onChange({ status }))
      .catch((e: unknown) => setError(errText(e, '바꾸지 못했어요.')))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <Card className={s.card}>
        <header className={s.head}>
          <h2>보관 · 삭제</h2>
          <p>프로젝트 관리자만 보관할 수 있고, 지우기는 연구실 관리자(project-manage)만 할 수 있어요</p>
        </header>

        <div className={s.zone}>
          <span className={s.zoneIcon}>{archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}</span>
          <span className={s.zoneText}>
            <strong>{archived ? '보관된 프로젝트예요' : '프로젝트 보관'}</strong>
            <small>
              {archived
                ? '지금은 읽기만 할 수 있어요. 보관을 풀면 다시 작업 · 스레드 · 회의록을 쓸 수 있어요.'
                : '보관하면 읽기만 할 수 있어요. 작업 · 스레드 · 회의록은 그대로 남고, 목록에서는 "보관됨"에서 보여요. 언제든 되돌릴 수 있어요.'}
            </small>
          </span>
          <Button variant="secondary" icon={archived ? ArchiveRestore : Archive} onClick={toggleArchive} disabled={busy || lab || !settings.canManage}>
            {archived ? '보관 풀기' : '보관하기'}
          </Button>
        </div>

        {settings.canDelete && (
          <div className={`${s.zone} ${s.danger}`}>
            <span className={`${s.zoneIcon} ${s.dangerIcon}`}>
              <TriangleAlert size={18} />
            </span>
            <span className={s.zoneText}>
              <strong className={s.dangerText}>프로젝트 삭제</strong>
              <small>작업 · 스레드 · 회의록 · 자료가 모두 숨겨져요. 30일 동안은 관리자가 되돌릴 수 있고, 키는 다시 쓸 수 없어요.</small>
            </span>
            <Button variant="secondary" className={s.dangerBtn} onClick={() => setConfirm(true)} disabled={lab}>
              삭제하기
            </Button>
          </div>
        )}
        {lab && <p className={s.muted}>연구실 운영(LAB) 프로젝트는 보관하거나 지울 수 없어요.</p>}
        {error && <p className={s.failText}>{error}</p>}
      </Card>

      {confirm && <DeleteConfirm settings={settings} onClose={() => setConfirm(false)} />}
    </>
  )
}

function DeleteConfirm({ settings, onClose }: { settings: ProjectSettings; onClose: () => void }) {
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [resources, setResources] = useState<ServiceResources>('KEEP')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const match = typed === settings.projectKey

  const submit = () => {
    setBusy(true)
    setError(null)
    whenLive(() => deleteProject(settings.projectKey, resources))
      .then(() => navigate('/projects', { replace: true }))
      .catch((e: unknown) => setError(errText(e, '지우지 못했어요.')))
      .finally(() => setBusy(false))
  }

  return (
    <Modal
      title={`${settings.name}를 삭제할까요?`}
      badge={<TriangleAlert size={18} className={s.dangerText} />}
      onClose={onClose}
      width={520}
      footer={
        <>
          <span className={s.grow} />
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button icon={X} className={s.deleteBtn} onClick={submit} disabled={!match || busy}>
            {busy ? '지우는 중…' : '삭제'}
          </Button>
        </>
      }
    >
      <div className={s.confirmBody}>
        <p>작업 {settings.taskTotal}개와 스레드 · 회의록 · 자료가 숨겨져요. 30일 안에는 관리자가 되돌릴 수 있어요.</p>
        <div className={s.field}>
          <span className={s.label}>연동 서비스 자원 (Vault 정책 · Jenkins 권한 · 권한 그룹)</span>
          <div className={s.radios}>
            <label>
              <input type="radio" name="resources" checked={resources === 'KEEP'} onChange={() => setResources('KEEP')} /> 남기기 — 되돌리면 그대로 써요
            </label>
            <label>
              <input type="radio" name="resources" checked={resources === 'REMOVE'} onChange={() => setResources('REMOVE')} /> 같이 지우기 — ERP 가 만든 것만 정리해요
            </label>
          </div>
        </div>
        <label className={s.field}>
          <span className={s.label}>
            확인을 위해 프로젝트 키 <strong>{settings.projectKey}</strong> 를 입력해 주세요
          </span>
          <span className={s.input}>
            <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoFocus aria-label="프로젝트 키 확인" />
            {match && (
              <small className={s.okText}>
                <Check size={12} /> 맞아요
              </small>
            )}
          </span>
        </label>
        {error && <p className={s.failText}>{error}</p>}
      </div>
    </Modal>
  )
}
