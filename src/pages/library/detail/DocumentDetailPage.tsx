import { useParams } from 'react-router-dom'
import { Download, ExternalLink, FileText, Folder, History, Link2, Lock, MessageCircle, Tag } from 'lucide-react'
import { Breadcrumb, Card, Chip, Columns, KeyValue, Loadable, SectionHead } from '../../../components/ui'
import { Markdown } from '../../../components/markdown/Markdown'
import { PageHeader } from '../../../layouts/PageHeader'
import { fileSize, useDocumentDetail, VISIBILITY_LABEL, type DocumentDetail, type DocVersion } from '../../../api/documents'
import s from './DocumentDetailPage.module.css'

/** 자료 상세 (D-3): 본문 · 파일과 버전 · 링크 · 폴더 · 공개 범위. 고치기 · 댓글은 다음 단계 */
export function DocumentDetailPage() {
  const { id } = useParams()
  const doc = useDocumentDetail(id)
  return (
    <>
      <PageHeader title="자료실" subtitle="연구실 자료와 프로젝트 파일" />
      <Loadable resource={doc} label="자료">
        {(d) => <DocumentBody d={d} />}
      </Loadable>
    </>
  )
}

function VersionRow({ v, latest }: { v: DocVersion; latest?: boolean }) {
  return (
    <div className={latest ? `${s.version} ${s.latest}` : s.version}>
      <span className={s.vTag}>v{v.version}</span>
      <div className={s.vMain}>
        <strong>{v.name}</strong>
        <small>
          {fileSize(v.size)} · {v.who} · {v.ago}
          {v.note && ` · ${v.note}`}
        </small>
      </div>
      {v.url ? (
        <a className={s.download} href={v.url} aria-label={`${v.name} 내려받기`}>
          <Download size={16} />
          내려받기
        </a>
      ) : (
        <span className={s.noFile}>목업 파일</span>
      )}
    </div>
  )
}

function DocumentBody({ d }: { d: DocumentDetail }) {
  return (
    <Columns
      sideWidth={320}
      main={
        <Card className={s.article}>
          <Breadcrumb items={[{ label: '자료실', to: '/library' }, { label: d.category }, { label: '상세' }]} />
          <h2 className={s.title}>{d.title}</h2>
          <div className={s.meta}>
            <span>{d.author}</span>
            <span>· {d.ago}</span>
            {d.edited && <span>· 수정됨</span>}
            {d.visibility !== 'LAB' && (
              <Chip tone={d.visibility === 'PRIVATE' ? 'muted' : 'warning'} icon={Lock}>
                {VISIBILITY_LABEL[d.visibility]}
              </Chip>
            )}
          </div>
          {d.body && (
            <div className={s.body}>
              <Markdown source={d.body} />
            </div>
          )}

          {d.files.length > 0 && (
            <section className={s.section}>
              <SectionHead icon={FileText} title={`파일 ${d.files.length}개`} />
              {d.files.map((g) => (
                <div key={g.name} className={s.group}>
                  <VersionRow v={g.latest} latest />
                  {g.previous.length > 0 && (
                    <details className={s.previous}>
                      <summary>
                        <History size={14} /> 이전 버전 {g.previous.length}개
                      </summary>
                      {g.previous.map((v) => (
                        <VersionRow key={v.version} v={v} />
                      ))}
                    </details>
                  )}
                </div>
              ))}
            </section>
          )}

          {d.links.length > 0 && (
            <section className={s.section}>
              <SectionHead icon={Link2} title="링크" />
              {d.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={s.link}>
                  <ExternalLink size={14} />
                  {l.title}
                </a>
              ))}
            </section>
          )}
        </Card>
      }
      side={
        <Card>
          <SectionHead icon={Folder} title="자료 정보" />
          <KeyValue
            items={[
              ['카테고리', d.category],
              ['폴더', d.folderPath ?? '폴더 밖'],
              ['프로젝트', d.project ? `${d.project.projectKey} · ${d.project.name}` : '연결 안 함'],
              ['공개 범위', VISIBILITY_LABEL[d.visibility]],
              [
                '태그',
                d.tags.length ? (
                  <span className={s.tags}>
                    <Tag size={12} />
                    {d.tags.map((t) => `#${t}`).join(' ')}
                  </span>
                ) : (
                  '없음'
                ),
              ],
              [
                '댓글',
                <span key="c" className={s.tags}>
                  <MessageCircle size={12} />
                  {d.commentCount}
                </span>,
              ],
            ]}
          />
        </Card>
      }
    />
  )
}
