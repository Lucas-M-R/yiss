import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const supabase = useSupabaseClient()
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  const allowedUserIds = [session.user.id, me?.partner_id].filter(Boolean)

  const { data } = await supabase
    .from('exercise_stats')
    .select('exercise_id, exercise_name')
    .in('user_id', allowedUserIds)
    .order('exercise_name')

  // Deduplicate by exercise_id
  const seen = new Set()
  const unique = (data ?? []).filter(row => {
    if (seen.has(row.exercise_id)) return false
    seen.add(row.exercise_id)
    return true
  })
  return unique
})
