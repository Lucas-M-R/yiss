<script setup lang="ts">
const { isOpen, time, isRunning, toggle, reset, close, formatTime } = useChrono()

// ── OLED screensaver ─────────────────────────────────────────────────────────
// While the chrono runs the screen is kept awake (wake lock), so after a few
// seconds without interaction the screen goes black and the time keeps moving
// around to avoid burn-in.
const IDLE_DELAY_MS = 3000
const MOVE_INTERVAL_MS = 10000

const idle = ref(false)
const position = ref({ top: 40, left: 50 })
let idleTimer: ReturnType<typeof setTimeout> | null = null
let moveTimer: ReturnType<typeof setInterval> | null = null

function randomPosition() {
  // Percentages of the viewport for the text center. The font size scales with the
  // viewport width (min(14vw, 3.75rem)), so even "100:00" stays within the screen
  position.value = { top: 15 + Math.random() * 65, left: 30 + Math.random() * 40 }
}

function clearTimers() {
  if (idleTimer) clearTimeout(idleTimer)
  if (moveTimer) clearInterval(moveTimer)
  idleTimer = null
  moveTimer = null
}

function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  if (!isOpen.value || !isRunning.value) return
  idleTimer = setTimeout(enterIdle, IDLE_DELAY_MS)
}

function enterIdle() {
  randomPosition()
  idle.value = true
  moveTimer = setInterval(randomPosition, MOVE_INTERVAL_MS)
}

function wake() {
  clearTimers()
  idle.value = false
  scheduleIdle()
}

// Any interaction while the screen is on postpones the screensaver. While it is
// shown, only a tap on the overlay wakes it, so that tap does not also reach
// the button underneath.
function onActivity() {
  if (!idle.value) scheduleIdle()
}

function onKeydown(e: KeyboardEvent) {
  if (idle.value) {
    // The key only wakes the screen: it must not also activate the focused button
    e.preventDefault()
    e.stopPropagation()
    wake()
  } else {
    scheduleIdle()
  }
}

const activityEvents = ['pointerdown', 'pointermove', 'wheel', 'scroll'] as const

onMounted(() => {
  activityEvents.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }))
  window.addEventListener('keydown', onKeydown, { capture: true })
})

onBeforeUnmount(() => {
  activityEvents.forEach(e => window.removeEventListener(e, onActivity, { capture: true }))
  window.removeEventListener('keydown', onKeydown, { capture: true })
  clearTimers()
})

watch([isOpen, isRunning], () => {
  if (isOpen.value && isRunning.value) {
    scheduleIdle()
  } else {
    clearTimers()
    idle.value = false
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed bottom-[60px] left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 p-6 shadow-xl"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Chronomètre</h3>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="gray"
          size="sm"
          @click="close"
        />
      </div>

      <div class="flex items-center justify-center gap-4">
        <div
          class="text-7xl font-bold font-mono tabular-nums text-violet-400 cursor-pointer select-none"
          @click="toggle"
        >
          {{ formatTime(time) }}
        </div>
        <UButton
          v-if="!isRunning"
          icon="i-lucide-rotate-ccw"
          size="xl"
          variant="ghost"
          color="gray"
          @click="reset"
        />
      </div>
    </div>

    <!-- OLED screensaver: pure black, dimmed time that moves periodically -->
    <Transition
      enter-active-class="transition-opacity duration-700"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="idle"
        class="fixed inset-0 z-[100] bg-black cursor-pointer select-none"
        aria-label="Toucher pour réafficher"
        @click.stop.prevent="wake"
      >
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 text-[min(14vw,3.75rem)] font-mono tabular-nums text-zinc-600 whitespace-nowrap"
          :style="{ top: `${position.top}%`, left: `${position.left}%` }"
        >
          {{ formatTime(time) }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
