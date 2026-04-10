import { useSupabaseClient } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const supabase = useSupabaseClient()

  // Determine target user (self or partner)
  let targetUserId: string = session.user.id

  if (body.user_id && body.user_id !== session.user.id) {
    // Validate that body.user_id is the logged-in user's partner
    const { data: me } = await supabase
      .from('users')
      .select('partner_id')
      .eq('id', session.user.id)
      .single()

    if (me?.partner_id !== body.user_id) {
      throw createError({ statusCode: 403, message: 'Not your partner' })
    }
    targetUserId = body.user_id
  }

  const { data, error } = await supabase
    .from('session_sets')
    .upsert({
      session_exercise_id: body.session_exercise_id,
      user_id: targetUserId,
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
