import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // Vérifier que l'utilisateur est connecté
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const { password } = await readBody(event)

  // Validation du mot de passe
  if (!password || password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Le mot de passe doit contenir au moins 8 caractères'
    })
  }

  try {
    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10)

    // Mettre à jour l'utilisateur dans Supabase
    const supabase = useSupabaseClient()
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', session.user.id)

    if (error) {
      console.error('Erreur Supabase lors de la mise à jour du mot de passe:', error)
      throw createError({
        statusCode: 500,
        message: 'Impossible de définir le mot de passe'
      })
    }

    console.log('✅ Mot de passe défini avec succès pour:', session.user.email)
    return { ok: true }
  } catch (error) {
    console.error('❌ Erreur lors de la définition du mot de passe:', error)
    throw createError({
      statusCode: 500,
      message: 'Impossible de définir le mot de passe'
    })
  }
})
