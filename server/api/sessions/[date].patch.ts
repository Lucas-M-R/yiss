import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const updates: Record<string, unknown> = {}
  if (body.notes !== undefined) updates.notes = body.notes

  if (Object.keys(updates).length === 0)
    throw createError({ statusCode: 400, message: 'Aucun champ à mettre à jour' })

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('session_date', date)
    .eq('created_by', session.user.id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw createError({ statusCode: 404, message: 'Session introuvable' })
    throw createError({ statusCode: 500, message: error.message })
  }
  return data
})
