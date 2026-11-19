/** 시간 단위 숫자 → 'HH:mm' (10.5 → 10:30) */
export const pad = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

/** 추천 시간대 하나: 날 · 시작 · 칸들 · 되는 사람 수 · 안 되는 사람 */
export type PollWindow = { day: number; start: number; keys: string[]; count: number; missing: string[] }

/** 응답한 사람 한 명 (칠한 칸을 Set 으로) */
export type PollPerson = { name: string; role: string; availability: string[]; set: Set<string> }
