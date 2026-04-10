import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('programs')
    .select(`*, days:program_days(id, label, sort_order, exercises:program_day_exercises(id, sort_order, default_sets, exercise:exercise_id(*)))`)
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
