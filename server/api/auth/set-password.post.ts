import bcrypt from 'bcryptjs'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const body = await readBody(event)

  if (!body || typeof body.password !== 'string' || body.password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Le mot de passe doit contenir au moins 8 caractères'
    })
  }

  const { password } = body

  try {
    const passwordHash = await bcrypt.hash(password, 10)

    const supabase = await serverSupabaseClient(event)
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', session.user.id)

    if (error) {
      console.error('Erreur Supabase lors de la mise à jour du mot de passe:', error)
      throw createError({ statusCode: 500, message: 'Impossible de définir le mot de passe' })
    }

    return { ok: true }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('❌ Erreur lors de la définition du mot de passe:', error)
    throw createError({ statusCode: 500, message: 'Impossible de définir le mot de passe' })
  }
})
