import { useSupabaseClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const programId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const supabase = useSupabaseClient()

  const { data, error } = await supabase
    .from('program_days')
    .insert({ program_id: programId, label: body.label, sort_order: body.sort_order ?? 0 })
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
