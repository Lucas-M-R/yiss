<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const toast = useToast()
const { clear } = useUserSession()

// Fetch current user with partner info
const { data: profile, refresh: refreshProfile } = await useFetch('/api/users/me')

// Editable display name
const displayName = ref(profile.value?.display_name ?? '')
const isSavingName = ref(false)

async function saveName() {
  if (!displayName.value.trim()) return
  isSavingName.value = true
  try {
    await $fetch('/api/users/me', {
      method: 'PATCH',
      body: { display_name: displayName.value.trim() }
    })
    await refreshProfile()
    toast.add({ title: 'Nom mis à jour', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de la mise à jour', color: 'error' })
  } finally {
    isSavingName.value = false
  }
}

// Partner invitation
const inviteEmail = ref('')
const isSendingInvite = ref(false)

async function sendInvitation() {
  if (!inviteEmail.value.trim()) return
  isSendingInvite.value = true
  try {
    await $fetch('/api/invitations', {
      method: 'POST',
      body: { email: inviteEmail.value.trim() }
    })
    inviteEmail.value = ''
    toast.add({ title: 'Invitation envoyée', description: 'Votre partenaire recevra un lien pour accepter.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? 'Impossible d\'envoyer l\'invitation', color: 'error' })
  } finally {
    isSendingInvite.value = false
  }
}

// Remove partner
const isRemovingPartner = ref(false)
const showRemoveConfirm = ref(false)

async function removePartner() {
  isRemovingPartner.value = true
  try {
    await $fetch('/api/users/me', {
      method: 'PATCH',
      body: { partner_id: null }
    })
    await refreshProfile()
    showRemoveConfirm.value = false
    toast.add({ title: 'Partenaire retiré', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  } finally {
    isRemovingPartner.value = false
  }
}

// Password management
const newPassword = ref('')
const confirmPassword = ref('')
const isSavingPassword = ref(false)
const showPasswordSection = ref(false)

async function setPassword() {
  if (!newPassword.value || newPassword.value.length < 8) {
    toast.add({ title: 'Le mot de passe doit contenir au moins 8 caractères', color: 'error' })
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.add({ title: 'Les mots de passe ne correspondent pas', color: 'error' })
    return
  }

  isSavingPassword.value = true
  try {
    await $fetch('/api/auth/set-password', {
      method: 'POST',
      body: { password: newPassword.value }
    })
    newPassword.value = ''
    confirmPassword.value = ''
    showPasswordSection.value = false
    toast.add({ title: 'Mot de passe défini avec succès', description: 'Vous pouvez maintenant vous connecter avec votre email et mot de passe.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Erreur', description: e?.data?.message ?? 'Impossible de définir le mot de passe', color: 'error' })
  } finally {
    isSavingPassword.value = false
  }
}

// Logout
async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
    <div>
      <h2 class="text-2xl font-bold text-white">Paramètres</h2>
    </div>

    <!-- User profile card -->
    <section class="space-y-2">
      <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium px-1">Mon profil</p>
      <UCard class="bg-zinc-900 border border-zinc-800">
        <div class="space-y-4 py-1">
          <!-- Avatar + email -->
          <div class="flex items-center gap-4">
            <UAvatar
              :src="profile?.avatar_url ?? undefined"
              :alt="profile?.display_name ?? undefined"
              size="xl"
              class="ring-2 ring-violet-500/50 shrink-0"
            />
            <div class="min-w-0">
              <p class="text-white font-semibold truncate">{{ profile?.display_name ?? '—' }}</p>
              <p class="text-zinc-400 text-sm truncate">{{ profile?.email ?? '—' }}</p>
            </div>
          </div>

          <!-- Editable name -->
          <div class="flex gap-2">
            <UInput
              v-model="displayName"
              placeholder="Votre nom affiché"
              class="flex-1"
              color="neutral"
              @keyup.enter="saveName"
            />
            <UButton
              color="violet"
              variant="solid"
              :loading="isSavingName"
              :disabled="!displayName.trim()"
              @click="saveName"
            >
              Sauvegarder
            </UButton>
          </div>
        </div>
      </UCard>
    </section>

    <!-- Partner section -->
    <section class="space-y-2">
      <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium px-1">Partenaire</p>

      <!-- No partner yet -->
      <UCard v-if="!profile?.partner" class="bg-zinc-900 border border-zinc-800">
        <div class="space-y-3 py-1">
          <p class="text-zinc-400 text-sm">
            Invitez quelqu'un pour suivre votre progression ensemble.
          </p>
          <div class="flex gap-2">
            <UInput
              v-model="inviteEmail"
              type="email"
              placeholder="adresse@email.com"
              class="flex-1"
              color="neutral"
              @keyup.enter="sendInvitation"
            />
            <UButton
              color="violet"
              variant="solid"
              :loading="isSendingInvite"
              :disabled="!inviteEmail.trim()"
              @click="sendInvitation"
            >
              Envoyer l'invitation
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Has partner -->
      <UCard v-else class="bg-zinc-900 border border-zinc-800">
        <div class="space-y-4 py-1">
          <div class="flex items-center gap-4">
            <UAvatar
              :src="profile.partner.avatar_url ?? undefined"
              :alt="profile.partner.display_name ?? undefined"
              size="lg"
              class="ring-2 ring-violet-500/30 shrink-0"
            />
            <div class="min-w-0 flex-1">
              <p class="text-white font-semibold truncate">{{ profile.partner.display_name ?? '—' }}</p>
              <p class="text-zinc-400 text-sm truncate">{{ profile.partner.email ?? '—' }}</p>
            </div>
            <UIcon name="i-lucide-heart" class="text-violet-400 text-xl shrink-0" />
          </div>

          <!-- Remove confirmation -->
          <div v-if="showRemoveConfirm" class="rounded-lg bg-red-950/40 border border-red-800/50 p-3 space-y-2">
            <p class="text-sm text-red-300">Êtes-vous sûr de vouloir retirer ce partenaire ?</p>
            <div class="flex gap-2">
              <UButton
                color="error"
                variant="solid"
                size="sm"
                :loading="isRemovingPartner"
                @click="removePartner"
              >
                Confirmer
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showRemoveConfirm = false"
              >
                Annuler
              </UButton>
            </div>
          </div>

          <UButton
            v-else
            color="error"
            variant="outline"
            size="sm"
            icon="i-lucide-user-minus"
            @click="showRemoveConfirm = true"
          >
            Retirer le partenaire
          </UButton>
        </div>
      </UCard>
    </section>

    <!-- Security section -->
    <section class="space-y-2">
      <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium px-1">Sécurité</p>
      <UCard class="bg-zinc-900 border border-zinc-800">
        <div class="space-y-4 py-1">
          <div v-if="!showPasswordSection">
            <p class="text-zinc-400 text-sm mb-3">
              Définissez un mot de passe pour vous connecter plus rapidement sans attendre l'email.
            </p>
            <UButton
              color="violet"
              variant="outline"
              icon="i-lucide-key"
              @click="showPasswordSection = true"
            >
              Définir un mot de passe
            </UButton>
          </div>

          <div v-else class="space-y-3">
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Nouveau mot de passe (min. 8 caractères)"
              color="neutral"
            />
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirmer le mot de passe"
              color="neutral"
              @keyup.enter="setPassword"
            />
            <div class="flex gap-2">
              <UButton
                color="violet"
                variant="solid"
                :loading="isSavingPassword"
                :disabled="!newPassword || !confirmPassword"
                @click="setPassword"
              >
                Enregistrer
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                @click="showPasswordSection = false; newPassword = ''; confirmPassword = ''"
              >
                Annuler
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </section>

    <!-- Preferences section -->
    <section class="space-y-2">
      <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium px-1">Préférences</p>
      <UCard class="bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
        <div class="flex items-center justify-between py-3 px-1">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-moon" class="text-zinc-400" />
            <span class="text-white text-sm">Thème</span>
          </div>
          <span class="text-zinc-500 text-sm">Sombre</span>
        </div>
        <div class="flex items-center justify-between py-3 px-1">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-globe" class="text-zinc-400" />
            <span class="text-white text-sm">Langue</span>
          </div>
          <span class="text-zinc-500 text-sm">Français</span>
        </div>
      </UCard>
    </section>

    <!-- Data section -->
    <section class="space-y-2">
      <p class="text-xs text-zinc-500 uppercase tracking-wide font-medium px-1">Données</p>
      <UCard class="bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
        <NuxtLink to="/import" class="flex items-center justify-between py-3 px-1 hover:bg-zinc-800/50 rounded transition">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-upload" class="text-zinc-400" />
            <span class="text-white text-sm">Importer des données</span>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-zinc-600" />
        </NuxtLink>
        <div class="flex items-center justify-between py-3 px-1 hover:bg-zinc-800/50 rounded transition cursor-pointer">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-download" class="text-zinc-400" />
            <span class="text-white text-sm">Exporter mes données</span>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-zinc-600" />
        </div>
      </UCard>
    </section>

    <!-- Logout -->
    <UButton
      block
      color="error"
      variant="outline"
      icon="i-lucide-log-out"
      @click="logout"
    >
      Se déconnecter
    </UButton>
  </div>
</template>
