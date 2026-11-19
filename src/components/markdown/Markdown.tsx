import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Code, Download, Eye, Share2, TriangleAlert } from 'lucide-react'
import s from './Markdown.module.css'

/** @이름 → 언급, DEFME-12 → 작업 링크 (코드 블록 밖에서만) */
function decorate(html: string, projectKey?: string) {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/g)
  return parts
    .map((p) =>
      p.startsWith('<')
        ? p
        : p
            .replace(/@([가-힣A-Za-z]{2,10})/g, '<span class="md-mention">@$1</span>')
            .replace(/\b([A-Z][A-Z0-9]+-\d+)\b/g, (_, k: string) =>
              projectKey && k.startsWith(projectKey + '-')
                ? `<a class="md-task" href="/projects/${projectKey}/tasks/${k}">${k}</a>`
                : `<span class="md-task">${k}</span>`,
            ),
    )
    .join('')
}

type Block = { kind: 'html'; html: string } | { kind: 'mermaid'; code: string }

function split(source: string, projectKey?: string): Block[] {
  const blocks: Block[] = []
  const re = /```mermaid\n([\s\S]*?)```/g
  let last = 0
  for (const m of source.matchAll(re)) {
    const before = source.slice(last, m.index)
    if (before.trim()) blocks.push({ kind: 'html', html: render(before, projectKey) })
    blocks.push({ kind: 'mermaid', code: m[1].trim() })
    last = m.index! + m[0].length
  }
  const rest = source.slice(last)
  if (rest.trim()) blocks.push({ kind: 'html', html: render(rest, projectKey) })
  return blocks
}

function render(md: string, projectKey?: string) {
  const raw = marked.parse(md, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(decorate(raw, projectKey))
}

export function Markdown({ source, projectKey }: { source: string; projectKey?: string }) {
  const blocks = useMemo(() => split(source, projectKey), [source, projectKey])
  return (
    <div className={s.md}>
      {blocks.map((b, i) =>
        b.kind === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />
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
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'inherit' })
      try {
        const { svg } = await mermaid.render(`mmd-${++seq}`, code)
        if (alive) setState({ code, svg })
      } catch (e) {
        const msg = e instanceof Error ? e.message.split('\n').slice(0, 2).join(' ') : String(e)
        if (alive) setState({ code, error: msg })
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
