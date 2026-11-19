// 프로젝트 홈(개요) 목업 — DEFME 기준. 다른 프로젝트도 같은 모양으로 보여 준다.
export type ProjectMember = { name: string; role: 'MANAGER' | 'MEMBER'; note?: string }

export const projectDetail = {
  description: '연구실 ERP 와 SSO. Vault · Jenkins · Penpot 계정을 하나로 묶고, 공지 · 일정 · 프로젝트 기능을 더한다.',
  period: '2026.09.01 – 2027.02.28',
  taskTotal: 46,
  taskDone: 29,
  members: [
    { name: '김민서', role: 'MANAGER' },
    { name: '박지훈', role: 'MANAGER' },
    { name: '최현우', role: 'MEMBER' },
    { name: '이정훈', role: 'MEMBER' },
    { name: '한유진', role: 'MEMBER', note: '인턴' },
  ] as ProjectMember[],
  milestones: [
    { id: 21, name: 'v1.2 배포 — 공지 · 캘린더', done: 9, total: 14, due: '12/1', closed: false, soon: true },
    { id: 22, name: '문서화 · 운영 가이드', done: 3, total: 10, due: '12/15', closed: false, soon: false },
    { id: 20, name: 'v1.1 — SSO 5단계', done: 12, total: 12, due: '11/17', closed: true, soon: false },
  ],
  activity: [
    { who: '박지훈', text: '님이 DEFME-44 를 검토로 옮겼어요', ago: '5분 전' },
    { who: '김민서', text: '님이 DEFME-41 에 댓글을 남겼어요', ago: '20분 전' },
    { who: '최현우', text: '님이 회의록 "11/17 주간 회의"에서 작업 3개를 만들었어요', ago: '1시간 전' },
    { who: '이정훈', text: '님이 스레드에 "PR 리뷰 규칙 정리" 를 올렸어요', ago: '어제' },
  ],
  services: [
    { code: 'JENKINS', name: 'Jenkins', target: 'Hoseo-I-Turtle/defme_BE', status: { ok: true, text: '#142 성공 · 3분 전 · 4분 12초' }, myPerm: '내 권한 · 빌드' },
    { code: 'VAULT', name: 'Vault', target: 'secret/projects/defme/', status: { ok: null, text: '비밀값은 Vault 에서만 보여요' }, myPerm: '내 권한 · 쓰기' },
    { code: 'PENPOT', name: 'Penpot', target: 'DEFME 디자인 · 파일 4개', status: { ok: null, text: '2시간 전 수정 · 홈 화면 시안' }, myPerm: null },
    { code: 'GITHUB', name: 'GitHub', target: 'Hoseo-I-Turtle/defme_BE', status: { ok: null, text: '이번 주 커밋 23 · 열린 PR 2' }, myPerm: null },
  ] as const,
  permissions: [
    { who: '프로젝트 관리자 (기본)', vault: 'Vault 쓰기', jenkins: 'Jenkins 빌드' },
    { who: '참여자 (기본)', vault: 'Vault 읽기', jenkins: 'Jenkins 빌드' },
    { who: '한유진 (개별)', vault: 'Vault 없음', jenkins: 'Jenkins 읽기' },
  ],
  upcoming: [
    { title: 'DEFME-44 OIDC 로그아웃 테스트', when: '11/18', color: 'var(--status-warning-text)' },
    { title: '중간 점검 회의', when: '11/26 14:00', color: 'var(--brand-400)' },
    { title: '마일스톤 v1.2 배포', when: '12/1', color: 'var(--status-negative)' },
  ],
}
