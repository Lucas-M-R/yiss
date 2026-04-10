import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const supabase = useSupabaseClient()
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  const { data, error } = await supabase
    .from('sessions')
    .select(`*, program_day:program_day_id(label, program:program_id(name)), exercises:session_exercises(count)`)
    .or(`created_by.eq.${session.user.id}${me?.partner_id ? `,created_by.eq.${me.partner_id}` : ''}`)
    .order('session_date', { ascending: false })
    .limit(20)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
