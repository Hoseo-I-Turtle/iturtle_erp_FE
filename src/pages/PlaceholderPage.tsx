import { Card } from '../components/ui'
import { PageHeader } from '../layouts/PageHeader'

/** 디자인이 아직 없는 화면용 임시 페이지. bare 면 헤더 없이 (프로젝트 탭 안) */
export function PlaceholderPage({ title, bare }: { title: string; bare?: boolean }) {
  return (
    <>
      {!bare && <PageHeader title={title} />}
      <Card>
        <p style={{ color: 'var(--text-muted)' }}>
          {bare ? `${title} — ` : ''}이 화면은 아직 디자인이 없어 준비 중이에요.
        </p>
      </Card>
    </>
  )
}
