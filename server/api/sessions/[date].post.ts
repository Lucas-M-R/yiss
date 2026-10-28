import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  // Copying a previous session: it must be mine or my partner's
  let source: { id: string; program_day_id: string | null } | null = null
  if (body.copy_from_session_id) {
    const { data } = await supabase
      .from('sessions')
      .select('id, program_day_id')
      .eq('id', body.copy_from_session_id)
      .in('created_by', [session.user.id, me?.partner_id].filter(Boolean))
      .maybeSingle()
    if (!data) throw createError({ statusCode: 404, message: 'Séance à reprendre introuvable' })
    source = data
  }

  // Create session
  const { data: newSession, error } = await supabase
    .from('sessions')
    .insert({
      session_date: date,
      program_day_id: body.program_day_id ?? source?.program_day_id ?? null,
      created_by: session.user.id
    })
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Add participants: self + partner if exists
  const participants: { session_id: string; user_id: string }[] = [
    { session_id: newSession.id, user_id: session.user.id }
  ]
  if (me?.partner_id) {
    participants.push({ session_id: newSession.id, user_id: me.partner_id })
  }
  await supabase.from('session_participants').insert(participants)

  if (source) {
    // Same exercises, order and number of sets as the copied session (set values are not copied)
    const { data: sourceExercises } = await supabase
      .from('session_exercises')
      .select('exercise_id, sets_count, sort_order')
      .eq('session_id', source.id)
      .order('sort_order')

    if (sourceExercises?.length) {
      await supabase.from('session_exercises').insert(
        sourceExercises.map((se: { exercise_id: string; sets_count: number; sort_order: number }) => ({
          session_id: newSession.id,
          exercise_id: se.exercise_id,
          sets_count: se.sets_count,
          sort_order: se.sort_order
        }))
      )
    }
  } else if (body.program_day_id) {
    // If created from a program day, pre-populate exercises
    const { data: dayExercises } = await supabase
      .from('program_day_exercises')
      .select('exercise_id, default_sets, sort_order')
      .eq('program_day_id', body.program_day_id)
      .order('sort_order')

    if (dayExercises?.length) {
      await supabase.from('session_exercises').insert(
        dayExercises.map((de: { exercise_id: string; default_sets: number; sort_order: number }) => ({
          session_id: newSession.id,
          exercise_id: de.exercise_id,
          sets_count: de.default_sets,
          sort_order: de.sort_order
        }))
      )
    }
  }

  // Return full session
  const { data: full } = await supabase
    .from('sessions')
    .select(`*, exercises:session_exercises(*, exercise:exercise_id(*), sets:session_sets(*))`)
    .eq('id', newSession.id)
    .single()

  return full
})
