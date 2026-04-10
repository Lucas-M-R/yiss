import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('programs')
    .insert({ name: body.name, owner_id: session.user.id, is_shared: body.is_shared ?? false })
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
