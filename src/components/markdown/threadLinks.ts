// 본문 속 스레드 링크 (ERP-32): Markdown 이 링크 자리에 인용 카드를 끼우고, 글 화면이 본문에서 못 찾은 언급만 아래에 모은다
/** 본문의 스레드 링크 [제목](/projects/KEY/threads/12) */
export const THREAD_LINK = /\[[^\]]*\]\(\/projects\/([A-Z][A-Z0-9]*)\/threads\/(\d+)\)/g
export const FENCE = /^\s*(```|~~~)/
/** 스레드 링크의 열쇠 "KEY/12" (embeds 의 열쇠와 같다) */
export const threadKey = (projectKey: string, threadId: number) => `${projectKey}/${threadId}`
/** 본문에 링크한 스레드 열쇠들 (코드 블록 밖) */
export function threadKeysIn(source: string): Set<string> {
  const keys = new Set<string>()
  let fence = false
  for (const line of source.split('\n')) {
    if (FENCE.test(line)) fence = !fence
    if (!fence) for (const m of line.matchAll(THREAD_LINK)) keys.add(threadKey(m[1], Number(m[2])))
  }
  return keys
}
