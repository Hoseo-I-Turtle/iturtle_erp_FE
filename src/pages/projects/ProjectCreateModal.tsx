import { useState } from 'react'
import { Calendar, Check, ChevronLeft, ChevronRight, GitBranch, Image, Info, Lock, Play, Users, X, type LucideIcon } from 'lucide-react'
import { Avatar, Button, Field, FormError, FormRow, Modal, Note, OptionCard, Select, Switch, TextArea, TextInput, ToggleChip } from '../../components/ui'
import { errorText } from '../../api/content'
import { useActiveMembers } from '../../api/events'
import { createProject, mockKeyTaken, type ProjectDraft } from '../../api/projectSettings'
import { getDataMode } from '../../lib/dataMode'
import { PROJECT_CATEGORY_NAME, type ProjectCategory } from '../../mocks/projects'
import s from './ProjectCreateModal.module.css'

const STEPS = ['기본 정보', '참여자', '연동 서비스']
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/
const ROLES = [
  { value: 'MEMBER' as const, label: '참여자' },
  { value: 'MANAGER' as const, label: '프로젝트 관리자' },
]

type Props = { onClose: () => void; onCreated: (projectKey: string, failed: string[]) => void }

/** 새 프로젝트 (Penpot 06 · 프로젝트 만들기 / 프로젝트 만들기 · 연동 서비스) — P-2 */
export function ProjectCreateModal({ onClose, onCreated }: Props) {
  const isLive = getDataMode() === 'live'
  const people = useActiveMembers()
  const [step, setStep] = useState(0)
  const [f, setF] = useState<ProjectDraft>({
    categoryCode: 'DEV',
    name: '',
    projectKey: '',
    startsOn: '',
    endsOn: '',
    description: '',
    visibility: 'LAB',
    members: [],
    githubUrl: '',
    jenkinsUrl: '',
    penpotUrl: '',
    vault: false,
  })
  const [on, setOn] = useState({ github: false, jenkins: false, penpot: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  const keyOk = KEY_RE.test(f.projectKey)
  const keyTaken = !isLive && keyOk && mockKeyTaken(f.projectKey)
  const others = (people.data?.members ?? []).filter((m) => m.id !== people.data?.meId)

  const next = () => {
    if (step === 0) {
      if (!f.name.trim()) return setError('이름을 적어 주세요.')
      if (!keyOk) return setError('키는 영문 대문자로 시작하는 대문자 · 숫자 2~10자예요.')
      if (keyTaken) return setError('이미 쓰고 있는 키예요.')
      if (f.startsOn && f.endsOn && f.endsOn < f.startsOn) return setError('끝 날짜가 시작보다 앞이에요.')
    }
    setError(null)
    setStep(step + 1)
  }

  const submit = async () => {
    const bad = [on.github && f.githubUrl, on.jenkins && f.jenkinsUrl, on.penpot && f.penpotUrl].some((u) => typeof u === 'string' && u.trim() && !/^https?:\/\//.test(u.trim()))
    if (bad) return setError('연동 서비스 주소는 http:// 또는 https:// 로 시작해야 해요.')
    setBusy(true)
    setError(null)
    try {
      const failed = await createProject(
        { ...f, name: f.name.trim(), githubUrl: on.github ? f.githubUrl : '', jenkinsUrl: on.jenkins ? f.jenkinsUrl : '', penpotUrl: on.penpot ? f.penpotUrl : '' },
        isLive,
      )
      onCreated(f.projectKey, failed)
    } catch (e) {
      setError(errorText(e, '프로젝트를 만들지 못했어요.'))
      setBusy(false)
    }
  }

  const service = (icon: LucideIcon, title: string, desc: string, checked: boolean, onChange: (v: boolean) => void, body?: React.ReactNode) => {
    const Icon = icon
    return (
      <div className={checked ? `${s.svc} ${s.svcOn}` : s.svc}>
        <div className={s.svcTop}>
          <Switch checked={checked} onChange={onChange} label={title} />
          <i>
            <Icon size={16} />
          </i>
          <span>
            <strong>{title}</strong>
            <small>{desc}</small>
          </span>
        </div>
        {checked && body}
      </div>
    )
  }

  return (
    <Modal
      title="새 프로젝트"
      width={760}
      onClose={onClose}
      footer={
        <div className={s.foot}>
          <span>
            {step === 0 && (
              <>
                <Info size={14} />
                만든 사람은 프로젝트 관리자가 돼요
              </>
            )}
          </span>
          {step > 0 && (
            <Button variant="secondary" icon={ChevronLeft} onClick={() => { setError(null); setStep(step - 1) }}>
              이전
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          {step < 2 ? (
            <Button icon={ChevronRight} onClick={next}>
              다음
            </Button>
          ) : (
            <Button icon={Check} onClick={submit} disabled={busy}>
              {busy ? '만드는 중…' : '프로젝트 만들기'}
            </Button>
          )}
        </div>
      }
    >
      <ol className={s.steps}>
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? s.stepOn : i < step ? s.stepDone : undefined}>
            <b>{i < step ? <Check size={12} /> : i + 1}</b>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <Field label="종류" required>
            <div className={s.pills}>
              {(Object.keys(PROJECT_CATEGORY_NAME) as ProjectCategory[]).map((c) => (
                <ToggleChip key={c} on={f.categoryCode === c} check onClick={() => set('categoryCode', c)}>
                  {PROJECT_CATEGORY_NAME[c]}
                </ToggleChip>
              ))}
            </div>
          </Field>
          <Field label="이름" required>
            <TextInput value={f.name} onChange={(v) => set('name', v.slice(0, 50))} placeholder="프로젝트 이름" trailing={`${f.name.length} / 50`} autoFocus />
          </Field>
          <FormRow>
            <Field label="키" required help={`대문자 · 숫자 2~10자. 작업 번호(${f.projectKey || 'KEY'}-12)와 주소에 쓰이고, 만든 뒤에는 바꿀 수 없어요`}>
              <TextInput
                value={f.projectKey}
                onChange={(v) => set('projectKey', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                placeholder="LAB2"
                invalid={f.projectKey.length > 0 && (!keyOk || keyTaken)}
                trailing={
                  f.projectKey && keyOk && !keyTaken ? (
                    <span className={s.ok}>
                      <Check size={12} />
                      {isLive ? '형식이 맞아요' : '사용할 수 있어요'}
                    </span>
                  ) : keyTaken ? (
                    <span className={s.bad}>이미 쓰는 키예요</span>
                  ) : undefined
                }
              />
            </Field>
            <Field label="기간" help="끝 날짜는 비워 둬도 돼요">
              <div className={s.period}>
                <TextInput type="date" icon={Calendar} value={f.startsOn} onChange={(v) => set('startsOn', v)} aria-label="시작" />
                <span>–</span>
                <TextInput type="date" icon={Calendar} value={f.endsOn} min={f.startsOn || undefined} onChange={(v) => set('endsOn', v)} aria-label="끝" />
              </div>
            </Field>
          </FormRow>
          <Field label="설명">
            <TextArea value={f.description} onChange={(v) => set('description', v.slice(0, 10000))} rows={3} placeholder="무엇을 하는 프로젝트인지" />
          </Field>
          <Field label="공개 범위">
            <div className={s.options}>
              <OptionCard on={f.visibility === 'LAB'} icon={Users} title="연구실 공개" desc="연구실 구성원 누구나 보고 읽을 수 있어요. 쓰기는 참여자만" onClick={() => set('visibility', 'LAB')} />
              <OptionCard on={f.visibility === 'PRIVATE'} icon={Lock} title="참여자만" desc="참여자가 아니면 목록에도 안 보여요" onClick={() => set('visibility', 'PRIVATE')} />
            </div>
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <p className={s.lead}>처음 참여자를 골라 주세요. 나중에 프로젝트 설정 › 참여자에서 더하고 뺄 수 있어요. 나는 프로젝트 관리자로 들어가요.</p>
          <div className={s.people}>
            {others.map((m) => {
              const picked = f.members.find((x) => x.memberId === m.id)
              return (
                <div key={m.id} className={picked ? `${s.personRow} ${s.personOn}` : s.personRow}>
                  <button type="button" aria-pressed={!!picked} onClick={() => set('members', picked ? f.members.filter((x) => x.memberId !== m.id) : [...f.members, { memberId: m.id, name: m.name, role: 'MEMBER' }])}>
                    <Avatar name={m.name} size={28} />
                    <strong>{m.name}</strong>
                    {picked ? <X size={14} /> : null}
                  </button>
                  {picked && (
                    <Select value={picked.role} options={ROLES} width={160} label={`${m.name} 역할`} onChange={(role) => set('members', f.members.map((x) => (x.memberId === m.id ? { ...x, role } : x)))} />
                  )}
                </div>
              )
            })}
            {people.data && others.length === 0 && <p className={s.lead}>더할 수 있는 재실 구성원이 없어요.</p>}
          </div>
          <p className={s.lead}>고른 참여자 {f.members.length}명 (+ 나)</p>
        </>
      )}

      {step === 2 && (
        <>
          <p className={s.lead}>연결할 서비스만 켜고 주소를 붙여 넣으세요. 건너뛰고 나중에 프로젝트 설정 › 연동 서비스에서 해도 돼요.</p>
          {/* 명세 확인 필요: 디자인의 "새로 만들기"(저장소 · Jenkins 작업 · Penpot 팀 프로젝트 생성)는 API 에 없다. 이미 있는 것의 주소만 연결한다 (P-12) */}
          {service(
            GitBranch,
            'GitHub',
            '저장소를 연결하면 커밋 · PR 이 프로젝트 활동에 보여요',
            on.github,
            (v) => setOn({ ...on, github: v }),
            <TextInput icon={GitBranch} type="url" value={f.githubUrl} onChange={(v) => set('githubUrl', v)} placeholder="https://github.com/Hoseo-I-Turtle/저장소" />,
          )}
          {service(
            Play,
            'Jenkins',
            '빌드 결과가 프로젝트 홈에 보이고, 참여자는 빌드 권한을 받아요',
            on.jenkins,
            (v) => setOn({ ...on, jenkins: v }),
            <TextInput icon={Play} type="url" value={f.jenkinsUrl} onChange={(v) => set('jenkinsUrl', v)} placeholder="https://lab.iturtle.win/jenkins/job/…" />,
          )}
          {service(
            Image,
            'Penpot',
            '디자인 파일 바로 가기를 프로젝트 홈에 둬요',
            on.penpot,
            (v) => setOn({ ...on, penpot: v }),
            <TextInput icon={Image} type="url" value={f.penpotUrl} onChange={(v) => set('penpotUrl', v)} placeholder="https://penpot.iturtle.win/…" />,
          )}
          {service(
            Lock,
            'Vault',
            '프로젝트 비밀값 경로를 만들고 권한을 맞춰요',
            f.vault,
            (v) => set('vault', v),
            <p className={s.vault}>
              <b>
                <Lock size={12} />
                secret/projects/{f.projectKey.toLowerCase()}/
              </b>
              관리자 쓰기 · 참여자 읽기 (기본)
            </p>,
          )}
          <Note icon={Info}>만들면 바로 서비스 권한을 맞춰요. 실패하면 프로젝트 설정 › 서비스 권한에서 다시 시도할 수 있어요</Note>
        </>
      )}

      <FormError>{error ?? people.error}</FormError>
    </Modal>
  )
}
