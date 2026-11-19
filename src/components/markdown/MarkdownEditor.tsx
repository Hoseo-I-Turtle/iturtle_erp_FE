import { useRef, useState } from 'react'
import {
  Bold,
  ChevronDown,
  Code,
  Eye,
  Heading,
  Image,
  Italic,
  Link2,
  List,
  Paperclip,
  Share2,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react'
import { Segmented } from '../ui'
import { Markdown } from './Markdown'
import s from './MarkdownEditor.module.css'

const DIAGRAMS: { label: string; kind: string; template: string }[] = [
  { label: '흐름도', kind: 'flowchart', template: 'flowchart LR\n  A[시작] --> B[처리] --> C[끝]' },
  {
    label: '시퀀스',
    kind: 'sequenceDiagram',
    template: 'sequenceDiagram\n  actor U as 사용자\n  participant A as 서버\n  U->>A: 요청\n  A-->>U: 응답',
  },
  { label: 'ER 다이어그램', kind: 'erDiagram', template: 'erDiagram\n  MEMBER ||--o{ TASK : "담당"' },
  { label: '상태', kind: 'stateDiagram', template: 'stateDiagram-v2\n  [*] --> 할일\n  할일 --> 진행중\n  진행중 --> 완료' },
  { label: '간트 차트', kind: 'gantt', template: 'gantt\n  dateFormat YYYY-MM-DD\n  작업A :a1, 2026-11-20, 5d' },
  { label: '마인드맵', kind: 'mindmap', template: 'mindmap\n  root((주제))\n    가지1\n    가지2' },
]

type Mode = 'write' | 'split' | 'preview'

/** 툴바 버튼: 선택 영역 앞뒤에 붙일 글자 */
const TOOLS: { icon: LucideIcon; label: string; before: string; after: string; fallback: string }[] = [
  { icon: Bold, label: '굵게', before: '**', after: '**', fallback: '굵게' },
  { icon: Italic, label: '기울임', before: '_', after: '_', fallback: '기울임' },
  { icon: Heading, label: '제목', before: '\n## ', after: '', fallback: '' },
  { icon: List, label: '목록', before: '\n- ', after: '', fallback: '' },
  { icon: SquareCheck, label: '체크리스트', before: '\n- [ ] ', after: '', fallback: '' },
  { icon: Code, label: '코드', before: '`', after: '`', fallback: 'code' },
  { icon: Link2, label: '링크', before: '[', after: '](https://)', fallback: '링크' },
  { icon: Image, label: '이미지', before: '![', after: '](이미지 주소)', fallback: '설명' },
  { icon: Paperclip, label: '첨부', before: '[첨부: ', after: ']', fallback: '파일 이름' },
]

type Props = {
  value: string
  onChange: (v: string) => void
  projectKey?: string
  placeholder?: string
  minHeight?: number
}

export function MarkdownEditor({ value, onChange, projectKey, placeholder, minHeight = 360 }: Props) {
  const [mode, setMode] = useState<Mode>('split')
  const [menu, setMenu] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  /** 선택 영역을 감싸거나 커서 위치에 넣는다 */
  const insert = (before: string, after = '', fallback = '') => {
    const el = ta.current
    if (!el) return onChange(value + before + fallback + after)
    const { selectionStart: a, selectionEnd: b } = el
    const sel = value.slice(a, b) || fallback
    const next = value.slice(0, a) + before + sel + after + value.slice(b)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, a + before.length + sel.length)
    })
  }
  return (
    <div className={s.editor}>
      <div className={s.toolbar}>
        {TOOLS.map(({ icon: Icon, label, before, after, fallback }) => (
          <button
            key={label}
            type="button"
            className={s.tool}
            onClick={() => insert(before, after, fallback)}
            aria-label={label}
            title={label}
          >
            <Icon size={16} />
          </button>
        ))}
        <div className={s.menuWrap}>
          <button type="button" className={s.diagramBtn} onClick={() => setMenu(!menu)} aria-expanded={menu}>
            <Share2 size={14} /> 다이어그램 넣기 <ChevronDown size={14} />
          </button>
          {menu && (
            <ul className={s.menu} role="menu">
              {DIAGRAMS.map((d) => (
                <li key={d.kind}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      insert('\n```mermaid\n' + d.template + '\n```\n')
                      setMenu(false)
                    }}
                  >
                    <span>{d.label}</span>
                    <code>{d.kind}</code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className={s.grow} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: '쓰기' },
            { value: 'split', label: '나란히' },
            { value: 'preview', label: '미리 보기' },
          ]}
        />
      </div>

      <div className={mode === 'split' ? `${s.panes} ${s.split}` : s.panes} style={{ minHeight: `min(${minHeight}px, 40vh)` }}>
        {mode !== 'preview' && (
          <textarea
            ref={ta}
            className={s.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
        )}
        {mode !== 'write' && (
          <div className={s.preview}>
            <div className={s.previewLabel}>
              <Eye size={14} /> 미리 보기
            </div>
            {value.trim() ? <Markdown source={value} projectKey={projectKey} /> : <p className={s.emptyPreview}>내용을 쓰면 여기에 보여요.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
