<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const toast = useToast()

// ── Data ──────────────────────────────────────────────────────────────────────
const { data: exercises, refresh } = await useFetch('/api/exercises')

const search = ref('')

const filtered = computed(() => {
  if (!exercises.value) return []
  const q = search.value.toLowerCase().trim()
  return q
    ? exercises.value.filter((e: any) => e.name.toLowerCase().includes(q))
    : exercises.value
})

const byCategory = computed(() => {
  const groups: Record<string, any[]> = { strength: [], cardio: [] }
  for (const ex of filtered.value) {
    const key = ex.category === 'cardio' ? 'cardio' : 'strength'
    groups[key].push(ex)
  }
  return groups
})

const categoryLabel: Record<string, string> = {
  strength: 'Force',
  cardio: 'Cardio',
}

// ── Create modal ──────────────────────────────────────────────────────────────
const modalOpen = ref(false)
const form = ref({ name: '', category: 'strength' })
const saving = ref(false)

const categoryOptions = [
  { label: 'Force', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
]

function openModal() {
  form.value = { name: '', category: 'strength' }
  modalOpen.value = true
}

async function createExercise() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    await $fetch('/api/exercises', {
      method: 'POST',
      body: form.value,
    })
    modalOpen.value = false
    await refresh()
    toast.add({ title: 'Exercice créé', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteExercise(id: string) {
  try {
    await $fetch(`/api/exercises/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Exercice supprimé', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  }
}
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white">Exercices</h2>
        <p class="text-zinc-400 text-sm mt-1">Bibliothèque d'exercices.</p>
      </div>
      <UButton size="sm" color="violet" variant="solid" icon="i-lucide-plus" @click="openModal">
        Nouvel exercice
      </UButton>
    </div>

    <!-- Search -->
    <UInput
      v-model="search"
      placeholder="Rechercher un exercice..."
      icon="i-lucide-search"
      class="w-full"
    />

    <!-- List grouped by category -->
    <div v-if="exercises" class="space-y-6">
      <template v-for="(cat, key) in byCategory" :key="key">
        <div v-if="cat.length > 0" class="space-y-2">
          <h3 class="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {{ categoryLabel[key] }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="ex in cat"
              :key="ex.id"
              class="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="font-medium text-white truncate">{{ ex.name }}</span>
                <UBadge
                  :label="ex.created_by ? 'Personnel' : 'Global'"
                  :color="ex.created_by ? 'violet' : 'zinc'"
                  variant="subtle"
                  size="xs"
                />
              </div>
              <UButton
                v-if="ex.created_by"
                icon="i-lucide-trash-2"
                size="xs"
                color="red"
                variant="ghost"
                aria-label="Supprimer"
                @click="deleteExercise(ex.id)"
              />
            </div>
          </div>
        </div>
      </template>

      <p
        v-if="filtered.length === 0"
        class="text-center text-zinc-500 text-sm py-8"
      >
        Aucun exercice trouvé.
      </p>
    </div>

    <!-- Loading skeletons -->
    <div v-else class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl bg-zinc-800" />
    </div>

    <!-- Create modal -->
    <UModal v-model:open="modalOpen" title="Nouvel exercice">
      <template #body>
        <div class="space-y-4 p-1">
          <UFormField label="Nom" required>
            <UInput
              v-model="form.name"
              placeholder="Ex : Squat barre"
              class="w-full"
              autofocus
              @keyup.enter="createExercise"
            />
          </UFormField>
          <UFormField label="Catégorie">
            <USelect
              v-model="form.category"
              :items="categoryOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="zinc" @click="modalOpen = false">Annuler</UButton>
          <UButton color="violet" :loading="saving" :disabled="!form.name.trim()" @click="createExercise">
            Créer
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
