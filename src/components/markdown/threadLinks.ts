// 본문 속 스레드 링크 (ERP-32): Markdown 이 링크 자리에 인용 카드를 끼우고, 글 화면이 본문에서 못 찾은 언급만 아래에 모은다

/** 주소 (서버 ThreadMentionService.LINK 와 같다): /projects/KEY/threads/12, 앞에 https://호스트 가 붙어도 된다 */
const PATH = String.raw`(?:https?:\/\/[^\s/()<>\]]+)?\/projects\/([A-Z][A-Z0-9]{1,9})\/threads\/(\d{1,18})`
/** 본문의 스레드 링크: [제목](주소) 또는 맨 주소 · URL */
export const THREAD_LINK = new RegExp(String.raw`\[[^\]]*\]\(${PATH}\)|${PATH}(?!\d)`, 'g')
export const FENCE = /^\s*(```|~~~)/
/** 스레드 링크의 열쇠 "KEY/12" (embeds 의 열쇠와 같다) */
export const threadKey = (projectKey: string, threadId: number) => `${projectKey}/${threadId}`
/** THREAD_LINK 결과의 열쇠 ([제목](주소) 면 1 · 2번, 맨 주소면 3 · 4번 묶음) */
export const keyOfMatch = (m: RegExpMatchArray) => threadKey(m[1] ?? m[3], Number(m[2] ?? m[4]))
/** 본문에 링크한 스레드 열쇠들 (코드 블록 밖) */
export function threadKeysIn(source: string): Set<string> {
  const keys = new Set<string>()
  let fence = false
  for (const line of source.split('\n')) {
    if (FENCE.test(line)) fence = !fence
    if (!fence) for (const m of line.matchAll(THREAD_LINK)) keys.add(keyOfMatch(m))
  }
  return keys
}
/** 카드 미리 보기에서 Markdown 기호를 걷어 낸 글 (제목 #, 표 |, 굵게 **, 코드 `, 인용 >, 구분선) */
export const plainExcerpt = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)#{1,6}\s/g, '$1')
    .replace(/\|?\s*-{3,}\s*(\|\s*-{3,}\s*)*\|?/g, ' ')
    .replace(/[|*`>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
