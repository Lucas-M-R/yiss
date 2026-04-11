import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email et mot de passe requis' })
  }

  try {
    // Récupérer l'utilisateur depuis Supabase
    const supabase = useSupabaseClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, password_hash')
      .eq('email', email)
      .single()

    if (error || !user) {
      throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
    }

    // Vérifier si l'utilisateur a un mot de passe défini
    if (!user.password_hash) {
      throw createError({
        statusCode: 401,
        message: 'Aucun mot de passe défini. Utilisez le lien par email pour vous connecter.'
      })
    }

    // Vérifier le mot de passe
    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
    }

    // Créer la session
    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        avatar: user.avatar_url
      }
    }, {
      maxAge: 60 * 60 * 24 * 30 // 30 jours
    })

    console.log('✅ Connexion réussie par mot de passe pour:', user.email)
    return { ok: true }
  } catch (error: any) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error
    }

    console.error('❌ Erreur lors de la connexion:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la connexion'
    })
  }
})
