<script setup lang="ts">
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
)

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExerciseOption {
  exercise_id: string
  exercise_name: string
}

interface StatRow {
  user_id: string
  exercise_id: string
  exercise_name: string
  session_date: string
  max_weight: number
  total_reps: number
  volume: number
}

interface UserMe {
  id: string
  display_name: string
  partner_id: string | null
  partner: { id: string; display_name: string } | null
}

// ---------------------------------------------------------------------------
// Filters state
// ---------------------------------------------------------------------------

type Period = '7d' | '30d' | '3m' | '1y' | 'all'

const selectedPeriod = ref<Period>('30d')
const selectedExerciseId = ref<string | null>(null)
const selectedUserId = ref<string | null>(null) // null = both

const periodLabels: { value: Period; label: string }[] = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '3m', label: '3m' },
  { value: '1y', label: '1an' },
  { value: 'all', label: 'Tout' },
]

// ---------------------------------------------------------------------------
// User / session
// ---------------------------------------------------------------------------

const { user } = useUserSession()

const { data: me } = await useFetch<UserMe>('/api/users/me')

const meId = computed(() => (user.value as any)?.id ?? '')
const meName = computed(() => me.value?.display_name ?? 'Moi')
const partner = computed(() => me.value?.partner ?? null)

// Person selector options
const personOptions = computed(() => {
  const opts = [{ value: null, label: 'Les deux' }, { value: meId.value, label: 'Moi' }]
  if (partner.value) {
    opts.push({ value: partner.value.id, label: partner.value.display_name })
  }
  return opts
})

// ---------------------------------------------------------------------------
// Exercises dropdown
// ---------------------------------------------------------------------------

const { data: exerciseOptions } = await useFetch<ExerciseOption[]>('/api/stats/exercises')

const exerciseSelectItems = computed(() =>
  (exerciseOptions.value ?? []).map(e => ({
    label: e.exercise_name,
    value: e.exercise_id,
  }))
)

// ---------------------------------------------------------------------------
// Stats data
// ---------------------------------------------------------------------------

const statsQuery = computed(() => {
  const q: Record<string, string> = {}
  if (selectedExerciseId.value) q.exercise_id = selectedExerciseId.value
  if (selectedUserId.value) q.user_id = selectedUserId.value
  if (selectedPeriod.value !== 'all') q.period = selectedPeriod.value
  return q
})

const {
  data: stats,
  pending: statsPending,
  refresh: refreshStats,
} = await useFetch<StatRow[]>('/api/stats', { query: statsQuery })

// useFetch auto-watches the reactive query — no manual watch needed

// ---------------------------------------------------------------------------
// Summary cards (only when exercise is selected)
// ---------------------------------------------------------------------------

const summaryStats = computed(() => {
  const rows = stats.value ?? []
  if (!rows.length) return null

  const allRows = rows // already filtered by period via API
  const maxWeight = Math.max(...allRows.map(r => r.max_weight ?? 0))

  const totalVolume = allRows.reduce((acc, r) => acc + (r.volume ?? 0), 0)

  const sorted = [...allRows].sort((a, b) => b.session_date.localeCompare(a.session_date))
  const lastDate = sorted[0]?.session_date ?? null

  // Progression: compare first and last max_weight in the period
  const byDate = [...allRows].sort((a, b) => a.session_date.localeCompare(b.session_date))
  const firstWeight = byDate[0]?.max_weight ?? 0
  const lastWeight = byDate[byDate.length - 1]?.max_weight ?? 0
  const progression = firstWeight > 0 ? Math.round(((lastWeight - firstWeight) / firstWeight) * 100) : null

  return { maxWeight, totalVolume: Math.round(totalVolume), lastDate, progression }
})

// ---------------------------------------------------------------------------
// Exercise list (when no exercise selected)
// ---------------------------------------------------------------------------

interface ExerciseSummary {
  exercise_id: string
  exercise_name: string
  last_date: string
  last_max_weight: number
}

