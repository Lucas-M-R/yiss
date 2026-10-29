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
  notes: string | null
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
const toast = useToast()

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

// Same-weekday session from a previous week, offered when starting a new one
interface PreviousSession {
  id: string
  session_date: string
  exercises: { name: string; sets_count: number }[]
}
const previousSession = ref<PreviousSession | null>(null)
const copyingPrevious = ref(false)

// Last sets per session exercise: sessionExerciseId -> userId -> set[]
interface LastSet {
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_sec: number | null
}
const lastSetsMap = ref<Record<string, Record<string, LastSet[]>>>({})

// Debounce timers: key -> timer id
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const saveTimerArgs = new Map<string, [sessionExerciseId: string, setNumber: number, userId: string]>()
// Requests in flight per set key, and keys edited again while their request was in flight
const inFlightSaves = new Map<string, Promise<void>>()
const dirtyWhileSaving = new Set<string>()
// Keys whose last save failed and wait for a retry
const failedSaves = ref(new Set<string>())
const SET_SAVE_DELAY_MS = 2500
const SET_RETRY_DELAY_MS = 5000
let unmounted = false

// Inline sets_count editing
const setsCountTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Comment fields
const showSessionNotes = ref(false)
const openExerciseNotes = ref(new Set<string>())
const sessionNotesTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const exerciseNotesTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

async function fetchLastSets(exerciseId: string, sessionExerciseId: string) {
  try {
    const data = await $fetch<Record<string, LastSet[]>>(
      `/api/exercises/${exerciseId}/last-sets`,
      { query: { date: date.value } }
    )
    lastSetsMap.value = { ...lastSetsMap.value, [sessionExerciseId]: data }
  } catch {
    // non-bloquant
  }
}

function getLastSet(sessionExerciseId: string, userId: string, setNumber: number): LastSet | null {
  const userSets = lastSetsMap.value[sessionExerciseId]?.[userId]
  if (!userSets) return null
  return userSets.find(s => s.set_number === setNumber) ?? userSets[userSets.length - 1] ?? null
}

async function fetchSession() {
  loading.value = true
  try {
    sessionData.value = await $fetch<SessionData>(`/api/sessions/${date.value}`)
    if (!sessionData.value?.session) await fetchPreviousSession()
    // Fetch last sets for all exercises in parallel
    const exercises = sessionData.value?.session?.exercises ?? []
    await Promise.all(exercises.map(ex => fetchLastSets(ex.exercise_id, ex.id)))
  } finally {
    loading.value = false
  }
}

