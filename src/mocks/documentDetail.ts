// 자료 상세 · 지운 자료 목업 (Penpot 06 · 자료 상세, 자료실 · 지운 자료) — docs/api/40-document-file.md D-3, D-1(deleted)
export type DocFileVersion = { version: number; name: string; size: string; uploadedBy: string; createdAt: string; note: string; url: string }
export type DocFileGroup = { logicalName: string; ext: string; latest: DocFileVersion; previous: DocFileVersion[] }
export type DocComment = { id: number; author: string; ago: string; text: string; mine: boolean }

export type DocumentDetailExtra = {
  body: string
  links: { title: string; url: string }[]
  files: DocFileGroup[]
  comments: DocComment[]
  resolvedCommentId: number | null
  created: string
  edited: string
}

const v = (version: number, name: string, size: string, createdAt: string, note: string): DocFileVersion => ({ version, name, size, uploadedBy: '박지훈', createdAt, note, url: '#' })

/** 어느 자료든 같은 상세 내용을 붙여 보여 준다 (목록의 제목 · 카테고리 · 태그는 그 자료 것) */
export const documentDetailExtra: DocumentDetailExtra = {
  body: `## 배포 순서
1. Vault 에서 \`secret/projects/defme/\` 아래 값을 확인합니다.
2. Jenkins 의 \`defme_BE\` 작업에서 main 브랜치를 빌드합니다.
3. 빌드가 끝나면 \`/actuator/health\` 로 상태를 확인합니다.

\`\`\`bash
$ vault kv get secret/projects/defme/db
$ curl https://lab.iturtle.win/defme/actuator/health
\`\`\`

비밀값은 문서에 적지 말고 Vault 경로만 적어 주세요.`,
  links: [{ title: 'Jenkins 작업', url: 'https://lab.iturtle.win/jenkins/job/defme_BE/' }],
  files: [
    {
      logicalName: 'deploy-guide.md',
      ext: 'md',
      latest: v(3, 'deploy-guide.md', '18KB', '11/14 14:00', 'Jenkins 작업 연결 추가'),
      previous: [v(2, 'deploy-guide.md', '17KB', '11/14 13:10', 'Vault 경로 수정'), v(1, 'deploy-guide.md', '15KB', '11/14 12:00', '초안')],
    },
    { logicalName: 'pipeline.png', ext: 'png', latest: v(1, 'pipeline.png', '240KB', '11/14 12:00', ''), previous: [] },
  ],
  comments: [
    { id: 881, author: '최현우', ago: '11/15', text: '3번에서 health 가 DOWN 이면 Vault 토큰 만료부터 확인하면 돼요.', mine: false },
    { id: 882, author: '김민서', ago: '11/16 · 수정됨', text: '롤백 순서도 추가해 주면 좋겠어요 @박지훈', mine: true },
  ],
  resolvedCommentId: null,
  created: '2026.11.14',
  edited: '11/14 14:00',
}

export type DeletedDocument = {
  documentId: number
  title: string
  categoryName: string
  ext: string | null
  /** '파일 2개 · 댓글 3' */
  contents: string
  author: string
  deletedBy: string
  deletedByNote: string
  deletedOn: string
  /** 완전 삭제까지 남은 날. 0 이면 정리 중 */
  daysLeft: number
}

export const deletedDocuments: DeletedDocument[] = [
  { documentId: 301, title: '2025 연구 계획서 초안', categoryName: '서식', ext: 'pdf', contents: '파일 2개 · 댓글 3', author: '이정훈', deletedBy: '이정훈', deletedByNote: '글쓴이', deletedOn: '11/20', daysLeft: 27 },
  { documentId: 302, title: '부하 테스트 원본 로그', categoryName: '개발 문서', ext: 'zip', contents: '파일 1개 · 1.2GB', author: '박지훈', deletedBy: '김민서', deletedByNote: 'DEFME 프로젝트 관리자', deletedOn: '11/12', daysLeft: 19 },
  { documentId: 303, title: '서버실 출입 방법 문의', categoryName: '질문 · 도움', ext: null, contents: '댓글 6', author: '오세훈', deletedBy: '정교수', deletedByNote: 'content-manage', deletedOn: '10/27', daysLeft: 3 },
  { documentId: 304, title: '10월 세미나 발표 (중복)', categoryName: '발표자료', ext: 'pptx', contents: '파일 1개', author: '한유진', deletedBy: '한유진', deletedByNote: '글쓴이', deletedOn: '10/23', daysLeft: 0 },
]
