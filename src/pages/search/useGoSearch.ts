import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { lookupTasks, TASK_KEY_PATTERN } from '../../api/tasks'

/**
 * 검색창에서 Enter: 작업 번호(DEFME-12)면 그 작업으로 바로 가고 (CMN-2-06, GET /tasks/lookup),
 * 아니거나 볼 수 없는 번호면 통합 검색 화면(/search?q=)으로 간다.
 */
export function useGoSearch() {
  const navigate = useNavigate()
  return useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q) return
      const key = q.toUpperCase()
      if (TASK_KEY_PATTERN.test(key)) {
        try {
          const [hit] = await lookupTasks([key])
          if (hit) {
            navigate(`/projects/${hit.projectKey}/tasks/${hit.taskKey}`)
            return
          }
        } catch {
          // 찾지 못하면 그냥 검색 결과로
        }
      }
      navigate(`/search?q=${encodeURIComponent(q)}`)
    },
    [navigate],
  )
}
