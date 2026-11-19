// 회의록 목업 — docs/api/32-minute-report.md
export type MinuteTodo = {
  id: number
  text: string
  assignee: string
  dueOn: string
  task?: { taskKey: string; status: string }
}

export type Minute = {
  minuteId: number
  title: string
  when: string
  place: string
  event: string
  template: string
  attendees: string[]
  absent: string[]
  agenda: string[]
  discussion: string[]
  decisions: string[]
  todos: MinuteTodo[]
  version: number
}

export const minutes: Minute[] = [
  {
    minuteId: 17,
    title: '11/17 주간 회의',
    when: '11/17(월) 14:00 – 15:00',
    place: '세미나실',
    event: '공용 일정 · 주간 회의',
    template: '양식 · 개발',
    attendees: ['김민서', '박지훈', '최현우', '이정훈'],
    absent: ['한유진'],
    agenda: ['v1.2 범위 확정 (공지 · 캘린더)', 'SSO 5단계 마무리와 Penpot 이관 남은 2명', '파일 저장소(MinIO) 설치 일정'],
    discussion: ['공지 투표는 공지 하나에 하나만 붙이기로 함', 'MinIO 는 연구실 서버에 컨테이너로 두고 바깥에 공개하지 않음'],
    decisions: ['v1.2 마감은 12/1 로 유지', '알림(사이트 안)은 1차에 포함'],
    todos: [
      { id: 1, text: 'Penpot 남은 2명 계정 이관', assignee: '박지훈', dueOn: '11/21', task: { taskKey: 'DEFME-50', status: '할 일' } },
      { id: 2, text: 'MinIO 컨테이너 compose 작성', assignee: '최현우', dueOn: '11/24', task: { taskKey: 'DEFME-51', status: '진행 중' } },
      { id: 3, text: '공지 투표 UI 시안 정리', assignee: '김민서', dueOn: '11/20' },
      { id: 4, text: '알림 종류 목록 SRS 와 맞추기', assignee: '이정훈', dueOn: '11/21' },
    ],
    version: 3,
  },
  {
    minuteId: 16,
    title: '11/10 주간 회의',
    when: '11/10(월) 14:00 – 15:00',
    place: '세미나실',
    event: '공용 일정 · 주간 회의',
    template: '양식 · 개발',
    attendees: ['김민서', '박지훈', '최현우', '이정훈', '한유진'],
    absent: [],
    agenda: ['OIDC 로그아웃 케이스 정리', 'v1.1 회고'],
    discussion: ['Penpot 2.x 는 client_id 로만 로그아웃 요청을 보냄'],
    decisions: ['로그아웃 6가지 케이스를 테스트로 고정'],
    todos: [
      { id: 1, text: 'OIDC 로그아웃 테스트 케이스 추가', assignee: '김민서', dueOn: '11/18', task: { taskKey: 'DEFME-44', status: '검토' } },
      { id: 2, text: '로그인 화면 리팩터링', assignee: '김민서', dueOn: '11/17', task: { taskKey: 'DEFME-41', status: '진행 중' } },
      { id: 3, text: 'MinIO 서명 주소 만료 정하기', assignee: '박지훈', dueOn: '11/25', task: { taskKey: 'DEFME-46', status: '진행 중' } },
    ],
    version: 1,
  },
]

export const minuteHistory = [
  { who: '박지훈', ago: '2분 전', what: '결정 사항' },
  { who: '김민서', ago: '30분 전', what: '할 일 2개 추가' },
  { who: '최현우', ago: '1시간 전', what: '처음 작성' },
]

export const otherMinutes = [
  { id: 16, title: '11/10 주간 회의', meta: 'DEFME 백엔드 · 할 일 3 → 작업 3' },
  { id: 0, title: '11/05 기술 세미나', meta: '연구실 회의 · 세미나 양식' },
  { id: 0, title: '11/03 주간 회의', meta: 'DEFME 백엔드 · 할 일 2' },
]
