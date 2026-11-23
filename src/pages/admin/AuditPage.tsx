import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button, Card, Empty, FilterSelect, Loadable } from '../../components/ui'
import { auditLogs } from '../../mocks/adminOps'
import {
  AUDIT_CATEGORIES,
  AUDIT_TARGETS,
  downloadAuditCsv,
  errorText,
  isLive,
  useAuditLogs,
  type AuditCategoryView,
  type AuditRow,
} from '../../api/admin'
import a from './admin.module.css'
import s from './AuditPage.module.css'

const CAT_TONE: Record<AuditCategoryView, string> = {
  권한: s.cBlue,
  프로젝트: s.cPurple,
  로그인: s.cGray,
  운영: s.cOrange,
  콘텐츠: s.cRed,
  구성원: s.cBlue,
  가입: s.cBlue,
  외부: s.cGray,
  회계: s.cOrange,
}

/** CSV 한 칸: 쉼표 · 따옴표 · 줄바꿈이 있으면 따옴표로 감싼다 */
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const uniq = (xs: string[]) => [...new Set(xs)].sort()

/** 목업: 보이는 목록을 브라우저에서 CSV 로 만든다 */
function exportMockCsv(rows: AuditRow[]) {
  const head = ['시각', '행위자', '분류', '사건', '대상', '바뀐 내용', 'IP', '결과']
  const body = rows.map((l) => [l.at, l.actor, l.category, l.action, l.target, l.change, l.ip, l.ok ? '성공' : '실패'].map(cell).join(','))
  // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인다
  const blob = new Blob(['﻿' + [head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = 'audit-log.csv'
  el.click()
  URL.revokeObjectURL(url)
}

/** 보여 줄 페이지 번호: 앞 3쪽 … 마지막 */
function pageNumbers(total: number) {
  if (total <= 4) return { head: Array.from({ length: total }, (_, i) => i + 1), last: null }
  return { head: [1, 2, 3], last: total }
}

export function AuditPage() {
  const [period, setPeriod] = useState('최근 7일')
  const [actor, setActor] = useState('')
  const [cat, setCat] = useState('')
  const [target, setTarget] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(0)
  // 실서버: 행위자 이름 → 로그인 ID (불러온 기록에서 모아 둔다)
  const [actors, setActors] = useState<Record<string, string>>({})
  const [exportErr, setExportErr] = useState('')
  const [exporting, setExporting] = useState(false)

  const filter = { period, actor, actorLoginId: actor ? actors[actor] : undefined, cat, target, page }
  const res = useAuditLogs(filter)
  const rows = res.data?.logs ?? []
  const totalPages = res.data?.totalPages ?? 1

  // 새로 본 행위자를 거르기 목록에 더한다 (렌더 중 파생 상태)
  const fresh = rows.filter((l) => l.loginId && !(l.actor in actors))
  if (fresh.length > 0) setActors({ ...actors, ...Object.fromEntries(fresh.map((l) => [l.actor, l.loginId!])) })

  const actorOptions = isLive() ? uniq([...Object.keys(actors), ...(actor ? [actor] : [])]) : uniq(auditLogs.map((l) => l.actor))
  // 거르기가 바뀌면 첫 페이지로
  const change = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(1)
    setSelected(0)
  }

  const exportCsv = async () => {
    if (!isLive()) return exportMockCsv(rows)
    setExportErr('')
    setExporting(true)
    try {
      await downloadAuditCsv(filter)
    } catch (e) {
      setExportErr(errorText(e, '내려받지 못했어요.'))
    } finally {
      setExporting(false)
    }
  }

  const go = (n: number) => {
    setPage(Math.min(totalPages, Math.max(1, n)))
    setSelected(0)
  }
  const nums = pageNumbers(totalPages)

  return (
    <Card className={s.card}>
      <div className={a.toolbar}>
        <FilterSelect label="기간" value={period} options={['오늘', '최근 7일', '최근 30일', '최근 1년']} onChange={change((v) => setPeriod(v || '최근 7일'))} />
        <FilterSelect label="행위자" value={actor} options={actorOptions} onChange={change(setActor)} />
        <FilterSelect label="사건 종류" value={cat} options={isLive() ? AUDIT_CATEGORIES : uniq(auditLogs.map((l) => l.category))} onChange={change(setCat)} />
        <FilterSelect label="대상" value={target} options={isLive() ? AUDIT_TARGETS : ['구성원', '프로젝트', '프리셋', '서비스', '자료']} onChange={change(setTarget)} />
        <span className={a.grow} />
        <span className={a.muted}>1년 보관 · 고치거나 지울 수 없어요</span>
        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={exporting}>
          CSV 내려받기
        </Button>
      </div>
      {exportErr && <p className={a.err}>{exportErr}</p>}

      <div className={s.thead}>
        <span>시각</span>
        <span>행위자</span>
        <span>사건</span>
        <span>대상</span>
        <span>바뀐 내용</span>
        <span>IP</span>
        <span>결과</span>
      </div>
      <Loadable resource={res} label="감사 로그">
        {(d) => (
          <>
            {d.logs.length === 0 && <Empty>조건에 맞는 기록이 없어요.</Empty>}
            {d.logs.map((l, i) => (
              <button key={i} type="button" className={i === selected ? `${s.row} ${s.rowOn}` : s.row} onClick={() => setSelected(i)}>
                <span className={s.time}>{l.at}</span>
                <span>{l.actor}</span>
                <span className={s.event}>
                  <span className={`${s.cat} ${CAT_TONE[l.category]}`}>{l.category}</span>
                  {l.action}
                </span>
                <span>{l.target}</span>
                <span className={s.change}>{l.change}</span>
                <span className={s.time}>{l.ip}</span>
                <span>
                  <span className={`${a.state} ${l.ok ? a.ok : a.bad}`}>{l.ok ? '성공' : '실패'}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </Loadable>

      <nav className={s.pager} aria-label="페이지">
        <button type="button" onClick={() => go(page - 1)} aria-label="이전">
          <ChevronLeft size={16} />
        </button>
        {nums.head.map((n) => (
          <button key={n} type="button" className={page === n ? s.pageOn : undefined} onClick={() => go(n)}>
            {n}
          </button>
        ))}
        {nums.last !== null && (
          <>
            {page > 3 && page < nums.last && (
              <button type="button" className={s.pageOn}>
                {page}
              </button>
            )}
            <span>…</span>
            <button type="button" className={page === nums.last ? s.pageOn : undefined} onClick={() => go(nums.last!)}>
              {nums.last}
            </button>
          </>
        )}
        <button type="button" onClick={() => go(page + 1)} aria-label="다음">
          <ChevronRight size={16} />
        </button>
      </nav>
    </Card>
  )
}
