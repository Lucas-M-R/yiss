export default defineEventHandler(async (event) => {
  const { token } = await readBody(event)

  console.log('🔍 Vérification du token:', token)

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token manquant' })
  }

  try {
    // Récupérer les données du token depuis le storage
    const storage = useStorage('magic-links')
    const data = await storage.getItem(token) as { email: string; createdAt: number } | null

    console.log('📦 Données récupérées du storage:', data)

    if (!data || !data.email) {
      console.error('❌ Token non trouvé ou expiré')
      throw createError({
        statusCode: 401,
        message: 'Lien de connexion invalide ou expiré'
      })
    }

    // Supprimer le token (usage unique)
    await storage.removeItem(token)

    const email = data.email
    const name = email.split('@')[0]

    // Créer ou mettre à jour l'utilisateur dans Supabase
    try {
      const supabase = useSupabaseClient()
      await supabase.from('users').upsert(
        { id: email, email, display_name: name, avatar_url: null },
        { onConflict: 'id', ignoreDuplicates: false }
      )
    } catch {
      // Ignore si Supabase n'est pas configuré
    }

    // Créer la session
    await setUserSession(event, {
      user: { id: email, email, name, avatar: null }
    }, {
      maxAge: 60 * 60 * 24 * 30 // 30 jours
    })

    console.log('✅ Session créée avec succès pour:', email)
    return { ok: true }
  } catch (error) {
    console.error('❌ Erreur de vérification du token:', error)
    throw createError({
      statusCode: 401,
      message: 'Lien de connexion invalide ou expiré'
    })
  }
})
