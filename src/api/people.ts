// 사람 언급 (ERP-34): 본문에는 @로그인ID 로 쓰고(서버가 알림 대상을 찾는 규칙), 화면에는 이름으로 보인다.
import { useEffect, useState } from 'react'
import { api } from './client'
import { fetchAllPages, MAX_PAGE_SIZE, type PageResponse } from './types'
import { getDataMode } from '../lib/dataMode'

export type Person = { loginId: string; name: string; memberType: string }

/** 서버 CommentMentionService 와 같은 로그인 ID 규칙 (앞에 글자가 붙은 a@b 는 언급이 아니다) */
export const MENTION_RE = /(^|[^A-Za-z0-9._-])@([a-z][a-z0-9._-]{3,29})/g

const MOCK_PEOPLE: Person[] = [
  { loginId: 'minseo', name: '김민서', memberType: 'STUDENT' },
  { loginId: 'jihoon', name: '박지훈', memberType: 'STUDENT' },
  { loginId: 'hyunwoo', name: '최현우', memberType: 'STUDENT' },
  { loginId: 'jeonghoon', name: '이정훈', memberType: 'STUDENT' },
  { loginId: 'yujin', name: '한유진', memberType: 'INTERN' },
]

type MemberRow = { loginId: string; name: string; memberType: string }

// 한 화면에 Markdown 이 여러 개라 구성원 목록은 페이지당 한 번만 받는다
let cache: Person[] | null = null
let loading: Promise<Person[]> | null = null
function load() {
  if (!loading) {
    loading = Promise.all(
      (['ACTIVE', 'ALUMNI'] as const).map((group) =>
        fetchAllPages((page) =>
          api<{ page: PageResponse<MemberRow> }>('/members', { query: { group, page, size: MAX_PAGE_SIZE } }).then((r) => r.page),
        ),
      ),
    )
      .then(([active, alumni]) => (cache = [...active, ...alumni].map((m) => ({ loginId: m.loginId, name: m.name, memberType: m.memberType }))))
      .catch((e: unknown) => {
        loading = null
        throw e
      })
  }
  return loading
}

/** 언급할 수 있는 사람 (재실 · 휴학 · 졸업). 못 받으면 빈 목록 — 그때는 @아이디 그대로 보인다 */
export function usePeople(): Person[] {
  const live = getDataMode() === 'live'
  const [people, setPeople] = useState<Person[]>(() => (live ? (cache ?? []) : MOCK_PEOPLE))
  useEffect(() => {
    if (!live || cache) return
    let alive = true
    load()
      .then((p) => alive && setPeople(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [live])
  return people
}
