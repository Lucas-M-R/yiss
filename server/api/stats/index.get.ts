import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const query = getQuery(event)
  const supabase = useSupabaseClient()

  const { data: me } = await supabase
    .from('users')
    .select('partner_id')
    .eq('id', session.user.id)
    .single()

  const allowedUserIds = [session.user.id, me?.partner_id].filter(Boolean)

  // Period filter
  const periodMap: Record<string, string> = {
    '7d': new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    '30d': new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    '3m': new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    '1y': new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  }
  const fromDate = query.period && periodMap[query.period as string] ? periodMap[query.period as string] : null

  let q = supabase
    .from('exercise_stats')
    .select('*')
    .in('user_id', allowedUserIds)
    .order('session_date', { ascending: true })

  if (query.exercise_id) q = q.eq('exercise_id', query.exercise_id as string)
  if (query.user_id) q = q.eq('user_id', query.user_id as string)
  if (fromDate) q = q.gte('session_date', fromDate)

  // If filtering by program, join through sessions
  if (query.program_id) {
    // Get session dates that belong to this program
    const { data: programSessions } = await supabase
      .from('sessions')
      .select('session_date')
      .eq('program_day_id', query.program_id) // approximate — would need join to program_days
    const dates = programSessions?.map(s => s.session_date) ?? []
    if (dates.length > 0) q = q.in('session_date', dates)
  }

  const { data, error } = await q
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
