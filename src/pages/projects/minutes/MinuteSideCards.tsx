import { ClipboardList, Clock, TriangleAlert } from 'lucide-react'
import { Avatar, Card, ListItem, SectionHead } from '../../../components/ui'
import type { MinuteConflict, MinuteList, MinuteView } from '../../../api/content'
import s from '../MinutesPage.module.css'

/** 다른 사람이 먼저 저장했을 때 (409) */
export function ConflictAlert({ conflict }: { conflict: MinuteConflict }) {
  return (
    <div className={s.conflict} role="alert">
      <TriangleAlert size={18} />
      <div>
        <strong>다른 사람이 먼저 저장했어요</strong>
        <p>
          {conflict.who} · {conflict.ago}. 내 수정은 덮어쓰지 않았어요. 새 내용을 보고 다시 고쳐 주세요.
        </p>
      </div>
    </div>
  )
}

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
  latest: NonNullable<MinuteList['latest']>
  isLatest: boolean
  onOpen: (id: number) => void
}

/** 다른 회의록 · 최근 회의록으로 돌아가기 */
export function OtherMinutesCard({ projectKey, others, latest, isLatest, onOpen }: OthersProps) {
  return (
    <Card>
      <SectionHead icon={ClipboardList} title="다른 회의록" link={{ to: `/projects/${projectKey}/minutes`, label: '전체' }} />
      {others.map((o) => (
        <ListItem
          key={o.title}
          plain
          onClick={o.id ? () => onOpen(o.id) : undefined}
          title={o.title}
          meta={o.meta}
        />
      ))}
      {!isLatest && <ListItem plain onClick={() => onOpen(latest.id)} title={latest.title} meta="최근 회의록으로 돌아가기" />}
    </Card>
  )
}
