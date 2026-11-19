import { ClipboardList, Clock } from 'lucide-react'
import { Avatar, Card, ListItem, SectionHead } from '../../../components/ui'
import type { MinuteList, MinuteView } from '../../../api/content'
import s from '../MinutesPage.module.css'

/** 수정 이력 */
export function HistoryCard({ history }: { history: MinuteView['history'] }) {
  return (
    <Card>
      <SectionHead icon={Clock} title="수정 이력" />
      {history.map((h) => (
        <ListItem
          key={h.who + h.ago + h.what}
          plain
          leading={<Avatar name={h.who} size={26} />}
          title={<small className={s.histWho}>{h.who}</small>}
          meta={`${h.ago} · ${h.what}`}
          // TODO: 이전 버전 보기 (MM-7 GET /meeting-minutes/{id}/revisions/{version}) — 보여 줄 화면이 아직 없다
          trailing={<button type="button" className={s.view}>보기</button>}
        />
      ))}
    </Card>
  )
}

type OthersProps = {
  projectKey: string
  others: MinuteList['others']
  onOpen: (id: number) => void
}

/** 다른 회의록 */
export function OtherMinutesCard({ projectKey, others, onOpen }: OthersProps) {
  return (
    <Card>
      <SectionHead icon={ClipboardList} title="다른 회의록" link={{ to: `/projects/${projectKey}/minutes`, label: '전체' }} />
      {others.map((o, i) => (
        <ListItem key={`${o.id}-${i}`} plain onClick={o.id ? () => onOpen(o.id) : undefined} title={o.title} meta={o.meta} />
      ))}
    </Card>
  )
}
