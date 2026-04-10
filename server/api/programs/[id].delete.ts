import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const supabase = useSupabaseClient()

  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', id)
    .eq('owner_id', session.user.id)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})
