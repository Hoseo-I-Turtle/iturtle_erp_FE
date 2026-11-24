import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Info, Lock, Plus, Users, X } from 'lucide-react'
import { Avatar, Button, Loadable, Modal, Switch } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import {
  KEY_PATTERN,
  checkProjectKey,
  createProject,
  errText,
  mockCheckKey,
  suggestKey,
  useCreateOptions,
  type CreateOptions,
  type KeyCheck,
  type LinkDraft,
  type ProjectDraft,
} from '../../../api/projectSettings'
import type { ServiceCode } from '../../../mocks/projects'
import { ServiceIcon } from '../common'
import s from './ProjectCreateModal.module.css'

const STEPS = ['기본 정보', '참여자', '연동 서비스'] as const
const NAME_MAX = 50

/** 프로젝트 만들기 (디자인: 06 Screens · 추가 › 프로젝트 만들기 · 연동 서비스). 3단계 */
export function ProjectCreateModal({ onClose }: { onClose: () => void }) {
  const options = useCreateOptions()
  return (
    <Modal title="새 프로젝트" onClose={onClose} width={760} offsetX={10}>
      <Loadable resource={options} label="프로젝트 만들기">
        {(o) => <CreateForm o={o} onClose={onClose} />}
      </Loadable>
    </Modal>
  )
}

const emptyDraft = (o: CreateOptions): ProjectDraft => ({
  categoryCode: o.categories[0]?.code ?? 'DEV',
  name: '',
  projectKey: '',
  description: '',
  startsOn: '',
  endsOn: '',
  visibility: 'LAB',
  members: [],
  vault: true,
  jenkins: false,
  links: [],
})

function CreateForm({ o, onClose }: { o: CreateOptions; onClose: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [d, setD] = useState<ProjectDraft>(() => emptyDraft(o))
  const [keyTouched, setKeyTouched] = useState(false)
  const [keyCheck, setKeyCheck] = useState<KeyCheck | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ key: string; warnings: string[] } | null>(null)
  const set = (p: Partial<ProjectDraft>) => setD((x) => ({ ...x, ...p }))

  // 이름을 바꾸면 키를 제안한다 (사용자가 키를 손대기 전까지)
  const setName = (name: string) => set(keyTouched ? { name } : { name, projectKey: suggestKey(name) })

  // 키 확인 (형식은 바로, 쓴 적 있는지는 잠깐 쉬었다가 서버에)
  const formatOk = KEY_PATTERN.test(d.projectKey)
  useEffect(() => {
    const key = d.projectKey
    if (!KEY_PATTERN.test(key)) return
    const t = window.setTimeout(() => {
      whenLive(() => checkProjectKey(key))
        .then((r) => setKeyCheck(r ?? mockCheckKey(key)))
        .catch(() => setKeyCheck(null))
    }, 300)
    return () => window.clearTimeout(t)
  }, [d.projectKey])
  const currentCheck: KeyCheck | null = !d.projectKey
    ? null
    : !formatOk
      ? { projectKey: d.projectKey, available: false, reason: 'INVALID', movedTo: null }
      : keyCheck?.projectKey === d.projectKey
        ? keyCheck
        : null

  const periodBad = !!d.startsOn && !!d.endsOn && d.endsOn < d.startsOn
  const step1Ok = d.name.trim().length > 0 && currentCheck?.available === true && !periodBad
  const linksOk = d.links.every((l) => l.url.trim() && l.displayName.trim())

  const submit = () => {
    setSaving(true)
    setError(null)
    whenLive(() => createProject(d))
      .then((r) => {
        const key = r?.projectKey ?? d.projectKey
        // 프로젝트는 만들어졌고 연결 일부가 실패했으면 창에 남겨 알려 준다
        if (r && r.warnings.length) return setDone({ key, warnings: r.warnings })
        onClose()
        navigate(`/projects/${key}`)
      })
      .catch((e: unknown) => {
        setError(errText(e, '만들지 못했어요. 잠시 뒤 다시 해 주세요.'))
        // 키 문제면 첫 단계로
        if (e instanceof Error && /키/.test(e.message)) setStep(0)
      })
      .finally(() => setSaving(false))
  }

  if (done) {
    return (
      <div className={s.form}>
        <p className={s.notice}>
          <Check size={14} /> {done.key} 프로젝트를 만들었어요. 다만 아래 연결은 하지 못했어요 — 프로젝트 설정에서 다시 해 주세요.
        </p>
        <ul className={s.warnings}>
          {done.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div className={s.foot}>
          <span className={s.grow} />
          <Button
            icon={ChevronRight}
            onClick={() => {
              onClose()
              navigate(`/projects/${done.key}/settings`)
            }}
          >
            프로젝트 설정으로
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={s.form}>
      <ol className={s.steps}>
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? `${s.step} ${s.stepOn}` : i < step ? `${s.step} ${s.stepDone}` : s.step}>
            <span className={s.stepNo}>{i < step ? <Check size={12} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <BasicStep o={o} d={d} set={set} setName={setName} keyCheck={currentCheck} onKeyTouched={() => setKeyTouched(true)} periodBad={periodBad} />
      )}
      {step === 1 && <MembersStep o={o} d={d} set={set} />}
      {step === 2 && <ServicesStep d={d} set={set} />}

      {error && <p className={`${s.notice} ${s.error}`}>{error}</p>}

      <div className={s.foot}>
        <span className={s.footNote}>
          <Info size={14} /> 만든 사람은 프로젝트 관리자가 돼요
        </span>
        <span className={s.grow} />
        {step === 0 ? (
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
        ) : (
          <Button variant="secondary" icon={ChevronLeft} onClick={() => setStep(step - 1)} disabled={saving}>
            이전
          </Button>
        )}
        {step < 2 ? (
          <Button icon={ChevronRight} onClick={() => setStep(step + 1)} disabled={step === 0 && !step1Ok}>
            다음
          </Button>
        ) : (
          <Button icon={Check} onClick={submit} disabled={saving || !step1Ok || !linksOk}>
            {saving ? '만드는 중…' : '프로젝트 만들기'}
          </Button>
        )}
      </div>
    </div>
  )
}

