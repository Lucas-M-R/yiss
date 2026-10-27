import { useSupabaseClient } from '../../utils/supabase'
import { assertSessionExerciseAccess } from '../../utils/access'

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

  await assertSessionExerciseAccess(supabase, id, session.user.id)

  const { data, error } = await supabase
    .from('session_exercises')
    .update(updates)
    .eq('id', id)
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})

