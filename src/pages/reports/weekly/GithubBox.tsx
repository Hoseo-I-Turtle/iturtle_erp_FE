import { GitBranch, GitCommitHorizontal, RefreshCw } from 'lucide-react'
import type { GithubActivity } from '../../../api/content'
import s from '../WeeklyReportPage.module.css'

/** GitHub 활동: 저장소 · 브랜치별 커밋 · 줄 수. onRefresh 가 없으면(읽기 전용, ERP-39) 새로 받기 단추를 숨긴다 */
export function GithubBox({ g, onRefresh }: { g: GithubActivity; onRefresh?: () => void }) {
  return (
    <div className={s.github}>
      <div className={s.boxHead}>
        <GitBranch size={18} />
        <strong>GitHub 활동</strong>
        <span className={s.grow} />
        <small>마지막으로 받은 시각 · {g.fetchedAgo}</small>
        {onRefresh && (
          <button type="button" className={s.copy} onClick={onRefresh}>
            <RefreshCw size={16} /> 지금 새로 받기
          </button>
        )}
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th>저장소 / 브랜치</th>
            <th>커밋</th>
            <th>추가</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => (
            <tr key={r.repo + r.branch}>
              <td>
                <GitBranch size={14} /> {r.repo} <span className={s.branch}>{r.branch}</span>
              </td>
              <td>{r.commits}</td>
              <td className={s.add}>+{r.add}</td>
              <td className={s.del}>−{r.del}</td>
            </tr>
          ))}
          <tr className={s.sum}>
            <td>
              <GitCommitHorizontal size={14} /> 합계 · 병합 커밋 {g.mergeCount}개와 lock 파일 제외
            </td>
            <td>{g.totals.c}</td>
            <td className={s.add}>+{g.totals.add}</td>
            <td className={s.del}>−{g.totals.del}</td>
          </tr>
        </tbody>
      </table>
      <p className={s.hint}>
        줄 수는 참고 지표예요. 리팩터링이나 자동 생성 코드로 크게 달라질 수 있어요. 같은 커밋이 여러 브랜치에 있으면 한 번만 세요.
      </p>
    </div>
  )
}
