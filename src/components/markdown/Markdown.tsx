import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Code, Download, Eye, Share2, TriangleAlert } from 'lucide-react'
import { MENTION_RE, usePeople } from '../../api/people'
import { FENCE, THREAD_LINK, threadKey } from './threadLinks'
import s from './Markdown.module.css'

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * @로그인ID → 이름 언급 (ERP-34, 서버 알림과 같은 규칙 · 모르는 아이디는 그대로), DEFME-12 → 작업 링크.
 * 코드 블록 · 태그 밖의 글자에만.
 */
function decorate(html: string, projectKey: string | undefined, names: Map<string, string>) {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/g)
  return parts
    .map((p) =>
      p.startsWith('<')
        ? p
        : p
            .replace(MENTION_RE, (all: string, pre: string, raw: string) => {
              // 끝의 . - _ 는 문장 부호로 본다 (서버와 같음)
              const id = raw.replace(/[._-]+$/, '')
              if (id.length < 4) return all
              const name = names.get(id)
              return `${pre}<span class="md-mention" title="@${id}">@${escapeHtml(name ?? id)}</span>${raw.slice(id.length)}`
            })
            .replace(/\b([A-Z][A-Z0-9]+-\d+)\b/g, (_, k: string) =>
              projectKey && k.startsWith(projectKey + '-')
                ? `<a class="md-task" href="/projects/${projectKey}/tasks/${k}">${k}</a>`
                : `<span class="md-task">${k}</span>`,
            ),
    )
    .join('')
}

type Block = { kind: 'html'; html: string } | { kind: 'mermaid'; code: string } | { kind: 'embed'; key: string }

type Ctx = { projectKey?: string; names: Map<string, string>; embeds?: Map<string, ReactNode> }

function split(source: string, ctx: Ctx): Block[] {
  const blocks: Block[] = []
  const re = /```mermaid\n([\s\S]*?)```/g
  let last = 0
  for (const m of source.matchAll(re)) {
    blocks.push(...withEmbeds(source.slice(last, m.index), ctx))
    blocks.push({ kind: 'mermaid', code: m[1].trim() })
    last = m.index! + m[0].length
  }
  blocks.push(...withEmbeds(source.slice(last), ctx))
  return blocks
}

/**
 * 스레드 링크가 있는 줄 바로 뒤에 그 스레드의 인용 카드를 둔다 (ERP-32). 링크만 있는 줄은 카드로 바꾸고,
 * 문장 안의 링크는 문장을 그대로 두고 그 아래에 카드. 카드를 모르는 링크 · 코드 블록 안은 그대로.
 */
function withEmbeds(md: string, ctx: Ctx): Block[] {
  if (!md.trim()) return []
  const embeds = ctx.embeds
  if (!embeds || embeds.size === 0) return [{ kind: 'html', html: render(md, ctx) }]
  const out: Block[] = []
  let buf: string[] = []
  const flush = () => {
    if (buf.join('\n').trim()) out.push({ kind: 'html', html: render(buf.join('\n'), ctx) })
    buf = []
  }
  let fence = false
  for (const line of md.split('\n')) {
    if (FENCE.test(line)) fence = !fence
    const keys = fence ? [] : [...line.matchAll(THREAD_LINK)].map((m) => threadKey(m[1], Number(m[2]))).filter((k) => embeds.has(k))
    if (keys.length === 0) {
      buf.push(line)
      continue
    }
    // 목록 기호 · 쉼표 말고 다른 글이 없으면 링크만 있는 줄
    const onlyLinks = !line.replace(THREAD_LINK, '').replace(/[\s,·*>-]/g, '')
    if (!onlyLinks) buf.push(line)
    flush()
    keys.forEach((key) => out.push({ kind: 'embed', key }))
  }
  flush()
  return out
}

