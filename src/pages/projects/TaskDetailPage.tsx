import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  GitBranch,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Play,
  SquareCheck,
} from 'lucide-react'
import { Avatar, AvatarStack, Breadcrumb, Button, Card, Checkbox, Chip, Columns, Empty, SectionHead, Segmented, ListItem, Loadable } from '../../components/ui'
import { Markdown } from '../../components/markdown/Markdown'
import { PRIORITY_NAME, STATUS_NAME, TYPE_NAME, type TaskStatus } from '../../mocks/tasks'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import { postTaskComment, setChecklistDone, setWatching, transitionRule, transitionTask, useTaskDetail, type TaskDetailData } from '../../api/projects'
import s from './TaskDetailPage.module.css'

const FLOW: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const LINK_ICON = { minutes: ClipboardList, pr: GitBranch, build: Play, thread: MessageSquare, task: SquareCheck }

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

export function TaskDetailPage() {
  const { key, taskKey } = useParams()
  const detail = useTaskDetail(key, taskKey)
  return (
    <Loadable resource={detail} label="작업 상세">
      {(d) => <TaskDetailView key={d.task.taskKey} d={d} projectKey={key ?? d.task.taskKey.split('-')[0]} reload={detail.reload} />}
    </Loadable>
  )
}

function TaskDetailView({ d, projectKey, reload }: { d: TaskDetailData; projectKey: string; reload: () => void }) {
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
          <h2 className={s.title}>
            <SquareCheck size={20} />
            <span className={s.key}>{task.taskKey}</span>
            {task.title}
          </h2>

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
                {cancelled ? '할 일로 되돌리기' : `${STATUS_NAME[next]}로 옮기기`}
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
          <Markdown source={d.description} projectKey={projectKey} />

          {checklist.length > 0 && (
            <div className={s.checklist}>
              <div className={s.checkHead}>
                <ListChecks size={18} />
                <span>체크리스트</span>
                <strong className={done === checklist.length ? s.allDone : undefined}>
                  {done} / {checklist.length}
                </strong>
              </div>
              {checklist.map((c, i) => (
                <Checkbox key={c.itemId ?? c.text} checked={c.done} color="var(--status-positive)" onChange={(v) => toggleCheck(i, v)}>
                  <span className={c.done ? s.checkDone : undefined}>{c.text}</span>
                </Checkbox>
              ))}
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
            <dl className={s.props}>
              <dt>상태</dt>
              <dd>
                {cancelled ? (
                  <span className={s.statusChip}>취소</span>
                ) : (
                  <span className={`${s.statusChip} ${s[`st${status}`]}`}>{STATUS_NAME[status] ?? status}</span>
                )}
              </dd>
              <dt>담당자</dt>
              <dd>{task.assignee ? <Person name={task.assignee} /> : '없음'}</dd>
              <dt>요청자</dt>
              <dd>
                <Person name={task.requester} />
              </dd>
              <dt>우선순위</dt>
              <dd>
                <Chip tone={task.priority === 'URGENT' ? 'danger' : task.priority === 'HIGH' ? 'warning' : 'tint'}>
                  {PRIORITY_NAME[task.priority]}
                </Chip>
              </dd>
              <dt>유형</dt>
              <dd>
                <Chip tone="brand" icon={SquareCheck}>
                  {task.typeName ?? TYPE_NAME[task.type]}
                </Chip>
              </dd>
              <dt>기한</dt>
              <dd>
                {task.dueOn ? (
                  <Chip tone={task.dueState === 'overdue' ? 'danger' : 'warning'} icon={Clock}>
                    {task.dueOn}
                  </Chip>
                ) : (
                  '없음'
                )}
              </dd>
              <dt>라벨</dt>
              <dd className={s.labels}>
                {task.labels.map((l) => (
                  <Chip key={l} tone="tint">
                    {l}
                  </Chip>
                ))}
              </dd>
              <dt>마일스톤</dt>
              <dd>{task.milestone ?? '없음'}</dd>
            </dl>
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

function Person({ name }: { name: string }) {
  return (
    <span className={s.person}>
      <Avatar name={name} size={20} />
      {name}
    </span>
  )
}
