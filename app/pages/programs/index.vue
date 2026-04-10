<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const toast = useToast()
const router = useRouter()

// ── Data ──────────────────────────────────────────────────────────────────────
const { data: programs, refresh } = await useFetch('/api/programs')

// ── Create modal ──────────────────────────────────────────────────────────────
const modalOpen = ref(false)
const form = ref({ name: '', is_shared: false })
const saving = ref(false)

function openModal() {
  form.value = { name: '', is_shared: false }
  modalOpen.value = true
}

async function createProgram() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const created = await $fetch('/api/programs', {
      method: 'POST',
      body: form.value,
    })
    modalOpen.value = false
    await refresh()
    toast.add({ title: 'Programme créé', color: 'green' })
    router.push(`/programs/${(created as any).id}`)
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? e.message, color: 'red' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="px-4 pt-6 pb-20 space-y-6 max-w-lg mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-white">Programmes</h2>
        <p class="text-zinc-400 text-sm mt-1">Gérez vos programmes d'entraînement.</p>
      </div>
      <UButton size="sm" color="violet" variant="solid" icon="i-lucide-plus" @click="openModal">
        Nouveau programme
      </UButton>
    </div>

    <!-- Program list -->
    <div v-if="programs" class="space-y-3">
      <UCard
        v-for="program in programs"
        :key="program.id"
        class="bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-violet-700 transition-colors"
        @click="router.push(`/programs/${program.id}`)"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <UIcon name="i-lucide-list-checks" class="text-violet-400 shrink-0" />
            <span class="font-semibold text-white truncate">{{ program.name }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UBadge v-if="program.is_shared" label="Partagé" color="violet" variant="subtle" size="xs" />
            <UIcon name="i-lucide-chevron-right" class="text-zinc-500" />
          </div>
        </div>
        <div v-if="program.days?.length" class="mt-3 flex flex-wrap gap-1">
          <UBadge
            v-for="day in program.days"
            :key="day.id"
            :label="day.label"
            color="zinc"
            variant="subtle"
            size="xs"
          />
        </div>
        <p v-else class="mt-2 text-xs text-zinc-500">Aucun jour configuré</p>
      </UCard>

      <!-- Empty state -->
      <UCard v-if="programs.length === 0" class="bg-zinc-900 border border-zinc-800">
        <div class="flex flex-col items-center gap-3 py-10 text-center">
          <UIcon name="i-lucide-list-checks" class="text-4xl text-violet-400" />
          <p class="text-white font-medium">Aucun programme créé</p>
          <p class="text-zinc-500 text-sm">Créez votre premier programme d'entraînement.</p>
          <UButton size="sm" color="violet" variant="solid" icon="i-lucide-plus" @click="openModal">
            Nouveau programme
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Loading -->
    <div v-else class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-xl bg-zinc-800" />
    </div>

    <!-- Create modal -->
    <UModal v-model:open="modalOpen" title="Nouveau programme">
      <template #body>
        <div class="space-y-4 p-1">
          <UFormField label="Nom du programme" required>
            <UInput
              v-model="form.name"
              placeholder="Ex : PPL – Push Pull Legs"
              class="w-full"
              autofocus
              @keyup.enter="createProgram"
            />
          </UFormField>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm text-zinc-300">Partagé avec le/la partenaire</span>
            <UToggle v-model="form.is_shared" color="violet" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="zinc" @click="modalOpen = false">Annuler</UButton>
          <UButton color="violet" :loading="saving" :disabled="!form.name.trim()" @click="createProgram">
            Créer
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
