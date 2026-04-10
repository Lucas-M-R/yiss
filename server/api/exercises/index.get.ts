import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const supabase = useSupabaseClient()

  // Get user's partner_id
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  const userIds = [session.user.id, me?.partner_id].filter(Boolean)

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .or(`created_by.is.null,created_by.in.(${userIds.join(',')})`)
    .order('name')

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
