<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportSet {
  set: number
  p1_reps?: number
  p1_weight?: number
  p1_duration_sec?: number
  p2_reps?: number
  p2_weight?: number
  p2_duration_sec?: number
}

interface ImportExercise {
  name: string
  sets: ImportSet[]
}

interface ImportSession {
  date: string
  program_day?: string
  exercises: ImportExercise[]
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

interface ValidationError {
  message: string
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const toast = useToast()

const rawJson = ref('')
const parsedSessions = ref<ImportSession[] | null>(null)
const validationErrors = ref<ValidationError[]>([])
const importResult = ref<ImportResult | null>(null)
const isImporting = ref(false)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const formatOpen = ref(false)

// ---------------------------------------------------------------------------
// Client-side validation
// ---------------------------------------------------------------------------

function validate(): boolean {
  validationErrors.value = []
  parsedSessions.value = null
  importResult.value = null

  const raw = rawJson.value.trim()
  if (!raw) {
    validationErrors.value = [{ message: 'Veuillez coller ou charger du JSON.' }]
    return false
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    validationErrors.value = [{ message: 'JSON invalide — vérifiez la syntaxe (virgules, guillemets, accolades).' }]
    return false
  }

  if (!Array.isArray(parsed)) {
    validationErrors.value = [{ message: 'Le JSON doit être un tableau (commençant par [).' }]
    return false
  }

  const errs: ValidationError[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown>
    const label = `Séance ${i + 1}`

    if (!item.date || typeof item.date !== 'string') {
      errs.push({ message: `${label} : champ 'date' manquant ou invalide.` })
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      errs.push({ message: `${label} : 'date' doit être au format YYYY-MM-DD (ex. 2025-01-15).` })
    }

    if (!Array.isArray(item.exercises) || item.exercises.length === 0) {
      errs.push({ message: `${label} : champ 'exercises' manquant ou vide.` })
      continue
    }

    const exercises = item.exercises as Record<string, unknown>[]
    for (let j = 0; j < exercises.length; j++) {
      const ex = exercises[j]
      const exLabel = `${label}, exercice ${j + 1}`

      if (!ex.name || typeof ex.name !== 'string') {
        errs.push({ message: `${exLabel} : champ 'name' manquant.` })
      }
      if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
        errs.push({ message: `${exLabel} : champ 'sets' manquant ou vide.` })
      }
    }
  }

  if (errs.length) {
    validationErrors.value = errs
    return false
  }

