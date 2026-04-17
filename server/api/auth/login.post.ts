import bcrypt from 'bcryptjs'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    throw createError({ statusCode: 400, message: 'Email et mot de passe requis' })
  }

  const { email, password } = body

  try {
    const supabase = await serverSupabaseClient(event)
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, password_hash, partner_id')
      .eq('email', email)
      .single()

    if (error || !user) {
      throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
    }

    if (!user.password_hash) {
      throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
    }

    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        avatar: user.avatar_url,
        partner_id: user.partner_id
      }
    }, {
      maxAge: 60 * 60 * 24 * 30
    })

    return { ok: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error('❌ Erreur lors de la connexion:', error)
    throw createError({ statusCode: 500, message: 'Erreur lors de la connexion' })
  }
})
