import { useSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const supabase = useSupabaseClient()

  const { data: me, error: meError } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()
  if (meError) throw createError({ statusCode: 500, message: meError.message })
  const allowedOwners = [session.user.id, me?.partner_id].filter(Boolean)

  const { data: existing, error: existingError } = await supabase
    .from('exercises').select('created_by').eq('id', id).single()
  if (existingError && existingError.code !== 'PGRST116') {
    throw createError({ statusCode: 500, message: existingError.message })
  }
  if (!existing) throw createError({ statusCode: 404, message: 'Exercice introuvable' })
  if (existing.created_by !== null && !allowedOwners.includes(existing.created_by)) {
    throw createError({ statusCode: 403 })
  }

  const [programDays, sessionExercises] = await Promise.all([
    supabase.from('program_day_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
    supabase.from('session_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
  ])

  if (programDays.error) throw createError({ statusCode: 500, message: programDays.error.message })
  if (sessionExercises.error) throw createError({ statusCode: 500, message: sessionExercises.error.message })

  return {
    program_days: programDays.count ?? 0,
    sessions: sessionExercises.count ?? 0,
  }
})
