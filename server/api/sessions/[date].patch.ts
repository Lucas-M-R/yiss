import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  let { data: existingSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('session_date', date)
    .eq('created_by', session.user.id)
    .maybeSingle()

  if (!existingSession && me?.partner_id) {
    const { data: partnerSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_date', date)
      .eq('created_by', me.partner_id)
      .maybeSingle()
    existingSession = partnerSession
  }

  if (!existingSession) throw createError({ statusCode: 404, message: 'Session introuvable' })

  const { data: updated, error } = await supabase
    .from('sessions')
    .update({ notes: body.notes ?? null })
    .eq('id', existingSession.id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return updated
})
