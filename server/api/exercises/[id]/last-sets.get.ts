import { useSupabaseClient } from '../../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const exerciseId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const beforeDate = query.date as string | undefined
  const supabase = useSupabaseClient()

  const { data: me } = await supabase
    .from('users')
    .select('partner_id')
    .eq('id', session.user.id)
    .single()

  const userIds = [session.user.id]
  if (me?.partner_id) userIds.push(me.partner_id)

  // Find recent sessions (by user or partner) before the given date
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, session_date')
    .in('created_by', userIds)
    .order('session_date', { ascending: false })
    .limit(20)

  if (beforeDate) {
    sessionsQuery = sessionsQuery.lt('session_date', beforeDate)
  }

  const { data: sessions } = await sessionsQuery
  if (!sessions?.length) return {}

  const sessionIds = sessions.map(s => s.id)
  const sessionDateMap = new Map(sessions.map(s => [s.id, s.session_date]))

  // Find session_exercises for this exercise in those sessions
  const { data: sessionExercises } = await supabase
    .from('session_exercises')
    .select('id, session_id')
    .eq('exercise_id', exerciseId)
    .in('session_id', sessionIds)

  if (!sessionExercises?.length) return {}

  // Sort by session_date desc to find the most recent per user
  const sorted = sessionExercises
    .map(se => ({ ...se, session_date: sessionDateMap.get(se.session_id) ?? '' }))
    .sort((a, b) => b.session_date.localeCompare(a.session_date))

  const seIds = sorted.map(se => se.id)

  const { data: sets } = await supabase
    .from('session_sets')
    .select('session_exercise_id, user_id, set_number, reps, weight_kg, duration_sec')
    .in('session_exercise_id', seIds)
    .in('user_id', userIds)

  if (!sets?.length) return {}

  // For each user, find the most recent session_exercise that has sets for them
  const result: Record<string, Array<{ set_number: number; reps: number | null; weight_kg: number | null; duration_sec: number | null }>> = {}

  for (const userId of userIds) {
    const userSets = sets.filter(s => s.user_id === userId)
    if (!userSets.length) continue

    const mostRecentSeId = sorted.find(se => userSets.some(s => s.session_exercise_id === se.id))?.id
    if (!mostRecentSeId) continue

    result[userId] = userSets
      .filter(s => s.session_exercise_id === mostRecentSeId)
      .map(s => ({ set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, duration_sec: s.duration_sec }))
  }

  return result
})
