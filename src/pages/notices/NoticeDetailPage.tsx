import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Check,
  Clock,
  Ellipsis,
  Eye,
  Info,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Send,
  SquareCheck,
  TriangleAlert,
} from 'lucide-react'
import { Avatar, Breadcrumb, Button, Card, Chip, Columns, Empty, KeyValue, Loadable, Progress, SectionHead } from '../../components/ui'
import { Markdown } from '../../components/markdown/Markdown'
import { PageHeader } from '../../layouts/PageHeader'
import { ApiError } from '../../api/client'
import { whenLive } from '../../api/useResource'
import {
  postNoticeComment,
  putMyVote,
  useNoticeComments,
  useNoticeDetail,
  useOtherNotices,
  type CommentView,
  type NoticeView,
  type VoteOptionView,
  type VoteView,
} from '../../api/communication'
import { NoticeWriteButton } from './NoticeWriteModal'
import s from './NoticeDetailPage.module.css'

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)

export function NoticeDetailPage() {
  const { id } = useParams()
  const notice = useNoticeDetail(id)

  return (
    <>
      <PageHeader title="공지사항" subtitle="연구실 공지와 투표" action={<NoticeWriteButton />} />
      <Loadable resource={notice} label="공지">
        {(n) => <NoticeBody key={n.id} notice={n} />}
      </Loadable>
    </>
  )
}

