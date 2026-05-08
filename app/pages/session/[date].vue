<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Exercise {
  id: string
  name: string
  category: string // 'strength' | 'cardio' | ...
}

interface SessionSet {
  id: string
  session_exercise_id: string
  user_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_sec: number | null
  rest_sec: number | null
}

interface SessionExercise {
  id: string
  session_id: string
  exercise_id: string
  exercise: Exercise
  sets_count: number
  sort_order: number
  sets: SessionSet[]
}

interface Session {
  id: string
  session_date: string
  program_day_id: string | null
  created_by: string
  notes: string | null
  exercises: SessionExercise[]
}

interface UserInfo {
  id: string
  display_name: string
  avatar_url: string | null
}

interface SessionData {
  session: Session | null
  me: UserInfo
  partner: UserInfo | null
}

interface ProgramDay {
  id: string
  label: string
  sort_order: number
}

interface Program {
  id: string
  name: string
  days: ProgramDay[]
}

// ---------------------------------------------------------------------------
// Route & date
// ---------------------------------------------------------------------------

const route = useRoute()
const date = computed(() => route.params.date as string)

const formattedDate = computed(() => {
  const d = new Date(date.value + 'T00:00:00')
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ]
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
})

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const sessionData = ref<SessionData | null>(null)
const loading = ref(true)
const creating = ref(false)

// Set of "session_exercise_id-user_id-set_number" currently saving
const saving = ref(new Set<string>())
// Set of "session_exercise_id-user_id-set_number" that just saved successfully (for green flash)
const saved = ref(new Set<string>())

// Add exercise modal
const showAddModal = ref(false)
const allExercises = ref<Exercise[]>([])
const exerciseSearch = ref('')
const selectedExerciseId = ref<string | null>(null)
const newSetsCount = ref(3)
const addingExercise = ref(false)
const creatingExercise = ref(false)

// Program selection for new session
const programs = ref<Program[]>([])
const selectedProgramDayId = ref<string | null>(null)

// Debounce timers: key -> timer id
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Inline sets_count editing
const setsCountTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Notes
const notes = ref('')
const noteSaving = ref(false)
const noteSaved = ref(false)
let notesTimer: ReturnType<typeof setTimeout> | null = null

watch(session, (s) => {
  if (s) notes.value = s.notes ?? ''
}, { immediate: true })

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

const session = computed(() => sessionData.value?.session ?? null)
const me = computed(() => sessionData.value?.me ?? null)
const partner = computed(() => sessionData.value?.partner ?? null)

const users = computed(() => {
  const list: UserInfo[] = []
  if (me.value) list.push(me.value)
  if (partner.value) list.push(partner.value)
  return list
})

