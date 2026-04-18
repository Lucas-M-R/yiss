export const useChrono = () => {
  const isOpen = useState('chrono-open', () => false)
  const time = useState('chrono-time', () => 0)
  const isRunning = useState('chrono-running', () => false)
  const wakeLock = useState<WakeLockSentinel | null>('chrono-wake-lock', () => null)

  let intervalId: NodeJS.Timeout | null = null

  const start = async () => {
    if (isRunning.value) return

    isRunning.value = true
    intervalId = setInterval(() => {
      time.value++
    }, 1000)

    // Request wake lock to prevent screen sleep
    if ('wakeLock' in navigator) {
      try {
        wakeLock.value = await navigator.wakeLock.request('screen')
      } catch (err) {
        console.error('Wake lock error:', err)
      }
    }
  }

  const pause = async () => {
    if (!isRunning.value) return

    isRunning.value = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    await releaseWakeLock()
  }

  const reset = async () => {
    await pause()
    time.value = 0
  }

  const toggle = async () => {
    if (isRunning.value) {
      await pause()
    } else {
      await start()
    }
  }

  const releaseWakeLock = async () => {
    if (wakeLock.value) {
      try {
        await wakeLock.value.release()
        wakeLock.value = null
      } catch (err) {
        console.error('Wake lock release error:', err)
      }
    }
  }

  const open = () => {
    isOpen.value = true
  }

  const close = async () => {
    isOpen.value = false
    await reset()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  onUnmounted(() => {
    pause()
  })

  return {
    isOpen,
    time,
    isRunning,
    start,
    pause,
    reset,
    toggle,
    open,
    close,
    formatTime
  }
}