type StepProps = { o: CreateOptions; d: ProjectDraft; set: (p: Partial<ProjectDraft>) => void }

function BasicStep({
  o,
  d,
  set,
  setName,
  keyCheck,
  onKeyTouched,
  periodBad,
}: StepProps & { setName: (name: string) => void; keyCheck: KeyCheck | null; onKeyTouched: () => void; periodBad: boolean }) {
  const keyHint =
    !d.projectKey || !keyCheck
      ? null
      : keyCheck.available
        ? { ok: true, text: '사용할 수 있어요' }
        : keyCheck.reason === 'INVALID'
          ? { ok: false, text: '형식이 맞지 않아요' }
          : { ok: false, text: '이미 쓰고 있거나 예전에 쓴 키예요' }
  return (
    <>
      <div className={s.field}>
        <span className={s.label}>
          종류 <em>*</em>
        </span>
        <div className={s.pills}>
          {o.categories.map((c) => (
            <button key={c.code} type="button" className={c.code === d.categoryCode ? `${s.pill} ${s.pillOn}` : s.pill} onClick={() => set({ categoryCode: c.code })}>
              {c.code === d.categoryCode && <Check size={14} />}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <label className={s.field}>
        <span className={s.label}>
          이름 <em>*</em>
        </span>
        <span className={s.input}>
          <input value={d.name} maxLength={NAME_MAX} placeholder="예: 연구실 비품 관리" onChange={(e) => setName(e.target.value)} />
          <small>
            {d.name.length} / {NAME_MAX}
          </small>
        </span>
      </label>

      <div className={s.grid}>
        <label className={s.field}>
          <span className={s.label}>
            키 <em>*</em>
          </span>
          <span className={s.input}>
            <input
              value={d.projectKey}
              maxLength={10}
              placeholder="LAB2"
              onChange={(e) => {
                onKeyTouched()
                set({ projectKey: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
              }}
            />
            {keyHint && <small className={keyHint.ok ? s.ok : s.bad}>{keyHint.ok ? <Check size={12} /> : <X size={12} />} {keyHint.text}</small>}
          </span>
          <span className={s.hint}>대문자 · 숫자 2~10자. 작업 번호({d.projectKey || 'KEY'}-12)와 주소에 쓰여요</span>
        </label>
        <div className={s.field}>
          <span className={s.label}>기간</span>
          <span className={s.period}>
            <span className={s.input}>
              <input type="date" value={d.startsOn} onChange={(e) => set({ startsOn: e.target.value })} aria-label="시작" />
            </span>
            <span className={s.dash}>–</span>
            <span className={s.input}>
              <input type="date" value={d.endsOn} onChange={(e) => set({ endsOn: e.target.value })} aria-label="끝" />
            </span>
          </span>
          <span className={periodBad ? `${s.hint} ${s.bad}` : s.hint}>{periodBad ? '끝 날이 시작보다 앞이에요' : '끝 날짜는 비워 둬도 돼요'}</span>
        </div>
      </div>

      <label className={s.field}>
        <span className={s.label}>설명</span>
        <textarea className={s.textarea} rows={3} value={d.description} placeholder="무엇을 하는 프로젝트인지" onChange={(e) => set({ description: e.target.value })} />
      </label>

      <div className={s.field}>
        <span className={s.label}>공개 범위</span>
        <div className={s.options}>
          <VisibilityCard on={d.visibility === 'LAB'} icon={<Users size={18} />} title="연구실 공개" desc="연구실 구성원 누구나 보고 읽을 수 있어요. 쓰기는 참여자만" onClick={() => set({ visibility: 'LAB' })} />
          <VisibilityCard on={d.visibility === 'PRIVATE'} icon={<Lock size={18} />} title="참여자만" desc="참여자가 아니면 목록에도 안 보여요" onClick={() => set({ visibility: 'PRIVATE' })} />
        </div>
      </div>
    </>
  )
}

function VisibilityCard({ on, icon, title, desc, onClick }: { on: boolean; icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" className={on ? `${s.option} ${s.optionOn}` : s.option} onClick={onClick} aria-pressed={on}>
      <span className={s.optionIcon}>{icon}</span>
      <span className={s.optionText}>
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
    </button>
  )
}

function MembersStep({ o, d, set }: StepProps) {
  const [q, setQ] = useState('')
  const picked = new Set(d.members.map((m) => m.memberId))
  const candidates = o.members.filter((m) => m.memberId !== o.meId && !picked.has(m.memberId) && (!q || m.name.includes(q))).slice(0, 8)
  const me = o.members.find((m) => m.memberId === o.meId)
  const add = (memberId: number) => set({ members: [...d.members, { memberId, role: 'MEMBER' }] })
  const remove = (memberId: number) => set({ members: d.members.filter((m) => m.memberId !== memberId) })
  const role = (memberId: number, r: 'MANAGER' | 'MEMBER') => set({ members: d.members.map((m) => (m.memberId === memberId ? { ...m, role: r } : m)) })
  const nameOf = (id: number) => o.members.find((m) => m.memberId === id)?.name ?? `구성원 ${id}`

  return (
    <>
      <div className={s.field}>
        <span className={s.label}>참여자</span>
        <ul className={s.memberList}>
          <li className={s.memberRow}>
            <Avatar name={me?.name ?? '나'} size={28} />
            <span className={s.memberName}>{me?.name ?? '나'} (나)</span>
            <span className={s.roleFixed}>프로젝트 관리자</span>
          </li>
          {d.members.map((m) => (
            <li key={m.memberId} className={s.memberRow}>
              <Avatar name={nameOf(m.memberId)} size={28} />
              <span className={s.memberName}>{nameOf(m.memberId)}</span>
              <select className={s.roleSelect} value={m.role} onChange={(e) => role(m.memberId, e.target.value as 'MANAGER' | 'MEMBER')} aria-label="역할">
                <option value="MEMBER">참여자</option>
                <option value="MANAGER">프로젝트 관리자</option>
              </select>
              <button type="button" className={s.iconBtn} onClick={() => remove(m.memberId)} aria-label={`${nameOf(m.memberId)} 빼기`}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <label className={s.field}>
        <span className={s.label}>구성원 더하기</span>
        <span className={s.input}>
          <input value={q} placeholder="이름으로 찾기" onChange={(e) => setQ(e.target.value)} />
        </span>
      </label>
      <div className={s.candidates}>
        {candidates.map((m) => (
          <button key={m.memberId} type="button" className={s.candidate} onClick={() => add(m.memberId)}>
            <Plus size={14} /> {m.name}
          </button>
        ))}
        {candidates.length === 0 && <span className={s.hint}>더할 수 있는 재실 구성원이 없어요</span>}
      </div>
      <p className={s.hint}>참여자는 나중에 프로젝트 설정 › 참여자에서도 바꿀 수 있어요.</p>
    </>
  )
}

const LINK_SERVICES: { service: LinkDraft['service']; name: string; placeholder: string }[] = [
  { service: 'GITHUB', name: 'GitHub', placeholder: 'https://github.com/Hoseo-I-Turtle/저장소' },
  { service: 'JENKINS', name: 'Jenkins', placeholder: 'https://lab.iturtle.win/jenkins/job/…' },
  { service: 'PENPOT', name: 'Penpot', placeholder: 'https://penpot.iturtle.win/#/workspace?…' },
]

function ServicesStep({ d, set }: Pick<StepProps, 'd' | 'set'>) {
  const linksOf = (svc: LinkDraft['service']) => d.links.filter((l) => l.service === svc)
  const updateLink = (i: number, p: Partial<LinkDraft>) => set({ links: d.links.map((l, j) => (j === i ? { ...l, ...p } : l)) })
  const addLink = (svc: LinkDraft['service'], name: string) => set({ links: [...d.links, { service: svc, url: '', displayName: name }] })
  const removeLink = (i: number) => set({ links: d.links.filter((_, j) => j !== i) })
  const hasJenkins = linksOf('JENKINS').length > 0

  return (
    <>
      <div className={s.svcRow}>
        <span className={s.optionIcon}>
          <ServiceIcon code="VAULT" size={18} />
        </span>
        <span className={s.optionText}>
          <strong>Vault 권한</strong>
          <small>비밀값 경로 secret/projects/{(d.projectKey || 'key').toLowerCase()}/ 를 만들고 참여자에게 권한을 줘요</small>
        </span>
        <Switch checked={d.vault} onChange={(v) => set({ vault: v })} label="Vault 권한" />
      </div>

      {LINK_SERVICES.map((svc) => (
        <div key={svc.service} className={s.svcBlock}>
          <div className={s.svcRow}>
            <span className={s.optionIcon}>
              <ServiceIcon code={svc.service as ServiceCode} size={18} />
            </span>
            <span className={s.optionText}>
              <strong>{svc.name}</strong>
              <small>
                {svc.service === 'GITHUB' && '연구실 조직의 저장소를 이어요. 커밋 · PR 이 프로젝트에 모여요'}
                {svc.service === 'JENKINS' && '빌드 작업을 이으면 최근 빌드가 보이고, 권한을 켜면 참여자가 빌드할 수 있어요'}
                {svc.service === 'PENPOT' && '디자인 파일이나 팀 프로젝트 주소를 이어요'}
              </small>
            </span>
            <Button variant="secondary" icon={Plus} onClick={() => addLink(svc.service, svc.name)}>
              잇기
            </Button>
          </div>
          {d.links.map((l, i) =>
            l.service !== svc.service ? null : (
              <div key={i} className={s.linkRow}>
                <span className={s.input}>
                  <input value={l.url} placeholder={svc.placeholder} onChange={(e) => updateLink(i, { url: e.target.value })} aria-label={`${svc.name} 주소`} />
                </span>
                <span className={`${s.input} ${s.linkName}`}>
                  <input value={l.displayName} maxLength={50} onChange={(e) => updateLink(i, { displayName: e.target.value })} aria-label="표시 이름" />
                </span>
                <button type="button" className={s.iconBtn} onClick={() => removeLink(i)} aria-label="빼기">
                  <X size={16} />
                </button>
              </div>
            ),
          )}
          {svc.service === 'JENKINS' && hasJenkins && (
            <div className={s.subRow}>
              <Switch checked={d.jenkins} onChange={(v) => set({ jenkins: v })} label="Jenkins 권한" />
              <span className={s.hint}>참여자에게 이 작업의 빌드 권한 주기</span>
            </div>
          )}
        </div>
      ))}

      <p className={`${s.notice}`}>
        <Info size={14} /> 만들면 바로 서비스 계정 · 권한을 맞춰요. 연결은 나중에 프로젝트 설정에서도 바꿀 수 있어요.
      </p>
    </>
  )
}
