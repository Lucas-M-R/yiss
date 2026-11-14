import { randomUUID } from 'uncrypto'
import { useSupabaseClient } from '../../utils/supabase'

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

  const supabase = useSupabaseClient()
  const columns = 'id, email, display_name, avatar_url, partner_id'

  // Existing account (emails are unique case-insensitively): keep its name and avatar.
  // ilike without wildcards, so "_" or "%" in an address match literally
  const { data: existing, error: readError } = await supabase
    .from('users')
    .select(columns)
    .ilike('email', email.trim().replace(/[\\%_]/g, c => `\\${c}`))
    .maybeSingle()

  let persisted = existing
  if (!persisted && !readError) {
    // users.id has no default (it holds the Google id for OAuth accounts): generate one
    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({ id: randomUUID(), email: email.trim(), display_name: email.split('@')[0]!, avatar_url: null })
      .select(columns)
      .single()
    if (insertError) console.error('❌ Erreur Supabase création utilisateur:', insertError)
    persisted = created
  }

  if (!persisted) {
    if (readError) console.error('❌ Erreur Supabase lecture utilisateur:', readError)
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