const exerciseList = computed((): ExerciseSummary[] => {
  if (selectedExerciseId.value) return []
  const rows = stats.value ?? []
  const map = new Map<string, ExerciseSummary>()
  for (const row of rows) {
    const existing = map.get(row.exercise_id)
    if (!existing || row.session_date > existing.last_date) {
      map.set(row.exercise_id, {
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        last_date: row.session_date,
        last_max_weight: row.max_weight,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.last_date.localeCompare(a.last_date))
})

// ---------------------------------------------------------------------------
// Chart config
// ---------------------------------------------------------------------------

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#a1a1aa' } },
  },
  scales: {
    x: { ticks: { color: '#71717a' }, grid: { color: '#27272a' } },
    y: { ticks: { color: '#71717a' }, grid: { color: '#27272a' } },
  },
}

// ---------------------------------------------------------------------------
// Chart data
// ---------------------------------------------------------------------------

function buildChartData(rows: StatRow[], field: 'max_weight' | 'volume') {
  const byUser: Record<string, StatRow[]> = {}
  for (const row of rows) {
    if (!byUser[row.user_id]) byUser[row.user_id] = []
    byUser[row.user_id].push(row)
  }

  const datasets = Object.entries(byUser).map(([userId, userRows]) => {
    const isMe = userId === meId.value
    const label = isMe ? meName.value : (partner.value?.display_name ?? 'Partenaire')
    const color = isMe ? 'rgb(139, 92, 246)' : 'rgb(34, 211, 238)'
    const bgColor = isMe ? 'rgba(139, 92, 246, 0.1)' : 'rgba(34, 211, 238, 0.1)'
    const sorted = [...userRows].sort((a, b) => a.session_date.localeCompare(b.session_date))

    return {
      label,
      data: sorted.map(r => ({ x: r.session_date, y: r[field] ?? 0 })),
      borderColor: color,
      backgroundColor: bgColor,
      tension: 0.3,
    }
  })

  return { datasets }
}

const lineChartData = computed(() => {
  const rows = stats.value ?? []
  return buildChartData(rows, 'max_weight')
})

const barChartData = computed(() => {
  const rows = stats.value ?? []
  const byUser: Record<string, StatRow[]> = {}
  for (const row of rows) {
    if (!byUser[row.user_id]) byUser[row.user_id] = []
    byUser[row.user_id].push(row)
  }

  const datasets = Object.entries(byUser).map(([userId, userRows]) => {
    const isMe = userId === meId.value
    const label = isMe ? meName.value : (partner.value?.display_name ?? 'Partenaire')
    const bgColor = isMe ? 'rgba(139, 92, 246, 0.7)' : 'rgba(34, 211, 238, 0.7)'
    const sorted = [...userRows].sort((a, b) => a.session_date.localeCompare(b.session_date))

    return {
      label,
      data: sorted.map(r => ({ x: r.session_date, y: r.volume ?? 0 })),
      backgroundColor: bgColor,
    }
  })

  return { datasets }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const monthNames = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.',
]

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
}

function formatWeight(w: number) {
  return `${w} kg`
}

function formatVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} t`
  return `${v} kg`
}

function progressionLabel(p: number | null) {
  if (p === null) return '—'
  if (p > 0) return `+${p}%`
  if (p < 0) return `${p}%`
  return '0%'
}

function progressionColor(p: number | null) {
  if (p === null || p === 0) return 'text-zinc-400'
  return p > 0 ? 'text-emerald-400' : 'text-red-400'
}

function selectExercise(id: string) {
  selectedExerciseId.value = id
}

const hasChartData = computed(() => (stats.value ?? []).length > 0)
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-white">Statistiques</h2>
      <p class="text-zinc-400 text-sm mt-1">Suivez votre progression.</p>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Filter bar                                                           -->
    <!-- ------------------------------------------------------------------ -->
    <div class="sticky top-0 z-10 bg-zinc-950 pb-3 pt-1 space-y-3">
      <!-- Person selector -->
      <div v-if="partner" class="flex gap-1">
        <button
          v-for="opt in personOptions"
          :key="String(opt.value)"
          class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="selectedUserId === opt.value
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'"
          @click="selectedUserId = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Exercise dropdown -->
      <USelect
        v-model="selectedExerciseId"
        :items="exerciseSelectItems"
        placeholder="Tous les exercices"
        value-key="value"
        label-key="label"
        color="zinc"
        class="w-full"
      />

      <!-- Period selector -->
      <div class="flex gap-1">
        <button
          v-for="p in periodLabels"
          :key="p.value"
          class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          :class="selectedPeriod === p.value
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'"
          @click="selectedPeriod = p.value"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Loading state                                                        -->
    <!-- ------------------------------------------------------------------ -->
    <div v-if="statsPending" class="space-y-3">
      <USkeleton class="h-24 w-full rounded-xl bg-zinc-800" />
      <div class="grid grid-cols-2 gap-3">
        <USkeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-xl bg-zinc-800" />
      </div>
      <USkeleton class="h-56 w-full rounded-xl bg-zinc-800" />
    </div>

    <template v-else>
      <!-- ---------------------------------------------------------------- -->
      <!-- Exercise selected view                                            -->
      <!-- ---------------------------------------------------------------- -->
      <template v-if="selectedExerciseId">
        <!-- Summary cards -->
        <div v-if="summaryStats" class="grid grid-cols-2 gap-3">
          <!-- Charge max -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <div class="py-1 space-y-1">
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">Charge max</p>
              <p class="text-xl font-bold text-white tabular-nums">{{ formatWeight(summaryStats.maxWeight) }}</p>
              <p class="text-[10px] text-zinc-600">Tous temps</p>
            </div>
          </UCard>

          <!-- Volume total -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <div class="py-1 space-y-1">
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">Volume total</p>
              <p class="text-xl font-bold text-white tabular-nums">{{ formatVolume(summaryStats.totalVolume) }}</p>
              <p class="text-[10px] text-zinc-600">Sur la période</p>
            </div>
          </UCard>

          <!-- Dernière séance -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <div class="py-1 space-y-1">
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">Dernière séance</p>
              <p class="text-sm font-semibold text-white leading-tight">
                {{ summaryStats.lastDate ? formatDate(summaryStats.lastDate) : '—' }}
              </p>
            </div>
          </UCard>

          <!-- Progression -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <div class="py-1 space-y-1">
              <p class="text-[10px] text-zinc-500 uppercase tracking-wide">Progression</p>
              <p
                class="text-xl font-bold tabular-nums"
                :class="progressionColor(summaryStats.progression)"
              >
                {{ progressionLabel(summaryStats.progression) }}
              </p>
              <p class="text-[10px] text-zinc-600">Charge max sur la période</p>
            </div>
          </UCard>
        </div>

        <!-- No data for exercise -->
        <UCard v-else class="bg-zinc-900 border border-zinc-800">
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-bar-chart-2" class="text-4xl text-zinc-600" />
            <p class="text-zinc-400 font-medium">Aucune donnée pour cet exercice</p>
            <p class="text-zinc-600 text-sm">Essayez une période plus longue.</p>
          </div>
        </UCard>

        <!-- Charts -->
        <template v-if="hasChartData">
          <!-- Charge max line chart -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <template #header>
              <p class="text-sm font-semibold text-zinc-300">Charge max (kg)</p>
            </template>
            <div class="h-[250px] md:h-[350px]">
              <ClientOnly>
                <Line
                  :data="lineChartData"
                  :options="{
                    ...chartDefaults,
                    plugins: {
                      ...chartDefaults.plugins,
                      legend: { ...chartDefaults.plugins.legend, display: !!partner },
                    },
                    scales: {
                      x: { ...chartDefaults.scales.x, type: 'category' },
                      y: { ...chartDefaults.scales.y, beginAtZero: false },
                    },
                  }"
                />
              </ClientOnly>
            </div>
          </UCard>

          <!-- Volume bar chart -->
          <UCard class="bg-zinc-900 border border-zinc-800">
            <template #header>
              <p class="text-sm font-semibold text-zinc-300">Volume par séance (kg)</p>
            </template>
            <div class="h-[250px] md:h-[350px]">
              <ClientOnly>
                <Bar
                  :data="barChartData"
                  :options="{
                    ...chartDefaults,
                    plugins: {
                      ...chartDefaults.plugins,
                      legend: { ...chartDefaults.plugins.legend, display: !!partner },
                    },
                    scales: {
                      x: { ...chartDefaults.scales.x, type: 'category', stacked: false },
                      y: { ...chartDefaults.scales.y, beginAtZero: true },
                    },
                  }"
                />
              </ClientOnly>
            </div>
          </UCard>
        </template>
      </template>

      <!-- ---------------------------------------------------------------- -->
      <!-- No exercise selected — exercise list                             -->
      <!-- ---------------------------------------------------------------- -->
      <template v-else>
        <!-- Placeholder when no data at all -->
        <UCard v-if="!exerciseList.length" class="bg-zinc-900 border border-zinc-800">
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-bar-chart-2" class="text-4xl text-violet-400" />
            <p class="text-white font-medium">Sélectionnez un exercice</p>
            <p class="text-zinc-500 text-sm">Choisissez un exercice dans le menu ci-dessus pour voir vos statistiques.</p>
          </div>
        </UCard>

        <!-- Exercise grid -->
        <div v-else class="space-y-2">
          <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium">Exercices récents</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="ex in exerciseList"
              :key="ex.exercise_id"
              class="w-full text-left"
              @click="selectExercise(ex.exercise_id)"
            >
              <UCard class="bg-zinc-900 border border-zinc-800 hover:border-violet-700 transition-colors cursor-pointer h-full">
                <div class="flex items-center gap-3 py-1">
                  <div class="flex-shrink-0 w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center">
                    <UIcon name="i-lucide-dumbbell" class="text-violet-400 text-base" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ ex.exercise_name }}</p>
                    <p class="text-xs text-zinc-500 mt-0.5">
                      {{ formatDate(ex.last_date) }}
                      <span v-if="ex.last_max_weight" class="ml-2 text-violet-400">
                        · {{ formatWeight(ex.last_max_weight) }}
                      </span>
                    </p>
                  </div>
                  <UIcon name="i-lucide-chevron-right" class="text-zinc-600 flex-shrink-0 text-sm" />
                </div>
              </UCard>
            </button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