const sortedExercises = computed(() =>
  [...(session.value?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order)
)

const programDayOptions = computed(() => {
  const opts: { label: string; value: string }[] = []
  for (const prog of programs.value) {
    for (const day of prog.days ?? []) {
      opts.push({ label: `${prog.name} — ${day.label}`, value: day.id })
    }
  }
  return opts
})

const filteredExercises = computed(() => {
  const q = exerciseSearch.value.trim().toLowerCase()
  if (!q) return allExercises.value
  return allExercises.value.filter(e => e.name.toLowerCase().includes(q))
})

const exerciseOptions = computed(() =>
  filteredExercises.value.map(e => ({ label: e.name, value: e.id }))
)

const canCreateExercise = computed(() =>
  exerciseSearch.value.trim().length > 0 && filteredExercises.value.length === 0
)

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchSession() {
  loading.value = true
  try {
    sessionData.value = await $fetch<SessionData>(`/api/sessions/${date.value}`)
  } finally {
    loading.value = false
  }
}

async function fetchPrograms() {
  try {
    programs.value = await $fetch<Program[]>('/api/programs')
  } catch {
    programs.value = []
  }
}

async function fetchExercises() {
  try {
    allExercises.value = await $fetch<Exercise[]>('/api/exercises')
  } catch {
    allExercises.value = []
  }
}

onMounted(() => {
  fetchSession()
  fetchPrograms()
})

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

async function startSession() {
  creating.value = true
  try {
    const body: Record<string, unknown> = {}
    if (selectedProgramDayId.value) body.program_day_id = selectedProgramDayId.value

    const newSession = await $fetch<Session>(`/api/sessions/${date.value}`, {
      method: 'POST',
      body
    })

    // Refresh to get full session data including me/partner
    await fetchSession()
  } finally {
    creating.value = false
  }
}

// ---------------------------------------------------------------------------
// Exercise management
// ---------------------------------------------------------------------------

async function openAddModal() {
  showAddModal.value = true
  if (!allExercises.value.length) await fetchExercises()
}

async function createExerciseFromSearch() {
  const name = exerciseSearch.value.trim()
  if (!name) return
  creatingExercise.value = true
  try {
    const created = await $fetch<Exercise>('/api/exercises', {
      method: 'POST',
      body: { name, category: 'strength' }
    })
    allExercises.value.push(created)
    selectedExerciseId.value = created.id
    exerciseSearch.value = ''
  } finally {
    creatingExercise.value = false
  }
}

function closeAddModal() {
  showAddModal.value = false
  exerciseSearch.value = ''
  selectedExerciseId.value = null
  newSetsCount.value = 3
}

async function addExercise() {
  if (!selectedExerciseId.value) return
  addingExercise.value = true
  try {
    const maxOrder = Math.max(0, ...(sortedExercises.value.map(e => e.sort_order)))
    const newEx = await $fetch<SessionExercise>(`/api/sessions/${date.value}/exercises`, {
      method: 'POST',
      body: {
        exercise_id: selectedExerciseId.value,
        sets_count: newSetsCount.value,
        sort_order: maxOrder + 1
      }
    })

    // Optimistically add to local state
    if (sessionData.value?.session) {
      sessionData.value.session.exercises.push(newEx)
    }
    closeAddModal()
  } finally {
    addingExercise.value = false
  }
}

async function removeExercise(sessionExerciseId: string) {
  // Optimistic removal
  if (sessionData.value?.session) {
    sessionData.value.session.exercises = sessionData.value.session.exercises.filter(
      e => e.id !== sessionExerciseId
    )
  }
  try {
    await $fetch(`/api/session-exercises/${sessionExerciseId}`, { method: 'DELETE' })
  } catch {
    // Revert on error
    await fetchSession()
  }
}

async function saveSetsCount(sessionExerciseId: string, value: number) {
  await $fetch(`/api/session-exercises/${sessionExerciseId}`, {
    method: 'PATCH',
    body: { sets_count: value }
  })
  setsCountTimers.delete(sessionExerciseId)
}

function onSetsCountChange(sessionExerciseId: string, value: number) {
  // Optimistic update
  if (sessionData.value?.session) {
    const ex = sessionData.value.session.exercises.find(e => e.id === sessionExerciseId)
    if (ex) ex.sets_count = value
  }

  // Debounce PATCH
  if (setsCountTimers.has(sessionExerciseId)) {
    clearTimeout(setsCountTimers.get(sessionExerciseId)!)
  }
  setsCountTimers.set(
    sessionExerciseId,
    setTimeout(() => saveSetsCount(sessionExerciseId, value), 1500)
  )
}

function onSetsCountBlur(sessionExerciseId: string) {
  // Save immediately on blur
  if (setsCountTimers.has(sessionExerciseId)) {
    clearTimeout(setsCountTimers.get(sessionExerciseId)!)
    setsCountTimers.delete(sessionExerciseId)
    const ex = sessionData.value?.session?.exercises.find(e => e.id === sessionExerciseId)
    if (ex) saveSetsCount(sessionExerciseId, ex.sets_count)
  }
}

// ---------------------------------------------------------------------------
// Set saving
// ---------------------------------------------------------------------------

function getSet(sessionExerciseId: string, userId: string, setNumber: number): SessionSet | null {
  const ex = sessionData.value?.session?.exercises?.find(e => e.id === sessionExerciseId)
  return ex?.sets?.find(s => s.user_id === userId && s.set_number === setNumber) ?? null
}

function isCardio(exercise: SessionExercise): boolean {
  return exercise.exercise?.category?.toLowerCase() === 'cardio'
}

function scheduleSave(sessionExerciseId: string, setNumber: number, userId: string) {
  const key = `${sessionExerciseId}-${userId}-${setNumber}`

  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key)!)
  }

  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key)
      saveSet(sessionExerciseId, setNumber, userId)
    }, 1500)
  )
}