function NoticeBody({ notice }: { notice: NoticeView }) {
  const others = useOtherNotices(notice.id)
  const read = notice.read
  const readPct = read && read.total ? Math.round((read.readCount / read.total) * 100) : 0

  return (
    <Columns
      main={
        <Card className={s.article}>
          <Breadcrumb items={[{ label: '공지사항', to: '/notices' }, { label: '상세' }]} />

          <div className={s.chips}>
            {notice.draft && <Chip tone="warning">임시 저장 · 아직 게시 전</Chip>}
            {notice.important && (
              <Chip tone="danger" icon={TriangleAlert}>
                필독
              </Chip>
            )}
            {notice.pinnedUntil && (
              <Chip tone="tint" icon={Pin}>
                상단 고정 · {notice.pinnedUntil}까지
              </Chip>
            )}
            {notice.vote && (
              <Chip tone="brand" icon={SquareCheck}>
                투표 포함
              </Chip>
            )}
          </div>

          <h2 className={s.title}>{notice.title}</h2>

          <div className={s.meta}>
            <Avatar name={notice.author} size={32} colorIndex={3} />
            <span className={s.author}>{notice.author}</span>
            <span className={s.metaText}>
              · {notice.createdAt}
              {notice.edited && ' · 수정됨'}
            </span>
            {notice.canEdit && (
              <span className={s.metaActions}>
                <Button variant="ghost" icon={Pencil} aria-label="수정" />
                <Button variant="ghost" icon={Ellipsis} aria-label="더 보기" />
              </span>
            )}
          </div>

          <div className={s.body}>
            <Markdown source={notice.body} />
          </div>

          {notice.attachments.map((a) => (
            <a key={a.name} href={a.url} className={s.attachment}>
              <Paperclip size={16} />
              <span className={s.attName}>{a.name}</span>
              <span className={s.attSize}>{a.size}</span>
            </a>
          ))}

          {notice.vote && <VoteBox noticeId={notice.noticeId} vote={notice.vote} meName={notice.meName} />}

          <Comments noticeId={notice.noticeId} id={notice.id} meName={notice.meName} />
        </Card>
      }
      side={
        <>
          {read && (
            <Card className={s.sideCard}>
              <SectionHead icon={Eye} title="읽음 확인" />
              {read.unread && <span className={s.privateChip}>작성자에게만 보여요</span>}
              <Progress value={readPct} color="var(--status-positive)" track="var(--status-negative-bg)" />
              <div className={s.readNums}>
                <span className={s.readYes}>읽음 {read.readCount}명</span>
                <span className={s.readNo}>안 읽음 {read.total - read.readCount}명</span>
              </div>
              {/* 명단은 작성자 · content-manage 에게만 온다 */}
              {read.unread && (
                <>
                  <div className={s.overline}>안 읽은 사람</div>
                  <ul className={s.people}>
                    {read.unread.map((p) => (
                      <li key={p.name}>
                        <Avatar name={p.name} size={28} />
                        <span className={s.personName}>{p.name}</span>
                        <span className={s.personRole}>{p.role}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          <Card>
            <SectionHead icon={Info} title="공지 정보" />
            <KeyValue items={notice.info} />
          </Card>

          <Card>
            <SectionHead icon={Megaphone} title="다른 공지" link={{ to: '/notices', label: '전체' }} />
            <Loadable resource={others} label="다른 공지">
              {(list) => (
                <ul className={s.others}>
                  {list.map((n) => (
                    <li key={n.id}>
                      <Link to={`/notices/${n.id}`}>
                        <div className={s.otherTitle}>{n.title}</div>
                        <div className={s.otherMeta}>{n.meta}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Loadable>
          </Card>
        </>
      }
    />
  )
}

/* ---------- 댓글 ---------- */
function Comments({ noticeId, id, meName }: { noticeId: number; id: string; meName: string }) {
  const comments = useNoticeComments(id)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    if (body.length > 2000) return setError('댓글은 2,000자까지 쓸 수 있어요.')
    setError('')
    setSending(true)
    // 먼저 목록에 붙이고, 서버 응답이 오면 그 값으로 바꾼다
    const temp: CommentView = { id: `tmp${Date.now()}`, author: meName, ago: '방금', text: body }
    comments.setData((prev) => [...prev, temp])
    setText('')
    try {
      const saved = await whenLive(() => postNoticeComment(noticeId, body))
      if (saved) comments.setData((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
    } catch (err) {
      comments.setData((prev) => prev.filter((c) => c.id !== temp.id))
      setText(body)
      setError(errText(err, '댓글을 올리지 못했어요.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className={s.commentsHead}>
        <MessageCircle size={18} />
        <span>댓글 {comments.data?.filter((c) => !c.deleted).length ?? ''}</span>
      </div>
      <Loadable resource={comments} label="댓글">
        {(list) =>
          list.length === 0 ? (
            <Empty>아직 댓글이 없어요.</Empty>
          ) : (
            <ul className={s.comments}>
              {list.map((c) => (
                <li key={c.id} className={s.comment} style={c.reply ? { marginLeft: 40 } : undefined}>
                  <Avatar name={c.author} size={32} />
                  <div>
                    <div className={s.commentHead}>
                      <strong>{c.author}</strong>
                      <span>{c.ago}</span>
                    </div>
                    <p style={c.deleted ? { color: 'var(--text-muted)' } : undefined}>{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Loadable>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-start' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="댓글을 남겨 주세요"
          aria-label="댓글"
          rows={2}
          maxLength={2000}
          style={{ flex: 1, resize: 'vertical', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #d5dde6)', font: 'inherit' }}
        />
        <Button type="submit" icon={Send} disabled={!text.trim() || sending}>
          등록
        </Button>
      </form>
      {error && (
        <p role="alert" style={{ color: 'var(--status-negative)', marginTop: 6 }}>
          {error}
        </p>
      )}
    </>
  )
}

/* ---------- 투표 ---------- */
function VoteBox({ noticeId, vote: initial, meName }: { noticeId: number; vote: VoteView; meName: string }) {
  const [vote, setVote] = useState(initial)
  const [options, setOptions] = useState(initial.options)
  // 투표 안 했고 아직 할 수 있으면 바로 고르는 상태로 연다
  const [editing, setEditing] = useState(!initial.voted && initial.canVote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mineCount = options.filter((o) => o.mine).length
  // 내가 고른 것이 생기거나 없어지면 참여 인원도 함께 바뀐다
  const participants = vote.participantCount - (vote.voted ? 1 : 0) + (mineCount > 0 ? 1 : 0)
  const counts = options.map((o) => o.count ?? 0)
  const maxVotes = Math.max(...counts)

  const toggle = (id: string) => {
    if (!editing) return
    setOptions((prev) => {
      const picked = prev.filter((o) => o.mine).length
      return prev.map((o): VoteOptionView => {
        if (o.id === id) {
          if (!o.mine && vote.multiple && vote.maxChoices && picked >= vote.maxChoices) return o
          return o.mine ? unpick(o) : pick(o)
        }
        if (!vote.multiple && o.mine) return unpick(o)
        return o
      })
    })
  }
  const pick = (o: VoteOptionView): VoteOptionView => ({
    ...o,
    mine: true,
    count: o.count === null ? null : o.count + 1,
    voters: vote.named ? [meName, ...o.voters] : o.voters,
  })
  const unpick = (o: VoteOptionView): VoteOptionView => ({
    ...o,
    mine: false,
    count: o.count === null ? null : Math.max(0, o.count - 1),
    voters: o.voters.filter((v) => v !== meName),
  })

  const finish = async () => {
    const picked = options.filter((o) => o.mine).map((o) => o.id)
    if (picked.length === 0) return setError('하나 이상 골라 주세요.')
    setError('')
    setSaving(true)
    try {
      const next = await whenLive(() => putMyVote(noticeId, picked))
      if (next) {
        setVote(next)
        setOptions(next.options)
      } else {
        setVote((v) => ({ ...v, voted: true, participantCount: participants }))
      }
      setEditing(false)
    } catch (err) {
      setOptions(vote.options)
      setError(errText(err, '투표를 저장하지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = () => {
    setError('')
    setEditing(true)
  }

  return (
    <section className={s.vote}>
      <div className={s.voteHead}>
        <SquareCheck size={20} />
        <h3>{vote.question}</h3>
        <span className={s.voteHeadChips}>
          <Chip tone="tint" className={s.whiteChip}>
            {vote.multiple ? (vote.maxChoices ? `최대 ${vote.maxChoices}개 선택` : '복수 선택') : '단일 선택'} · {vote.named ? '기명' : '익명'}
          </Chip>
          <Chip tone="warning" icon={Clock}>
            마감 {vote.dday}
          </Chip>
        </span>
      </div>

      {options.map((o) => {
        const pct = vote.eligible && o.count !== null ? Math.round((o.count / vote.eligible) * 100) : 0
        const shown = o.voters.slice(0, 4)
        const rest = (o.count ?? o.voters.length) - shown.length
        return (
          <button
            key={o.id}
            type="button"
            className={o.mine ? `${s.option} ${s.optionMine}` : s.option}
            onClick={() => toggle(o.id)}
            aria-pressed={o.mine}
            disabled={!editing || saving}
          >
            <span className={s.optionTop}>
              <span className={o.mine ? `${s.box} ${s.boxOn}` : s.box}>{o.mine && <Check size={14} strokeWidth={3} />}</span>
              <span className={s.optionLabel}>{o.label}</span>
              {/* 결과 공개 전이면 숫자가 오지 않는다 */}
              <span className={s.optionCount}>{o.count === null ? '결과 비공개' : `${o.count}명 · ${pct}%`}</span>
            </span>
            {o.count !== null && (
              <Progress value={pct} height={6} color={o.count === maxVotes ? 'var(--brand-400)' : 'var(--brand-200)'} />
            )}
            {vote.named && shown.length > 0 && (
              <span className={s.optionVoters}>
                {shown.join(', ')}
                {rest > 0 && ` 외 ${rest}명`}
              </span>
            )}
          </button>
        )
      })}

      <div className={s.voteFoot}>
        <span>
          {vote.eligible}명 중 {participants}명 참여
          {vote.canChange ? ' · 마감 전까지 바꿀 수 있어요' : !vote.named && vote.voted ? ' · 익명 투표는 바꿀 수 없어요' : ''}
        </span>
        {editing ? (
          <Button variant="primary" onClick={finish} disabled={saving}>
            투표 완료
          </Button>
        ) : (
          (vote.canChange || vote.canVote) && (
            <Button variant="secondary" onClick={startEdit}>
              {vote.voted ? '선택 바꾸기' : '투표하기'}
            </Button>
          )
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--status-negative)', marginTop: 6 }}>
          {error}
        </p>
      )}
    </section>
  )
}
