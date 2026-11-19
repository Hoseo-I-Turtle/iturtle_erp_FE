import { useParams } from 'react-router-dom'
import { Calendar, Check, Clock, FlaskConical, GitCommitHorizontal, LayoutGrid, ListChecks, Lock, Shield, Users } from 'lucide-react'
import { Avatar, Card, Chip, Columns, Empty, ListItem, Loadable, Progress, SectionHead } from '../../components/ui'
import { useProjectHome, type ProjectHome } from '../../api/projects'
import { ServiceIcon, StatusChip } from './common'
import s from './ProjectHomePage.module.css'

export function ProjectHomePage() {
  const { key } = useParams()
  const home = useProjectHome(key)
  return (
    <Loadable resource={home} label="프로젝트 홈">
      {(d) => <ProjectHomeView d={d} />}
    </Loadable>
  )
}

function ProjectHomeView({ d }: { d: ProjectHome }) {
  const p = d.project
  const base = `/projects/${p.projectKey}`

  return (
    <Columns
      main={
        <>
          <Card className={s.overview}>
            <p className={s.desc}>{d.description}</p>
            <div className={s.chips}>
              <StatusChip status={p.status} />
              <Chip tone="tint" icon={Calendar}>
                {d.period}
              </Chip>
              <Chip tone="tint" icon={ListChecks}>
                작업 {d.taskTotal} · 완료 {d.taskDone}
              </Chip>
              <Chip tone="tint" icon={Users}>
                참여자 {d.members.length}
              </Chip>
            </div>
            <ul className={s.members}>
              {d.members.map((m) => (
                <li key={m.name}>
                  <Avatar name={m.name} size={28} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>
                      {m.role === 'MANAGER' ? '프로젝트 관리자' : '참여자'}
                      {m.note && ` · ${m.note}`}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead icon={FlaskConical} title="마일스톤" link={{ to: `${base}/milestones`, label: '전체' }} />
            {d.milestones.length === 0 && <Empty>마일스톤이 없어요.</Empty>}
            {d.milestones.map((m) => {
              const pct = m.total ? Math.round((m.done / m.total) * 100) : 0
              return (
                <div key={m.id} className={s.ms}>
                  <div className={s.msTop}>
                    <span className={s.msName}>{m.name}</span>
                    <span className={s.msCount}>
                      완료 {m.done} / {m.total}
                    </span>
                    {m.soon ? (
                      <Chip tone="warning" icon={Clock}>
                        {m.due}
                      </Chip>
                    ) : (
                      <span className={s.msDue}>
                        <Clock size={14} />
                        {m.due}
                        {m.closed && ' 닫힘'}
                      </span>
                    )}
                  </div>
                  <Progress value={pct} height={6} />
                </div>
              )
            })}
          </Card>

          <Card>
            <SectionHead icon={Clock} title="최근 활동" />
            {d.activity.length === 0 && <Empty>아직 활동이 없어요.</Empty>}
            <ul className={s.activity}>
              {d.activity.map((a, i) => (
                <li key={i}>
                  <Avatar name={a.who} size={26} />
                  <span className={s.actText}>
                    {a.who} {a.text}
                  </span>
                  <span className={s.actAgo}>{a.ago}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      }
      side={
        <>
          <Card>
            <SectionHead icon={LayoutGrid} title="연동 서비스" link={{ to: `${base}/settings`, label: '관리' }} />
            {d.services.length === 0 && <Empty>연결한 서비스가 없어요.</Empty>}
            {d.services.map((sv, i) => {
              // 카드 자체가 그 서비스로 가는 버튼이다 (주소가 없으면 그냥 카드)
              const Tag = sv.url ? 'a' : 'div'
              return (
                <Tag
                  key={`${sv.code}-${i}`}
                  className={sv.url ? `${s.svc} ${s.svcLink}` : s.svc}
                  {...(sv.url ? { href: sv.url, target: '_blank', rel: 'noopener noreferrer', title: `${sv.name} 열기` } : {})}
                >
                  <div className={s.svcTop}>
                    <ServiceIcon code={sv.code} size={20} />
                    <span className={s.svcText}>
                      <strong>{sv.name}</strong>
                      <small>{sv.target}</small>
                    </span>
                  </div>
                  <div className={s.svcBottom}>
                    <span className={sv.status.ok ? `${s.svcStatus} ${s.svcOk}` : s.svcStatus}>
                      {sv.status.ok && <Check size={14} />}
                      {sv.code === 'VAULT' && <Lock size={14} />}
                      {sv.code === 'GITHUB' && <GitCommitHorizontal size={14} />}
                      {sv.status.text}
                    </span>
                    {sv.myPerm && <span className={s.svcPerm}>{sv.myPerm}</span>}
                  </div>
                </Tag>
              )
            })}
          </Card>

          <Card>
            <SectionHead icon={Shield} title="프로젝트 서비스 권한" link={{ to: `${base}/settings`, label: '설정' }} />
            <ul className={s.perms}>
              {d.permissions.map((r) => (
                <li key={r.who}>
                  <span>{r.who}</span>
                  <Chip tone={r.vault === 'Vault 없음' ? 'tint' : 'brand'}>{r.vault}</Chip>
                  <Chip tone={r.jenkins.includes('빌드') ? 'brand' : 'tint'}>{r.jenkins}</Chip>
                </li>
              ))}
            </ul>
            <p className={s.permNote}>
              바꾸면 다음 로그인부터 반영돼요. 회수는 Vault 토큰(최대 8시간)이 끝나야 적용돼요.
            </p>
          </Card>

          <Card>
            <SectionHead icon={Calendar} title="다가오는 일정 · 기한" />
            {d.upcoming.length === 0 && <Empty>30일 안에 일정 · 기한이 없어요.</Empty>}
            {d.upcoming.map((u, i) => (
              <ListItem
                key={`${u.title}-${i}`}
                plain
                leading={<i className={s.dot} style={{ background: u.color }} />}
                title={u.title}
                trailing={<span className={s.when}>{u.when}</span>}
              />
            ))}
          </Card>
        </>
      }
    />
  )
}
