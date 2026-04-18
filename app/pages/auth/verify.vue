<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false,
  ssr: false
})

const route = useRoute()
const { fetch: fetchSession } = useUserSession()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  const rawToken = route.query.token
  const token = typeof rawToken === 'string' ? rawToken : ''

  if (!token) {
    status.value = 'error'
    errorMessage.value = 'Token manquant dans l\'URL'
    return
  }

  window.history.replaceState({}, document.title, route.path)

  try {
    await $fetch('/api/auth/verify-magic-link', {
      method: 'POST',
      body: { token }
    })

    await fetchSession()
    status.value = 'success'

    // Redirection après un court délai
    setTimeout(() => {
      navigateTo('/')
    }, 1500)
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err.data?.message || 'Lien de connexion invalide ou expiré'
  }
})
</script>

<template>
  <UCard class="w-full max-w-sm bg-zinc-900 border border-zinc-800 shadow-2xl">
    <div class="flex flex-col items-center gap-6 py-12">
      <!-- Loading -->
      <div v-if="status === 'loading'" class="flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
        <p class="text-zinc-400">Vérification en cours...</p>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'" class="flex flex-col items-center gap-4">
        <div class="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center">
          <UIcon name="i-lucide-check" class="text-4xl text-green-400" />
        </div>
        <h2 class="text-2xl font-bold text-white">Connexion réussie !</h2>
        <p class="text-zinc-400 text-center">Redirection en cours...</p>
      </div>

      <!-- Error -->
      <div v-else class="flex flex-col items-center gap-4">
        <div class="w-20 h-20 rounded-full bg-red-600/20 flex items-center justify-center">
          <UIcon name="i-lucide-x-circle" class="text-4xl text-red-400" />
        </div>
        <h2 class="text-2xl font-bold text-white">Erreur</h2>
        <p class="text-zinc-400 text-center">{{ errorMessage }}</p>
        <UButton
          color="violet"
          variant="solid"
          @click="navigateTo('/login')"
        >
          Retour à la connexion
        </UButton>
      </div>
    </div>
  </UCard>
</template>
