import { AlertTriangle, Check, ChevronRight, GitCommitHorizontal, LayoutGrid, Lock } from 'lucide-react'
import { Card, Empty, SectionHead } from '../../../components/ui'
import type { HomeService } from '../../../api/projects'
import type { ServiceCode } from '../../../mocks/projects'
import { ServiceIcon } from '../common'
import s from './LinkedServices.module.css'

/** 화면에 보이는 서비스 순서 */
const ORDER: ServiceCode[] = ['GITHUB', 'JENKINS', 'PENPOT', 'VAULT']

type Group = { code: ServiceCode; name: string; myPerm: string | null; items: HomeService[] }

/** 같은 서비스(저장소 둘, 젠킨스 작업 둘 …)는 한 칸에 모은다 */
function groupByService(services: HomeService[]): Group[] {
  const groups = new Map<ServiceCode, Group>()
  for (const sv of services) {
    const g = groups.get(sv.code) ?? { code: sv.code, name: sv.name, myPerm: sv.myPerm, items: [] }
    g.items.push(sv)
    groups.set(sv.code, g)
  }
  return [...groups.values()].sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code))
}

/** 프로젝트 홈 · 연동 서비스: 서비스마다 칸 하나, 대상(저장소 · 작업 · 파일 · 경로)마다 누르면 새 탭으로 열리는 줄 하나 */
export function LinkedServices({ services, manageTo }: { services: HomeService[]; manageTo: string }) {
  const groups = groupByService(services)
  return (
    <Card>
      <SectionHead icon={LayoutGrid} title="연동 서비스" link={{ to: manageTo, label: '관리' }} />
      {groups.length === 0 && <Empty>연결한 서비스가 없어요.</Empty>}
      {groups.map((g) => (
        <section key={g.code} className={s.group} aria-label={g.name}>
          <header className={s.head}>
            <span className={s.badge}>
              <ServiceIcon code={g.code} size={16} />
            </span>
            <strong className={s.name}>{g.name}</strong>
            <span className={s.count}>{g.items.length}</span>
            {g.myPerm && <span className={s.perm}>{g.myPerm}</span>}
          </header>
          {g.items.map((sv, i) => (
            <ServiceRow key={`${sv.target}-${i}`} sv={sv} />
          ))}
        </section>
      ))}
    </Card>
  )
}

function ServiceRow({ sv }: { sv: HomeService }) {
  const tone = sv.status.ok === true ? s.ok : sv.status.ok === false ? s.fail : ''
  const body = (
    <>
      <span className={s.text}>
        <span className={s.target}>{sv.target}</span>
        {sv.status.text && (
          <span className={`${s.status} ${tone}`}>
            <StatusIcon sv={sv} />
            {sv.status.text}
          </span>
        )}
      </span>
      {sv.url && <ChevronRight size={16} className={s.chev} aria-hidden />}
    </>
  )
  // 주소가 있으면 줄 전체가 그 서비스로 가는 링크, 없으면 그냥 줄
  return sv.url ? (
    <a className={`${s.row} ${s.link}`} href={sv.url} target="_blank" rel="noopener noreferrer" title={`${sv.name} 열기`}>
      {body}
    </a>
  ) : (
    <div className={s.row}>{body}</div>
  )
}

function StatusIcon({ sv }: { sv: HomeService }) {
  if (sv.status.ok === true) return <Check size={13} />
  if (sv.status.ok === false) return <AlertTriangle size={13} />
  if (sv.code === 'VAULT') return <Lock size={13} />
  if (sv.code === 'GITHUB') return <GitCommitHorizontal size={13} />
  return null
}
