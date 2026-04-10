import { useSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  // Find session for this date (created by current user or their partner)
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  let sess: { id: string } | null = null

  const { data: mySession } = await supabase
    .from('sessions')
    .select('id')
    .eq('session_date', date)
    .eq('created_by', session.user.id)
    .maybeSingle()

  sess = mySession

  if (!sess && me?.partner_id) {
    const { data: partnerSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_date', date)
      .eq('created_by', me.partner_id)
      .maybeSingle()
    sess = partnerSession
  }

  if (!sess) throw createError({ statusCode: 404, message: 'Séance introuvable' })

  const { data, error } = await supabase
    .from('session_exercises')
    .insert({
      session_id: sess.id,
      exercise_id: body.exercise_id,
      sets_count: body.sets_count ?? 3,
      sort_order: body.sort_order ?? 99
    })
    .select('*, exercise:exercise_id(*), sets:session_sets(*)')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
