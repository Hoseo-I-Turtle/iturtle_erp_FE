import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FileText,
  GripVertical,
  Image,
  Info,
  Link2,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Download,
  Share2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Avatar, Button, Card, Chip, ConfirmDialog, Empty, Loadable, Modal, Note } from '../../components/ui'
import { Markdown } from '../../components/markdown/Markdown'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { findProject } from '../../mocks/projects'
import { whenLive, type Resource } from '../../api/useResource'
import {
  createThread,
  errorText,
  deleteThread,
  editThread,
  pinThread,
  replyToThread,
  savePinnedOrder,
  useThreadBoard,
  useThreadReplies,
  type ThreadBoard,
  type ThreadPostView,
} from '../../api/content'
import s from './ThreadPage.module.css'

const firstLine = (p: ThreadPostView) => p.body.replace(/```[\s\S]*?```/g, '').trim()

export function ThreadPage() {
  const { key } = useParams()
  const project = findProject(key)
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

  // 글 고치기 · 지우기 (H-4, H-6)
  const [editing, setEditing] = useState<{ title: string; body: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const saveEdit = async (p: ThreadPostView) => {
    if (!editing) return
    setSaving(true)
    setEditError('')
    try {
      const saved = await whenLive(() => editThread(projectKey, p.postId, editing.title.trim(), editing.body))
      const today = new Date()
      setPosts((ps) =>
        ps.map((x) =>
          x.postId === p.postId
            ? (saved ?? { ...x, title: editing.title.trim() || null, body: editing.body, editedBy: ME, editedAt: `${today.getMonth() + 1}/${today.getDate()}` })
            : x,
        ),
      )
      setEditing(null)
    } catch (e) {
      setEditError(errorText(e, '글을 고치지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }
  const removePost = async (p: ThreadPostView) => {
    setSaving(true)
    setEditError('')
    try {
      await whenLive(() => deleteThread(projectKey, p.postId))
      board.setData((x) => ({ ...x, posts: x.posts.filter((y) => y.postId !== p.postId), total: Math.max(0, x.total - 1) }))
    } catch (e) {
      setEditError(errorText(e, '글을 지우지 못했어요.'))
    } finally {
      setSaving(false)
      setRemoving(false)
    }
  }
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
        <Card className={s.pinnedCard}>
          <div className={s.pinnedHead}>
            <Pin size={18} className={s.pinIcon} />
            <h2>고정 글</h2>
            <Chip tone="warning">
              {pinned.length} / {d.pinnedLimit}
            </Chip>
            <span className={s.hint}>끌어서 순서 바꾸기</span>
          </div>
          {pinned.length === 0 && <Empty>고정된 글이 없어요.</Empty>}
          {pinned.map((p) => (
            <button
              key={p.postId}
              type="button"
              draggable
              onDragStart={() => setDragId(p.postId)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(p.postId)}
              onDragEnd={() => setDragId(null)}
              className={p.postId === selected?.postId ? `${s.pinned} ${s.pinnedOn}` : s.pinned}
              onClick={() => setSelectedId(p.postId)}
            >
              <GripVertical size={16} className={s.grip} />
              <span className={s.pinnedText}>
                <strong>{p.title}</strong>
                <small>
                  {p.author} · {p.ago} · 답글 {p.replyCount}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </Card>

        <div className={s.allHead}>
          <h2>
            전체 글 <span>{d.total}</span>
          </h2>
          <button
            type="button"
            className={pinnedOnly ? `${s.pill} ${s.pillOn}` : s.pill}
            onClick={() => setPinnedOnly(!pinnedOnly)}
          >
            <Pin size={14} /> 고정 글만 보기
          </button>
          <span className={s.pill}>
            최근 답글 순 <ChevronDown size={14} />
          </span>
        </div>

        {all.map((p) => (
          <button
            key={p.postId}
            type="button"
            className={p.postId === selected?.postId ? `${s.post} ${s.postOn}` : s.post}
            onClick={() => setSelectedId(p.postId)}
          >
            <span className={s.postHead}>
              <Avatar name={p.author} size={26} />
              <strong>{p.author}</strong>
              <small>{p.ago}</small>
            </span>
            {p.title && <span className={s.postTitle}>{p.title}</span>}
            <span className={s.postBody}>{firstLine(p)}</span>
            <span className={s.postMeta}>
              <span>
                <MessageCircle size={14} /> 답글 {p.replyCount}
              </span>
              {p.body.includes('```mermaid') && (
                <span>
                  <Share2 size={14} /> 다이어그램
                </span>
              )}
              {p.attachments.length > 0 && (
                <span>
                  <Paperclip size={14} /> 첨부 {p.attachments.length}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <Card className={s.detail}>
        {error && (
          <Note icon={TriangleAlert} tone="warning">
            {error}
          </Note>
        )}
        {!selected ? (
          <Empty>아직 글이 없어요.</Empty>
        ) : (
          <>
            <div className={s.detailTop}>
              {selected.pinnedOrder !== null && (
                <Chip tone="warning" icon={Pin}>
                  고정됨 · {selected.pinnedOrder}번째
                </Chip>
              )}
              <Chip tone="tint" icon={FileText}>
                Markdown
              </Chip>
              <span className={s.grow} />
              <Button
                variant="secondary"
                className={s.small}
                icon={selected.pinnedOrder !== null ? PinOff : Pin}
                onClick={() => togglePin(selected)}
              >
                {selected.pinnedOrder !== null ? '고정 해제' : '고정'}
              </Button>
              {selected.author === ME && !editing && (
                <Button variant="secondary" className={s.small} icon={Pencil} onClick={() => setEditing({ title: selected.title ?? '', body: selected.body })}>
                  고치기
                </Button>
              )}
              <span className={s.moreWrap}>
                <Button variant="icon" icon={Ellipsis} aria-label="더 보기" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
                {menuOpen && (
                  <span className={s.moreMenu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${window.location.origin}${base}?post=${selected.postId}`)
                        setMenuOpen(false)
                      }}
                    >
                      <Link2 size={16} />
                      링크 복사
                    </button>
                    {selected.author === ME && (
                      <button
                        type="button"
                        role="menuitem"
                        className={s.moreDanger}
                        onClick={() => {
                          setMenuOpen(false)
                          setRemoving(true)
                        }}
                      >
                        <X size={16} />
                        지우기
                      </button>
                    )}
                  </span>
                )}
              </span>
            </div>
            {editError && <p className={s.editError}>{editError}</p>}
            {selected.title && <h2 className={s.detailTitle}>{selected.title}</h2>}
            <div className={s.detailMeta}>
              <Avatar name={selected.author} size={26} />
              <strong>{selected.author}</strong>
              <span>
                · {selected.createdAt} 작성
                {selected.editedBy && ` · ${selected.editedAt} ${selected.editedBy} 수정`}
                {selected.pinnedBy && ` · 고정: ${selected.pinnedBy}`}
              </span>
            </div>
            <hr className={s.hr} />
            {editing ? (
              <div className={s.editBox}>
                <input
                  className={s.editTitle}
                  value={editing.title}
                  maxLength={200}
                  placeholder="제목 (선택)"
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  aria-label="제목"
                />
                <MarkdownEditor value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} projectKey={projectKey} minHeight={220} />
                <div className={s.editFoot}>
                  <small>고치면 글 아래에 "수정" 표시가 붙어요. 새로 멘션한 사람에게만 알림이 가요</small>
                  <Button variant="secondary" onClick={() => setEditing(null)}>
                    취소
                  </Button>
                  <Button icon={Check} disabled={saving || !editing.body.trim()} onClick={() => saveEdit(selected)}>
                    저장
                  </Button>
                </div>
              </div>
            ) : (
              <Markdown source={selected.body} projectKey={projectKey} />
            )}
            {removing && (
              <ConfirmDialog title="이 글을 지울까요?" confirmLabel="지우기" icon={X} danger busy={saving} onClose={() => setRemoving(false)} onConfirm={() => removePost(selected)}>
                <p>
                  답글 {selected.replyCount}개와 첨부 파일 {selected.attachments.length}개도 함께 안 보이게 돼요. 지운 글은 되살릴 수 없어요.
                  {selected.pinnedOrder !== null && ' 고정된 글이라 지우면 상단 고정도 풀려요.'}
                </p>
              </ConfirmDialog>
            )}

            {selected.attachments.length > 0 && (
              <div className={s.files}>
                {selected.attachments.map((a) => (
                  <a key={a.name} href={a.url ?? '#'} className={s.file}>
                    {a.kind === 'image' ? <Image size={16} /> : <FileText size={16} />}
                    <strong>{a.name}</strong>
                    <small>{a.size}</small>
                    <Download size={16} />
                  </a>
                ))}
              </div>
            )}

            <hr className={s.hr} />
            <div className={s.repliesHead}>
              <h3>답글 {selected.replyCount}</h3>
              <span>글쓴이와 지켜보는 사람에게 알림</span>
            </div>
            {(replies.data ?? []).map((r, i) => (
              <div key={i} className={s.reply}>
                <Avatar name={r.author} size={26} />
                <div>
                  <div className={s.replyHead}>
                    <strong>{r.author}</strong>
                    <small>{r.ago}</small>
                  </div>
                  <Markdown source={r.body} projectKey={projectKey} />
                </div>
              </div>
            ))}
            <div className={s.replyBox}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendReply()}
                placeholder="답글 쓰기 · Markdown, mermaid 코드 블록 지원"
              />
              {/* TODO: 답글 첨부 (uploadFile → attachmentFileIds) */}
              <Paperclip size={18} className={s.clip} />
              <Button onClick={sendReply} className={s.small}>
                올리기
              </Button>
            </div>
          </>
        )}
      </Card>

      {composing && (
        <Composer
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

type ComposerProps = {
  projectName: string
  projectKey: string
  onClose: () => void
  onSubmit: (title: string, body: string) => Promise<void>
}
function Composer({ projectName, projectKey, onClose, onSubmit }: ComposerProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: 첨부 파일 고르는 칸 (api/content.ts 의 uploadFile → attachmentFileIds). 지금은 첨부 없이 올린다
  const submit = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await onSubmit(title, body)
    } catch (e) {
      setError(errorText(e, '글을 올리지 못했어요.'))
      setSending(false)
    }
  }

  return (
    <Modal
      title="새 글"
      badge={<Chip tone="tint">{projectName} · 스레드</Chip>}
      onClose={onClose}
      footer={
        <>
          <span className={s.composerHint}>
            {error ? <TriangleAlert size={16} /> : <Info size={16} />}
            {error ??
              `@이름으로 알리고, ${projectKey}-12 처럼 쓰면 작업 링크가 돼요. 상단 고정은 프로젝트 관리자가 글을 올린 뒤 할 수 있어요.`}
          </span>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={!body.trim() || sending}>
            올리기
          </Button>
        </>
      }
    >
      <label className={s.titleInput}>
        <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <small>제목 (선택) · {title.length} / 100</small>
      </label>
      <MarkdownEditor value={body} onChange={setBody} projectKey={projectKey} placeholder="내용을 Markdown 으로 써 주세요." />
    </Modal>
  )
}
