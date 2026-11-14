import { useSupabaseClient } from '../../utils/supabase'
import { assertSessionExerciseAccess } from '../../utils/access'
import { requireRouterParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = requireRouterParam(event, 'id')
  const supabase = useSupabaseClient()
  await assertSessionExerciseAccess(supabase, id, session.user.id)

  const { error } = await supabase.from('session_exercises').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})
