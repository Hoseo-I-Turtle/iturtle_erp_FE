// 사람 고르기 (담당자 등): 버튼에 프로필 사진 · 이름, 누르면 사진 · 이름 · 역할이 있는 테마 드롭다운.
// 맨 위에 "미지정", 8명 이상이면 찾기 칸. 키보드는 Dropdown 과 같다 (↑↓ Enter Esc · 글자로 찾기).
import { ChevronDown, UserRound } from 'lucide-react'
import { Avatar } from './index'
import { Dropdown } from './Dropdown'
import s from './MemberPicker.module.css'

export type PickMember = { id: number; name: string; photoUrl?: string | null; /** 역할 · 팀 (흐린 글자) */ meta?: string }

type Props = {
  value: number | null
  members: PickMember[]
  onChange: (id: number | null) => void
  label: string
  /** 고른 사람이 없을 때 · 맨 위 항목 이름 */
  noneLabel?: string
  /** 버튼 모양 (없으면 기본 테두리 칸) */
  triggerClassName?: string
  avatarSize?: number
  disabled?: boolean
}

function NoOne({ size }: { size: number }) {
  return (
    <span className={s.none} style={{ width: size, height: size }} aria-hidden>
      <UserRound size={Math.round(size * 0.6)} />
    </span>
  )
}

export function MemberPicker({ value, members, onChange, label, noneLabel = '미지정', triggerClassName, avatarSize = 22, disabled }: Props) {
  const options = [
    { value: null as number | null, label: noneLabel, leading: <NoOne size={24} /> },
    ...members.map((m) => ({ value: m.id as number | null, label: m.name, meta: m.meta, leading: <Avatar name={m.name} src={m.photoUrl} size={24} /> })),
  ]
  return (
    <Dropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      searchable={members.length > 7}
      disabled={disabled}
      menuWidth={220}
      triggerClassName={`${s.trigger} ${triggerClassName ?? s.boxed}`}
      trigger={(sel, open) => {
        const m = members.find((x) => x.id === value)
        return (
          <>
            {m ? <Avatar name={m.name} src={m.photoUrl} size={avatarSize} /> : <NoOne size={avatarSize} />}
            <span className={m ? s.name : `${s.name} ${s.muted}`}>{m ? m.name : (sel?.label ?? noneLabel)}</span>
            {!disabled && <ChevronDown size={14} className={open ? `${s.chev} ${s.chevOpen}` : s.chev} />}
          </>
        )
      }}
    />
  )
}
