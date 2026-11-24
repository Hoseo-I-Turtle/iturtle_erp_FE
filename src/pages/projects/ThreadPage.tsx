import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Button, Loadable, Modal } from '../../components/ui'
import { LoadMore } from '../../components/ui/LoadMore'
import { useLoadMore } from '../../api/useLoadMore'
import { whenLive, type Resource } from '../../api/useResource'
import {
  createThread,
  deleteThread,
  updateThread,
  errorText,
  fetchMoreThreads,
  pinThread,
  replyToThread,
  savePinnedOrder,
  updateThreadDocuments,
  useThreadBoard,
  useThreadReplies,
  type ThreadBoard,
  type ThreadPostView,
} from '../../api/content'
import { PinnedPostsCard } from './threads/PinnedPostsCard'
import { PostDetail } from './threads/PostDetail'
import { PostList } from './threads/PostList'
import { ThreadComposer } from './threads/ThreadComposer'
import { DocumentPicker } from './threads/DocumentPicker'
import s from './ThreadPage.module.css'
import { useProjectHeader } from '../../api/projects'

export function ThreadPage() {
  const { key } = useParams()
  // 실서버면 GET /projects/{key} (목업이면 mocks) — 목업 프로젝트 이름이 실서버 화면에 섞이지 않게
  const project = useProjectHeader(key).data ?? { projectKey: key ?? '', name: key ?? '' }
  // 실서버에는 목업에 없는 프로젝트도 있으니 주소의 키를 그대로 쓴다
  const projectKey = key ?? project.projectKey
  const projectName = project.projectKey === projectKey ? project.name : projectKey
  const board = useThreadBoard(projectKey)
  return (
    <Loadable resource={board} label="스레드">
      {(d) => <ThreadView board={board} d={d} projectKey={projectKey} projectName={projectName} />}
    </Loadable>
  )
}

type ViewProps = { board: Resource<ThreadBoard>; d: ThreadBoard; projectKey: string; projectName: string }

