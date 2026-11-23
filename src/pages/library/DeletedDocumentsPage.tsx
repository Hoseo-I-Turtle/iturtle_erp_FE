import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Search, Shield, TriangleAlert } from 'lucide-react'
import { Card, Chip, ConfirmDialog, Empty, FormError, Loadable, Note, Progress, Segmented } from '../../components/ui'
import { PageHeader } from '../../layouts/PageHeader'
import { errorText } from '../../api/content'
import { restoreDocument, useDeletedDocuments } from '../../api/documents'
import { getDataMode } from '../../lib/dataMode'
import type { DeletedDocument } from '../../mocks/documentDetail'
import s from './DeletedDocumentsPage.module.css'

/** 자료실 · 지운 자료 (Penpot 06 · 자료실 · 지운 자료) — D-1 deleted=true, D-6. content-manage 만 */
export function DeletedDocumentsPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [target, setTarget] = useState<DeletedDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useDeletedDocuments(keyword)

  const restore = async () => {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await restoreDocument(target.documentId, getDataMode() === 'live')
      setTarget(null)
    } catch (e) {
      setError(errorText(e, '되살리지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="자료실" subtitle="지운 자료 · 30일 안에는 되살릴 수 있어요" action={null} />
      <Card className={s.card}>
        <div className={s.toolbar}>
          <Segmented
            value="deleted"
            options={[
              { value: 'all', label: '자료' },
              { value: 'deleted', label: `지운 자료 ${list.data?.length ?? ''}`.trim() },
            ]}
            onChange={(v) => v === 'all' && navigate('/library')}
          />
          <label className={s.search}>
            <Search size={16} />
            <input type="search" placeholder="제목 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </label>
          <Chip tone="tint" icon={Shield} className={s.role}>
            content-manage 만 보이는 화면
          </Chip>
        </div>
        <Note icon={TriangleAlert} tone="warning">
          지운 자료는 목록 · 검색 · 프로젝트 자료 탭에서 안 보여요. 30일이 지나면 파일과 댓글까지 완전히 지워지고 되살릴 수 없어요.
        </Note>
        <Loadable resource={list} label="지운 자료">
          {(items) =>
            items.length === 0 ? (
              <Empty>지운 자료가 없어요.</Empty>
            ) : (
              <div className={s.table}>
                <div className={`${s.row} ${s.thead}`}>
                  <span>자료</span>
                  <span>올린 사람</span>
                  <span>지운 사람</span>
                  <span>지운 날</span>
                  <span>완전 삭제까지</span>
                  <span />
                </div>
                {items.map((d) => {
                  const soon = d.daysLeft <= 3
                  return (
                    <div key={d.documentId} className={`${s.row} ${s.item}`}>
                      <span className={s.doc}>
                        <i>{d.ext ? d.ext.toUpperCase() : '—'}</i>
                        <span>
                          <strong>{d.title}</strong>
                          <small>
                            {d.categoryName} · {d.contents}
                          </small>
                        </span>
                      </span>
                      <span>{d.author}</span>
                      <span className={s.by}>
                        {d.deletedBy}
                        <small>{d.deletedByNote}</small>
                      </span>
                      <span>{d.deletedOn}</span>
                      <span className={s.left}>
                        <b className={soon ? s.soon : undefined}>{d.daysLeft > 0 ? `${d.daysLeft}일 남음` : '정리 중'}</b>
                        <Progress value={((30 - d.daysLeft) / 30) * 100} height={6} color={soon ? 'var(--status-negative)' : 'var(--accent-2)'} track="var(--surface-card)" />
                      </span>
                      <span className={s.act}>
                        {d.daysLeft > 0 ? (
                          <button type="button" onClick={() => setTarget(d)}>
                            <RefreshCw size={14} />
                            되살리기
                          </button>
                        ) : (
                          <Chip tone="gray">정리 중</Chip>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </Loadable>
      </Card>
      {target && (
        <ConfirmDialog title={`"${target.title}"을 되살릴까요?`} confirmLabel="되살리기" icon={RefreshCw} busy={busy} onClose={() => setTarget(null)} onConfirm={restore}>
          <p>파일과 댓글도 함께 돌아오고, 파일 완전 삭제 예약이 취소돼요. 감사 로그에 "자료 되살림"으로 남아요.</p>
          <FormError>{error}</FormError>
        </ConfirmDialog>
      )}
    </>
  )
}
