import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Info, Kanban, Shield, X } from 'lucide-react'
import { Button, Card, Chip, Columns, Empty, Field, FormError, FormRow, Loadable, Note, OptionCard, SectionHead, Segmented, Select, SmallButton, TextArea, TextInput, ToggleChip } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { cancelAccessRequest, createAccessRequest, levelName, useAccessRequests, useMyAccess, type AccessRequestDraft, type MyAccess } from '../../api/accessRequests'
import { addDaysYmd } from '../../api/communication'
import { errorText } from '../../api/content'
import { MOCK_ME, todayKst } from '../../api/projects'
import { getDataMode } from '../../lib/dataMode'
import type { AccessRequestView } from '../../mocks/projectSettings'
import { REQUEST_TEXT, REQUEST_TONE } from '../projects/settings/requestTones'
import s from './AccessRequestPage.module.css'

const LEVELS = {
  VAULT: [
    { level: 'READ', desc: '비밀값 보기' },
    { level: 'WRITE', desc: '비밀값 보기 · 바꾸기' },
  ],
  JENKINS: [
    { level: 'READ', desc: '빌드 결과 보기' },
    { level: 'BUILD', desc: '빌드 실행 · 설정 고치기' },
  ],
}
const RANK: Record<string, number> = { NONE: 0, READ: 1, WRITE: 2, BUILD: 2 }
const EMPTY: MyAccess = { labRoles: [], requestableRoles: [], projects: [] }

