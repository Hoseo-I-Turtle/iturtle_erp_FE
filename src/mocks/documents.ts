// 자료실 목업 — 필드 이름은 docs/api/40-document-file.md 의 DocumentSummary 를 따른다
export type DocumentCategory = 'PAPER' | 'SLIDE' | 'DEV_DOC' | 'DATA' | 'FORM' | 'QNA' | 'FREE'

export const CATEGORY_NAME: Record<DocumentCategory, string> = {
  PAPER: '논문',
  SLIDE: '발표자료',
  DEV_DOC: '개발 문서',
  DATA: '데이터',
  FORM: '서식',
  QNA: '질문 · 도움',
  FREE: '자유',
}

export type DocumentSummary = {
  documentId: number
  categoryCode: DocumentCategory
  title: string
  author: string
  ago: string
  /** 정렬용 (작을수록 최신) */
  ageMinutes: number
  project: { projectKey: string; name: string } | null
  visibility: 'LAB' | 'PROJECT_MEMBERS'
  tags: string[]
  fileTypes: string[]
  latestVersion: number
  commentCount: number
  resolved: boolean | null
  pinned: boolean
}

export const categoryCounts: Record<DocumentCategory, number> = {
  PAPER: 34,
  SLIDE: 27,
  DEV_DOC: 22,
  DATA: 9,
  FORM: 6,
  QNA: 18,
  FREE: 12,
}

const p = (projectKey: string, name: string) => ({ projectKey, name })

export const documents: DocumentSummary[] = [
  { documentId: 3, categoryCode: 'FORM', title: '연구실 주간 보고 양식', author: '정교수', ago: '2주 전', ageMinutes: 20160, project: null, visibility: 'LAB', tags: ['양식'], fileTypes: ['docx'], latestVersion: 1, commentCount: 0, resolved: null, pinned: true },
  { documentId: 210, categoryCode: 'PAPER', title: 'Code Review at Scale — 요약 정리', author: '이정훈', ago: '1시간 전', ageMinutes: 60, project: p('SEM', '11월 기술 세미나'), visibility: 'LAB', tags: ['코드리뷰', 'SE'], fileTypes: ['pdf'], latestVersion: 1, commentCount: 3, resolved: null, pinned: false },
  { documentId: 211, categoryCode: 'SLIDE', title: '코드 리뷰 문화 도입 발표', author: '김민서', ago: '어제', ageMinutes: 1440, project: p('SEM', '11월 기술 세미나'), visibility: 'LAB', tags: ['세미나'], fileTypes: ['pptx'], latestVersion: 2, commentCount: 5, resolved: null, pinned: false },
  { documentId: 212, categoryCode: 'DEV_DOC', title: 'DEFME 배포 가이드 (Vault · Jenkins)', author: '박지훈', ago: '3일 전', ageMinutes: 4320, project: p('DEFME', 'DEFME 백엔드'), visibility: 'PROJECT_MEMBERS', tags: ['배포', 'vault'], fileTypes: ['md'], latestVersion: 3, commentCount: 2, resolved: null, pinned: false },
  { documentId: 213, categoryCode: 'DATA', title: '센서 수집 데이터 11월 1주차', author: '최현우', ago: '4일 전', ageMinutes: 5760, project: p('PAPER', 'KCC 2027 투고'), visibility: 'PROJECT_MEMBERS', tags: ['raw'], fileTypes: ['zip'], latestVersion: 1, commentCount: 0, resolved: null, pinned: false },
  { documentId: 214, categoryCode: 'QNA', title: '개발 서버 접속 오류 해결 방법 문의', author: '최현우', ago: '5일 전', ageMinutes: 7200, project: null, visibility: 'LAB', tags: ['서버'], fileTypes: [], latestVersion: 1, commentCount: 4, resolved: true, pinned: false },
  { documentId: 215, categoryCode: 'PAPER', title: 'KCC 2027 투고 규정', author: '정교수', ago: '1주 전', ageMinutes: 10080, project: p('PAPER', 'KCC 2027 투고'), visibility: 'LAB', tags: ['KCC', '규정'], fileTypes: ['pdf'], latestVersion: 1, commentCount: 1, resolved: null, pinned: false },
  { documentId: 216, categoryCode: 'QNA', title: 'Testcontainers 가 Windows 에서 안 떠요', author: '한유진', ago: '2시간 전', ageMinutes: 120, project: null, visibility: 'LAB', tags: ['테스트'], fileTypes: [], latestVersion: 1, commentCount: 1, resolved: false, pinned: false },
  { documentId: 217, categoryCode: 'QNA', title: 'Penpot 에서 컴포넌트 공유하는 법?', author: '오세훈', ago: '어제', ageMinutes: 1500, project: null, visibility: 'LAB', tags: ['디자인'], fileTypes: [], latestVersion: 1, commentCount: 0, resolved: false, pinned: false },
]

export const pinnedDocs = [
  { documentId: 3, title: '연구실 주간 보고 양식', meta: '서식 · DOCX' },
  { documentId: 4, title: '논문 작성 체크리스트', meta: '서식 · PDF' },
  { documentId: 5, title: '연구실 보안 수칙', meta: '서식 · PDF' },
]

export const popularTags = ['세미나', '코드리뷰', '배포', 'vault', 'KCC', '데이터셋', 'SE', '양식', '서버']
