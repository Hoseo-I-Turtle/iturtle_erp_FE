// 화면 데이터 훅: 목업 모드면 목업을 바로 주고, 실서버 모드면 API 를 불러 화면 모양으로 바꾼 값을 준다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getDataMode } from '../lib/dataMode'
import { ApiError } from './client'

export type Resource<T> = {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
  /** 낙관적 업데이트 (화면에서 바로 고치고, 저장은 따로 부른다) */
  setData: (f: (prev: T) => T) => void
}

type State<T> = { key: string; data: T | undefined; error: string | null }

/**
 * @param key  이 값이 바뀌면 다시 불러온다 (JSON 으로 비교)
 * @param mock 목업 모드에서 쓸 값
 * @param live 실서버 모드에서 부를 함수 (API 응답 → 화면 모양 변환까지)
 */
export function useResource<T>(key: unknown, mock: () => T, live: () => Promise<T>): Resource<T> {
  const isLive = getDataMode() === 'live'
  const [tick, setTick] = useState(0)
  const reqKey = `${JSON.stringify(key)}#${tick}`

  const [state, setState] = useState<State<T>>(() =>
    isLive ? { key: '', data: undefined, error: null } : { key: reqKey, data: mock(), error: null },
  )

  // 목업: 키가 바뀌면 그 자리에서 다시 계산한다 (렌더 중 파생 상태)
  if (!isLive && state.key !== reqKey) setState({ key: reqKey, data: mock(), error: null })

  const liveRef = useRef(live)
  useLayoutEffect(() => {
    liveRef.current = live
  })

  useEffect(() => {
    if (!isLive) return
    let alive = true
    liveRef
      .current()
      .then((data) => alive && setState({ key: reqKey, data, error: null }))
      .catch(
        (e) =>
          alive &&
          setState((s) => ({ key: reqKey, data: s.data, error: e instanceof ApiError ? e.message : '데이터를 불러오지 못했어요.' })),
      )
    return () => {
      alive = false
    }
  }, [isLive, reqKey])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((f: (prev: T) => T) => setState((s) => (s.data === undefined ? s : { ...s, data: f(s.data) })), [])

  return {
    data: state.data,
    loading: isLive && state.key !== reqKey,
    error: state.key === reqKey ? state.error : null,
    reload,
    setData,
  }
}

/** 실서버 모드일 때만 API 를 부르는 저장 동작. 목업 모드에서는 아무것도 하지 않는다. */
export async function whenLive<T>(call: () => Promise<T>): Promise<T | undefined> {
  if (getDataMode() !== 'live') return undefined
  return call()
}
