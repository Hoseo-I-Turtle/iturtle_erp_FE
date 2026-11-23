import { Link, useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronLeft, ChevronRight, Database, KeyRound, Monitor, MousePointer2, Palette, Shield, Sparkles, User, type LucideIcon } from 'lucide-react'
import { Card, Switch } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { clearDataMode, getDataMode } from '../../lib/dataMode'
import { THEMES, useTheme, type ThemeInfo } from '../../lib/theme'
import s from './SettingsPage.module.css'

type Item = { icon: LucideIcon; title: string; desc: string; to?: string; value?: string; onClick?: () => void }

/** 설정: 무엇을 바꿀지 고르는 화면 (사이드바 아래 톱니바퀴) */
export function SettingsPage() {
  const navigate = useNavigate()
  const { choice, active } = useTheme()
  const themeName = THEMES.find((t) => t.id === active)?.name ?? '기본'

  const groups: { title: string; items: Item[] }[] = [
    {
      title: '내 계정',
      items: [
        { icon: User, title: '내 프로필', desc: '사진 · 소개 · 연락처 · GitHub 연결', to: '/me' },
        { icon: Bell, title: '알림 받기', desc: '종류별로 알림을 켜고 끄기', to: '/me' },
        { icon: KeyRound, title: '비밀번호 변경', desc: '로그인 비밀번호 바꾸기', to: '/password' },
        { icon: Shield, title: '권한 신청', desc: '연동 서비스 권한 · 연구실 역할 신청과 내 신청 보기', to: '/access-requests' },
      ],
    },
    {
      title: '화면',
      items: [{ icon: Palette, title: '테마', desc: '화면 색과 분위기 바꾸기', to: '/settings/theme', value: choice === 'auto' ? `자동 (${themeName})` : themeName }],
    },
    {
      title: '기타',
      items: [
        {
          icon: Database,
          title: '데이터 출처',
          desc: '목업 데이터와 실서버 사이를 바꾸기',
          value: getDataMode() === 'live' ? '실서버' : '목업 데이터',
          onClick: () => {
            clearDataMode()
            navigate('/start')
          },
        },
      ],
    },
  ]

  return (
    <>
      <PageHeader title="설정" subtitle="내 계정과 화면을 바꿔요" action={null} />
      <div className={s.groups}>
        {groups.map((g) => (
          <Card key={g.title} className={s.group}>
            <h2>{g.title}</h2>
            {g.items.map((it) => {
              const body = (
                <>
                  <i>
                    <it.icon size={20} />
                  </i>
                  <span>
                    <strong>{it.title}</strong>
                    <small>{it.desc}</small>
                  </span>
                  {it.value && <em>{it.value}</em>}
                  <ChevronRight size={18} />
                </>
              )
              return it.to ? (
                <Link key={it.title} to={it.to} className={s.item}>
                  {body}
                </Link>
              ) : (
                <button key={it.title} type="button" className={s.item} onClick={it.onClick}>
                  {body}
                </button>
              )
            })}
          </Card>
        ))}
      </div>
    </>
  )
}

/** 설정 › 테마: 테마 카드 중에서 고른다. 고르면 바로 바뀐다 */
export function ThemeSettingsPage() {
  const { choice, active, info, objects, effects, setTheme, setObject, setEffects } = useTheme()
  return (
    <>
      <PageHeader title="설정" subtitle="테마 · 고르면 바로 바뀌고 이 브라우저에 기억돼요" action={null} />
      <Card className={s.themeCard}>
        <Link to="/settings" className={s.back}>
          <ChevronLeft size={16} />
          설정
        </Link>
        <h2>테마</h2>
        <div className={s.themes} role="radiogroup" aria-label="테마">
          {THEMES.filter((t) => !t.hidden).map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={choice === t.id} className={choice === t.id ? `${s.theme} ${s.themeOn}` : s.theme} onClick={() => setTheme(t.id)}>
              <Preview t={t} />
              <span className={s.themeText}>
                <strong>
                  {t.name}
                  {choice === t.id && <Check size={16} />}
                </strong>
                <small>{t.desc}</small>
              </span>
            </button>
          ))}
        </div>
        <button type="button" role="switch" aria-checked={choice === 'auto'} className={choice === 'auto' ? `${s.auto} ${s.autoOn}` : s.auto} onClick={() => setTheme(choice === 'auto' ? active : 'auto')}>
          <i>
            <Monitor size={20} />
          </i>
          <span>
            <strong>기기 설정 따라가기</strong>
            <small>기기가 어두운 화면이면 다크, 밝은 화면이면 기본 테마를 써요</small>
          </span>
          <b>{choice === 'auto' ? '켜짐' : '꺼짐'}</b>
        </button>
      </Card>

      {/* 색(틀)과 따로 켜고 끄는 것들 */}
      <Card className={s.themeCard}>
        <h2>꾸미기</h2>
        {info.objectSets.length === 0 && <p className={s.none}>{info.name} 테마에는 오브젝트가 없어요.</p>}
        {info.objectSets.map((label, i) => (
          <div key={i} className={s.toggle}>
            <i>
              <Sparkles size={20} />
            </i>
            <span>
              <strong>오브젝트 {i + 1}</strong>
              <small>{label}. 꺼도 테마 색은 그대로예요</small>
            </span>
            <Switch checked={objects[i]} onChange={(v) => setObject(i, v)} label={`오브젝트 ${i + 1}`} />
          </div>
        ))}
        <div className={s.toggle}>
          <i>
            <MousePointer2 size={20} />
          </i>
          <span>
            <strong>마우스 효과</strong>
            <small>
              {info.hasEffects ? '마우스를 움직이면 방울 · 눈 · 빛이 따라와요. 기기에서 "움직임 줄이기"를 켰으면 자동으로 꺼져요' : `${info.name} 테마에는 마우스 효과가 없어요`}
            </small>
          </span>
          <Switch checked={effects} onChange={setEffects} label="마우스 효과" />
        </div>
      </Card>
    </>
  )
}

/** 테마 미리보기: 사이드바 + 카드 두 장을 작게 그린다 */
function Preview({ t }: { t: ThemeInfo }) {
  const p = t.preview
  return (
    <span className={s.preview} style={{ background: p.page }} aria-hidden>
      <span className={s.pvSide} style={{ background: p.sidebar }}>
        <i />
        <i />
        <i />
      </span>
      <span className={s.pvMain}>
        <span className={s.pvCard} style={{ background: p.card }}>
          <b style={{ background: p.text }} />
          <b style={{ background: p.text, opacity: 0.35, width: '70%' }} />
          <u style={{ background: p.accent }} />
        </span>
        <span className={s.pvCard} style={{ background: p.card }}>
          <b style={{ background: p.text, opacity: 0.35 }} />
          <b style={{ background: p.text, opacity: 0.35, width: '50%' }} />
        </span>
      </span>
    </span>
  )
}
