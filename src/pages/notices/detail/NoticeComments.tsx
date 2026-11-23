import { CommentThread } from '../../../components/comments/CommentThread'
import { mockNoticeComments } from '../../../api/communication'

/** 공지 댓글: 목록과 쓰기만 (답글 · 고치기 · 지우기는 공지 화면에서는 아직 열지 않는다) */
export function NoticeComments({ noticeId, id, meName }: { noticeId: number; id: string; meName: string }) {
  return <CommentThread targetType="NOTICE" targetId={noticeId} meName={meName} mock={() => mockNoticeComments(id)} manage={false} />
}
