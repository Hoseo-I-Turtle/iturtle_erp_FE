import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Database, FlaskConical, Loader, Server, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui'
import { getApiBase, getDataMode, pingServer, setDataMode, type DataMode } from '../../lib/dataMode'
import s from './StartPage.module.css'

/** 앱에 들어가기 전에 목업 / 실서버를 고르는 화면 */
export function StartPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<DataMode>(() => getDataMode() ?? 'mock')
  const [base, setBase] = useState(getApiBase)
  const [check, setCheck] = useState<{ state: 'idle' | 'checking' | 'ok' | 'fail'; message?: string }>({ state: 'idle' })

  const test = async () => {
    setCheck({ state: 'checking' })
    const r = await pingServer(base)
    setCheck({ state: r.ok ? 'ok' : 'fail', message: r.message })
  }

  const enter = () => {
    setDataMode(mode, mode === 'live' ? base : undefined)
    navigate(mode === 'live' ? '/login' : '/', { replace: true })
  }

  return (
    <div className={s.page}>
      <div className={s.box}>
        <div className={s.logo}>
          <span className={s.mark}>
            <FlaskConical size={24} />
          </span>
          Iturtle
        </div>
        <h1>어떤 데이터로 볼까요?</h1>
        <p className={s.sub}>나중에 사이드바 아래에서 언제든 바꿀 수 있어요.</p>

        <div className={s.options} role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'mock'}
            className={mode === 'mock' ? `${s.option} ${s.on}` : s.option}
            onClick={() => setMode('mock')}
          >
            <span className={s.optIcon}>
              <Database size={22} />
            </span>
            <strong>목업 데이터</strong>
            <span>서버 없이 화면을 둘러봐요. 고친 내용은 새로고침하면 처음으로 돌아가요.</span>
            {mode === 'mock' && <Check size={18} className={s.check} />}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'live'}
            className={mode === 'live' ? `${s.option} ${s.on}` : s.option}
            onClick={() => setMode('live')}
          >
            <span className={s.optIcon}>
              <Server size={22} />
            </span>
            <strong>실서버</strong>
            <span>ERP 백엔드에 연결해 로그인하고 실제 데이터를 써요.</span>
            {mode === 'live' && <Check size={18} className={s.check} />}
          </button>
        </div>

        {mode === 'live' && (
          <div className={s.server}>
            <label>
              <span>API 주소</span>
              <input
                value={base}
                onChange={(e) => {
                  setBase(e.target.value)
                  setCheck({ state: 'idle' })
                }}
                placeholder="/api/v1 또는 https://erp.example.com/api/v1"
              />
            </label>
            <Button variant="secondary" onClick={test} disabled={check.state === 'checking' || !base.trim()}>
              {check.state === 'checking' ? <Loader size={16} className={s.spin} /> : null}
              연결 확인
            </Button>
            {check.message && (
              <p className={check.state === 'ok' ? s.ok : s.fail}>
                {check.state === 'ok' ? <Check size={14} /> : <TriangleAlert size={14} />} {check.message}
              </p>
            )}
          </div>
        )}

        <Button className={s.enter} onClick={enter} disabled={mode === 'live' && !base.trim()}>
          {mode === 'mock' ? '목업으로 들어가기' : '실서버로 들어가기'}
        </Button>
      </div>
    </div>
  )
}