function onSetBlur(sessionExerciseId: string, setNumber: number, userId: string) {
  // Save immediately on blur
  const key = `${sessionExerciseId}-${userId}-${setNumber}`
  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key)!)
    saveTimers.delete(key)
    saveSet(sessionExerciseId, setNumber, userId)
  }
}

async function saveSet(sessionExerciseId: string, setNumber: number, userId: string) {
  const key = `${sessionExerciseId}-${userId}-${setNumber}`
  saving.value = new Set([...saving.value, key])

  try {
    const ex = sessionData.value?.session?.exercises?.find(e => e.id === sessionExerciseId)
    const currentSet = ex?.sets?.find(s => s.user_id === userId && s.set_number === setNumber)

    const result = await $fetch<SessionSet>('/api/sets', {
      method: 'POST',
      body: {
        session_exercise_id: sessionExerciseId,
        set_number: setNumber,
        user_id: userId,
        reps: currentSet?.reps ?? null,
        weight_kg: currentSet?.weight_kg ?? null,
        duration_sec: currentSet?.duration_sec ?? null,
        rest_sec: currentSet?.rest_sec ?? null,
      }
    })

    if (ex) {
      const idx = ex.sets.findIndex(s => s.user_id === userId && s.set_number === setNumber)
      if (idx >= 0) {
        ex.sets[idx] = result
      } else {
        ex.sets.push(result)
      }
    }

    // Green flash (only for me)
    if (userId === me.value?.id) {
      saved.value = new Set([...saved.value, key])
      setTimeout(() => {
        saved.value.delete(key)
        saved.value = new Set(saved.value)
      }, 1200)
    }
  } finally {
    saving.value.delete(key)
    saving.value = new Set(saving.value)
  }
}

function isSaving(sessionExerciseId: string, setNumber: number): boolean {
  const userId = me.value?.id
  if (!userId) return false
  return saving.value.has(`${sessionExerciseId}-${userId}-${setNumber}`)
}

function isSaved(sessionExerciseId: string, setNumber: number): boolean {
  const userId = me.value?.id
  if (!userId) return false
  return saved.value.has(`${sessionExerciseId}-${userId}-${setNumber}`)
}

// ---------------------------------------------------------------------------
// Duration helpers (cardio)
// ---------------------------------------------------------------------------

