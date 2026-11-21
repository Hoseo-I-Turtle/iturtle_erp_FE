// 프로젝트 스레드 목업 — docs/api/31-task.md 의 스레드 부분
export type ThreadPost = {
  postId: number
  title: string | null
  author: string
  createdAt: string
  ago: string
  editedBy?: string
  editedAt?: string
  body: string
  pinnedOrder: number | null
  pinnedBy?: string
  replyCount: number
  attachments: { name: string; size: string; kind: 'pdf' | 'image' }[]
  replies: { author: string; ago: string; body: string }[]
  /** 연결한 자료실 자료 카드 (ERP-18). available=false 면 "볼 수 없는 자료" */
  documents?: ThreadDocumentCard[]
  /** 본문에 링크한 다른 스레드 미리보기 (ERP-20) */
  mentions?: ThreadMentionCard[]
  /** 내가 고칠 수 있는 글인지 (서버 permissions.canEdit) */
  canEdit?: boolean
}

export type ThreadDocumentCard = {
  documentId: number
  available: boolean
  title: string | null
  categoryName: string | null
  visibility: 'LAB' | 'PROJECT_MEMBERS' | 'PRIVATE' | null
  author: string | null
}
export type ThreadMentionCard = {
  projectKey: string
  threadId: number
  available: boolean
  title: string | null
  excerpt: string | null
  author: string | null
  createdAt: string | null
}

const ARCH_BODY = `모듈러 모놀리스 구조와 요청 흐름을 정리합니다. 새 모듈을 만들 때 이 글을 먼저 봐 주세요. 관련 작업: DEFME-31

## 요청 흐름

\`\`\`mermaid
flowchart LR
  B([브라우저]) --> C[Controller] --> F["Facade<br/>@Transactional"] --> S[Service] --> R[Repository] --> D([MySQL])
  F -. 같은 트랜잭션 .-> A[AuditCommandApi]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  Facade->>Service: 저장
  Service->>Repository: save
\`\`\`
`

export const threadPosts: ThreadPost[] = [
  { postId: 1, title: '백엔드 아키텍처 정리', author: '박지훈', createdAt: '10/21', ago: '10/21', editedBy: '김서연', editedAt: '11/14', body: ARCH_BODY, pinnedOrder: 1, pinnedBy: '박지훈', replyCount: 6, attachments: [{ name: 'erd-v2.pdf', size: '1.2MB', kind: 'pdf' }, { name: 'module-deps.png', size: '340KB', kind: 'image' }], replies: [{ author: '김서연', ago: '11/14', body: 'Facade 아래 감사 로그 흐름 추가했어요. 고정 글이라 관리자도 고칠 수 있어서 바로 반영했습니다.' }] },
  { postId: 2, title: '개발 규칙 · 브랜치 전략', author: '김서연', createdAt: '10/25', ago: '11/03 수정', body: '- `main` 은 배포 가능한 상태만\n- 기능은 `feat/DEFME-12-설명` 브랜치\n- PR 은 리뷰어 1명 이상 승인', pinnedOrder: 2, pinnedBy: '박지훈', replyCount: 2, attachments: [], replies: [] },
  { postId: 3, title: '로컬 개발 환경 세팅', author: '박지훈', createdAt: '10/20', ago: '10/28 수정', body: '1. JDK 21 설치\n2. `docker compose up -d`\n3. `./gradlew bootRun`', pinnedOrder: 3, pinnedBy: '박지훈', replyCount: 4, attachments: [], replies: [] },
  { postId: 4, title: null, author: '이도윤', createdAt: '방금', ago: '방금', body: 'Vault 경로 묶기 승인 났어요. 이제 secret/projects/defme/ 에서 DB 계정 읽을 수 있습니다. DEFME-44 확인 부탁드려요.\n\n로컬 설정은 [로컬 개발 환경 세팅](/projects/DEFME/threads/3) 참고.', pinnedOrder: null, replyCount: 3, attachments: [], replies: [],
    mentions: [{ projectKey: 'DEFME', threadId: 3, available: true, title: '로컬 개발 환경 세팅', excerpt: '1. JDK 21 설치 2. `docker compose up -d` 3. `./gradlew bootRun`', author: '박지훈', createdAt: '10/20' }],
    documents: [
      { documentId: 2, available: true, title: 'SSO 로그인 흐름도', categoryName: '개발 문서', visibility: 'LAB', author: '김민서' },
      { documentId: 99, available: false, title: null, categoryName: null, visibility: null, author: null },
    ],
    canEdit: true },
  { postId: 5, title: '로그인 실패 잠금 정책 논의', author: '김서연', createdAt: '2시간 전', ago: '2시간 전', body: '5회 실패 → 10분 잠금 vs 지수 증가. 교수님 의견도 듣고 싶어요. 아래에 시퀀스 다이어그램 붙였습니다.\n\n```mermaid\nsequenceDiagram\n  actor U as 사용자\n  participant A as ERP\n  U->>A: 로그인 실패 5회\n  A-->>U: 10분 잠금\n```', pinnedOrder: null, replyCount: 5, attachments: [], replies: [] },
  { postId: 6, title: null, author: '박지훈', createdAt: '어제', ago: '어제', body: '배포 파이프라인 Jenkins 작업 연결했습니다. 빌드 실패 알림은 스레드로 오게 할까요?', pinnedOrder: null, replyCount: 1, attachments: [], replies: [] },
  { postId: 7, title: null, author: '최민준', createdAt: '11/12', ago: '11/12', body: '주간 회의 때 말한 ERD 초안 첨부합니다 (erd-v2.pdf)', pinnedOrder: null, replyCount: 2, attachments: [{ name: 'erd-v2.pdf', size: '1.2MB', kind: 'pdf' }], replies: [] },
]

export const THREAD_TOTAL = 24
