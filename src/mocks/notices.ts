// 공지 목업 데이터
export type Person = { name: string; role: string }

export type VoteOption = { id: string; label: string; voters: string[] }
export type Vote = {
  question: string
  multiple: boolean
  named: boolean
  deadline: string
  dday: string
  eligible: number
  options: VoteOption[]
}

export type Notice = {
  id: string
  title: string
  body: string
  author: string
  createdAt: string
  edited?: boolean
  important?: boolean
  pinnedUntil?: string
  attachments: { name: string; size: string }[]
  vote?: Vote
  comments: { author: string; ago: string; text: string }[]
  read: { total: number; readCount: number; unread: Person[] }
  info: [string, string][]
}

export const ME = '김민서'

export const notices: Notice[] = [
  {
    id: '2',
    title: '12월 연구실 회식 날짜를 정해요',
    body:
      '올해 마지막 회식 날짜를 정하려고 합니다. 가능한 날짜를 모두 골라 주세요(복수 선택). 가장 많이 나온 날로 정하고, 장소는 정해지면 다시 공지하겠습니다. 투표는 11월 20일(목) 18시에 마감하며, 마감 전까지는 선택을 바꿀 수 있어요.',
    author: '정교수',
    createdAt: '11/17(월) 09:12',
    edited: true,
    important: true,
    pinnedUntil: '11/30',
    attachments: [{ name: '회식_장소후보.pdf', size: '1.2MB' }],
    vote: {
      question: '가능한 날짜를 모두 골라 주세요',
      multiple: true,
      named: true,
      deadline: '11/20(목) 18:00',
      dday: 'D-3',
      eligible: 11,
      options: [
        { id: 'a', label: '12/18(목) 저녁', voters: ['김민서', '박지훈', '최현우', '이정훈', '정교수', '오세훈', '윤서연'] },
        { id: 'b', label: '12/19(금) 저녁', voters: ['김민서', '정교수', '이정훈', '박지훈', '윤서연'] },
        { id: 'c', label: '12/22(월) 저녁', voters: ['최현우', '한유진'] },
      ],
    },
    comments: [
      { author: '박지훈', ago: '30분 전', text: '18일이 제일 좋은데 19일도 괜찮습니다!' },
      { author: '최현우', ago: '12분 전', text: '22일은 학회 발표 준비 때문에 어려울 것 같아요.' },
    ],
    read: {
      total: 11,
      readCount: 8,
      unread: [
        { name: '한유진', role: '인턴' },
        { name: '오세훈', role: '학생' },
        { name: '윤서연', role: '학생' },
      ],
    },
    info: [
      ['대상', '전체 구성원 (11명)'],
      ['투표 대상', '전체 구성원'],
      ['결과 공개', '투표한 뒤 바로'],
      ['고정 기한', '11/30(일)까지'],
      ['첨부', '1개 · 1.2MB'],
    ],
  },
]

export const otherNotices = [
  { id: '1', title: '11월 기술 세미나: 코드 리뷰 문화 도입', meta: '필독 · 이정훈 · 1시간 전' },
  { id: '3', title: '서버 점검 안내 (11/27)', meta: '박지훈 · 3일 전' },
  { id: '4', title: '연구실 보안 수칙 개정', meta: '정교수 · 1주 전' },
]

/** 공지 목록 목업 (디자인 06 Screens · 공지 목록) */
export type NoticeRowMock = {
  id: string
  title: string
  author: string
  date: string
  mustRead: boolean
  pinnedUntil?: string
  read: boolean
  commentCount: number
  attachmentCount: number
  poll?: { closed: boolean; voted: boolean; dday: string }
}
export const noticeRows: NoticeRowMock[] = [
  { id: '1', title: '11월 기술 세미나: 코드 리뷰 문화 도입', author: '이정훈', date: '11/14', mustRead: true, pinnedUntil: '11/30', read: false, commentCount: 3, attachmentCount: 0 },
  { id: '2', title: '12월 연구실 회식 날짜를 정해요', author: '정교수', date: '11/17', mustRead: true, pinnedUntil: '11/30', read: true, commentCount: 2, attachmentCount: 1, poll: { closed: false, voted: true, dday: 'D-3' } },
  { id: '3', title: '서버 점검 안내 (11/27)', author: '박지훈', date: '11/16', mustRead: false, read: false, commentCount: 0, attachmentCount: 0 },
  { id: '4', title: '연구실 보안 수칙 개정', author: '정교수', date: '11/10', mustRead: false, read: true, commentCount: 4, attachmentCount: 1 },
  { id: '5', title: '11월 연구실 간식 신청', author: '한유진', date: '11/07', mustRead: false, read: true, commentCount: 6, attachmentCount: 0, poll: { closed: true, voted: true, dday: '마감' } },
  { id: '6', title: '장비 예약 규칙 변경 (2일 전까지 예약)', author: '이정훈', date: '10/28', mustRead: false, read: true, commentCount: 1, attachmentCount: 0 },
  { id: '7', title: '논문 스터디 일정 변경 안내', author: '박지훈', date: '10/25', mustRead: false, read: true, commentCount: 0, attachmentCount: 0 },
]
