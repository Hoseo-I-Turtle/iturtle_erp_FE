import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, Check, ChevronRight, GitBranch, Lock, Shield, Upload, X } from 'lucide-react'
import { Avatar, Button, Card, Chip, Columns, Loadable, Switch } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { whenLive } from '../../api/useResource'
import { PASSWORD_PATH } from '../../api/client'
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
                <Button variant="ghost" icon={X} onClick={removePhoto} disabled={!photo || uploading}>
                  지우기
                </Button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </div>
              <small className={photoError ? s.err : s.hint}>{photoError || 'JPG · PNG · WEBP, 5MB 이하 · 올릴 때 정사각형으로 잘라요'}</small>
            </div>
          </div>

          <div className={s.label}>바꿀 수 없는 정보</div>
          <div className={s.three}>
            <ReadOnly label="구성원 번호" value={data.memberNo} />
            <ReadOnly label="로그인 ID" value={data.loginId} />
            <ReadOnly label="이름" value={data.name} hint="이름 · 구분은 관리자가 바꿔요" />
          </div>

          <div className={s.label}>내가 바꿀 수 있는 정보</div>
          <div className={s.two}>
            <label className={s.field}>
              이메일 (선택)
              <input className={emailOk ? s.input : `${s.input} ${s.invalid}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <small className={emailOk ? s.hint : s.err}>{emailOk ? 'Penpot 로그인 이메일(학번@iturtle.local)은 바뀌지 않아요' : '이메일 형식을 확인해 주세요'}</small>
            </label>
            <label className={s.field}>
              연락처 (선택)
              <input className={phoneOk ? s.input : `${s.input} ${s.invalid}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <span className={s.switchRow}>
                <Switch checked={form.phonePublic} onChange={(v) => setForm({ ...form, phonePublic: v })} label="연락처 공개" />
                <small className={s.hint}>연락처 공개 (끄면 contact-view 역할만 봐요)</small>
              </span>
            </label>
          </div>
          <label className={s.field}>
            소개
            <input className={s.input} maxLength={200} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
            <small className={s.hint}>{form.intro.length} / 200자 · 구성원 목록 카드에 보여요</small>
          </label>

          <div className={s.bottom}>
            <Link to={PASSWORD_PATH} className={s.pwLink}>
              <Lock size={16} /> 비밀번호 바꾸기
            </Link>
            {saveError && <small className={s.err}>{saveError}</small>}
            <Button icon={Check} onClick={save} disabled={!dirty || !emailOk || !phoneOk || saving}>
              {dirty ? '저장' : '저장됨'}
            </Button>
          </div>
        </Card>
      }
      side={
        <>
          <Card>
            <h2 className={s.sideTitle}>
              <Shield size={20} /> 내 서비스 권한
            </h2>
            <div className={s.small}>연구실 전체 · VAULT · JENKINS 읽기 / 쓰기는 프로젝트별</div>
            <div>
              {data.labRoles.length === 0 && <small className={s.hint}>연구실 전체 서비스 역할이 없어요</small>}
              {data.labRoles.map((r) => (
                <Chip key={r} tone="brand">
                  {r}
                </Chip>
              ))}
            </div>
            <div className={s.small}>프로젝트별</div>
            {data.projectPerms.length === 0 && <small className={s.hint}>참여 중인 프로젝트가 없어요</small>}
            {data.projectPerms.map((p) => (
              <div key={p.name} className={s.perm}>
                <strong>{p.name}</strong>
                <span>{p.vault}</span>
                <span>{p.jenkins}</span>
              </div>
            ))}
            <Link to="/admin/role-requests" className={s.more}>
              필요한 권한이 없나요? 권한 신청 <ChevronRight size={14} />
            </Link>
          </Card>

          <Card>
            <h2 className={s.sideTitle}>
              <GitBranch size={20} /> GitHub 연결
            </h2>
            {github ? (
              <div className={s.github}>
                <Check size={18} />
                <span>
                  <strong>@{github.login} 연결됨</strong>
                  <small>{github.orgLabel}</small>
                </span>
                <Button variant="secondary" onClick={unlink}>
                  해제
                </Button>
              </div>
            ) : (
              <Button variant="tint" icon={GitBranch} onClick={linkGithub}>
                GitHub 계정 연결하기
              </Button>
            )}
            {githubMsg && <small className={githubMsg.ok ? s.hint : s.err}>{githubMsg.message}</small>}
            <small className={s.hint}>주간 보고의 GitHub 활동은 이 계정의 커밋으로 모아요.</small>
          </Card>

          <Card>
            <h2 className={s.sideTitle}>
              <Bell size={20} /> 알림 받기
            </h2>
            {prefs.map((p) => (
              <div key={p.key} className={s.pref}>
                <span>{p.label}</span>
                {p.locked ? (
                  <span className={s.locked}>
                    <Lock size={12} /> 끌 수 없음
                  </span>
                ) : (
                  <Switch checked={p.enabled} onChange={(v) => togglePref(p.key, v)} label={p.label} />
                )}
              </div>
            ))}
            {prefError && <small className={s.err}>{prefError}</small>}
          </Card>
        </>
      }
    />
  )
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <label className={s.field}>
      {label}
      <input className={`${s.input} ${s.readonly}`} value={value} readOnly />
      {hint && <small className={s.hint}>{hint}</small>}
    </label>
  )
}