function secToDisplay(sec: number | null): string {
  if (sec === null || sec === undefined) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function displayToSec(value: string): number | null {
  if (!value.trim()) return null
  // Accept "MM:SS" or plain minutes
  if (value.includes(':')) {
    const [mStr, sStr] = value.split(':')
    const m = parseInt(mStr, 10) || 0
    const s = parseInt(sStr, 10) || 0
    return m * 60 + s
  }
  const minutes = parseFloat(value)
  return isNaN(minutes) ? null : Math.round(minutes * 60)
}

// ---------------------------------------------------------------------------
// Input event handlers
// ---------------------------------------------------------------------------

function onStrengthInput(
  sessionExerciseId: string,
  setNumber: number,
  userId: string,
  field: 'reps' | 'weight_kg',
  rawValue: string
) {
  const parsed = rawValue === '' ? null : (field === 'weight_kg' ? parseFloat(rawValue) : parseInt(rawValue, 10))
  const value = parsed === null || isNaN(parsed as number) ? null : parsed

  // Optimistic update — access through reactive proxy to trigger Vue reactivity
  if (sessionData.value?.session) {
    const ex = sessionData.value.session.exercises.find(e => e.id === sessionExerciseId)
    if (ex) {
      let idx = ex.sets.findIndex(s => s.user_id === userId && s.set_number === setNumber)
      if (idx === -1) {
        ex.sets.push({
          id: '',
          session_exercise_id: sessionExerciseId,
          user_id: userId,
          set_number: setNumber,
          reps: null,
          weight_kg: null,
          duration_sec: null,
          rest_sec: null
        })
        idx = ex.sets.length - 1
      }
      ;(ex.sets[idx] as Record<string, unknown>)[field] = value
    }
  }
  scheduleSave(sessionExerciseId, setNumber, userId)
}

async function saveNotes() {
  noteSaving.value = true
  try {
    await $fetch(`/api/sessions/${date.value}`, {
      method: 'PATCH',
      body: { notes: notes.value || null }
    })
    noteSaved.value = true
    setTimeout(() => { noteSaved.value = false }, 1200)
  } finally {
    noteSaving.value = false
  }
}

function onNotesInput() {
  if (notesTimer) clearTimeout(notesTimer)
  notesTimer = setTimeout(saveNotes, 1500)
}

function onNotesBlur() {
  if (notesTimer) {
    clearTimeout(notesTimer)
    notesTimer = null
  }
  saveNotes()
}

function onCardioInput(
  sessionExerciseId: string,
  setNumber: number,
  userId: string,
  rawValue: string
) {
  const sec = displayToSec(rawValue)

  // Optimistic update — access through reactive proxy
  if (sessionData.value?.session) {
    const ex = sessionData.value.session.exercises.find(e => e.id === sessionExerciseId)
    if (ex) {
      let idx = ex.sets.findIndex(s => s.user_id === userId && s.set_number === setNumber)
      if (idx === -1) {
        ex.sets.push({
          id: '',
          session_exercise_id: sessionExerciseId,
          user_id: userId,
          set_number: setNumber,
          reps: null,
          weight_kg: null,
          duration_sec: null,
          rest_sec: null
        })
        idx = ex.sets.length - 1
      }
      ex.sets[idx].duration_sec = sec
    }
  }
  scheduleSave(sessionExerciseId, setNumber, userId)
}
</script>

<template>
  <div class="px-4 pt-6 pb-8 max-w-full">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6 max-w-2xl mx-auto">
      <NuxtLink to="/">
        <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" size="sm" />
      </NuxtLink>
      <div>
        <p class="text-xs text-zinc-500 uppercase tracking-wide">Séance</p>
        <h2 class="text-xl font-bold text-white">{{ formattedDate }}</h2>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="max-w-2xl mx-auto space-y-3">
      <USkeleton class="h-12 w-full rounded-xl bg-zinc-800" />
      <USkeleton class="h-40 w-full rounded-xl bg-zinc-800" />
    </div>

    <!-- No session yet -->
    <div v-else-if="!session" class="max-w-lg mx-auto">
      <UCard class="bg-zinc-900 border border-zinc-800">
        <div class="flex flex-col items-center gap-4 py-10 text-center">
          <UIcon name="i-lucide-dumbbell" class="text-4xl text-violet-400" />
          <div>
            <p class="text-white font-medium text-lg">Pas encore de séance</p>
            <p class="text-zinc-500 text-sm mt-1">Démarrez une séance pour commencer à enregistrer.</p>
          </div>

          <!-- Program day selector -->
          <div v-if="programDayOptions.length" class="w-full max-w-xs space-y-2">
            <p class="text-xs text-zinc-400 text-left">Charger un programme (optionnel)</p>
            <USelect
              v-model="selectedProgramDayId"
              :items="[{ label: 'Séance libre', value: null }, ...programDayOptions]"
              value-key="value"
              placeholder="Choisir un jour de programme"
              color="neutral"
              class="w-full"
            />
          </div>

          <UButton
            size="md"
            color="violet"
            variant="solid"
            icon="i-lucide-play"
            :loading="creating"
            @click="startSession"
          >
            Commencer la séance
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Session exists -->
    <div v-else class="space-y-4">
      <!-- Exercise table — horizontally scrollable on mobile -->
      <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800">
              <th class="sticky left-0 z-10 bg-zinc-900 px-3 py-2.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap min-w-[130px]">
                Exercice
              </th>
              <th class="px-3 py-2.5 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                Séries
              </th>
              <th class="px-3 py-2.5 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">
                Série #
              </th>

              <!-- Me columns -->
              <template v-if="me">
                <th class="px-2 py-2.5 text-center text-xs font-semibold text-violet-400 uppercase tracking-wide whitespace-nowrap">
                  {{ me.display_name }} Rép
                </th>
                <th class="px-2 py-2.5 text-center text-xs font-semibold text-violet-400 uppercase tracking-wide whitespace-nowrap">
                  {{ me.display_name }} Poids
                </th>
              </template>

              <!-- Partner columns -->
              <template v-if="partner">
                <th class="px-2 py-2.5 text-center text-xs font-semibold text-zinc-300 uppercase tracking-wide whitespace-nowrap">
                  {{ partner.display_name }} Rép
                </th>
                <th class="px-2 py-2.5 text-center text-xs font-semibold text-zinc-300 uppercase tracking-wide whitespace-nowrap">
                  {{ partner.display_name }} Poids
                </th>
              </template>
            </tr>
          </thead>

          <tbody>
            <template v-for="ex in sortedExercises" :key="ex.id">
              <!-- Exercise header row -->
              <tr class="border-b border-zinc-800/60 bg-zinc-800/30">
                <!-- Exercise name (sticky) -->
                <td class="sticky left-0 z-10 bg-zinc-800/60 px-3 py-2">
                  <div class="flex items-center gap-1.5">
                    <button
                      class="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Supprimer l'exercice"
                      @click="removeExercise(ex.id)"
                    >
                      <UIcon name="i-lucide-x" class="text-xs" />
                    </button>
                    <span class="font-medium text-white text-xs leading-tight">{{ ex.exercise.name }}</span>
                  </div>
                </td>

                <!-- Sets count (editable) -->
                <td class="px-3 py-2 text-center">
                  <input
                    type="number"
                    :value="ex.sets_count"
                    min="1"
                    max="10"
                    class="w-12 text-center bg-zinc-700 border border-zinc-600 rounded text-white text-xs px-1 py-1 tabular-nums focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                    @input="onSetsCountChange(ex.id, parseInt(($event.target as HTMLInputElement).value, 10))"
                    @blur="onSetsCountBlur(ex.id)"
                  />
                </td>

                <!-- Empty cells for set # and user columns -->
                <td />
                <template v-if="me">
                  <td /><td />
                </template>
                <template v-if="partner">
                  <td /><td />
                </template>
              </tr>

              <!-- One row per set number -->
              <tr
                v-for="n in ex.sets_count"
                :key="`${ex.id}-set-${n}`"
                class="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                :class="{ 'bg-green-950/10': isSaved(ex.id, n) }"
              >
                <!-- Exercise column (empty for set rows, sticky) -->
                <td class="sticky left-0 z-10 bg-zinc-900 px-3 py-1.5">
                  <!-- Save indicator -->
                  <div class="flex justify-end">
                    <UIcon
                      v-if="isSaving(ex.id, n)"
                      name="i-lucide-loader-circle"
                      class="text-xs text-zinc-500 animate-spin"
                    />
                    <UIcon
                      v-else-if="isSaved(ex.id, n)"
                      name="i-lucide-check"
                      class="text-xs text-green-400"
                    />
                  </div>
                </td>

                <!-- Sets count column (empty) -->
                <td />

                <!-- Set number -->
                <td class="px-3 py-1.5 text-center">
                  <span class="text-xs text-zinc-500 tabular-nums">{{ n }}</span>
                </td>

                <!-- STRENGTH exercise: reps + weight for each user -->
                <template v-if="!isCardio(ex)">
                  <!-- Me: reps -->
                  <td v-if="me" class="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      inputmode="numeric"
                      min="0"
                      :value="getSet(ex.id, me.id, n)?.reps ?? ''"
                      placeholder="—"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      @input="onStrengthInput(ex.id, n, me.id, 'reps', ($event.target as HTMLInputElement).value)"
                      @blur="onSetBlur(ex.id, n, me.id)"
                    />
                  </td>
                  <!-- Me: weight -->
                  <td v-if="me" class="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.5"
                      :value="getSet(ex.id, me.id, n)?.weight_kg ?? ''"
                      placeholder="kg"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      @input="onStrengthInput(ex.id, n, me.id, 'weight_kg', ($event.target as HTMLInputElement).value)"
                      @blur="onSetBlur(ex.id, n, me.id)"
                    />
                  </td>

                  <!-- Partner: reps (editable) -->
                  <td v-if="partner" class="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      inputmode="numeric"
                      min="0"
                      :value="getSet(ex.id, partner.id, n)?.reps ?? ''"
                      placeholder="—"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
                      @input="onStrengthInput(ex.id, n, partner.id, 'reps', ($event.target as HTMLInputElement).value)"
                      @blur="onSetBlur(ex.id, n, partner.id)"
                    />
                  </td>
                  <!-- Partner: weight (editable) -->
                  <td v-if="partner" class="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.5"
                      :value="getSet(ex.id, partner.id, n)?.weight_kg ?? ''"
                      placeholder="kg"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
                      @input="onStrengthInput(ex.id, n, partner.id, 'weight_kg', ($event.target as HTMLInputElement).value)"
                      @blur="onSetBlur(ex.id, n, partner.id)"
                    />
                  </td>
                </template>

                <!-- CARDIO exercise: duration for each user -->
                <template v-else>
                  <!-- Me: duration -->
                  <td v-if="me" class="px-2 py-1.5 text-center" colspan="2">
                    <input
                      type="text"
                      inputmode="numeric"
                      :value="secToDisplay(getSet(ex.id, me.id, n)?.duration_sec ?? null)"
                      placeholder="MM:SS"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      @change="onCardioInput(ex.id, n, me.id, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <!-- Partner: duration (editable) -->
                  <td v-if="partner" class="px-2 py-1.5 text-center" colspan="2">
                    <input
                      type="text"
                      inputmode="numeric"
                      :value="secToDisplay(getSet(ex.id, partner.id, n)?.duration_sec ?? null)"
                      placeholder="MM:SS"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-600 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
                      @change="onCardioInput(ex.id, n, partner.id, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                </template>
              </tr>
            </template>

            <!-- Empty state -->
            <tr v-if="!sortedExercises.length">
              <td :colspan="partner ? 7 : 5" class="px-4 py-10 text-center">
                <div class="flex flex-col items-center gap-2 text-zinc-500">
                  <UIcon name="i-lucide-dumbbell" class="text-2xl text-zinc-600" />
                  <p class="text-sm">Aucun exercice. Ajoutez-en un ci-dessous.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Add exercise button -->
      <div class="flex justify-center">
        <UButton
          icon="i-lucide-plus"
          variant="outline"
          color="violet"
          size="sm"
          @click="openAddModal"
        >
          Ajouter un exercice
        </UButton>
      </div>

      <!-- Session notes -->
      <div class="max-w-2xl mx-auto">
        <UCard class="bg-zinc-900 border border-zinc-800">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes complémentaires</label>
              <div class="h-4 flex items-center">
                <UIcon v-if="noteSaving" name="i-lucide-loader-circle" class="text-xs text-zinc-500 animate-spin" />
                <UIcon v-else-if="noteSaved" name="i-lucide-check" class="text-xs text-green-400" />
              </div>
            </div>
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Ressenti de la séance, observations…"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm px-3 py-2 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-none"
              @input="onNotesInput"
              @blur="onNotesBlur"
            />
          </div>
        </UCard>
      </div>
    </div>

    <!-- Add exercise modal -->
    <UModal v-model:open="showAddModal" title="Ajouter un exercice">
      <template #body>
        <div class="space-y-4 p-1">
          <UInput
            v-model="exerciseSearch"
            placeholder="Rechercher un exercice..."
            icon="i-lucide-search"
            color="neutral"
            autofocus
          />

          <div class="space-y-1.5">
            <label class="text-xs text-zinc-400 font-medium">Exercice</label>
            <USelect
              v-if="!canCreateExercise"
              v-model="selectedExerciseId"
              :items="exerciseOptions"
              value-key="value"
              placeholder="Sélectionner un exercice"
              color="neutral"
              class="w-full"
            />
            <UButton
              v-else
              icon="i-lucide-plus"
              color="violet"
              variant="outline"
              class="w-full"
              :loading="creatingExercise"
              @click="createExerciseFromSearch"
            >
              Ajouter « {{ exerciseSearch.trim() }} »
            </UButton>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs text-zinc-400 font-medium">Nombre de séries</label>
            <UInput
              v-model="newSetsCount"
              type="number"
              :min="1"
              :max="10"
              color="neutral"
              class="w-24"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton variant="ghost" color="neutral" @click="closeAddModal">Annuler</UButton>
          <UButton
            color="violet"
            :disabled="!selectedExerciseId"
            :loading="addingExercise"
            @click="addExercise"
          >
            Ajouter
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
