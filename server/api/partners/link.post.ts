import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.userId) throw createError({ statusCode: 400, message: 'userId requis' })
  if (body.userId === session.user.id) throw createError({ statusCode: 400, message: 'Vous ne pouvez pas vous ajouter vous-même' })

  const supabase = useSupabaseClient()

  const { data: currentUser } = await supabase
    .from('users')
    .select('partner_id')
    .eq('id', session.user.id)
    .single()

  if (currentUser?.partner_id) throw createError({ statusCode: 400, message: 'Vous avez déjà un partenaire' })

  const { data: targetUser } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, email, partner_id')
    .eq('id', body.userId)
    .single()

  if (!targetUser) throw createError({ statusCode: 404, message: 'Utilisateur non trouvé' })
  if (targetUser.partner_id) throw createError({ statusCode: 400, message: 'Cet utilisateur a déjà un partenaire' })

  await supabase.from('users').update({ partner_id: body.userId }).eq('id', session.user.id)
  await supabase.from('users').update({ partner_id: session.user.id }).eq('id', body.userId)

  return { success: true, partner: { id: targetUser.id, display_name: targetUser.display_name, avatar_url: targetUser.avatar_url, email: targetUser.email } }
})
