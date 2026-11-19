import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loadable } from '../../components/ui'
import { whenLive, type Resource } from '../../api/useResource'
import {
  createThread,
  errorText,
  pinThread,
  replyToThread,
  savePinnedOrder,
  useThreadBoard,
  useThreadReplies,
  type ThreadBoard,
  type ThreadPostView,
} from '../../api/content'
import { PinnedPostsCard } from './threads/PinnedPostsCard'
import { PostDetail } from './threads/PostDetail'
import { PostList } from './threads/PostList'
import { ThreadComposer } from './threads/ThreadComposer'
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
  const base = `/projects/${projectKey}/threads`
  const ME = d.meName

  const { posts } = d
  const setPosts = (f: (ps: ThreadPostView[]) => ThreadPostView[]) => board.setData((x) => ({ ...x, posts: f(x.posts) }))
  const [selectedId, setSelectedId] = useState(posts[0]?.postId ?? 0)
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
      />

      {composing && (
        <ThreadComposer
          projectName={projectName}
          projectKey={projectKey}
          onClose={() => navigate(base)}
          onSubmit={async (title, body) => {
            // 실서버는 만든 글을 받아 넣고, 목업은 그 자리에서 만든다
            const saved = await whenLive(() => createThread(projectKey, title, body))
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
