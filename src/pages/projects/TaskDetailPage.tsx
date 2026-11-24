import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  GitBranch,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Play,
  Plus,
  SquareCheck,
  X,
} from 'lucide-react'
import { Avatar, AvatarStack, Breadcrumb, Button, Card, Checkbox, Columns, Empty, SectionHead, Segmented, ListItem, Loadable } from '../../components/ui'
import { Markdown } from '../../components/markdown/Markdown'
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor'
import { STATUS_NAME, type TaskStatus } from '../../mocks/tasks'
import { LoadMore } from '../../components/ui/LoadMore'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import { useLoadMore, type LoadMoreState } from '../../api/useLoadMore'
import {
  addChecklistItem,
  deleteChecklistItem,
  postTaskComment,
  renameChecklistItem,
  setChecklistDone,
  setWatching,
  transitionRule,
  transitionTask,
  updateTask,
  fetchMoreTaskActivity,
  useTaskDetail,
  type TaskDetailData,
  type TaskFields,
  type TaskPatch,
} from '../../api/projects'
import { useTaskFormOptions } from '../../api/tasks'
import { TaskFieldsPanel } from './TaskFieldsPanel'
import s from './TaskDetailPage.module.css'

const FLOW: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const LINK_ICON = { minutes: ClipboardList, pr: GitBranch, build: Play, thread: MessageSquare, task: SquareCheck }

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

/** 바뀐 칸 → T-4 본문 (빈 날짜 · 설명은 null = 비우기) */
function toPatch(next: Partial<TaskFields>): TaskPatch {
  const p: TaskPatch = {}
  if (next.title !== undefined) p.title = next.title
  if (next.description !== undefined) p.description = next.description.trim() ? next.description : null
  if (next.priority !== undefined) p.priority = next.priority
  if (next.assigneeId !== undefined) p.assigneeMemberId = next.assigneeId
  if (next.startOn !== undefined) p.startOn = next.startOn || null
  if (next.dueOn !== undefined) p.dueOn = next.dueOn || null
  if (next.labelIds !== undefined) p.labelIds = next.labelIds
  if (next.milestoneId !== undefined) p.milestoneId = next.milestoneId
  return p
}

/** 낱말 뒤에 붙일 조사 '로' / '으로' (받침이 없거나 ㄹ 이면 '로': 검토로 · 할 일로, 그 밖의 받침이면 '으로': 진행 중으로) */
function ro(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '로'
  const final = code % 28
  return final === 0 || final === 8 ? '로' : '으로'
}

export function TaskDetailPage() {
  const { key, taskKey } = useParams()
  const detail = useTaskDetail(key, taskKey)
  // 활동 기록: 목록 끝에 닿으면 다음 페이지를 이어 붙인다
  const moreActivity = useLoadMore(detail, detail.data?.activityHasNext, (d) => fetchMoreTaskActivity(key, taskKey, d))
  return (
    <Loadable resource={detail} label="작업 상세">
      {(d) => <TaskDetailView key={d.task.taskKey} d={d} projectKey={key ?? d.task.taskKey.split('-')[0]} reload={detail.reload} moreActivity={moreActivity} />}
    </Loadable>
  )
}

