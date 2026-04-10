import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('users')
    .select('*, partner:partner_id(id, display_name, avatar_url, email)')
    .eq('id', session.user.id)
    .single()

  return data
})
