import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const supabase = useSupabaseClient()

  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
    .eq('created_by', session.user.id) // only own exercises

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})
