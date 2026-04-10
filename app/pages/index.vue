<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionSummary {
  id: string
  session_date: string
  created_by: string
  program_day: { label: string; program: { name: string } } | null
  exercises: { count: number }[]
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const today = new Date()
const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const dayNamesShort = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']
const monthNames = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

const todayIso = today.toISOString().slice(0, 10)

const formattedDate = computed(() =>
  `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]}`
)

// ---------------------------------------------------------------------------
// Weekly strip: Mon–Sun of current week
// ---------------------------------------------------------------------------

function getWeekDays(): { iso: string; label: string; dayIndex: number }[] {
  // Start from Monday
  const days: { iso: string; label: string; dayIndex: number }[] = []
  const dow = today.getDay() // 0=Sun
  // Monday offset: if Sun (0), go back 6; else go back (dow - 1)
  const mondayOffset = dow === 0 ? -6 : -(dow - 1)
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + mondayOffset + i)
    const iso = d.toISOString().slice(0, 10)
    days.push({ iso, label: dayNamesShort[(d.getDay())], dayIndex: i })
  }
  return days
}

const weekDays = getWeekDays()

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const { user } = useUserSession()

const sessions = ref<SessionSummary[]>([])
const loadingSessions = ref(true)

async function fetchSessions() {
  loadingSessions.value = true
  try {
    sessions.value = await $fetch<SessionSummary[]>('/api/sessions')
  } catch {
    sessions.value = []
  } finally {
    loadingSessions.value = false
  }
}

onMounted(fetchSessions)

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const sessionDates = computed(() => new Set(sessions.value.map(s => s.session_date)))

const todaySession = computed(() =>
  sessions.value.find(s => s.session_date === todayIso) ?? null
)

const recentSessions = computed(() =>
  sessions.value.slice(0, 5)
)

const thisMonthCount = computed(() => {
  const prefix = todayIso.slice(0, 7) // YYYY-MM
  return sessions.value.filter(s => s.session_date.startsWith(prefix)).length
})

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatSessionDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`
}

function sessionLabel(s: SessionSummary): string {
  if (s.program_day?.label) {
    return `${s.program_day.program?.name ?? ''} — ${s.program_day.label}`
  }
  return 'Séance libre'
}

function exerciseCount(s: SessionSummary): number {
  return s.exercises?.[0]?.count ?? 0
}
</script>

<template>
  <div class="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
    <!-- Greeting -->
    <div>
      <p class="text-zinc-400 text-sm">{{ formattedDate }}</p>
      <h2 class="text-2xl font-bold text-white mt-1">
        Bonjour{{ (user as any)?.name ? ', ' + (user as any).name.split(' ')[0] : '' }} 👋
      </h2>
    </div>

    <!-- Séance du jour -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold text-white">Séance du jour</h3>
        <NuxtLink :to="`/session/${todayIso}`" class="text-xs text-violet-400 hover:text-violet-300 transition">
          Ouvrir →
        </NuxtLink>
      </div>

      <NuxtLink :to="`/session/${todayIso}`">
        <UCard class="bg-zinc-900 border border-zinc-800 hover:border-violet-800 transition-colors cursor-pointer">
          <div class="flex items-center gap-4 py-2">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <UIcon
                :name="todaySession ? 'i-lucide-dumbbell' : 'i-lucide-plus-circle'"
                class="text-xl text-violet-400"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium text-sm">
                {{ todaySession ? sessionLabel(todaySession) : 'Démarrer une séance' }}
              </p>
              <p class="text-zinc-500 text-xs mt-0.5">
                {{ todaySession
                  ? `${exerciseCount(todaySession)} exercice${exerciseCount(todaySession) !== 1 ? 's' : ''}`
                  : 'Aucune séance enregistrée aujourd\'hui'
                }}
              </p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="text-zinc-600 flex-shrink-0" />
          </div>
        </UCard>
      </NuxtLink>
    </section>

    <!-- Weekly strip -->
    <section class="space-y-3">
      <h3 class="text-base font-semibold text-white">Cette semaine</h3>
      <div class="grid grid-cols-7 gap-1">
        <NuxtLink
          v-for="day in weekDays"
          :key="day.iso"
          :to="`/session/${day.iso}`"
          class="flex flex-col items-center gap-1 py-2 rounded-lg transition-colors"
          :class="day.iso === todayIso
            ? 'bg-violet-500/20 ring-1 ring-violet-500/50'
            : 'hover:bg-zinc-800'"
        >
          <span class="text-[10px] font-medium text-zinc-500 uppercase">{{ day.label }}</span>
          <!-- Dot indicator -->
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center"
            :class="sessionDates.has(day.iso)
              ? 'bg-violet-500'
              : day.iso === todayIso ? 'bg-zinc-700' : 'bg-zinc-800'"
          >
            <UIcon
              v-if="sessionDates.has(day.iso)"
              name="i-lucide-check"
              class="text-xs text-white"
            />
            <span v-else class="text-[10px] text-zinc-500">
              {{ new Date(day.iso + 'T00:00:00').getDate() }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Quick stats -->
    <section class="space-y-3">
      <h3 class="text-base font-semibold text-white">Ce mois-ci</h3>
      <div class="grid grid-cols-2 gap-3">
        <UCard class="bg-zinc-900 border border-zinc-800">
          <div class="flex items-center gap-3 py-1">
            <UIcon name="i-lucide-calendar-check" class="text-2xl text-violet-400 flex-shrink-0" />
            <div>
              <p class="text-2xl font-bold text-white tabular-nums">{{ thisMonthCount }}</p>
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">Séances</p>
            </div>
          </div>
        </UCard>
        <UCard class="bg-zinc-900 border border-zinc-800">
          <div class="flex items-center gap-3 py-1">
            <UIcon name="i-lucide-flame" class="text-2xl text-orange-400 flex-shrink-0" />
            <div>
              <p class="text-2xl font-bold text-white tabular-nums">
                {{ sessions.filter(s => {
                  const d = new Date(s.session_date + 'T00:00:00')
                  const now = new Date()
                  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
                  return diff <= 6
                }).length }}
              </p>
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">7 derniers jours</p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- Dernières séances -->
    <section class="space-y-3">
      <h3 class="text-base font-semibold text-white">Dernières séances</h3>

      <!-- Loading -->
      <div v-if="loadingSessions" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-14 w-full rounded-xl bg-zinc-800" />
      </div>

      <!-- Empty -->
      <div v-else-if="!recentSessions.length">
        <UCard class="bg-zinc-900 border border-zinc-800">
          <div class="flex flex-col items-center gap-2 py-6 text-center">
            <UIcon name="i-lucide-calendar-x" class="text-2xl text-zinc-600" />
            <p class="text-zinc-500 text-sm">Aucune séance enregistrée.</p>
          </div>
        </UCard>
      </div>

      <!-- List -->
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="s in recentSessions"
          :key="s.id"
          :to="`/session/${s.session_date}`"
        >
          <UCard class="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
            <div class="flex items-center gap-3 py-1">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                <UIcon name="i-lucide-dumbbell" class="text-sm text-zinc-400" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ sessionLabel(s) }}</p>
                <p class="text-xs text-zinc-500 mt-0.5">
                  {{ formatSessionDate(s.session_date) }}
                  <span v-if="exerciseCount(s)" class="ml-2 text-zinc-600">
                    · {{ exerciseCount(s) }} exercice{{ exerciseCount(s) !== 1 ? 's' : '' }}
                  </span>
                </p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="text-zinc-600 flex-shrink-0" />
            </div>
          </UCard>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
