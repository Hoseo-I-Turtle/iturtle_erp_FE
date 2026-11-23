// 공지 목록 목업 (Penpot 06 · 공지 목록) — docs/api/20-communication.md N-1 의 NoticeSummary 를 화면 모양으로
export type NoticeListItem = {
  id: string
  title: string
  author: string
  /** 11/14 */
  date: string
  mustRead: boolean
  /** 고정 기한 (11/30). 없으면 고정 아님 */
  pinnedUntil?: string
  read: boolean
  commentCount: number
  attachmentCount: number
  /** 투표: 진행 중 · 마감, 내가 대상인지 · 했는지, 한 줄 설명 */
  poll?: { closed: boolean; audience: boolean; voted: boolean; note: string }
}

export const noticeList: NoticeListItem[] = [
  { id: '1', title: '11월 기술 세미나: 코드 리뷰 문화 도입', author: '이정훈', date: '11/14', mustRead: true, pinnedUntil: '11/30', read: false, commentCount: 3, attachmentCount: 0 },
  { id: '2', title: '12월 연구실 회식 날짜를 정해요', author: '정교수', date: '11/17', mustRead: true, pinnedUntil: '11/30', read: true, commentCount: 2, attachmentCount: 1, poll: { closed: false, audience: true, voted: true, note: '투표 마감 11/20(목) · D-3' } },
  { id: '3', title: '서버 점검 안내 (11/27)', author: '박지훈', date: '11/16', mustRead: false, read: false, commentCount: 0, attachmentCount: 0 },
  { id: '4', title: '연구실 보안 수칙 개정', author: '정교수', date: '11/10', mustRead: false, read: true, commentCount: 4, attachmentCount: 1 },
  { id: '5', title: '11월 연구실 간식 신청', author: '한유진', date: '11/07', mustRead: false, read: true, commentCount: 6, attachmentCount: 0, poll: { closed: true, audience: true, voted: true, note: '9명 참여' } },
  { id: '6', title: '장비 예약 규칙 변경 (2일 전까지 예약)', author: '이정훈', date: '10/28', mustRead: false, read: true, commentCount: 1, attachmentCount: 0 },
  { id: '7', title: '논문 스터디 일정 변경 안내', author: '박지훈', date: '10/25', mustRead: false, read: true, commentCount: 0, attachmentCount: 0 },
  { id: '8', title: '연구실 대청소 (10/24 금)', author: '김민서', date: '10/20', mustRead: true, read: false, commentCount: 2, attachmentCount: 0 },
  { id: '9', title: '학회 참가 지원 신청 받아요', author: '정교수', date: '10/15', mustRead: false, read: false, commentCount: 5, attachmentCount: 2 },
]

/** 옆 칸 "진행 중인 투표" */
export const openPolls = [
  { id: '2', title: '12월 연구실 회식 날짜를 정해요', participantCount: 9, audienceCount: 11, dday: 'D-3', note: '복수 선택 · 기명' },
]
