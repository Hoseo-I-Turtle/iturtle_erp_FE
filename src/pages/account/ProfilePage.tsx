import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Columns, Loadable } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { whenLive } from '../../api/useResource'
import { keepModeAcrossReload } from '../../lib/dataMode'
import {
  deleteProfilePhoto,
  errorText,
  githubLinkResult,
  githubLinkStartUrl,
  isLive,
  saveMyProfile,
  saveNotiPref,
  unlinkGithub,
  uploadProfilePhoto,
  useMyProfile,
  type ProfileData,
} from '../../api/admin'
import { PhotoHeader } from './profile/PhotoHeader'
import { ProfileForm } from './profile/ProfileForm'
import { GithubLinkCard, NotiPrefsCard, ServicePermsCard } from './profile/ProfileSideCards'
import s from './ProfilePage.module.css'

const MAX_PHOTO = 5 * 1024 * 1024

export function ProfilePage() {
  const res = useMyProfile()
  return (
    <>
      <PageHeader title="내 프로필" subtitle="내 정보 · 서비스 권한 · GitHub · 알림 설정" action={null} />
      <Loadable resource={res} label="내 프로필">
        {(d) => <ProfileView data={d} />}
      </Loadable>
    </>
  )
}

function ProfileView({ data }: { data: ProfileData }) {
  const [form, setForm] = useState(data.form)
  const [saved, setSaved] = useState(data.form)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [photo, setPhoto] = useState<string | null>(data.photoUrl)
  const [photoError, setPhotoError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [github, setGithub] = useState(data.github)
  // GitHub 연결에서 돌아왔을 때 (?github=linked | error&code=)
  const [githubMsg, setGithubMsg] = useState(() => githubLinkResult(window.location.search))
  const [params, setParams] = useSearchParams()
  // 결과는 한 번만 보여 주고 주소에서 지운다 (새로고침해도 다시 뜨지 않게)
  useEffect(() => {
    if (!params.has('github')) return
    const next = new URLSearchParams(params)
    next.delete('github')
    next.delete('code')
    setParams(next, { replace: true })
  }, [params, setParams])
  const [prefs, setPrefs] = useState(data.prefs)
  const [prefError, setPrefError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const emailOk = !form.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
  const phoneOk = !form.phone || /^[0-9-]{9,20}$/.test(form.phone)

  const pickPhoto = async (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setPhotoError('JPG · PNG · WEBP 만 올릴 수 있어요')
    if (file.size > MAX_PHOTO) return setPhotoError('5MB 이하만 올릴 수 있어요')
    setPhotoError('')
    const prev = photo
    setPhoto(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await whenLive(() => uploadProfilePhoto(data.memberId, file))
      if (url) setPhoto(url)
    } catch (e) {
      // 실패하면 이전 사진 그대로 (1-3)
      setPhoto(prev)
      setPhotoError(errorText(e, '사진을 올리지 못했어요. 다시 시도해 주세요.'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePhoto = async () => {
    const prev = photo
    setPhoto(null)
    setPhotoError('')
    try {
      await whenLive(() => deleteProfilePhoto(data.memberId))
    } catch (e) {
      setPhoto(prev)
      setPhotoError(errorText(e, '사진을 지우지 못했어요.'))
    }
  }

  const save = async () => {
    const prev = saved
    setSaved(form)
    setSaving(true)
    setSaveError('')
    try {
      const next = await whenLive(() => saveMyProfile(form, prev))
      if (next) {
        setForm(next)
        setSaved(next)
      }
    } catch (e) {
      setSaved(prev)
      setSaveError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  const linkGithub = () => {
    // 실서버: GitHub 로 페이지 이동 (G-1). 돌아오면 ?github= 로 결과를 알려 준다
    if (isLive()) {
      keepModeAcrossReload()
      return window.location.assign(githubLinkStartUrl())
    }
    setGithub({ login: 'minseo-k', orgLabel: 'Hoseo-I-Turtle 조직 · students 팀' })
  }
  const unlink = async () => {
    const prev = github
    setGithub(null)
    setGithubMsg(null)
    try {
      await whenLive(() => unlinkGithub(data.memberId))
    } catch (e) {
      setGithub(prev)
      setGithubMsg({ ok: false, message: errorText(e, '연결을 해제하지 못했어요.') })
    }
  }

  const togglePref = async (key: string, enabled: boolean) => {
    const prev = prefs
    setPrefs((ps) => ps.map((p) => (p.key === key ? { ...p, enabled } : p)))
    setPrefError('')
    try {
      const next = await whenLive(() => saveNotiPref(key, enabled))
      if (next) setPrefs(next)
    } catch (e) {
      setPrefs(prev)
      setPrefError(errorText(e))
    }
  }

  return (
    <Columns
      main={
        <Card className={s.main}>
          <PhotoHeader data={data} photo={photo} photoError={photoError} uploading={uploading} fileRef={fileRef} onPick={pickPhoto} onRemove={removePhoto} />
          <ProfileForm
            data={data}
            form={form}
            onChange={setForm}
            emailOk={emailOk}
            phoneOk={phoneOk}
            dirty={dirty}
            saving={saving}
            saveError={saveError}
            onSave={save}
          />
        </Card>
      }
      side={
        <>
          <ServicePermsCard data={data} />
          <GithubLinkCard github={github} githubMsg={githubMsg} onLink={linkGithub} onUnlink={unlink} />
          <NotiPrefsCard prefs={prefs} prefError={prefError} onToggle={togglePref} />
        </>
      }
    />
  )
}
