import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, GitBranch, Info, Kanban, Lock, Mail, User } from 'lucide-react'
import { Avatar, Card, Chip, Columns, Empty, ListItem, Loadable, Note, Segmented, SectionHead } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { MEMBER_TYPE_NAME, type Member, type MemberType } from '../../mocks/members'
import { useMemberDirectory, useMemberExtras, type MemberDirectory } from '../../api/members'
import s from './MembersPage.module.css'

type Status = 'ACTIVE' | 'GRADUATED'
type TypeFilter = 'ALL' | MemberType
const TYPE_ORDER: MemberType[] = ['PROFESSOR', 'STUDENT', 'INTERN']
const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  ...TYPE_ORDER.map((t) => ({ value: t as TypeFilter, label: MEMBER_TYPE_NAME[t] })),
]

export function MembersPage() {
  const dir = useMemberDirectory()
  // 통합 검색 결과에서 오면 /members?member=3 — 그 사람을 골라 둔다
  const [params] = useSearchParams()
  const linked = Number(params.get('member')) || null
  return (
    <>
      <PageHeader title="구성원" subtitle="함께하는 사람들과 졸업생" action={null} />
      <Loadable resource={dir} label="구성원 목록">
        {(d) => <MembersView key={linked ?? 'me'} dir={d} linkedId={linked} />}
      </Loadable>
    </>
  )
}

function MembersView({ dir, linkedId }: { dir: MemberDirectory; linkedId: number | null }) {
  const { members } = dir
  const linked = members.find((m) => m.memberId === linkedId)
  const [status, setStatus] = useState<Status>(linked?.status === 'GRADUATED' ? 'GRADUATED' : 'ACTIVE')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [selectedId, setSelectedId] = useState(linked?.memberId ?? dir.meId)

  const shown = members.filter((m) => m.status === status && (type === 'ALL' || m.memberType === type))
  const base = members.find((m) => m.memberId === selectedId) ?? members[0]
  // 참여 프로젝트 · GitHub 는 고른 사람마다 따로 불러온다
  const extras = useMemberExtras(base)
  const selected: Member = { ...base, ...(extras.data ?? {}) }

  if (!base) return <Empty>구성원이 없어요.</Empty>

  return (
    <>
      <Columns
        sideWidth={320}
        main={
          <Card className={s.members}>
            <div className={s.top}>
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ACTIVE', label: `재실 ${dir.activeCount}` },
                  { value: 'GRADUATED', label: `졸업생 ${dir.alumniCount}` },
                ]}
              />
              <div className={s.typeChips}>
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={f.value === type ? `${s.typeChip} ${s.typeChipOn}` : s.typeChip}
                    onClick={() => setType(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 && <Empty>해당하는 구성원이 없어요.</Empty>}
            {TYPE_ORDER.map((t) => {
              const group = shown.filter((m) => m.memberType === t)
              if (group.length === 0) return null
              return (
                <section key={t} className={s.group}>
                  <h2 className={s.groupTitle}>
                    {MEMBER_TYPE_NAME[t]} <span>{group.length}</span>
                  </h2>
                  <div className={s.grid}>
                    {group.map((m) => (
                      <MemberCard
                        key={m.memberId}
                        m={m}
                        selected={m.memberId === selectedId}
                        onClick={() => setSelectedId(m.memberId)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </Card>
        }
        side={
          <>
            <Card className={s.profile}>
              <Avatar name={selected.name} src={selected.photoUrl} size={80} />
              <h2 className={s.profileName}>{selected.name}</h2>
              <div className={s.profileChips}>
                <Chip tone="tint">{MEMBER_TYPE_NAME[selected.memberType]}</Chip>
                {selected.status === 'ACTIVE' ? (
                  <Chip className={s.chipActive}>재실</Chip>
                ) : (
                  <Chip tone="muted">졸업</Chip>
                )}
              </div>
              <p className={s.profileIntro}>{selected.intro}</p>
              <dl className={s.profileKv}>
                <Row icon={User} k="구성원 번호" v={selected.memberNo} />
                <Row icon={Mail} k="이메일" v={selected.email ?? '—'} />
                <Row
                  icon={Lock}
                  k="연락처"
                  v={
                    selected.phonePublic && selected.phone ? (
                      selected.phone
                    ) : (
                      <span className={s.hidden}>
                        비공개 <Lock size={14} />
                      </span>
                    )
                  }
                />
                <Row icon={Calendar} k="입실일" v={selected.joinedAt} />
                {selected.graduatedAt && <Row icon={Calendar} k="졸업일" v={selected.graduatedAt} />}
                <Row icon={GitBranch} k="GitHub" v={selected.githubLogin ? `@${selected.githubLogin} 연결됨` : '연결 안 됨'} />
              </dl>
            </Card>

            <Card>
              <SectionHead icon={Kanban} title="참여 중인 프로젝트" />
              {selected.projects.length === 0 && <Empty>참여 중인 프로젝트가 없어요.</Empty>}
              {selected.projects.map((p) => (
                <ListItem key={p.name} title={p.name} meta={p.role} trailing={<Chip tone="tint">{p.category}</Chip>} />
              ))}
            </Card>

            {!selected.phonePublic && (
              <Note icon={Info}>연락처는 본인이 비공개로 했어요. contact-view 역할이 있으면 볼 수 있어요.</Note>
            )}
          </>
        }
      />
    </>
  )
}

function MemberCard({ m, selected, onClick }: { m: Member; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={selected ? `${s.card} ${s.cardOn}` : s.card} onClick={onClick}>
      <span className={s.cardTop}>
        <Avatar name={m.name} src={m.photoUrl} size={44} />
        <span className={s.cardName}>
          <strong>{m.name}</strong>
          <span className={s.typeBadge}>{MEMBER_TYPE_NAME[m.memberType]}</span>
        </span>
      </span>
      <span className={s.cardIntro}>{m.intro}</span>
      <span className={s.cardMeta}>{m.graduatedAt ? `졸업 ${m.graduatedAt.slice(0, 7)}` : `입실 ${m.joinedAt.slice(0, 7)}`}</span>
    </button>
  )
}

function Row({ icon: Icon, k, v }: { icon: typeof User; k: string; v: ReactNode }) {
  return (
    <div className={s.kvRow}>
      <dt>
        <Icon size={16} />
        {k}
      </dt>
      <dd>{v}</dd>
    </div>
  )
}
