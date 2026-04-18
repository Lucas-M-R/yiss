import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body.token !== 'string') {
    throw createError({ statusCode: 400, message: 'Token manquant' })
  }

  const { token } = body

  const storage = useStorage('magic-links')
  const data = await storage.getItem(token) as { email: string; createdAt: number } | null

  if (!data || !data.email) {
    throw createError({ statusCode: 401, message: 'Lien de connexion invalide ou expiré' })
  }

  if (Date.now() - data.createdAt > 15 * 60 * 1000) {
    await storage.removeItem(token)
    throw createError({ statusCode: 401, message: 'Lien de connexion invalide ou expiré' })
  }

  await storage.removeItem(token)

  const { email } = data

  const supabase = await serverSupabaseClient(event)
  const { data: persisted, error: upsertError } = await supabase
    .from('users')
    .upsert(
      { email, display_name: email.split('@')[0], avatar_url: null },
      { onConflict: 'email' }
    )
    .select('id, email, display_name, avatar_url, partner_id')
    .single()

  if (upsertError || !persisted) {
    console.error('❌ Erreur Supabase upsert:', upsertError)
    throw createError({ statusCode: 500, message: 'Erreur lors de la création du compte' })
  }

  await setUserSession(event, {
    user: {
      id: persisted.id,
      email: persisted.email,
      name: persisted.display_name,
      avatar: persisted.avatar_url,
      partner_id: persisted.partner_id
    }
  }, {
    maxAge: 60 * 60 * 24 * 30
  })

  return { ok: true }
})
