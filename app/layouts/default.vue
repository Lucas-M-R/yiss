<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { user } = useAuth()
const { open: openChrono, isOpen: isChronoOpen } = useChrono()

const navItems = [
  { label: 'Accueil', icon: 'i-lucide-home', to: '/' },
  { label: 'Séances', icon: 'i-lucide-calendar', to: '/session/' + new Date().toISOString().slice(0, 10) },
  { label: 'Stats', icon: 'i-lucide-bar-chart-2', to: '/stats' },
  { label: 'Paramètres', icon: 'i-lucide-settings', to: '/settings' }
]

const route = useRoute()

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <!-- Top header -->
    <header class="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
      <span class="text-xl font-bold tracking-tight text-violet-400">Spor</span>
      <div class="flex items-center gap-3">
        <UButton
          icon="i-lucide-timer"
          variant="ghost"
          color="gray"
          size="sm"
          @click="openChrono"
        />
        <NuxtLink to="/settings">
          <UAvatar
            :src="user?.avatar as string | undefined"
            :alt="user?.name as string | undefined"
            size="sm"
            class="cursor-pointer ring-2 ring-violet-500/50 hover:ring-violet-500 transition"
          />
        </NuxtLink>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto transition-[padding]" :class="isChronoOpen ? 'pb-[240px]' : 'pb-20'">
      <slot />
    </main>

    <!-- Bottom navigation bar (mobile-first) -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 flex items-stretch">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors"
        :class="isActive(item.to)
          ? 'text-violet-400'
          : 'text-zinc-500 hover:text-zinc-300'"
      >
        <UIcon :name="item.icon" class="text-xl" />
        <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <!-- Chrono overlay -->
    <Chrono />
  </div>
</template>
