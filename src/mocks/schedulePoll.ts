// 모임 날짜 정하기(시간 맞추기) 목업
export type SchedulePoll = {
  id: string
  title: string
  project: string
  durationSlots: number // 1칸 = 1시간
  place: string
  deadline: string
  dday: string
  creator: string
  audience: string
  days: { key: string; label: string; long: string }[]
  hours: number[]
  /** 내 개인 일정으로 막힌 칸: "dayIdx-hour" → 라벨(첫 칸에만 표시) */
  myBusy: Record<string, string>
  myAvailability: string[]
  others: { name: string; role: string; availability: string[] }[]
  pending: { name: string; role: string }[]
}

const days = [
  { key: '2026-11-24', label: '11/24 월', long: '11/24(월)' },
  { key: '2026-11-25', label: '11/25 화', long: '11/25(화)' },
  { key: '2026-11-26', label: '11/26 수', long: '11/26(수)' },
  { key: '2026-11-27', label: '11/27 목', long: '11/27(목)' },
  { key: '2026-11-28', label: '11/28 금', long: '11/28(금)' },
]
const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18]

/** 디자인 시안의 '전체 결과' 숫자 (나 포함). 다른 응답자 가용 칸을 여기서 역산해 만든다. */
const TOTALS = [
  [3, 5, 2, 0, 5],
  [3, 5, 3, 0, 5],
  [2, 3, 3, 1, 4],
  [3, 2, 4, 2, 2],
  [6, 3, 6, 4, 2],
  [6, 2, 6, 4, 3],
  [6, 2, 5, 3, 3],
  [4, 3, 5, 2, 1],
  [2, 1, 3, 1, 0],
]
const MINE = ['0-14', '0-15', '0-16', '1-10', '1-11', '2-14', '2-15', '2-16', '2-17', '4-10', '4-11', '4-12']
const OTHERS = [
  { name: '박지훈', role: '학생' },
  { name: '최현우', role: '학생' },
  { name: '이정훈', role: '박사과정' },
  { name: '오세훈', role: '학생' },
  { name: '정교수', role: '교수' },
]

function buildOthers() {
  const avail = OTHERS.map(() => [] as string[])
  hours.forEach((h, hi) =>
    days.forEach((_, d) => {
      const key = `${d}-${h}`
      const need = Math.max(0, TOTALS[hi][d] - (MINE.includes(key) ? 1 : 0))
      // 칸마다 시작 사람을 돌려서 고르게 분포
      for (let k = 0; k < need; k++) avail[(d + hi + k) % OTHERS.length].push(key)
    }),
  )
  return OTHERS.map((p, i) => ({ ...p, availability: avail[i] }))
}

export const schedulePoll: SchedulePoll = {
  id: '1',
  title: 'DEFME 중간 점검 회의',
  project: 'DEFME 백엔드',
  durationSlots: 2,
  place: '세미나실 / Zoom',
  deadline: '11/19(수) 18:00',
  dday: 'D-2',
  creator: '박지훈',
  audience: 'DEFME 백엔드 참여자 8명',
  days,
  hours,
  myBusy: { '3-10': '서버 점검', '3-11': '', '3-12': '', '1-15': '랩 미팅', '1-16': '' },
  myAvailability: MINE,
  others: buildOthers(),
  pending: [
    { name: '한유진', role: '인턴' },
    { name: '윤서연', role: '학생' },
  ],
}
