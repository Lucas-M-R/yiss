import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.email) throw createError({ statusCode: 400, message: 'Email requis' })

  const supabase = useSupabaseClient()

  // Check if already has a partner
  const { data: currentUser } = await supabase
    .from('users')
    .select('partner_id')
    .eq('id', session.user.id)
    .single()

  if (currentUser?.partner_id) throw createError({ statusCode: 400, message: 'Vous avez déjà un partenaire' })

  // Cancel previous pending invitations from this user
  await supabase
    .from('partner_invitations')
    .update({ status: 'expired' })
    .eq('inviter_id', session.user.id)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('partner_invitations')
    .insert({ inviter_id: session.user.id, invitee_email: body.email })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
