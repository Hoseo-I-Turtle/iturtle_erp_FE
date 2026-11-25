// 테마마다 글자 · 바탕 짝의 대비(WCAG 2.x)를 재고, AA 에 못 미치면 실패(종료 코드 1)한다.
//   node scripts/theme-contrast.mjs
// 바탕이 그라데이션이면 그 안의 색마다 재서 가장 낮은 값을 쓴다. 반쯤 비치는 색은 그 아래 바탕 위에 겹쳐 잰다.
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** "선택자 { ... }" 묶음에서 --이름: 값 을 뽑는다 */
function block(css, selector) {
  const i = css.indexOf(`${selector} {`)
  if (i < 0) return {}
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i))
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const tokens = read('tokens.css')
const themes = read('themes.css')
const root = block(tokens, ':root')
const THEMES = ['default', 'ocean', 'christmas', 'space', 'dark']
const vars = (t) => (t === 'default' ? root : { ...root, ...block(themes, `[data-theme='${t}']`) })

function resolve(v, all, depth = 0) {
  if (depth > 10) throw new Error(`var 고리: ${v}`)
  return v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fb) => resolve(all[name] ?? fb ?? '', all, depth + 1))
}

/** 값 안의 색들 [r, g, b, a] (그라데이션이면 여러 개) */
function colors(v) {
  const out = []
  for (const m of v.matchAll(/#([0-9a-f]{3,8})\b|rgba?\(([^)]+)\)/gi)) {
    if (m[1]) {
      let h = m[1]
      if (h.length <= 4) h = [...h].map((c) => c + c).join('')
      out.push([0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)).concat(h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1))
    } else {
      const p = m[2].split(/[,\s/]+/).filter(Boolean).map(Number)
      out.push([p[0], p[1], p[2], p[3] ?? 1])
    }
  }
  return out
}
const over = (top, under) => [0, 1, 2].map((k) => top[k] * top[3] + under[k] * (1 - top[3])).concat(1)
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/**
 * 잴 짝: [글자, 바탕, 그 바탕 아래 깔린 것(반투명일 때), 최소 대비, 설명]
 * 4.5 = 본문 글자, 3 = 큰 글자 · 아이콘 · 테두리 없는 조작칸
 */
const PAIRS = [
  ['--on-page-text', '--page-bg', null, 4.5, '바탕 위 글자'],
  ['--on-page-muted', '--page-bg', null, 4.5, '바탕 위 흐린 글자'],
  ['--page-title', '--page-bg', null, 3, '화면 제목 (큰 글자)'],
  ['--page-subtitle', '--page-bg', null, 4.5, '화면 부제'],
  ['--control-on-page-text', '--control-on-page-bg', '--page-bg', 4.5, '바탕 위 조작칸 글자'],
  ['--text-primary', '--surface-card', null, 4.5, '카드 제목'],
  ['--text-body', '--surface-card', null, 4.5, '카드 본문'],
  ['--text-secondary', '--surface-card', null, 4.5, '카드 보조 글자'],
  ['--text-muted', '--surface-card', null, 3, '카드 설명 · 날짜 (작은 보조)'],
  ['--text-primary', '--surface-tint', null, 4.5, '드롭다운 고른 줄'],
  ['--text-body', '--surface-sunken', null, 4.5, '드롭다운 마우스 올린 줄'],
]

let fail = 0
const rows = []
for (const t of THEMES) {
  const all = vars(t)
  for (const [fg, bg, under, min, what] of PAIRS) {
    const f = colors(resolve(all[fg] ?? '', all))[0]
    const base = under ? colors(resolve(all[under] ?? '', all)) : [[255, 255, 255, 1]]
    const bgs = colors(resolve(all[bg] ?? '', all)).flatMap((b) => base.map((u) => over(b, u)))
    if (!f || bgs.length === 0) {
      rows.push([t, what, fg, bg, '-', min, '값 없음'])
      fail++
      continue
    }
    const r = Math.min(...bgs.map((b) => ratio(over(f, b), b)))
    const ok = r >= min
    if (!ok) fail++
    rows.push([t, what, fg, bg, r.toFixed(2), min, ok ? 'OK' : 'FAIL'])
  }
}
const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)))
const head = ['theme', 'use', 'fg', 'bg', 'ratio', 'min', 'result']
console.log([head, ...rows].map((r) => r.map((c, i) => String(c).padEnd(Math.max(w[i], head[i].length))).join('  ')).join('\n'))
console.log(fail ? `\n${fail} 개가 AA 에 못 미침` : '\n모두 AA 통과')
process.exit(fail ? 1 : 0)
