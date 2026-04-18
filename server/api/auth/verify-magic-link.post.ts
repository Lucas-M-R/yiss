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
    let userId: string
    try {
      const supabase = useSupabaseClient()

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (existingUser) {
        userId = existingUser.id
      } else {
        // Generate ID for new user (magic-link prefix + UUID)
        userId = `magic-${crypto.randomUUID()}`
        const { error } = await supabase.from('users').insert({
          id: userId,
          email,
          display_name: name,
          avatar_url: null
        })

        if (error) {
          console.error('Erreur création utilisateur:', error)
          throw error
        }
      }
    } catch (error) {
      console.error('Erreur Supabase:', error)
      // Fallback: use email as ID if Supabase fails
      userId = `magic-${crypto.randomUUID()}`
    }

    // Créer la session
    await setUserSession(event, {
      user: { id: userId, email, name, avatar: null }
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
