<script setup lang="ts">
const { isOpen, time, isRunning, toggle, reset, close, formatTime } = useChrono()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed bottom-20 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 p-6 shadow-xl"
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
  </Teleport>
</template>
