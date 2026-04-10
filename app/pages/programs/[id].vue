<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const programId = route.params.id as string

// ── Program data ──────────────────────────────────────────────────────────────
const { data: program, refresh } = await useFetch(`/api/programs/${programId}`)

// ── Exercises list (for picker) ───────────────────────────────────────────────
const { data: allExercises } = await useFetch('/api/exercises')

// ── Inline name editing ───────────────────────────────────────────────────────
const editingName = ref(false)
const nameInput = ref('')
const savingName = ref(false)

function startEditName() {
  nameInput.value = program.value?.name ?? ''
  editingName.value = true
}

async function saveName() {
  if (!nameInput.value.trim()) return
  savingName.value = true
  try {
    await $fetch(`/api/programs/${programId}`, {
      method: 'PATCH',
      body: { name: nameInput.value.trim(), is_shared: program.value?.is_shared },
    })
    await refresh()
    editingName.value = false
    toast.add({ title: 'Nom mis à jour', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    savingName.value = false
  }
}

// ── Toggle is_shared ──────────────────────────────────────────────────────────
const savingShared = ref(false)

async function toggleShared(val: boolean) {
  savingShared.value = true
  try {
    await $fetch(`/api/programs/${programId}`, {
      method: 'PATCH',
      body: { name: program.value?.name, is_shared: val },
    })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    savingShared.value = false
  }
}

// ── Delete program ────────────────────────────────────────────────────────────
const deletingProgram = ref(false)

async function deleteProgram() {
  if (!confirm('Supprimer ce programme ?')) return
  deletingProgram.value = true
  try {
    await $fetch(`/api/programs/${programId}`, { method: 'DELETE' })
    toast.add({ title: 'Programme supprimé', color: 'green' })
    router.push('/programs')
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
    deletingProgram.value = false
  }
}

// ── Add day ───────────────────────────────────────────────────────────────────
const newDayLabel = ref('')
const addingDay = ref(false)
const showAddDay = ref(false)

async function addDay() {
  if (!newDayLabel.value.trim()) return
  addingDay.value = true
  try {
    const sortOrder = program.value?.days?.length ?? 0
    await $fetch(`/api/programs/${programId}/days`, {
      method: 'POST',
      body: { label: newDayLabel.value.trim(), sort_order: sortOrder },
    })
    newDayLabel.value = ''
    showAddDay.value = false
    await refresh()
    toast.add({ title: 'Jour ajouté', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    addingDay.value = false
  }
}

// ── Add exercise to a day ─────────────────────────────────────────────────────
const exModal = ref(false)
const activeDayId = ref<string | null>(null)
const exForm = ref({ exercise_id: '', default_sets: 3 })
const exSearch = ref('')
const addingEx = ref(false)

const filteredExercises = computed(() => {
  if (!allExercises.value) return []
  const q = exSearch.value.toLowerCase().trim()
  return q
    ? allExercises.value.filter((e: any) => e.name.toLowerCase().includes(q))
    : allExercises.value
})

const exerciseOptions = computed(() =>
  filteredExercises.value.map((e: any) => ({ label: e.name, value: e.id }))
)

function openExModal(dayId: string) {
  activeDayId.value = dayId
  exForm.value = { exercise_id: '', default_sets: 3 }
  exSearch.value = ''
  exModal.value = true
}

async function addExercise() {
  if (!exForm.value.exercise_id || !activeDayId.value) return
  addingEx.value = true
  try {
    const day = program.value?.days?.find((d: any) => d.id === activeDayId.value)
    const sortOrder = day?.exercises?.length ?? 0
    await $fetch(`/api/days/${activeDayId.value}/exercises`, {
      method: 'POST',
      body: { ...exForm.value, sort_order: sortOrder },
    })
    exModal.value = false
    await refresh()
    toast.add({ title: 'Exercice ajouté', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    addingEx.value = false
  }
}

// ── Remove exercise from day ──────────────────────────────────────────────────
async function removeExercise(exId: string, dayId: string) {
  try {
    await $fetch(`/api/days/${dayId}/exercises/${exId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Exercice retiré', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  }
}

// ── Accordion items ───────────────────────────────────────────────────────────
const accordionItems = computed(() =>
  (program.value?.days ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((day: any) => ({
      label: day.label,
      slot: day.id,
      day,
    }))
)
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">
    <!-- Back -->
    <UButton
      variant="ghost"
      color="zinc"
      icon="i-lucide-arrow-left"
      size="sm"
      @click="router.push('/programs')"
    >
      Programmes
    </UButton>

    <!-- Program header -->
    <div v-if="program" class="space-y-4">
      <!-- Name -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div v-if="!editingName" class="flex items-center gap-2">
            <h2 class="text-2xl font-bold text-white truncate">{{ program.name }}</h2>
            <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="zinc" @click="startEditName" />
          </div>
          <div v-else class="flex items-center gap-2">
            <UInput
              v-model="nameInput"
              class="flex-1"
              autofocus
              @keyup.enter="saveName"
              @keyup.escape="editingName = false"
            />
            <UButton icon="i-lucide-check" size="xs" color="violet" :loading="savingName" @click="saveName" />
            <UButton icon="i-lucide-x" size="xs" variant="ghost" color="zinc" @click="editingName = false" />
          </div>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          color="red"
          variant="ghost"
          :loading="deletingProgram"
          @click="deleteProgram"
        />
      </div>

      <!-- Shared toggle -->
      <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
        <span class="text-sm text-zinc-300">Partagé avec le/la partenaire</span>
        <UToggle
          :model-value="program.is_shared"
          color="violet"
          :disabled="savingShared"
          @update:model-value="toggleShared"
        />
      </div>

      <!-- Days as collapsible accordion -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Jours</h3>
          <UButton size="xs" color="violet" variant="ghost" icon="i-lucide-plus" @click="showAddDay = !showAddDay">
            Ajouter un jour
          </UButton>
        </div>

        <!-- Inline add day form -->
        <div v-if="showAddDay" class="flex gap-2">
          <UInput
            v-model="newDayLabel"
            placeholder="Ex : Lundi – Poussée"
            class="flex-1"
            autofocus
            @keyup.enter="addDay"
            @keyup.escape="showAddDay = false"
          />
          <UButton color="violet" size="sm" :loading="addingDay" :disabled="!newDayLabel.trim()" @click="addDay">
            OK
          </UButton>
          <UButton variant="ghost" color="zinc" size="sm" @click="showAddDay = false">
            <UIcon name="i-lucide-x" />
          </UButton>
        </div>

        <!-- Empty state -->
        <UCard v-if="!program.days?.length" class="bg-zinc-900 border border-zinc-800">
          <div class="flex flex-col items-center gap-2 py-8 text-center">
            <UIcon name="i-lucide-calendar-plus" class="text-3xl text-zinc-600" />
            <p class="text-sm text-zinc-500">Aucun jour configuré. Ajoutez-en un ci-dessus.</p>
          </div>
        </UCard>

        <!-- Days accordion -->
        <UAccordion
          v-else
          :items="accordionItems"
          :ui="{ root: 'space-y-2' }"
        >
          <template v-for="item in accordionItems" :key="item.day.id" #[item.slot]>
            <div class="pb-3 space-y-2">
              <!-- Exercise list -->
              <div v-if="item.day.exercises?.length" class="space-y-1">
                <div
                  v-for="pde in item.day.exercises.slice().sort((a: any, b: any) => a.sort_order - b.sort_order)"
                  :key="pde.id"
                  class="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="text-sm text-white truncate">{{ pde.exercise?.name }}</span>
                    <UBadge :label="`${pde.default_sets} séries`" color="zinc" variant="subtle" size="xs" />
                  </div>
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    color="red"
                    variant="ghost"
                    @click.stop="removeExercise(pde.id, item.day.id)"
                  />
                </div>
              </div>
              <p v-else class="text-xs text-zinc-500 px-1">Aucun exercice dans ce jour.</p>

              <!-- Add exercise button -->
              <UButton
                size="xs"
                color="violet"
                variant="outline"
                icon="i-lucide-plus"
                class="w-full justify-center"
                @click.stop="openExModal(item.day.id)"
              >
                Ajouter un exercice
              </UButton>
            </div>
          </template>
        </UAccordion>
      </div>
    </div>

    <!-- Loading -->
    <div v-else class="space-y-4">
      <USkeleton class="h-10 w-48 rounded-lg bg-zinc-800" />
      <USkeleton class="h-14 w-full rounded-xl bg-zinc-800" />
      <USkeleton v-for="i in 3" :key="i" class="h-24 w-full rounded-xl bg-zinc-800" />
    </div>

    <!-- Add exercise modal -->
    <UModal v-model:open="exModal" title="Ajouter un exercice">
      <template #body>
        <div class="space-y-4 p-1">
          <UFormField label="Rechercher">
            <UInput
              v-model="exSearch"
              placeholder="Filtrer les exercices..."
              icon="i-lucide-search"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Exercice" required>
            <USelect
              v-model="exForm.exercise_id"
              :options="exerciseOptions"
              placeholder="Choisir un exercice"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Séries par défaut">
            <UInput
              v-model.number="exForm.default_sets"
              type="number"
              :min="1"
              :max="20"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="zinc" @click="exModal = false">Annuler</UButton>
          <UButton
            color="violet"
            :loading="addingEx"
            :disabled="!exForm.exercise_id"
            @click="addExercise"
          >
            Ajouter
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
