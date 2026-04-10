import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.token) throw createError({ statusCode: 400, message: 'Token requis' })

  const supabase = useSupabaseClient()

  const { data: invitation } = await supabase
    .from('partner_invitations')
    .select('*, inviter:inviter_id(id, display_name)')
    .eq('token', body.token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation invalide ou expirée' })

  // Link the two users as partners
  await supabase.from('users').update({ partner_id: invitation.inviter_id }).eq('id', session.user.id)
  await supabase.from('users').update({ partner_id: session.user.id }).eq('id', invitation.inviter_id)

  await supabase
    .from('partner_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  return { success: true, partner: invitation.inviter }
})
