import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const updates: Record<string, unknown> = {}
  if (body.sets_count !== undefined) updates.sets_count = body.sets_count
  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0)
    throw createError({ statusCode: 400, message: 'Aucun champ à mettre à jour' })

  // Verify user is creator or participant of the session containing this exercise
  const { data: se } = await supabase
    .from('session_exercises')
    .select('session_id, sessions!inner(created_by)')
    .eq('id', id)
    .single()

  if (!se) throw createError({ statusCode: 404 })

  const sessionCreatedBy = (se.sessions as { created_by: string }).created_by
  if (sessionCreatedBy !== session.user.id) {
    const { data: participant } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', se.session_id)
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (!participant) throw createError({ statusCode: 403 })
  }

  const { data, error } = await supabase
    .from('session_exercises')
    .update(updates)
    .eq('id', id)
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})