function ThreadView({ board, d, projectKey, projectName }: ViewProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const composing = pathname.endsWith('/threads/new')
  // /threads/{id} (언급 카드 · 링크로 들어옴) 이면 그 글을 고른다
  const { threadId } = useParams()
  const linkedId = threadId && /^\d+$/.test(threadId) ? Number(threadId) : undefined
  const base = `/projects/${projectKey}/threads`
  const ME = d.meName

  const { posts } = d
  // 목록 끝에 닿으면 다음 페이지를 이어 붙인다 (고정 글만 볼 때는 더 부를 것이 없다)
  const more = useLoadMore(board, d.hasNext, (x) => fetchMoreThreads(projectKey, x))
  const setPosts = (f: (ps: ThreadPostView[]) => ThreadPostView[]) => board.setData((x) => ({ ...x, posts: f(x.posts) }))
  const [selectedId, setSelectedId] = useState(linkedId ?? posts[0]?.postId ?? 0)
  // 다른 글 링크로 옮겨 오면 그 글을 고른다 (렌더 중 파생 — 이전 주소와 비교)
  const [seenLinkedId, setSeenLinkedId] = useState(linkedId)
  if (linkedId !== seenLinkedId) {
    setSeenLinkedId(linkedId)
    if (linkedId !== undefined) setSelectedId(linkedId)
  }
  const [editingDocs, setEditingDocs] = useState<ThreadPostView | null>(null)
  // 글 고치기 · 지우기 (ERP-33)
  const [editingPost, setEditingPost] = useState<ThreadPostView | null>(null)
  const [deletingPost, setDeletingPost] = useState<ThreadPostView | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [savingDocs, setSavingDocs] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pinned = posts.filter((p) => p.pinnedOrder !== null).sort((a, b) => a.pinnedOrder! - b.pinnedOrder!)
  const all = pinnedOnly ? pinned : posts.filter((p) => p.pinnedOrder === null)
  const selected: ThreadPostView | undefined = posts.find((p) => p.postId === selectedId) ?? posts[0]
  // 답글은 고른 글마다 따로 불러온다 (목업은 글에 들어 있는 답글)
  const replies = useThreadReplies(selected?.postId, selected?.replies ?? [])

  const update = (id: number, f: (p: ThreadPostView) => ThreadPostView) => setPosts((ps) => ps.map((p) => (p.postId === id ? f(p) : p)))
  /** 저장 실패: 짧게 알리고 서버 내용으로 다시 맞춘다 */
  const fail = (e: unknown) => {
    setError(errorText(e))
    board.reload()
  }

  const togglePin = async (p: ThreadPostView) => {
    const pinning = p.pinnedOrder === null
    // 실서버: 제목 없는 글은 고정할 때 제목을 붙여야 한다 (H-4, P134). 목업은 그대로 고정한다
    let title: string | undefined
    if (pinning && !p.title) {
      const typed = await whenLive(async () => window.prompt('고정하려면 제목이 필요해요. 제목을 적어 주세요.')?.trim() ?? '')
      if (typed !== undefined) {
        if (!typed) return
        title = typed
      }
    }
    setError(null)
    if (!pinning) update(p.postId, (x) => ({ ...x, pinnedOrder: null }))
    else update(p.postId, (x) => ({ ...x, title: title ?? x.title, pinnedOrder: pinned.length + 1, pinnedBy: ME }))
    try {
      const saved = await whenLive(() => pinThread(projectKey, p.postId, pinning, title))
      if (saved) update(p.postId, (x) => ({ ...saved, replies: x.replies }))
    } catch (e) {
      fail(e)
    }
  }

  const reorder = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return
    const ids = pinned.map((p) => p.postId)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(to, 0, ids.splice(from, 1)[0])
    setError(null)
    setPosts((ps) => ps.map((p) => (p.pinnedOrder === null ? p : { ...p, pinnedOrder: ids.indexOf(p.postId) + 1 })))
    try {
      await whenLive(() => savePinnedOrder(projectKey, ids))
    } catch (e) {
      fail(e)
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    const body = reply
    const mine = { author: ME, ago: '방금', body }
    setError(null)
    update(selected.postId, (p) => ({ ...p, replyCount: p.replyCount + 1, replies: [...p.replies, mine] }))
    replies.setData((rs) => [...rs, mine])
    setReply('')
    try {
      await whenLive(() => replyToThread(selected.postId, body))
    } catch (e) {
      // 되돌리고 쓰던 내용은 입력 칸에 돌려놓는다
      setError(errorText(e, '답글을 올리지 못했어요.'))
      setReply(body)
      update(selected.postId, (p) => ({ ...p, replyCount: p.replyCount - 1, replies: p.replies.filter((r) => r !== mine) }))
      replies.reload()
    }
  }

  return (
    <div className={s.layout}>
      <div className={s.left}>
        <PinnedPostsCard
          pinned={pinned}
          limit={d.pinnedLimit}
          selectedId={selected?.postId}
          onSelect={setSelectedId}
          onDragStart={setDragId}
          onDrop={reorder}
          onDragEnd={() => setDragId(null)}
        />
        <PostList
          total={d.total}
          posts={all}
          pinnedOnly={pinnedOnly}
          onTogglePinnedOnly={() => setPinnedOnly(!pinnedOnly)}
          selectedId={selected?.postId}
          onSelect={setSelectedId}
          footer={!pinnedOnly && <LoadMore more={more} />}
        />
      </div>

      <PostDetail
        selected={selected}
        replies={replies.data ?? []}
        projectKey={projectKey}
        error={error}
        reply={reply}
        onReplyChange={setReply}
        onSendReply={sendReply}
        onTogglePin={togglePin}
        onEditDocuments={setEditingDocs}
        onEdit={setEditingPost}
        onDelete={setDeletingPost}
      />

      {editingPost && (
        <ThreadComposer
          projectName={projectName}
          projectKey={projectKey}
          initial={{ title: editingPost.title, body: editingPost.body }}
          onClose={() => setEditingPost(null)}
          onSubmit={async (title, body) => {
            const post = editingPost
            const saved = await whenLive(() => updateThread(projectKey, post.postId, title, body))
            update(post.postId, (x) =>
              saved ? { ...saved, replies: x.replies } : { ...x, title: title.trim() || null, body, editedBy: ME, editedAt: '방금' },
            )
            setEditingPost(null)
          }}
        />
      )}

      {deletingPost && (
        <Modal
          title="글을 지울까요?"
          width={440}
          onClose={() => setDeletingPost(null)}
          footer={
            <>
              <span className={s.grow} />
              <Button variant="secondary" onClick={() => setDeletingPost(null)}>
                취소
              </Button>
              <Button
                icon={Trash2}
                disabled={deleting}
                onClick={async () => {
                  const post = deletingPost
                  setDeleting(true)
                  setError(null)
                  try {
                    await whenLive(() => deleteThread(projectKey, post.postId))
                    board.setData((x) => ({ ...x, posts: x.posts.filter((p) => p.postId !== post.postId), total: Math.max(0, x.total - 1) }))
                    setSelectedId(posts.find((p) => p.postId !== post.postId)?.postId ?? 0)
                    setDeletingPost(null)
                    if (linkedId === post.postId) navigate(base)
                  } catch (e) {
                    setDeletingPost(null)
                    fail(e)
                  } finally {
                    setDeleting(false)
                  }
                }}
              >
                {deleting ? '지우는 중…' : '지우기'}
              </Button>
            </>
          }
        >
          <p className={s.deleteText}>
            &lsquo;{deletingPost.title ?? deletingPost.body.split('\n')[0].slice(0, 40)}&rsquo; 글과 답글이 보이지 않게 돼요.
          </p>
        </Modal>
      )}

      {editingDocs && (
        <DocumentPicker
          projectKey={projectKey}
          value={(editingDocs.documents ?? []).map((x) => ({ documentId: x.documentId, title: x.title ?? '볼 수 없는 자료' }))}
          saving={savingDocs}
          onClose={() => setEditingDocs(null)}
          onSave={async (picked) => {
            const post = editingDocs
            setSavingDocs(true)
            setError(null)
            try {
              const saved = await whenLive(() => updateThreadDocuments(projectKey, post.postId, picked.map((x) => x.documentId)))
              update(post.postId, (x) =>
                saved
                  ? { ...saved, replies: x.replies }
                  : {
                      ...x,
                      documents: picked.map((d) => x.documents?.find((o) => o.documentId === d.documentId) ?? { documentId: d.documentId, available: true, title: d.title, categoryName: null, visibility: null, author: null }),
                    },
              )
              setEditingDocs(null)
            } catch (e) {
              fail(e)
            } finally {
              setSavingDocs(false)
            }
          }}
        />
      )}

      {composing && (
        <ThreadComposer
          projectName={projectName}
          projectKey={projectKey}
          onClose={() => navigate(base)}
          onSubmit={async (title, body, documentIds) => {
            // 실서버는 만든 글을 받아 넣고, 목업은 그 자리에서 만든다
            const saved = await whenLive(() => createThread(projectKey, title, body, documentIds))
            const post: ThreadPostView = saved ?? {
              postId: Math.max(0, ...posts.map((p) => p.postId)) + 1,
              title: title || null,
              author: ME,
              createdAt: '방금',
              ago: '방금',
              body,
              pinnedOrder: null,
              replyCount: 0,
              attachments: [],
              replies: [],
              canEdit: true,
            }
            board.setData((x) => ({ ...x, posts: [post, ...x.posts], total: saved ? x.total + 1 : x.total }))
            setSelectedId(post.postId)
            navigate(base)
          }}
        />
      )}
    </div>
  )
}
