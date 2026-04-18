<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false
})

const { loggedIn, fetch: fetchSession } = useUserSession()

if (loggedIn.value) {
  await navigateTo('/')
}

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const mode = ref<'password' | 'magic'>('magic') // Par défaut magic link
const magicLinkSent = ref(false)

async function loginWithPassword() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    await fetchSession()
    await navigateTo('/')
  } catch (err: any) {
    error.value = err.data?.message || 'Identifiants incorrects'
  } finally {
    loading.value = false
  }
}

async function sendMagicLink() {
  error.value = ''
  magicLinkSent.value = false
  loading.value = true
  try {
    await $fetch('/api/auth/send-magic-link', {
      method: 'POST',
      body: { email: email.value }
    })
    magicLinkSent.value = true
  } catch (err: any) {
    error.value = err.data?.message || 'Erreur lors de l\'envoi de l\'email'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (mode.value === 'magic') {
    await sendMagicLink()
  } else {
    await loginWithPassword()
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

      <!-- Toggle entre Magic Link et Password -->
      <div class="flex w-full gap-2 p-1 bg-zinc-800 rounded-lg">
        <button
          type="button"
          class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors"
          :class="mode === 'magic' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'"
          @click="mode = 'magic'; magicLinkSent = false; error = ''"
        >
          Lien par email
        </button>
        <button
          type="button"
          class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors"
          :class="mode === 'password' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'"
          @click="mode = 'password'; magicLinkSent = false; error = ''"
        >
          Mot de passe
        </button>
      </div>

      <!-- Magic Link Form -->
      <form v-if="mode === 'magic' && !magicLinkSent" class="w-full space-y-4" @submit.prevent="handleSubmit">
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

        <p v-if="error" class="text-sm text-red-400 text-center">{{ error }}</p>

        <UButton
          type="submit"
          size="lg"
          class="w-full justify-center"
          color="violet"
          variant="solid"
          :loading="loading"
        >
          Envoyer le lien de connexion
        </UButton>

        <p class="text-xs text-zinc-500 text-center">
          Vous recevrez un email avec un lien pour vous connecter
        </p>
      </form>

      <!-- Magic Link Sent Message -->
      <div v-if="mode === 'magic' && magicLinkSent" class="w-full space-y-4 text-center">
        <div class="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto">
          <UIcon name="i-lucide-mail-check" class="text-3xl text-green-400" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white mb-2">Email envoyé !</h3>
          <p class="text-sm text-zinc-400">
            Vérifiez votre boîte mail <span class="text-white font-medium">{{ email }}</span>
          </p>
          <p class="text-xs text-zinc-500 mt-2">
            Le lien expire dans 15 minutes
          </p>
        </div>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          @click="magicLinkSent = false"
        >
          Renvoyer un email
        </UButton>
      </div>

      <!-- Password Form -->
      <form v-if="mode === 'password'" class="w-full space-y-4" @submit.prevent="handleSubmit">
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
