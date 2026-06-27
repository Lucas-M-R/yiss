<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const router = useRouter()
const toast = useToast()

const { data: exercises, refresh } = await useFetch('/api/exercises')

const categoryOptions = [
  { label: 'Force', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
]

const categoryLabel: Record<string, string> = {
  strength: 'Force',
  cardio: 'Cardio',
}

const search = ref('')

const filtered = computed(() => {
  if (!exercises.value) return []
  const q = search.value.toLowerCase().trim()
  return q
    ? exercises.value.filter((e: any) => e.name.toLowerCase().includes(q))
    : exercises.value
})

// ── Inline rename ─────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editForm = ref({ name: '', category: 'strength' })
const saving = ref(false)

function startEdit(ex: any) {
  editingId.value = ex.id
  editForm.value = { name: ex.name, category: ex.category }
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit() {
  if (!editForm.value.name.trim() || !editingId.value) return
  saving.value = true
  try {
    await $fetch(`/api/exercises/${editingId.value}`, {
      method: 'PATCH',
      body: editForm.value,
    })
    editingId.value = null
    await refresh()
    toast.add({ title: 'Exercice mis à jour', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteModal = ref(false)
const deleteTarget = ref<any>(null)
const deleteUsage = ref<{ program_days: number; sessions: number } | null>(null)
const deleteUsageLoading = ref(false)
const deleteUsageError = ref(false)
const deleting = ref(false)

async function openDeleteModal(ex: any) {
  deleteTarget.value = ex
  deleteUsage.value = null
  deleteUsageError.value = false
  deleteUsageLoading.value = true
  deleteModal.value = true
  try {
    deleteUsage.value = await $fetch(`/api/exercises/${ex.id}/usage`)
  } catch {
    deleteUsageError.value = true
  } finally {
    deleteUsageLoading.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch(`/api/exercises/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteModal.value = false
    await refresh()
    toast.add({ title: 'Exercice supprimé', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    deleting.value = false
  }
}

// ── Merge ─────────────────────────────────────────────────────────────────────
const mergeModal = ref(false)
const mergeSource = ref<any>(null)
const mergeTargetId = ref('')
const mergeUsage = ref<{ program_days: number; sessions: number } | null>(null)
const mergeUsageLoading = ref(false)
const mergeUsageError = ref(false)
const merging = ref(false)

const mergeTargetOptions = computed(() =>
  (exercises.value ?? [])
    .filter((e: any) => e.id !== mergeSource.value?.id)
    .map((e: any) => ({ label: `${e.name} (${categoryLabel[e.category]})`, value: e.id }))
)

async function openMergeModal(ex: any) {
  mergeSource.value = ex
  mergeTargetId.value = ''
  mergeUsage.value = null
  mergeUsageError.value = false
  mergeUsageLoading.value = true
  mergeModal.value = true
  try {
    mergeUsage.value = await $fetch(`/api/exercises/${ex.id}/usage`)
  } catch {
    mergeUsageError.value = true
  } finally {
    mergeUsageLoading.value = false
  }
}

async function confirmMerge() {
  if (!mergeSource.value || !mergeTargetId.value) return
  merging.value = true
  try {
    await $fetch('/api/exercises/merge', {
      method: 'POST',
      body: { source_id: mergeSource.value.id, target_id: mergeTargetId.value },
    })
    mergeModal.value = false
    await refresh()
    toast.add({ title: 'Exercices fusionnés', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    merging.value = false
  }
}
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">
    <!-- Back -->
    <UButton
      variant="ghost"
      color="zinc"
      icon="i-lucide-arrow-left"
      size="sm"
      @click="router.push('/exercises')"
    >
      Exercices
    </UButton>

    <div>
      <h2 class="text-2xl font-bold text-white">Gérer les exercices</h2>
      <p class="text-zinc-400 text-sm mt-1">Renommer, fusionner ou supprimer des exercices.</p>
    </div>

    <UInput
      v-model="search"
      placeholder="Rechercher un exercice..."
      icon="i-lucide-search"
      class="w-full"
    />

    <div v-if="exercises" class="space-y-2">
      <div
        v-for="ex in filtered"
        :key="ex.id"
        class="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3"
      >
        <!-- Display mode -->
        <div v-if="editingId !== ex.id" class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-medium text-white truncate">{{ ex.name }}</span>
            <UBadge :label="categoryLabel[ex.category]" color="zinc" variant="subtle" size="xs" />
            <UBadge
              :label="ex.created_by ? 'Personnel' : 'Global'"
              :color="ex.created_by ? 'violet' : 'zinc'"
              variant="subtle"
              size="xs"
            />
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="zinc" aria-label="Renommer" @click="startEdit(ex)" />
            <UButton icon="i-lucide-merge" size="xs" variant="ghost" color="zinc" aria-label="Fusionner" @click="openMergeModal(ex)" />
            <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="red" aria-label="Supprimer" @click="openDeleteModal(ex)" />
          </div>
        </div>

        <!-- Edit mode -->
        <div v-else class="space-y-2">
          <UInput
            v-model="editForm.name"
            class="w-full"
            autofocus
            @keyup.enter="saveEdit"
            @keyup.escape="cancelEdit"
          />
          <div class="flex items-center gap-2">
            <USelect
              v-model="editForm.category"
              :items="categoryOptions"
              value-key="value"
              class="flex-1"
            />
            <UButton icon="i-lucide-check" size="sm" color="violet" :loading="saving" :disabled="!editForm.name.trim()" @click="saveEdit" />
            <UButton icon="i-lucide-x" size="sm" variant="ghost" color="zinc" @click="cancelEdit" />
          </div>
        </div>
      </div>

      <p v-if="filtered.length === 0" class="text-center text-zinc-500 text-sm py-8">
        Aucun exercice trouvé.
      </p>
    </div>

    <div v-else class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-xl bg-zinc-800" />
    </div>

    <!-- Delete modal -->
    <UModal v-model:open="deleteModal" title="Supprimer l'exercice">
      <template #body>
        <div class="space-y-3 p-1">
          <p class="text-sm text-zinc-300">
            Supprimer <span class="font-semibold text-white">{{ deleteTarget?.name }}</span> ?
          </p>
          <UAlert
            v-if="deleteUsageError"
            color="red"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Impossible de vérifier l'usage"
            description="Réessayez plus tard avant de supprimer cet exercice."
          />
          <UAlert
            v-else-if="deleteUsage && (deleteUsage.program_days > 0 || deleteUsage.sessions > 0)"
            color="red"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Cet exercice est utilisé"
            :description="`${deleteUsage.program_days} jour(s) de programme et ${deleteUsage.sessions} séance(s) seront aussi supprimés.`"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="zinc" @click="deleteModal = false">Annuler</UButton>
          <UButton
            color="red"
            :loading="deleting || deleteUsageLoading"
            :disabled="deleteUsageLoading || deleteUsageError"
            @click="confirmDelete"
          >
            Supprimer
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Merge modal -->
    <UModal v-model:open="mergeModal" title="Fusionner l'exercice">
      <template #body>
        <div class="space-y-4 p-1">
          <p class="text-sm text-zinc-300">
            Fusionner <span class="font-semibold text-white">{{ mergeSource?.name }}</span> dans un autre exercice.
            L'historique sera reporté et <span class="font-semibold text-white">{{ mergeSource?.name }}</span> sera supprimé.
          </p>
          <UAlert
            v-if="mergeUsageError"
            color="red"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Impossible de vérifier l'usage"
            description="Réessayez plus tard avant de fusionner cet exercice."
          />
          <UAlert
            v-else-if="mergeUsage && (mergeUsage.program_days > 0 || mergeUsage.sessions > 0)"
            color="amber"
            variant="subtle"
            icon="i-lucide-info"
            :description="`${mergeUsage.program_days} jour(s) de programme et ${mergeUsage.sessions} séance(s) seront déplacés.`"
          />
          <UFormField label="Fusionner vers" required>
            <USelect
              v-model="mergeTargetId"
              :items="mergeTargetOptions"
              value-key="value"
              placeholder="Choisir l'exercice cible"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="zinc" @click="mergeModal = false">Annuler</UButton>
          <UButton
            color="violet"
            :loading="merging || mergeUsageLoading"
            :disabled="!mergeTargetId || mergeUsageLoading || mergeUsageError"
            @click="confirmMerge"
          >
            Fusionner
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
