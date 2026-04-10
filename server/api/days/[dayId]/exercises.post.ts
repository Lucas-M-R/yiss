import { useSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const dayId = getRouterParam(event, 'dayId')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('program_day_exercises')
    .insert({ program_day_id: dayId, exercise_id: body.exercise_id, default_sets: body.default_sets ?? 3, sort_order: body.sort_order ?? 0 })
    .select('*, exercise:exercise_id(*)').single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