  parsedSessions.value = parsed as ImportSession[]
  return true
}

// ---------------------------------------------------------------------------
// Preview computed
// ---------------------------------------------------------------------------

const previewSummary = computed(() => {
  const sessions = parsedSessions.value
  if (!sessions?.length) return null

  const dates = sessions.map(s => s.date).sort()
  const totalExercises = sessions.reduce((sum, s) => sum + s.exercises.length, 0)

  return {
    total: sessions.length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    totalExercises,
    preview: sessions.slice(0, 3),
  }
})

// ---------------------------------------------------------------------------
// File handling
// ---------------------------------------------------------------------------

function loadFile(file: File) {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    toast.add({ title: 'Fichier non supporté', description: 'Seuls les fichiers .json sont acceptés.', color: 'error' })
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    rawJson.value = (e.target?.result as string) ?? ''
    parsedSessions.value = null
    validationErrors.value = []
    importResult.value = null
  }
  reader.readAsText(file)
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) loadFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function openFilePicker() {
  fileInput.value?.click()
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function runImport() {
  if (!parsedSessions.value?.length) return
  isImporting.value = true
  importResult.value = null

  try {
    const result = await $fetch<ImportResult>('/api/import', {
      method: 'POST',
      body: parsedSessions.value,
    })
    importResult.value = result

    if (result.imported > 0) {
      toast.add({
        title: 'Import terminé',
        description: `${result.imported} séance(s) importée(s).`,
        color: 'success',
      })
    }
  } catch (err: any) {
    toast.add({
      title: 'Erreur lors de l\'import',
      description: err?.data?.message ?? err?.message ?? 'Erreur inconnue.',
      color: 'error',
    })
  } finally {
    isImporting.value = false
  }
}

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

const exampleJson = `[
  {
    "date": "2025-01-15",
    "program_day": "Lundi",
    "exercises": [
      {
        "name": "Développé couché",
        "sets": [
          { "set": 1, "p1_reps": 10, "p1_weight": 80, "p2_reps": 8, "p2_weight": 60 },
          { "set": 2, "p1_reps": 9,  "p1_weight": 80, "p2_reps": 7, "p2_weight": 60 }
        ]
      },
      {
        "name": "Tapis de course",
        "sets": [
          { "set": 1, "p1_duration_sec": 1200, "p2_duration_sec": 900 }
        ]
      }
    ]
  }
]`
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">

    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-white">Importer des séances</h2>
      <p class="text-zinc-400 text-sm mt-1">Importez vos données d'entraînement au format JSON.</p>
    </div>

    <!-- ------------------------------------------------------------------ -->
    <!-- Step 1: JSON input                                                   -->
    <!-- ------------------------------------------------------------------ -->
    <UCard class="bg-zinc-900 border border-zinc-800">
      <template #header>
        <p class="text-sm font-semibold text-zinc-300">1. Collez votre JSON ou chargez un fichier</p>
      </template>

      <div class="space-y-3">
        <!-- Textarea -->
        <UTextarea
          v-model="rawJson"
          placeholder='[ { "date": "2025-01-15", "exercises": [...] } ]'
          :rows="8"
          class="font-mono text-xs w-full"
          :ui="{ base: 'font-mono text-xs resize-y' }"
          @input="parsedSessions = null; validationErrors = []; importResult = null"
        />

        <!-- Drag-and-drop zone -->
        <div
          class="relative border-2 border-dashed rounded-xl flex flex-col items-center gap-2 py-6 px-4 text-center transition-colors cursor-pointer select-none"
          :class="isDragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-zinc-700 hover:border-violet-700 hover:bg-zinc-800/50'"
          @click="openFilePicker"
          @drop.prevent="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <UIcon
            name="i-lucide-file-json"
            class="text-3xl transition-colors"
            :class="isDragging ? 'text-violet-400' : 'text-zinc-500'"
          />
          <div>
            <p class="text-sm font-medium text-zinc-300">Glissez un fichier .json ici</p>
            <p class="text-xs text-zinc-500 mt-0.5">ou cliquez pour parcourir</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="onFileChange"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-check-circle"
            color="violet"
            :disabled="!rawJson.trim()"
            @click="validate"
          >
            Valider
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- ------------------------------------------------------------------ -->
    <!-- Validation errors                                                    -->
    <!-- ------------------------------------------------------------------ -->
    <UAlert
      v-if="validationErrors.length"
      color="error"
      icon="i-lucide-circle-x"
      title="Erreurs de validation"
    >
      <template #description>
        <ul class="mt-1 space-y-0.5 list-disc list-inside text-sm">
          <li v-for="(err, i) in validationErrors" :key="i">{{ err.message }}</li>
        </ul>
      </template>
    </UAlert>

    <!-- ------------------------------------------------------------------ -->
    <!-- Step 2: Preview                                                      -->
    <!-- ------------------------------------------------------------------ -->
    <template v-if="previewSummary">
      <UCard class="bg-zinc-900 border border-zinc-800">
        <template #header>
          <p class="text-sm font-semibold text-zinc-300">2. Aperçu avant import</p>
        </template>

        <!-- Summary stats -->
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-zinc-800 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-white tabular-nums">{{ previewSummary.total }}</p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Séances</p>
          </div>
          <div class="bg-zinc-800 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-white tabular-nums">{{ previewSummary.totalExercises }}</p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Exercices</p>
          </div>
          <div class="bg-zinc-800 rounded-xl p-3 text-center col-span-1">
            <p class="text-[11px] font-semibold text-violet-300 leading-tight tabular-nums">
              {{ formatDate(previewSummary.firstDate) }}
            </p>
            <p class="text-[10px] text-zinc-500 mt-0.5">→</p>
            <p class="text-[11px] font-semibold text-violet-300 leading-tight tabular-nums">
              {{ formatDate(previewSummary.lastDate) }}
            </p>
          </div>
        </div>

        <!-- Preview rows (first 3) -->
        <p class="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-2">
          Aperçu ({{ Math.min(3, previewSummary.total) }} premières séances)
        </p>
        <div class="space-y-2">
          <div
            v-for="s in previewSummary.preview"
            :key="s.date"
            class="flex items-start gap-3 bg-zinc-800 rounded-lg px-3 py-2.5"
          >
            <div class="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center">
              <UIcon name="i-lucide-calendar" class="text-violet-400 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <p class="text-sm font-semibold text-white">{{ formatDate(s.date) }}</p>
                <span v-if="s.program_day" class="text-[10px] text-zinc-500 shrink-0">{{ s.program_day }}</span>
              </div>
              <p class="text-xs text-zinc-400 mt-0.5 truncate">
                {{ s.exercises.map(e => e.name).join(', ') }}
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-upload-cloud"
              color="violet"
              :loading="isImporting"
              :disabled="isImporting"
              @click="runImport"
            >
              Importer {{ previewSummary.total }} séance{{ previewSummary.total > 1 ? 's' : '' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>

    <!-- ------------------------------------------------------------------ -->
    <!-- Step 3: Result                                                       -->
    <!-- ------------------------------------------------------------------ -->
    <template v-if="importResult">
      <!-- Success summary -->
      <UCard class="bg-zinc-900 border border-zinc-800">
        <template #header>
          <p class="text-sm font-semibold text-zinc-300">Résultat de l'import</p>
        </template>

        <div class="grid grid-cols-3 gap-3">
          <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-emerald-400 tabular-nums">{{ importResult.imported }}</p>
            <p class="text-[10px] text-emerald-600 uppercase tracking-wide mt-0.5">Importées</p>
          </div>
          <div class="bg-zinc-800 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-zinc-400 tabular-nums">{{ importResult.skipped }}</p>
            <p class="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">Ignorées</p>
          </div>
          <div
            class="rounded-xl p-3 text-center"
            :class="importResult.errors.length ? 'bg-red-500/10 border border-red-500/20' : 'bg-zinc-800'"
          >
            <p
              class="text-xl font-bold tabular-nums"
              :class="importResult.errors.length ? 'text-red-400' : 'text-zinc-400'"
            >
              {{ importResult.errors.length }}
            </p>
            <p
              class="text-[10px] uppercase tracking-wide mt-0.5"
              :class="importResult.errors.length ? 'text-red-600' : 'text-zinc-500'"
            >
              Erreurs
            </p>
          </div>
        </div>

        <!-- Error list -->
        <ul v-if="importResult.errors.length" class="mt-4 space-y-1">
          <li
            v-for="(err, i) in importResult.errors"
            :key="i"
            class="flex items-start gap-2 text-xs text-red-400"
          >
            <UIcon name="i-lucide-circle-x" class="shrink-0 mt-0.5 text-red-500" />
            {{ err }}
          </li>
        </ul>

        <!-- Link to stats -->
        <template v-if="importResult.imported > 0" #footer>
          <div class="flex justify-end">
            <UButton
              to="/stats"
              variant="ghost"
              color="violet"
              trailing-icon="i-lucide-arrow-right"
            >
              Voir les statistiques
            </UButton>
          </div>
        </template>
      </UCard>
    </template>

    <!-- ------------------------------------------------------------------ -->
    <!-- Format help (collapsible)                                            -->
    <!-- ------------------------------------------------------------------ -->
    <UCard class="bg-zinc-900 border border-zinc-800">
      <button
        class="flex w-full items-center justify-between text-left"
        @click="formatOpen = !formatOpen"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="text-zinc-400 text-base" />
          <span class="text-sm font-medium text-zinc-300">Format JSON attendu</span>
        </div>
        <UIcon
          name="i-lucide-chevron-down"
          class="text-zinc-500 text-sm transition-transform"
          :class="formatOpen ? 'rotate-180' : ''"
        />
      </button>

      <div v-if="formatOpen" class="mt-4 space-y-3">
        <p class="text-xs text-zinc-400">
          Le fichier doit être un tableau JSON de séances. Chaque séance contient une date, un nom de jour optionnel et une liste d'exercices. Les champs <code class="text-violet-400">p1_*</code> correspondent à vous et les champs <code class="text-violet-400">p2_*</code> à votre partenaire.
        </p>

        <div class="space-y-1">
          <p class="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">Champs disponibles par série</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div class="text-zinc-400"><code class="text-violet-400">p1_reps</code> / <code class="text-violet-400">p2_reps</code></div>
            <div class="text-zinc-500">Nombre de répétitions</div>
            <div class="text-zinc-400"><code class="text-violet-400">p1_weight</code> / <code class="text-violet-400">p2_weight</code></div>
            <div class="text-zinc-500">Charge en kg</div>
            <div class="text-zinc-400"><code class="text-violet-400">p1_duration_sec</code> / <code class="text-violet-400">p2_duration_sec</code></div>
            <div class="text-zinc-500">Durée en secondes (cardio)</div>
          </div>
        </div>

        <p class="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mt-2">Exemple</p>
        <pre class="text-[11px] text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-x-auto leading-relaxed">{{ exampleJson }}</pre>
      </div>
    </UCard>

  </div>
</template>
