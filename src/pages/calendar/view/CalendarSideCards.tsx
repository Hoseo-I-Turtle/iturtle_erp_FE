import { Calendar, CalendarPlus, ClipboardList, LayoutGrid } from 'lucide-react'
import { openEventEditor } from '../../../api/calendarEvents'
import { Button, Card, Checkbox, SectionHead } from '../../../components/ui'
import { formatLongDay, ymd } from '../../../lib/date'
import { KIND_META, LAYER_META, type CalEvent, type EventLayer } from '../../../mocks/calendar'
import { EventRow } from './EventRow'
import s from '../CalendarPage.module.css'

type LayerProps = {
  layers: Record<EventLayer, boolean>
  onlyMine: boolean
  saveError: string
  onChange: (layers: Record<EventLayer, boolean>, onlyMine: boolean) => void
}

/** 보기: 일정 층 켜고 끄기 · 내가 참석자인 공용 일정만 */
export function LayerFilterCard({ layers, onlyMine, saveError, onChange }: LayerProps) {
  return (
    <Card className={s.side}>
      <SectionHead icon={LayoutGrid} title="보기" />
      {(Object.keys(LAYER_META) as EventLayer[]).map((l) => (
        <Checkbox
          key={l}
          checked={layers[l]}
          color={LAYER_META[l].color}
          onChange={(v) => onChange({ ...layers, [l]: v }, onlyMine)}
        >
          <span className={s.layerText}>
            <strong>{LAYER_META[l].label}</strong>
            <small>{LAYER_META[l].desc}</small>
          </span>
        </Checkbox>
      ))}
      <Checkbox checked={onlyMine} onChange={(v) => onChange(layers, v)}>
        <span className={s.layerText}>
          <strong>내가 참석자인 공용 일정만</strong>
        </span>
      </Checkbox>
      {saveError && (
        <p className={s.empty} role="alert">
          {saveError}
        </p>
      )}
    </Card>
  )
}

/** 일정 종류 색 설명 */
export function KindLegendCard() {
  return (
    <Card>
      <SectionHead title="일정 종류" />
      <div className={s.legend}>
        {Object.values(KIND_META).map((k) => (
          <span key={k.label} className={s.legendItem}>
            <i style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

/** 고른 날의 일정 · 회의록 만들기 */
export function SelectedDayCard({ selected, selectedEvents }: { selected: Date; selectedEvents: CalEvent[] }) {
  return (
    <Card className={s.selectedDay}>
      <SectionHead icon={Calendar} title={formatLongDay(selected)} />
      {selectedEvents.length === 0 && <p className={s.empty}>일정이 없어요.</p>}
      {selectedEvents.map((e) => (
        <EventRow key={e.id} e={e} compact />
      ))}
      <Button variant="tint" icon={CalendarPlus} className={s.minutesBtn} onClick={() => openEventEditor({ date: ymd(selected) })}>
        이 날 일정 추가
      </Button>
      {/* 백엔드 POST /meeting-minutes 는 projectKey 없이 연구실 회의록도 받지만(참석자 목록은 필수) 이 앱에 연구실 회의록 화면 경로가 없어 아직 연결하지 않음 */}
      <Button variant="tint" icon={ClipboardList} className={s.minutesBtn}>
        이 날 회의록 만들기
      </Button>
    </Card>
  )
}
