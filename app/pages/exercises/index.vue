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

// ── Create / edit modal ───────────────────────────────────────────────────────
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ name: '', category: 'strength' })
const saving = ref(false)

const categoryOptions = [
  { label: 'Force', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
]

function openModal() {
  if (saving.value) return
  editingId.value = null
  form.value = { name: '', category: 'strength' }
  modalOpen.value = true
}

function openEditModal(ex: any) {
  if (saving.value) return
  editingId.value = ex.id
  form.value = { name: ex.name, category: ex.category === 'cardio' ? 'cardio' : 'strength' }
  modalOpen.value = true
}

async function submitExercise() {
  if (saving.value || !form.value.name.trim()) return
  // Captured up front: the modal state may change while the request is in flight
  const id = editingId.value
  saving.value = true
  try {
    if (id) {
      await $fetch(`/api/exercises/${id}`, {
        method: 'PATCH',
        body: { name: form.value.name },
      })
    } else {
      await $fetch('/api/exercises', {
        method: 'POST',
        body: form.value,
      })
    }
    modalOpen.value = false
    await refresh()
    toast.add({ title: id ? 'Exercice modifié' : 'Exercice créé', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteExercise(id: string) {
  try {
    await $fetch(`/api/exercises/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Exercice supprimé', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'error' })
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
      <UButton size="sm" color="primary" variant="solid" icon="i-lucide-plus" @click="openModal">
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
                  :color="ex.created_by ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="xs"
                />
              </div>
              <div v-if="ex.created_by" class="flex items-center gap-1 flex-shrink-0">
                <UButton
                  icon="i-lucide-pencil"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Modifier"
                  @click="openEditModal(ex)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  aria-label="Supprimer"
                  @click="deleteExercise(ex.id)"
                />
              </div>
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

    <!-- Create / edit modal -->
    <UModal v-model:open="modalOpen" :title="editingId ? 'Modifier l’exercice' : 'Nouvel exercice'">
      <template #body>
        <div class="space-y-4 p-1">
          <UFormField label="Nom" required>
            <UInput
              v-model="form.name"
              placeholder="Ex : Squat barre"
              class="w-full"
              autofocus
              :disabled="saving"
              @keyup.enter="submitExercise"
            />
          </UFormField>
          <UFormField
            label="Catégorie"
            :help="editingId ? 'Non modifiable : les séries déjà saisies en dépendent.' : undefined"
          >
            <USelect
              :disabled="!!editingId"
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
          <UButton variant="ghost" color="neutral" :disabled="saving" @click="modalOpen = false">Annuler</UButton>
          <UButton color="primary" :loading="saving" :disabled="!form.name.trim()" @click="submitExercise">
            {{ editingId ? 'Enregistrer' : 'Créer' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
