<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const { loggedIn, fetch: fetchSession } = useUserSession()

if (loggedIn.value) {
  await navigateTo('/')
}

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    await fetchSession()
    await navigateTo('/')
  } catch {
    error.value = 'Identifiants incorrects'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm bg-zinc-900 border border-zinc-800 shadow-2xl">
    <div class="flex flex-col items-center gap-6 py-8">
      <div class="flex flex-col items-center gap-3">
        <div class="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
          <UIcon name="i-lucide-dumbbell" class="text-4xl text-white" />
        </div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Spor</h1>
        <p class="text-sm text-zinc-400 text-center leading-relaxed">
          Suivez votre progression ensemble
        </p>
      </div>

      <USeparator class="w-full" />

      <!-- Google OAuth -->
      <UButton
        size="lg"
        class="w-full justify-center gap-3"
        color="neutral"
        variant="solid"
        @click="navigateTo('/auth/google', { external: true })"
      >
        <UIcon name="i-logos-google-icon" class="text-lg" />
        Se connecter avec Google
      </UButton>

      <USeparator class="w-full" label="ou" />

      <form class="w-full space-y-4" @submit.prevent="login">
        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            placeholder="vous@exemple.com"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField label="Mot de passe">
          <UInput
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <p v-if="error" class="text-sm text-red-400 text-center">{{ error }}</p>

        <UButton
          type="submit"
          size="lg"
          class="w-full justify-center"
          color="violet"
          variant="solid"
          :loading="loading"
        >
          Se connecter
        </UButton>
      </form>
    </div>
  </UCard>
</template>
