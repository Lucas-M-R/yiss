import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  setHeader(event, 'Cache-Control', 'no-store')

  const body = await readBody(event)
  const rawEmail = body?.email
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
    throw createError({ statusCode: 400, message: 'Email requis' })
  }
  const email = rawEmail.trim().toLowerCase()

  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, email, partner_id')
    .eq('email', email)
    .neq('id', session.user.id)
    .single()

  if (error || !data) throw createError({ statusCode: 404, message: 'Aucun utilisateur trouvé avec cet email' })
  if (data.partner_id) throw createError({ statusCode: 400, message: 'Cet utilisateur a déjà un partenaire' })

  return { id: data.id, display_name: data.display_name, avatar_url: data.avatar_url, email: data.email }
})
