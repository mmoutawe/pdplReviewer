import { useEffect, useReducer } from 'react'

type Store<T> = {
  getState: () => T
  subscribe: (l: () => void) => () => void
}

export function useStore<T>(store: Store<T>): T {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  useEffect(() => store.subscribe(rerender), [store])
  return store.getState()
}
