import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const updates: Record<string, unknown> = {}
  if (body.notes !== undefined) updates.notes = body.notes

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('session_date', date)
    .eq('created_by', session.user.id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
