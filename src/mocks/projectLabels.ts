// 프로젝트 라벨 목업 (Penpot 06 · 프로젝트 설정 · 라벨) — docs/api/30-project.md P-24
export type ProjectLabel = { labelId: number; name: string; color: string; description: string; taskCount: number }

export const LABEL_COLORS = ['#e5484d', '#f5a524', '#34c27a', '#3f6593', '#7c5cff', '#e85aa8', '#5b86b6', '#1b3554']

export const projectLabels: ProjectLabel[] = [
  { labelId: 1, name: '알림', color: '#3f6593', description: '알림 · 메일 · 푸시', taskCount: 6 },
  { labelId: 2, name: '프로필', color: '#7c5cff', description: '내 프로필 · 계정 화면', taskCount: 4 },
  { labelId: 3, name: '보안', color: '#e5484d', description: '권한 · 인증 · 감사', taskCount: 9 },
  { labelId: 4, name: '성능', color: '#f5a524', description: '느린 화면 · 쿼리', taskCount: 3 },
  { labelId: 5, name: '문서', color: '#34c27a', description: '가이드 · README', taskCount: 5 },
  { labelId: 6, name: '디자인', color: '#e85aa8', description: 'Penpot 화면 반영', taskCount: 7 },
  { labelId: 7, name: '인프라', color: '#1b3554', description: '배포 · nginx · Vault', taskCount: 11 },
]
