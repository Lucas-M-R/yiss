// Module-level storage for the current page's refresh function (client-side only)
let _refreshFn: (() => Promise<void>) | null = null

export const usePageRefresh = () => {
  const register = (fn: () => Promise<void>) => {
    _refreshFn = fn
    onUnmounted(() => {
      if (_refreshFn === fn) _refreshFn = null
    })
  }

  const refresh = async () => {
    if (_refreshFn) {
      await _refreshFn()
    } else {
      await refreshNuxtData()
    }
  }

  return { register, refresh }
}