async function fetchPreviousSession() {
  try {
    previousSession.value = await $fetch<PreviousSession | null>(`/api/sessions/${date.value}/previous`)
  } catch {
    previousSession.value = null
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

watch(() => sessionData.value?.session, (s) => {
  showSessionNotes.value = !!s?.notes
  openExerciseNotes.value = new Set()
  s?.exercises?.forEach(ex => {
    if (ex.notes) openExerciseNotes.value.add(ex.id)
  })
})

const { register: registerPageRefresh } = usePageRefresh()

async function refreshSession() {
  await flushPendingSaves()
  // A failed save is waiting for its retry: refetching now would overwrite the unsaved value
  if (saveTimers.size > 0) {
    toast.add({ title: 'Connexion instable', description: 'Des séries ne sont pas encore enregistrées, réessaie dans un instant.', color: 'orange' })
    return
  }
  await fetchSession()
}

// The app can be backgrounded or killed at any time on mobile: send pending edits right away
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flushPendingSaves()
}

onMounted(() => {
  fetchSession()
  fetchPrograms()
  registerPageRefresh(refreshSession)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  unmounted = true
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (sessionNotesTimer.value) clearTimeout(sessionNotesTimer.value)
  exerciseNotesTimers.forEach(t => clearTimeout(t))
  exerciseNotesTimers.clear()
  // Send pending set edits instead of dropping them when leaving the page
  flushPendingSaves()
  setsCountTimers.forEach(t => clearTimeout(t))
  setsCountTimers.clear()
})

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

const previousSessionLabel = computed(() => {
  const prev = previousSession.value
  if (!prev) return ''
  const prevDate = new Date(prev.session_date + 'T00:00:00')
  const weekday = prevDate.toLocaleDateString('fr-FR', { weekday: 'long' })
  const daysAgo = Math.round((new Date(date.value + 'T00:00:00').getTime() - prevDate.getTime()) / 86400000)
  if (daysAgo === 7) return `Reprendre la séance de ${weekday} dernier`
  return `Reprendre la séance du ${weekday} ${prevDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
})

async function startSession(copyFromSessionId?: string) {
  const loadingRef = copyFromSessionId ? copyingPrevious : creating
  loadingRef.value = true
  try {
    const body: Record<string, unknown> = {}
    if (copyFromSessionId) body.copy_from_session_id = copyFromSessionId
    else if (selectedProgramDayId.value) body.program_day_id = selectedProgramDayId.value

    const newSession = await $fetch<Session>(`/api/sessions/${date.value}`, {
      method: 'POST',
      body
    })

    // Refresh to get full session data including me/partner
    await fetchSession()
  } catch (e: any) {
    toast.add({ title: 'Impossible de créer la séance', description: e?.data?.message ?? e?.message, color: 'red' })
  } finally {
    loadingRef.value = false
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
    fetchLastSets(selectedExerciseId.value, newEx.id)
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

// Reorder requests are chained so a fast double tap can't land out of order on the server
let reorderQueue: Promise<void> = Promise.resolve()

function moveExercise(sessionExerciseId: string, direction: -1 | 1) {
  const list = [...sortedExercises.value]
  const from = list.findIndex(e => e.id === sessionExerciseId)
  const to = from + direction
  if (from === -1 || to < 0 || to >= list.length) return

  // Optimistic update: renumber every exercise so duplicate sort_order values can't block the swap
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  list.forEach((e, i) => { e.sort_order = i })

  const ids = list.map(e => e.id)
  reorderQueue = reorderQueue.then(async () => {
    try {
      await $fetch(`/api/sessions/${date.value}/reorder`, { method: 'PUT', body: { ids } })
    } catch (e: any) {
      toast.add({ title: 'Ordre non enregistré', description: e?.data?.message ?? e?.message, color: 'error' })
      await refreshSession()
    }
  })
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
// Notes saving
// ---------------------------------------------------------------------------

function toggleExerciseNotes(sessionExerciseId: string) {
  if (openExerciseNotes.value.has(sessionExerciseId)) {
    openExerciseNotes.value.delete(sessionExerciseId)
  } else {
    openExerciseNotes.value.add(sessionExerciseId)
  }
  openExerciseNotes.value = new Set(openExerciseNotes.value)
}

async function saveExerciseNotes(sessionExerciseId: string, notes: string) {
  await $fetch(`/api/session-exercises/${sessionExerciseId}`, {
    method: 'PATCH',
    body: { notes: notes || null }
  })
  exerciseNotesTimers.delete(sessionExerciseId)
}

function onExerciseNotesInput(sessionExerciseId: string, value: string) {
  if (sessionData.value?.session) {
    const ex = sessionData.value.session.exercises.find(e => e.id === sessionExerciseId)
    if (ex) ex.notes = value || null
  }
  if (exerciseNotesTimers.has(sessionExerciseId)) {
    clearTimeout(exerciseNotesTimers.get(sessionExerciseId)!)
  }
  exerciseNotesTimers.set(
    sessionExerciseId,
    setTimeout(() => saveExerciseNotes(sessionExerciseId, value), 1500)
  )
}

function onExerciseNotesBlur(sessionExerciseId: string) {
  if (exerciseNotesTimers.has(sessionExerciseId)) {
    clearTimeout(exerciseNotesTimers.get(sessionExerciseId)!)
    exerciseNotesTimers.delete(sessionExerciseId)
    const ex = sessionData.value?.session?.exercises.find(e => e.id === sessionExerciseId)
    if (ex) saveExerciseNotes(sessionExerciseId, ex.notes ?? '')
  }
}

async function saveSessionNotes(notes: string) {
  await $fetch(`/api/sessions/${date.value}`, {
    method: 'PATCH',
    body: { notes: notes || null }
  })
}

function onSessionNotesInput(value: string) {
  if (sessionData.value?.session) sessionData.value.session.notes = value || null
  if (sessionNotesTimer.value) clearTimeout(sessionNotesTimer.value)
  sessionNotesTimer.value = setTimeout(() => saveSessionNotes(value), 1500)
}

function onSessionNotesBlur(value: string) {
  if (sessionNotesTimer.value) {
    clearTimeout(sessionNotesTimer.value)
    sessionNotesTimer.value = null
  }
  saveSessionNotes(value)
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

function setKey(sessionExerciseId: string, userId: string, setNumber: number) {
  return `${sessionExerciseId}-${userId}-${setNumber}`
}

function scheduleSave(sessionExerciseId: string, setNumber: number, userId: string, delay = SET_SAVE_DELAY_MS) {
  const key = setKey(sessionExerciseId, userId, setNumber)

  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key)!)
  }

  saveTimerArgs.set(key, [sessionExerciseId, setNumber, userId])
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key)
      saveSet(sessionExerciseId, setNumber, userId)
    }, delay)
  )
}

function onSetBlur(sessionExerciseId: string, setNumber: number, userId: string) {
  // Save immediately on blur
  const key = setKey(sessionExerciseId, userId, setNumber)
  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key)!)
    saveTimers.delete(key)
    saveSet(sessionExerciseId, setNumber, userId)
  }
}

// Fires every debounced save now and waits until nothing is in flight anymore
async function flushPendingSaves() {
  for (const [key, timer] of [...saveTimers]) {
    clearTimeout(timer)
    saveTimers.delete(key)
    const [sessionExerciseId, setNumber, userId] = saveTimerArgs.get(key)!
    saveSet(sessionExerciseId, setNumber, userId)
  }
  while (inFlightSaves.size > 0) {
    await Promise.all(inFlightSaves.values())
  }
}

function saveSet(sessionExerciseId: string, setNumber: number, userId: string): Promise<void> {
  const key = setKey(sessionExerciseId, userId, setNumber)

  // One request per set at a time: if one is in flight, resend once it's done with the latest values
  const pending = inFlightSaves.get(key)
  if (pending) {
    dirtyWhileSaving.add(key)
    return pending
  }

  const promise = doSaveSet(key, sessionExerciseId, setNumber, userId).finally(() => {
    inFlightSaves.delete(key)
    if (dirtyWhileSaving.delete(key)) saveSet(sessionExerciseId, setNumber, userId)
  })
  inFlightSaves.set(key, promise)
  return promise
}

async function doSaveSet(key: string, sessionExerciseId: string, setNumber: number, userId: string) {
  saving.value = new Set([...saving.value, key])

  try {
    const ex = sessionData.value?.session?.exercises?.find(e => e.id === sessionExerciseId)
    const currentSet = ex?.sets?.find(s => s.user_id === userId && s.set_number === setNumber)

    const result = await $fetch<SessionSet>('/api/sets', {
      method: 'POST',
      // Lets the request finish if the page is closed, and frees the set if the network hangs
      keepalive: true,
      timeout: 15_000,
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

    if (failedSaves.value.delete(key)) failedSaves.value = new Set(failedSaves.value)

    // Only take the id from the server: the local values may have been edited
    // while the request was in flight and must not be overwritten
    if (ex) {
      const local = ex.sets.find(s => s.user_id === userId && s.set_number === setNumber)
      if (local) {
        local.id = result.id
      } else {
        ex.sets.push(result)
      }
    }

    // Green flash (only for me), unless a newer edit still has to be saved
    if (userId === me.value?.id && !dirtyWhileSaving.has(key) && !saveTimers.has(key)) {
      saved.value = new Set([...saved.value, key])
      setTimeout(() => {
        saved.value.delete(key)
        saved.value = new Set(saved.value)
      }, 1200)
    }
  } catch (e: any) {
    // Network/server error: keep the local value and retry later, unless a newer edit is already queued
    const retryable = !e?.statusCode || e.statusCode >= 500
    if (retryable) {
      failedSaves.value = new Set([...failedSaves.value, key])
    } else {
      if (failedSaves.value.delete(key)) failedSaves.value = new Set(failedSaves.value)
      toast.add({ title: 'Série non enregistrée', description: e?.data?.message ?? 'Recharge la page puis saisis à nouveau la valeur.', color: 'red' })
    }
    if (retryable && !unmounted && !dirtyWhileSaving.has(key) && !saveTimers.has(key)) {
      scheduleSave(sessionExerciseId, setNumber, userId, SET_RETRY_DELAY_MS)
    }
  } finally {
    saving.value.delete(key)
    saving.value = new Set(saving.value)
  }
}

function isSaving(sessionExerciseId: string, setNumber: number): boolean {
  const userId = me.value?.id
  if (!userId) return false
  return saving.value.has(setKey(sessionExerciseId, userId, setNumber))
}

// Any user of the row (me or partner) waiting for a retry
function isPendingRetry(sessionExerciseId: string, setNumber: number): boolean {
  return users.value.some(u => failedSaves.value.has(setKey(sessionExerciseId, u.id, setNumber)))
}

function isSaved(sessionExerciseId: string, setNumber: number): boolean {
  const userId = me.value?.id
  if (!userId) return false
  return saved.value.has(setKey(sessionExerciseId, userId, setNumber))
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

          <!-- Repeat the same weekday session from a previous week -->
          <div v-if="previousSession" class="w-full max-w-xs space-y-2">
            <UButton
              block
              size="md"
              color="violet"
              variant="soft"
              icon="i-lucide-repeat"
              :loading="copyingPrevious"
              :disabled="creating"
              @click="startSession(previousSession.id)"
            >
              {{ previousSessionLabel }}
            </UButton>
            <p class="text-xs text-zinc-500 text-left">
              {{ previousSession.exercises.map(e => `${e.name} (${e.sets_count})`).join(' · ') }}
            </p>
            <div class="flex items-center gap-2 pt-2">
              <div class="h-px flex-1 bg-zinc-800" />
              <span class="text-xs text-zinc-600">ou</span>
              <div class="h-px flex-1 bg-zinc-800" />
            </div>
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
            :disabled="copyingPrevious"
            @click="startSession()"
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
            <template v-for="(ex, exIndex) in sortedExercises" :key="ex.id">
              <!-- Exercise header row -->
              <tr class="border-b border-zinc-800/60 bg-zinc-800/30">
                <!-- Exercise name (sticky) -->
                <td class="sticky left-0 z-10 bg-zinc-800/60 px-3 py-2">
                  <div class="flex items-center gap-1.5">
                    <!-- Reorder -->
                    <div v-if="sortedExercises.length > 1" class="flex flex-col flex-shrink-0 -my-1">
                      <button
                        class="text-zinc-600 hover:text-violet-400 disabled:opacity-30 disabled:hover:text-zinc-600 transition-colors leading-none"
                        title="Monter l'exercice"
                        :disabled="exIndex === 0"
                        @click="moveExercise(ex.id, -1)"
                      >
                        <UIcon name="i-lucide-chevron-up" class="text-sm" />
                      </button>
                      <button
                        class="text-zinc-600 hover:text-violet-400 disabled:opacity-30 disabled:hover:text-zinc-600 transition-colors leading-none"
                        title="Descendre l'exercice"
                        :disabled="exIndex === sortedExercises.length - 1"
                        @click="moveExercise(ex.id, 1)"
                      >
                        <UIcon name="i-lucide-chevron-down" class="text-sm" />
                      </button>
                    </div>
                    <button
                      class="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Supprimer l'exercice"
                      @click="removeExercise(ex.id)"
                    >
                      <UIcon name="i-lucide-x" class="text-xs" />
                    </button>
                    <span class="font-medium text-white text-xs leading-tight">{{ ex.exercise.name }}</span>
                    <button
                      class="ml-auto flex-shrink-0 transition-colors"
                      :class="openExerciseNotes.has(ex.id) || ex.notes ? 'text-violet-400' : 'text-zinc-600 hover:text-zinc-400'"
                      title="Commentaire"
                      @click="toggleExerciseNotes(ex.id)"
                    >
                      <UIcon name="i-lucide-message-square" class="text-xs" />
                    </button>
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

              <!-- Exercise notes row -->
              <tr v-if="openExerciseNotes.has(ex.id)" class="border-b border-zinc-800/60 bg-zinc-800/20">
                <td :colspan="partner ? 7 : 5" class="px-3 py-2">
                  <textarea
                    :value="ex.notes ?? ''"
                    placeholder="Commentaire sur cet exercice..."
                    rows="2"
                    class="w-full bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-2 py-1.5 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-none"
                    @input="onExerciseNotesInput(ex.id, ($event.target as HTMLTextAreaElement).value)"
                    @blur="onExerciseNotesBlur(ex.id)"
                  />
                </td>
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
                      v-else-if="isPendingRetry(ex.id, n)"
                      name="i-lucide-cloud-off"
                      class="text-xs text-amber-500/70"
                      title="Pas encore enregistré, nouvel essai automatique"
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
                      :placeholder="getLastSet(ex.id, me.id, n)?.reps?.toString() ?? '—'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
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
                      :placeholder="getLastSet(ex.id, me.id, n)?.weight_kg?.toString() ?? 'kg'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
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
                      :placeholder="getLastSet(ex.id, partner.id, n)?.reps?.toString() ?? '—'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
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
                      :placeholder="getLastSet(ex.id, partner.id, n)?.weight_kg?.toString() ?? 'kg'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
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
                      :placeholder="getLastSet(ex.id, me.id, n)?.duration_sec != null ? secToDisplay(getLastSet(ex.id, me.id, n)!.duration_sec) : 'MM:SS'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-white text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                      @change="onCardioInput(ex.id, n, me.id, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <!-- Partner: duration (editable) -->
                  <td v-if="partner" class="px-2 py-1.5 text-center" colspan="2">
                    <input
                      type="text"
                      inputmode="numeric"
                      :value="secToDisplay(getSet(ex.id, partner.id, n)?.duration_sec ?? null)"
                      :placeholder="getLastSet(ex.id, partner.id, n)?.duration_sec != null ? secToDisplay(getLastSet(ex.id, partner.id, n)!.duration_sec) : 'MM:SS'"
                      class="w-full text-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs px-1 py-1 tabular-nums placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/50"
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

      <!-- Add exercise + session notes buttons -->
      <div class="flex justify-center gap-2">
        <UButton
          icon="i-lucide-plus"
          variant="outline"
          color="violet"
          size="sm"
          @click="openAddModal"
        >
          Ajouter un exercice
        </UButton>
        <UButton
          icon="i-lucide-message-square"
          variant="ghost"
          :color="showSessionNotes || session?.notes ? 'violet' : 'neutral'"
          size="sm"
          @click="showSessionNotes = !showSessionNotes"
        >
          Note de séance
        </UButton>
      </div>

      <!-- Session notes -->
      <div v-if="showSessionNotes" class="max-w-2xl mx-auto">
        <textarea
          :value="session?.notes ?? ''"
          placeholder="Note générale sur la séance..."
          rows="3"
          class="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm px-3 py-2.5 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 resize-none"
          @input="onSessionNotesInput(($event.target as HTMLTextAreaElement).value)"
          @blur="onSessionNotesBlur(($event.target as HTMLTextAreaElement).value)"
        />
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