/** 권한 신청하기 (Penpot 06 · 권한 신청하기) — 7-1, 7-2, 7-3(MINE), 7-4 */
export function AccessRequestPage() {
  const isLive = getDataMode() === 'live'
  const [params] = useSearchParams()
  const access = useMyAccess()
  const mine = useAccessRequests('MINE')
  const data = access.data ?? EMPTY
  const today = todayKst()

  // 프로젝트 카드의 "권한 신청"에서 오면 ?project=SENS&service=VAULT 로 채워 온다
  const [f, setF] = useState<AccessRequestDraft>({
    targetKind: 'PROJECT_SERVICE',
    projectKey: params.get('project') ?? '',
    service: params.get('service') === 'JENKINS' ? 'JENKINS' : 'VAULT',
    level: '',
    roleCode: '',
    reason: '',
    expiresOn: '',
  })
  const [tab, setTab] = useState<'PENDING' | 'DONE'>('PENDING')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const set = <K extends keyof AccessRequestDraft>(k: K, v: AccessRequestDraft[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setSent(false)
  }

  const project = data.projects.find((p) => p.projectKey === f.projectKey) ?? data.projects[0]
  const current = project ? (f.service === 'VAULT' ? project.vault : project.jenkins) : null
  const options = LEVELS[f.service].map((l) => ({ ...l, state: !current ? 'off' : current.level === l.level ? 'current' : RANK[l.level] > RANK[current.level] ? 'ok' : 'lower' }))
  const level = options.some((o) => o.level === f.level && o.state === 'ok') ? f.level : (options.find((o) => o.state === 'ok')?.level ?? '')

  const submit = async () => {
    const project_ = f.targetKind === 'PROJECT_SERVICE'
    if (project_ && !project) return setError('참여 중인 프로젝트가 없어요.')
    if (project_ && !current) return setError('이 프로젝트는 그 서비스 권한을 켜지 않았어요.')
    if (project_ && !level) return setError('이미 가장 높은 수준이에요.')
    if (!project_ && !f.roleCode) return setError('신청할 역할을 골라 주세요.')
    if (f.reason.trim().length < 10) return setError('사유를 10자 이상 적어 주세요.')
    setBusy(true)
    setError(null)
    try {
      const role = data.requestableRoles.find((r) => r.code === f.roleCode)
      await createAccessRequest({ ...f, projectKey: project?.projectKey ?? '', level, reason: f.reason.trim() }, isLive, {
        target: project_ ? (f.service === 'VAULT' ? 'Vault' : 'Jenkins') : (role?.name ?? f.roleCode),
        project: project_ ? (project?.name ?? null) : null,
        current: project_ ? levelName(current?.level) : null,
        approver: project_ ? `${project?.projectKey} 프로젝트 관리자` : 'role-manage',
        me: MOCK_ME,
      })
      setF((p) => ({ ...p, reason: '', expiresOn: '' }))
      setSent(true)
      setTab('PENDING')
    } catch (e) {
      setError(errorText(e, '신청을 보내지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (r: AccessRequestView) => {
    setError(null)
    try {
      await cancelAccessRequest(r, isLive)
    } catch (e) {
      setError(errorText(e, '취소하지 못했어요.'))
    }
  }

  const access_ = (v: MyAccess['projects'][number]['vault']) =>
    v ? (
      <span className={s.level}>
        <Chip tone={v.level === 'NONE' ? 'gray' : 'brand'}>{levelName(v.level)}</Chip>
        {v.until && <small>{v.until}</small>}
      </span>
    ) : (
      <span className={s.off}>꺼짐</span>
    )

  return (
    <>
      <PageHeader title="권한 신청" subtitle="연동 서비스 권한을 올리거나 연구실 역할을 신청해요" action={null} />
      <Columns
        sideWidth={520}
        main={
          <Card className={s.card}>
            <div className={s.head}>
              <h2>새 신청</h2>
              <p>승인되면 다음 로그인부터 반영돼요</p>
            </div>
            <Field label="무엇을 신청하나요" required>
              <div className={s.kinds}>
                <OptionCard on={f.targetKind === 'PROJECT_SERVICE'} icon={Kanban} title="프로젝트 서비스 권한" desc="참여 중인 프로젝트의 Vault · Jenkins 수준" onClick={() => set('targetKind', 'PROJECT_SERVICE')} />
                <OptionCard on={f.targetKind === 'LAB_ROLE'} icon={Shield} title="연구실 역할" desc="신청할 수 있는 역할만 보여요" onClick={() => set('targetKind', 'LAB_ROLE')} />
              </div>
            </Field>

            {f.targetKind === 'PROJECT_SERVICE' ? (
              <>
                <FormRow>
                  <Field label="프로젝트" required className={s.grow}>
                    <Select
                      block
                      value={project?.projectKey ?? ''}
                      options={data.projects.length ? data.projects.map((p) => ({ value: p.projectKey, label: `${p.projectKey} · ${p.name}` })) : [{ value: '', label: '참여 중인 프로젝트가 없어요' }]}
                      onChange={(v) => set('projectKey', v)}
                      label="프로젝트"
                    />
                  </Field>
                  <Field label="서비스" required>
                    <Segmented
                      value={f.service}
                      options={[
                        { value: 'VAULT', label: 'Vault' },
                        { value: 'JENKINS', label: 'Jenkins' },
                      ]}
                      onChange={(v) => set('service', v)}
                    />
                  </Field>
                </FormRow>
                <Field label="수준" required hint="지금보다 높은 수준만 고를 수 있어요" help={current ? undefined : '이 프로젝트는 이 서비스 권한을 켜지 않았어요. 프로젝트 관리자에게 먼저 켜 달라고 해 주세요'}>
                  <div className={s.kinds}>
                    {options.map((o) => (
                      <OptionCard
                        key={o.level}
                        on={level === o.level}
                        disabled={o.state !== 'ok'}
                        title={levelName(o.level)}
                        badge={o.state === 'current' ? <Chip tone="gray">지금</Chip> : level === o.level ? <Chip tone="muted">신청</Chip> : null}
                        desc={o.desc}
                        onClick={() => set('level', o.level)}
                      />
                    ))}
                  </div>
                </Field>
              </>
            ) : (
              <Field label="역할" required help={data.requestableRoles.length ? '관리 역할(구성원 · 역할 관리 등)은 신청할 수 없어요' : '지금 신청할 수 있는 역할이 없어요'}>
                <div className={s.pills}>
                  {data.requestableRoles.map((r) => (
                    <ToggleChip key={r.code} on={f.roleCode === r.code} check onClick={() => set('roleCode', r.code)}>
                      {r.name} ({r.code})
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            )}

            <Field label="사유" required hint="10~1,000자">
              <TextArea value={f.reason} onChange={(v) => set('reason', v.slice(0, 1000))} rows={3} placeholder="왜 필요한지 적어 주세요" />
            </Field>
            <Field label="사용 기한" hint="비우면 기한 없이 신청해요" help={f.expiresOn ? '끝나기 3일 전에 알림이 가요' : undefined}>
              <div className={s.pills}>
                <ToggleChip on={f.expiresOn === addDaysYmd(today, 7)} onClick={() => set('expiresOn', addDaysYmd(today, 7))}>
                  1주
                </ToggleChip>
                <ToggleChip on={f.expiresOn === addDaysYmd(today, 30)} onClick={() => set('expiresOn', addDaysYmd(today, 30))}>
                  1개월
                </ToggleChip>
                <ToggleChip on={!f.expiresOn} onClick={() => set('expiresOn', '')}>
                  기한 없음
                </ToggleChip>
                <span className={s.date}>
                  <TextInput type="date" value={f.expiresOn} min={addDaysYmd(today, 1)} onChange={(v) => set('expiresOn', v)} aria-label="사용 기한" />
                </span>
              </div>
            </Field>

            <Note icon={Info}>
              승인하는 사람: {f.targetKind === 'PROJECT_SERVICE' ? `${project?.projectKey ?? ''} 프로젝트 관리자` : 'role-manage 역할'}. 같은 대상으로 대기 중인 신청이 있으면 새로 낼 수 없어요.
            </Note>
            <FormError>{error}</FormError>
            <div className={s.foot}>
              <span>{sent ? '신청을 보냈어요. 오른쪽 "내 신청"에서 볼 수 있어요' : ''}</span>
              <Button icon={Check} onClick={submit} disabled={busy}>
                {busy ? '보내는 중…' : '신청 보내기'}
              </Button>
            </div>
          </Card>
        }
        side={
          <>
            <Card>
              <SectionHead title="지금 내 권한" />
              <Loadable resource={access} label="내 권한">
                {(a) => (
                  <>
                    {a.projects.length === 0 ? (
                      <Empty>참여 중인 프로젝트가 없어요.</Empty>
                    ) : (
                      <div className={s.table}>
                        <div className={`${s.row} ${s.thead}`}>
                          <span>프로젝트</span>
                          <span>Vault</span>
                          <span>Jenkins</span>
                        </div>
                        {a.projects.map((p) => (
                          <button key={p.projectKey} type="button" className={project?.projectKey === p.projectKey ? `${s.row} ${s.rowOn}` : s.row} onClick={() => set('projectKey', p.projectKey)}>
                            <span className={s.proj}>
                              <b>{p.projectKey}</b>
                              <small>{p.role}</small>
                            </span>
                            {access_(p.vault)}
                            {access_(p.jenkins)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={s.roles}>
                      <small>연구실 역할</small>
                      {a.labRoles.map((r) => (
                        <Chip key={r} tone="plain" className={s.soft}>
                          {r}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}
              </Loadable>
            </Card>
            <Card>
              <div className={s.sideHead}>
                <strong>내 신청</strong>
                <Loadable resource={mine} label="내 신청">
                  {(m) => (
                    <Segmented
                      value={tab}
                      options={[
                        { value: 'PENDING', label: `대기 ${m.counts.PENDING}` },
                        { value: 'DONE', label: `끝난 것 ${m.items.length - m.counts.PENDING}` },
                      ]}
                      onChange={setTab}
                    />
                  )}
                </Loadable>
              </div>
              {(mine.data?.items ?? [])
                .filter((r) => (tab === 'PENDING') === (r.status === 'PENDING'))
                .map((r) => (
                  <div key={r.requestId} className={s.req}>
                    <div className={s.reqHead}>
                      <Chip tone="plain">{r.project ? `${r.project} · ${r.target}` : r.target}</Chip>
                      {r.currentLevel && r.level && (
                        <>
                          <small>{r.currentLevel}</small>
                          <ChevronRight size={12} />
                          <b>{r.level}</b>
                        </>
                      )}
                      <Chip tone={REQUEST_TONE[r.status]} className={s.status}>
                        {REQUEST_TEXT[r.status]}
                      </Chip>
                    </div>
                    <p>{r.reason}</p>
                    <div className={s.reqFoot}>
                      <small className={r.status === 'REJECTED' ? s.rejected : undefined}>
                        {r.status === 'PENDING' ? `${r.ago} 신청 · 승인: ${r.approverLabel}` : r.status === 'REJECTED' ? `거절 사유: ${r.note}` : [r.note, r.reviewer && `처리 ${r.reviewer}`].filter(Boolean).join(' · ')}
                      </small>
                      {r.status === 'PENDING' && (
                        <SmallButton icon={X} onClick={() => cancel(r)}>
                          신청 취소
                        </SmallButton>
                      )}
                    </div>
                  </div>
                ))}
              {mine.data && mine.data.items.filter((r) => (tab === 'PENDING') === (r.status === 'PENDING')).length === 0 && <Empty>{tab === 'PENDING' ? '기다리는 신청이 없어요.' : '끝난 신청이 없어요.'}</Empty>}
            </Card>
          </>
        }
      />
    </>
  )
}
