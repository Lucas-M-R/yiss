import { useSupabaseClient } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  // body: { session_exercise_id, set_number, reps?, weight_kg?, duration_sec?, rest_sec? }
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('session_sets')
    .upsert({
      session_exercise_id: body.session_exercise_id,
      user_id: session.user.id,
      set_number: body.set_number,
      reps: body.reps ?? null,
      weight_kg: body.weight_kg ?? null,
      duration_sec: body.duration_sec ?? null,
      rest_sec: body.rest_sec ?? null
    }, { onConflict: 'session_exercise_id,user_id,set_number' })
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
