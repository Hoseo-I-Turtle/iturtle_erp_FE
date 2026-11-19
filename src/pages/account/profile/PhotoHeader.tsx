import type { RefObject } from 'react'
import { Upload, X } from 'lucide-react'
import { Avatar, Button, Chip } from '../../../components/ui'
import type { ProfileData } from '../../../api/admin'
import s from '../ProfilePage.module.css'

type Props = {
  data: ProfileData
  photo: string | null
  photoError: string
  uploading: boolean
  fileRef: RefObject<HTMLInputElement | null>
  onPick: (file?: File) => void
  onRemove: () => void
}

/** 사진 · 이름 · 구분 칩 · 사진 바꾸기/지우기 */
export function PhotoHeader({ data, photo, photoError, uploading, fileRef, onPick, onRemove }: Props) {
  return (
    <div className={s.top}>
      {photo ? <img src={photo} alt="" className={s.photo} /> : <Avatar name={data.name} size={88} />}
      <div className={s.topText}>
        <h2>{data.name}</h2>
        <div className={s.chips}>
          <Chip tone="tint">{data.typeLabel}</Chip>
          <Chip className={s.active}>재실</Chip>
          <Chip tone="tint">입실 {data.joinedAt}</Chip>
        </div>
        <div className={s.photoActions}>
          <Button variant="tint" icon={Upload} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '올리는 중' : '사진 바꾸기'}
          </Button>
          <Button variant="ghost" icon={X} onClick={onRemove} disabled={!photo || uploading}>
            지우기
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onPick(e.target.files?.[0])} />
        </div>
        <small className={photoError ? s.err : s.hint}>{photoError || 'JPG · PNG · WEBP, 5MB 이하 · 올릴 때 정사각형으로 잘라요'}</small>
      </div>
    </div>
  )
}