function render(md: string, ctx: Ctx) {
  const raw = marked.parse(md, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(decorate(raw, ctx.projectKey, ctx.names))
}

type Props = {
  source: string
  projectKey?: string
  /** 스레드 링크 자리에 넣을 카드 (열쇠 = threadKey). 없으면 링크 그대로 */
  embeds?: Map<string, ReactNode>
}

export function Markdown({ source, projectKey, embeds }: Props) {
  const people = usePeople()
  const names = useMemo(() => new Map(people.map((p) => [p.loginId, p.name])), [people])
  const blocks = useMemo(() => split(source, { projectKey, names, embeds }), [source, projectKey, names, embeds])
  return (
    <div className={s.md}>
      {blocks.map((b, i) =>
        b.kind === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : b.kind === 'embed' ? (
          <div key={i} className={s.embed}>
            {embeds?.get(b.key)}
          </div>
        ) : (
          <Mermaid key={i} code={b.code} />
        ),
      )}
    </div>
  )
}

let seq = 0
type MermaidState = { code: string; svg?: string; error?: string }

/** mermaid 는 무거워서 다이어그램이 있을 때만 불러온다 */
export function Mermaid({ code }: { code: string }) {
  const [state, setState] = useState<MermaidState>({ code })
  const [showCode, setShowCode] = useState(false)
  const [zoom, setZoom] = useState(false)
  const kind = code.split('\n')[0].trim()

  useEffect(() => {
    let alive = true
    import('mermaid').then(async ({ default: mermaid }) => {
      // suppressErrorRendering: 문법이 틀려도 mermaid 가 body 끝에 "Syntax error in text" 그림을 붙이지 않게 한다 (오류는 아래 칸에 보여 줌)
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'inherit', suppressErrorRendering: true })
      const id = `mmd-${++seq}`
      try {
        const { svg } = await mermaid.render(id, code)
        if (alive) setState({ code, svg })
      } catch (e) {
        const msg = e instanceof Error ? e.message.split('\n').slice(0, 2).join(' ') : String(e)
        if (alive) setState({ code, error: msg })
      } finally {
        // 그리다 실패하면 mermaid 가 잠깐 만든 자리(#d{id} · #{id})가 body 에 남을 수 있다 — 화면 밖으로 새지 않게 지운다
        document.getElementById(`d${id}`)?.remove()
        document.getElementById(id)?.remove()
      }
    })
    return () => {
      alive = false
    }
  }, [code])

  // 코드가 바뀐 직후에는 이전 결과를 보여 주지 않는다
  const current = state.code === code ? state : { code }

  if (current.error)
    return (
      <div className={s.mmdError} role="alert">
        <strong>
          <TriangleAlert size={14} /> 다이어그램을 그리지 못했어요 · {current.error}
        </strong>
        <pre>{code}</pre>
      </div>
    )

  const download = () => {
    if (!current.svg) return
    const url = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={zoom ? `${s.mmd} ${s.mmdZoom}` : s.mmd}>
      <div className={s.mmdBar}>
        <span className={s.mmdTag}>
          <Share2 size={12} /> mermaid
        </span>
        <span className={s.mmdKind}>{kind}</span>
        <span className={s.grow} />
        <button type="button" onClick={() => setShowCode(!showCode)}>
          <Code size={14} /> {showCode ? '그림 보기' : '코드 보기'}
        </button>
        <button type="button" onClick={() => setZoom(!zoom)}>
          <Eye size={14} /> {zoom ? '닫기' : '크게 보기'}
        </button>
        <button type="button" onClick={download} disabled={!current.svg}>
          <Download size={14} /> SVG
        </button>
      </div>
      {showCode ? (
        <pre className={s.mmdCode}>{code}</pre>
      ) : current.svg ? (
        <div className={s.mmdSvg} dangerouslySetInnerHTML={{ __html: current.svg }} />
      ) : (
        <div className={s.mmdLoading}>그리는 중…</div>
      )}
    </div>
  )
}
