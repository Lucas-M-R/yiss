import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .update({ display_name: body.display_name })
    .eq('id', session.user.id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
