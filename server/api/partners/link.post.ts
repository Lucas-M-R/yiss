import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.userId) throw createError({ statusCode: 400, message: 'userId requis' })
  if (body.userId === session.user.id) throw createError({ statusCode: 400, message: 'Vous ne pouvez pas vous ajouter vous-même' })

  const supabase = useSupabaseClient()

  // Fetch target user info before attempting the link
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, email')
    .eq('id', body.userId)
    .single()

  if (!targetUser) throw createError({ statusCode: 404, message: 'Utilisateur non trouvé' })

  // Conditional update: only proceeds if partner_id IS NULL (optimistic lock)
  const { data: updatedSelf } = await supabase
    .from('users')
    .update({ partner_id: body.userId })
    .eq('id', session.user.id)
    .is('partner_id', null)
    .select('id')

  if (!updatedSelf?.length) {
    throw createError({ statusCode: 409, message: 'Vous avez déjà un partenaire' })
  }

  const { data: updatedTarget } = await supabase
    .from('users')
    .update({ partner_id: session.user.id })
    .eq('id', body.userId)
    .is('partner_id', null)
    .select('id')

  if (!updatedTarget?.length) {
    // Rollback: remove partner_id from current user
    await supabase.from('users').update({ partner_id: null }).eq('id', session.user.id)
    throw createError({ statusCode: 409, message: 'Cet utilisateur a déjà un partenaire' })
  }

  return { success: true, partner: targetUser }
})
