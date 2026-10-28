import { useSupabaseClient } from '../../../utils/supabase'

const WEEKS_BACK = 8

// Most recent session (mine or my partner's) on the same weekday within the last weeks,
// to offer "reprendre la séance de lundi dernier" when starting a new one
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date') // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createError({ statusCode: 400, message: 'Date invalide' })

  const sameWeekdayDates = Array.from({ length: WEEKS_BACK }, (_, i) => {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7 * (i + 1))
    return d.toISOString().slice(0, 10)
  })

  const supabase = useSupabaseClient()
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()
  const userIds = [session.user.id, me?.partner_id].filter(Boolean)

  const { data, error } = await supabase
    .from('sessions')
    .select('id, session_date, exercises:session_exercises(sets_count, sort_order, exercise:exercise_id(name))')
    .in('session_date', sameWeekdayDates)
    .in('created_by', userIds)
    .order('session_date', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })

  const previous = (data ?? []).find(s => s.exercises?.length)
  if (!previous) return null

  return {
    id: previous.id,
    session_date: previous.session_date,
    exercises: [...previous.exercises]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(e => ({ name: (e.exercise as unknown as { name: string } | null)?.name ?? '', sets_count: e.sets_count }))
  }
})
