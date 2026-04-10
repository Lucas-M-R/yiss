import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('session_exercises')
    .update({ sets_count: body.sets_count })
    .eq('id', id)
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
