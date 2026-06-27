import { useSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const supabase = useSupabaseClient()

  const [programDays, sessionExercises] = await Promise.all([
    supabase.from('program_day_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
    supabase.from('session_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
  ])

  return {
    program_days: programDays.count ?? 0,
    sessions: sessionExercises.count ?? 0,
  }
})
