<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const route = useRoute()
const token = route.params.token as string
const { loggedIn } = useUserSession()
const toast = useToast()

const isAccepting = ref(false)
const accepted = ref(false)
const errorMessage = ref('')

async function loginWithGoogle() {
  await navigateTo(`/auth/google?redirect=/invite/${token}`, { external: true })
}

async function acceptInvitation() {
  isAccepting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/invitations/accept', {
      method: 'POST',
      body: { token }
    })
    accepted.value = true
    toast.add({ title: 'Invitation acceptée !', description: 'Vous êtes maintenant liés à votre partenaire.', color: 'success' })
    await navigateTo('/settings')
  } catch (e: any) {
    errorMessage.value = e?.data?.message ?? 'Invitation invalide ou expirée.'
    toast.add({ title: 'Erreur', description: errorMessage.value, color: 'error' })
  } finally {
    isAccepting.value = false
  }
}

// Auto-accept if already logged in
if (loggedIn.value) {
  await acceptInvitation()
}
</script>

<template>
  <UCard class="w-full max-w-sm bg-zinc-900 border border-zinc-800 shadow-2xl">
    <div class="flex flex-col items-center gap-6 py-8">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-3">
        <div class="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
          <UIcon name="i-lucide-dumbbell" class="text-4xl text-white" />
        </div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Spor</h1>
      </div>

      <USeparator class="w-full" />

      <!-- Content -->
      <div class="w-full space-y-4 text-center">
        <!-- Error state -->
        <template v-if="errorMessage">
          <UIcon name="i-lucide-circle-x" class="text-4xl text-red-400 mx-auto" />
          <p class="text-red-400 font-medium">{{ errorMessage }}</p>
          <NuxtLink to="/">
            <UButton color="neutral" variant="outline" block>
              Retour à l'accueil
            </UButton>
          </NuxtLink>
        </template>

        <!-- Accepting state (logged in) -->
        <template v-else-if="loggedIn && isAccepting">
          <UIcon name="i-lucide-loader-circle" class="text-4xl text-violet-400 mx-auto animate-spin" />
          <p class="text-zinc-300">Acceptation de l'invitation en cours…</p>
        </template>

        <!-- Not logged in: prompt to connect -->
        <template v-else-if="!loggedIn">
          <div class="space-y-2">
            <UIcon name="i-lucide-handshake" class="text-4xl text-violet-400 mx-auto" />
            <p class="text-white font-semibold text-lg">Vous avez été invité !</p>
            <p class="text-zinc-400 text-sm">
              Connectez-vous avec Google pour accepter cette invitation de partenariat.
            </p>
          </div>

          <UButton
            size="lg"
            class="w-full justify-center gap-3"
            color="neutral"
            variant="solid"
            @click="loginWithGoogle"
          >
            <UIcon name="i-logos-google-icon" class="text-lg" />
            Se connecter avec Google
          </UButton>

          <p class="text-xs text-zinc-500">
            Une fois connecté, l'invitation sera acceptée automatiquement.
          </p>
        </template>
      </div>
    </div>
  </UCard>
</template>