function TaskDetailView({ d, projectKey, reload, moreActivity }: { d: TaskDetailData; projectKey: string; reload: () => void; moreActivity: LoadMoreState }) {
  const task = d.task
  const ME = d.me

  const [status, setStatus] = useState<TaskStatus>(task.status)
  // 취소된 작업 (서버 CANCELLED). 화면 상태 칸에는 없어 따로 들고, '할 일로 되돌리기'(CANCELLED → TODO)만 할 수 있다
  const [cancelled, setCancelled] = useState(!!task.cancelled)
  // 상태를 옮길 때마다 서버가 올려 주는 동시 수정 값 (T-7)
  const [version, setVersion] = useState(task.version ?? 0)
  const [checklist, setChecklist] = useState(d.checklist)
  const [comments, setComments] = useState(d.comments)
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const [subscribed, setSubscribed] = useState(d.watching)
  const [watchCount, setWatchCount] = useState(d.watchCount)
  const [notice, setNotice] = useState<string | null>(null)
  // 바로 고치기 (ERP-12)
  const [fields, setFields] = useState(d.fields)
  const formOptions = useTaskFormOptions(projectKey, d.fields.canEdit)
  const editable = fields.canEdit && !cancelled
  const options = editable ? (formOptions.data ?? null) : null
  const [editingText, setEditingText] = useState(false)
  const [titleDraft, setTitleDraft] = useState(d.fields.title)
  const [descDraft, setDescDraft] = useState(d.fields.description)
  const [newItem, setNewItem] = useState('')
  const [renaming, setRenaming] = useState<{ index: number; text: string } | null>(null)

  const canComplete = task.requester === ME || d.isManager
  const done = checklist.filter((c) => c.done).length
  const idx = cancelled ? -1 : FLOW.indexOf(status)
  const next: TaskStatus | undefined = cancelled ? 'TODO' : FLOW[idx + 1]
  // 구독자 얼굴: 내 구독 여부만 화면에서 바꾼다
  const subscribers = subscribed ? (d.subscribers.includes(ME) ? d.subscribers : [...d.subscribers, ME]) : d.subscribers.filter((n) => n !== ME)
  const shownWatchCount = watchCount + (subscribed === d.watching ? 0 : subscribed ? 1 : -1)

  const addComment = (body: string) => {
    const temp = { author: ME, ago: '방금', body }
    setComments((c) => [...c, temp])
    if (task.taskId === undefined) return
    const taskId = task.taskId
    whenLive(() => postTaskComment(taskId, body))
      .then((saved) => saved && setComments((c) => c.map((x) => (x === temp ? saved : x))))
      .catch((e: unknown) => {
        setComments((c) => c.filter((x) => x !== temp))
        setDraft(body)
        setNotice(errMsg(e, '댓글을 저장하지 못했어요.'))
      })
  }

  /** 상태 옮기기: 화면에서 바로 바꾸고, 서버가 거절하면 되돌린다 (T-7) */
  const transition = (to: TaskStatus, reason?: string, onFail?: () => void) => {
    const before = status
    setNotice(null)
    setStatus(to)
    whenLive(() => transitionTask(task.taskKey, { toStatus: to, version, reason }))
      .then((r) => r?.task.version !== undefined && setVersion(r.task.version))
      .catch((e: unknown) => {
        setStatus(before)
        onFail?.()
        setNotice(errMsg(e, '상태를 바꾸지 못했어요.'))
        // 다른 사람이 먼저 고쳤으면 새로 불러온다
        if (e instanceof ApiError && e.code === 'P101') reload()
      })
  }

  const advance = () => {
    if (!next) return
    // 서버와 같은 이동 규칙 (TaskService.TRANSITIONS)
    const rule = transitionRule(cancelled ? 'CANCELLED' : status, next)
    if (!rule) return setNotice('이 상태로는 옮길 수 없어요.')
    if (next === 'IN_PROGRESS' && !task.assignee) return setNotice('담당자가 없는 작업은 진행 중으로 옮길 수 없어요.')
    if (rule.byRequester && !canComplete) return setNotice(`${next === 'DONE' ? '완료' : '되돌리기'}는 요청자나 프로젝트 관리자만 할 수 있어요.`)
    if (!rule.byRequester && task.assignee !== ME && !d.isManager) return setNotice('담당자나 프로젝트 관리자만 옮길 수 있어요.')
    if (cancelled) {
      setCancelled(false)
      transition(next, undefined, () => setCancelled(true))
      return
    }
    transition(next)
  }
  const reject = () => {
    if (!draft.trim()) return setNotice('반려하려면 사유를 댓글 칸에 먼저 써 주세요.')
    const reason = draft
    // 실서버는 사유를 반려 사유 댓글(REJECT_REASON)로 서버가 만든다. 화면에는 바로 보여 준다.
    const temp = { author: ME, ago: '방금', body: `반려: ${reason}` }
    setComments((c) => [...c, temp])
    setDraft('')
    transition('IN_PROGRESS', reason, () => {
      setComments((c) => c.filter((x) => x !== temp))
      setDraft(reason)
    })
  }

  /** 칸을 바로 고친다: 화면에서 먼저 바꾸고, 서버가 거절하면 되돌린다. 다른 사람이 먼저 고쳤으면(P101) 새로 불러온다 */
  const saveFields = (next: Partial<TaskFields>) => {
    const before = fields
    setFields({ ...fields, ...next })
    setNotice(null)
    whenLive(() => updateTask(task.taskKey, version, toPatch(next)))
      .then((r) => r && setVersion(r.version))
      .catch((e: unknown) => {
        setFields(before)
        setNotice(errMsg(e, '저장하지 못했어요.'))
        if (e instanceof ApiError && e.code === 'P101') reload()
      })
  }
  const saveText = () => {
    if (!titleDraft.trim()) return setNotice('제목을 써 주세요.')
    const next: Partial<TaskFields> = {}
    if (titleDraft.trim() !== fields.title) next.title = titleDraft.trim()
    if (descDraft !== fields.description) next.description = descDraft
    if (Object.keys(next).length > 0) saveFields(next)
    setEditingText(false)
  }

  const addItem = () => {
    const text = newItem.trim()
    if (!text) return
    const temp = { text, done: false }
    setChecklist((cl) => [...cl, temp])
    setNewItem('')
    whenLive(() => addChecklistItem(task.taskKey, text))
      .then((saved) => saved && setChecklist((cl) => cl.map((x) => (x === temp ? saved : x))))
      .catch((e: unknown) => {
        setChecklist((cl) => cl.filter((x) => x !== temp))
        setNewItem(text)
        setNotice(errMsg(e, '체크리스트 항목을 더하지 못했어요.'))
      })
  }
  const renameItem = (i: number, text: string) => {
    const item = checklist[i]
    setRenaming(null)
    if (!text.trim() || text.trim() === item.text) return
    setChecklist((cl) => cl.map((x, j) => (j === i ? { ...x, text: text.trim() } : x)))
    if (item.itemId === undefined) return
    const itemId = item.itemId
    whenLive(() => renameChecklistItem(task.taskKey, itemId, text.trim())).catch((e: unknown) => {
      setChecklist((cl) => cl.map((x, j) => (j === i ? item : x)))
      setNotice(errMsg(e, '체크리스트를 저장하지 못했어요.'))
    })
  }
  const removeItem = (i: number) => {
    const item = checklist[i]
    setChecklist((cl) => cl.filter((_, j) => j !== i))
    if (item.itemId === undefined) return
    const itemId = item.itemId
    whenLive(() => deleteChecklistItem(task.taskKey, itemId)).catch((e: unknown) => {
      setChecklist((cl) => [...cl.slice(0, i), item, ...cl.slice(i)])
      setNotice(errMsg(e, '체크리스트 항목을 지우지 못했어요.'))
    })
  }

  const toggleCheck = (i: number, v: boolean) => {
    const item = checklist[i]
    setChecklist((cl) => cl.map((x, j) => (j === i ? { ...x, done: v } : x)))
    if (item.itemId === undefined) return
    const itemId = item.itemId
    whenLive(() => setChecklistDone(task.taskKey, itemId, v)).catch((e: unknown) => {
      setChecklist((cl) => cl.map((x, j) => (j === i ? { ...x, done: !v } : x)))
      setNotice(errMsg(e, '체크리스트를 저장하지 못했어요.'))
    })
  }

  const toggleWatch = () => {
    const on = !subscribed
    setSubscribed(on)
    whenLive(() => setWatching(task.taskKey, on))
      .then((r) => {
        if (!r) return
        // 서버 숫자를 기준으로 맞춘다 (내 구독이 반영된 값)
        setWatchCount(r.count - (r.watching === d.watching ? 0 : r.watching ? 1 : -1))
      })
      .catch((e: unknown) => {
        setSubscribed(!on)
        setNotice(errMsg(e, '구독을 바꾸지 못했어요.'))
      })
  }

  return (
    <Columns
      main={
        <Card className={s.main}>
          <Breadcrumb
            items={[
              { label: d.projectName, to: `/projects/${projectKey}` },
              { label: '보드', to: `/projects/${projectKey}/board` },
              { label: task.taskKey },
            ]}
          />
          {editingText ? (
            <input className={s.titleInput} value={titleDraft} maxLength={200} onChange={(e) => setTitleDraft(e.target.value)} aria-label="제목" autoFocus />
          ) : (
            <h2 className={s.title}>
              <SquareCheck size={20} />
              <span className={s.key}>{task.taskKey}</span>
              {fields.title}
              {editable && (
                <Button
                  variant="icon"
                  icon={Pencil}
                  aria-label="제목 · 설명 고치기"
                  onClick={() => {
                    setTitleDraft(fields.title)
                    setDescDraft(fields.description)
                    setEditingText(true)
                  }}
                />
              )}
            </h2>
          )}

          <div className={s.flow}>
            {FLOW.map((st, i) => (
              <span key={st} className={s.step}>
                {i > 0 && <ChevronRight size={14} className={s.arrow} />}
                <span className={i < idx ? `${s.stepChip} ${s.past}` : i === idx ? `${s.stepChip} ${s.now}` : s.stepChip}>
                  {i < idx && <Check size={14} />}
                  {STATUS_NAME[st]}
                </span>
              </span>
            ))}
            <span className={s.grow} />
            {status === 'REVIEW' && (
              <Button variant="secondary" onClick={reject}>
                반려
              </Button>
            )}
            {next && (
              <Button icon={Check} onClick={advance}>
                {cancelled ? '할 일로 되돌리기' : `${STATUS_NAME[next]}${ro(STATUS_NAME[next])} 옮기기`}
              </Button>
            )}
          </div>
          {notice ? (
            <p className={s.warn}>{notice}</p>
          ) : (
            status === 'REVIEW' && (
              <p className={s.help}>
                완료는 요청자({task.requester})나 프로젝트 관리자가 할 수 있어요. 반려하려면 사유를 댓글로 남겨야 해요.
              </p>
            )
          )}

          <div className={s.label}>설명</div>
          {editingText ? (
            <>
              <MarkdownEditor value={descDraft} onChange={setDescDraft} projectKey={projectKey} placeholder="설명을 Markdown 으로 써 주세요." />
              <div className={s.editActions}>
                <Button variant="secondary" onClick={() => setEditingText(false)}>
                  취소
                </Button>
                <Button icon={Check} onClick={saveText} disabled={!titleDraft.trim()}>
                  저장
                </Button>
              </div>
            </>
          ) : (
            <Markdown source={fields.description} projectKey={projectKey} />
          )}

          {(checklist.length > 0 || editable) && (
            <div className={s.checklist}>
              <div className={s.checkHead}>
                <ListChecks size={18} />
                <span>체크리스트</span>
                <strong className={done === checklist.length ? s.allDone : undefined}>
                  {done} / {checklist.length}
                </strong>
              </div>
              {checklist.map((c, i) => (
                <div key={c.itemId ?? `${i}-${c.text}`} className={s.checkRow}>
                  {renaming?.index === i ? (
                    <input
                      className={s.inlineInput}
                      value={renaming.text}
                      maxLength={200}
                      autoFocus
                      onChange={(e) => setRenaming({ index: i, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) renameItem(i, renaming.text)
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      onBlur={() => renameItem(i, renaming.text)}
                      aria-label="항목 고치기"
                    />
                  ) : (
                    <Checkbox checked={c.done} color="var(--status-positive)" onChange={(v) => toggleCheck(i, v)}>
                      <span className={c.done ? s.checkDone : undefined}>{c.text}</span>
                    </Checkbox>
                  )}
                  {editable && renaming?.index !== i && (
                    <span className={s.checkTools}>
                      <button type="button" className={s.iconBtn} onClick={() => setRenaming({ index: i, text: c.text })} aria-label={`${c.text} 고치기`}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className={s.iconBtn} onClick={() => removeItem(i)} aria-label={`${c.text} 지우기`}>
                        <X size={14} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
              {editable && (
                <div className={s.checkRow}>
                  <Plus size={16} />
                  <input
                    className={s.inlineInput}
                    value={newItem}
                    maxLength={200}
                    placeholder="항목 더하기 (Enter)"
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addItem()}
                    aria-label="체크리스트 항목 더하기"
                  />
                </div>
              )}
            </div>
          )}

          {d.attachments.map((a) => (
            <a key={a.href + a.name} href={a.href} className={s.att}>
              <Paperclip size={16} />
              <strong>{a.name}</strong>
              <small>{a.size}</small>
            </a>
          ))}

          <div className={s.commentsHead}>
            <h3>댓글 {comments.length}</h3>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'comments', label: '댓글' },
                { value: 'activity', label: '활동 기록' },
              ]}
            />
          </div>
          {tab === 'comments'
            ? comments.map((c, i) => (
                <div key={c.commentId ?? `n${i}`} className={s.comment}>
                  <Avatar name={c.author} size={30} />
                  <div>
                    <div className={s.commentHead}>
                      <strong>{c.author}</strong>
                      <small>{c.ago}</small>
                    </div>
                    <Markdown source={c.body} projectKey={projectKey} />
                  </div>
                </div>
              ))
            : d.activity.map((a, i) => (
                <div key={i} className={s.activity}>
                  <Avatar name={a.who} size={24} />
                  <span>
                    <strong>{a.who}</strong> 님이 {a.text}
                  </span>
                  <small>{a.ago}</small>
                </div>
              ))}
          {tab === 'activity' && <LoadMore more={moreActivity} />}
          <div className={s.commentBox}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && draft.trim()) {
                  addComment(draft)
                  setDraft('')
                }
              }}
              placeholder="댓글 쓰기 · @로 멘션"
            />
            <Paperclip size={18} className={s.clip} />
            <Button
              onClick={() => {
                if (!draft.trim()) return
                addComment(draft)
                setDraft('')
              }}
            >
              등록
            </Button>
          </div>
        </Card>
      }
      side={
        <>
          <Card>
            <TaskFieldsPanel task={task} status={status} cancelled={cancelled} fields={fields} options={options} onChange={saveFields} />
          </Card>

          <Card>
            <div className={s.subHead}>
              <Eye size={20} />
              <h2>구독 {shownWatchCount}</h2>
              <Button variant="tint" icon={subscribed ? Check : undefined} onClick={toggleWatch}>
                {subscribed ? '구독 중' : '구독하기'}
              </Button>
            </div>
            <AvatarStack names={subscribers} />
            <p className={s.help}>요청자 · 담당자 · 댓글 단 사람 · 멘션된 사람은 자동으로 구독돼요.</p>
          </Card>

          <Card>
            <SectionHead icon={Link2} title="연결" />
            {d.links.length === 0 && <Empty>연결된 항목이 없어요.</Empty>}
            {d.links.map((l) => {
              const Icon = LINK_ICON[l.kind]
              return <ListItem key={l.title} leading={<Icon size={18} />} title={l.title} meta={l.meta} to={l.to} />
            })}
          </Card>
        </>
      }
    />
  )
}
