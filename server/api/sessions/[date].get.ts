import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date') // YYYY-MM-DD
  const supabase = useSupabaseClient()

  // Get user + partner
  const { data: me } = await supabase
    .from('users')
    .select('*, partner:partner_id(id, display_name, avatar_url)')
    .eq('id', session.user.id)
    .single()

  // Find existing session for this date where user is creator
  let { data: existingSession } = await supabase
    .from('sessions')
    .select(`
      *,
      exercises:session_exercises(
        *,
        exercise:exercise_id(*),
        sets:session_sets(*)
      )
    `)
    .eq('session_date', date)
    .eq('created_by', session.user.id)
    .maybeSingle()

  // Also check if partner created a session for this date
  if (!existingSession && me?.partner?.id) {
    const { data: partnerSession } = await supabase
      .from('sessions')
      .select(`
        *,
        exercises:session_exercises(
          *,
          exercise:exercise_id(*),
          sets:session_sets(*)
        )
      `)
      .eq('session_date', date)
      .eq('created_by', me.partner.id)
      .maybeSingle()
    existingSession = partnerSession
  }

  return {
    session: existingSession,
    me: { id: me?.id, display_name: me?.display_name, avatar_url: me?.avatar_url },
    partner: me?.partner ?? null
  }
})
