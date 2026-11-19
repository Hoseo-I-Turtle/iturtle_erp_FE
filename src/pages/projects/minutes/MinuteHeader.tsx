import { Calendar, Clock, FileText, MapPin, Pencil, Save, TriangleAlert, X } from 'lucide-react'
import { Avatar, Button, Chip, Note } from '../../../components/ui'
import type { Minute } from '../../../mocks/minutes'
import s from '../MinutesPage.module.css'

type Props = {
  m: Minute
  editing: boolean
  saving: boolean
  error: string | null
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
}

/** 제목 · 수정/저장 버튼 · 일시 · 장소 · 일정 · 참석/불참 */
export function MinuteHeader({ m, editing, saving, error, onEdit, onCancel, onSave }: Props) {
  return (
    <>
      <div className={s.titleRow}>
        <h2>{m.title}</h2>
        {editing ? (
          <>
            <Button variant="secondary" icon={X} onClick={onCancel}>
              취소
            </Button>
            <Button icon={Save} onClick={onSave} disabled={saving}>
              저장
            </Button>
          </>
        ) : (
          <Button variant="secondary" icon={Pencil} onClick={onEdit}>
            수정
          </Button>
        )}
      </div>
      {error && (
        <Note icon={TriangleAlert} tone="warning">
          {error}
        </Note>
      )}
      <div className={s.chips}>
        <Chip tone="tint" icon={Clock}>
          {m.when}
        </Chip>
        <Chip tone="tint" icon={MapPin}>
          {m.place}
        </Chip>
        <Chip tone="tint" icon={Calendar}>
          {m.event}
        </Chip>
        <span className={s.template}>
          <FileText size={14} /> {m.template}
        </span>
      </div>
      <div className={s.people}>
        <span className={s.peopleLabel}>참석</span>
        {m.attendees.map((n) => (
          <span key={n} className={s.person}>
            <Avatar name={n} size={20} /> {n}
          </span>
        ))}
        {m.absent.length > 0 && <span className={s.peopleLabel}>불참</span>}
        {m.absent.map((n) => (
          <span key={n} className={`${s.person} ${s.absent}`}>
            <Avatar name={n} size={20} /> {n}
          </span>
        ))}
      </div>
    </>
  )
}
