import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const supabase = useSupabaseClient()
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  let query = supabase
    .from('programs')
    .select(`*, days:program_days(id, label, sort_order, exercises:program_day_exercises(id, sort_order, default_sets, exercise:exercise_id(*)))`)
    .order('created_at')

  if (me?.partner_id) {
    query = query.or(`owner_id.eq.${session.user.id},and(owner_id.eq.${me.partner_id},is_shared.eq.true)`)
  } else {
    query = query.eq('owner_id', session.user.id)
  }

  const { data, error } = await query
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
