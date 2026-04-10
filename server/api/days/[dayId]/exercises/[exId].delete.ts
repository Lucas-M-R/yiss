import { useSupabaseClient } from '../../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const exId = getRouterParam(event, 'exId')
  const supabase = useSupabaseClient()

  const { error } = await supabase
    .from('program_day_exercises')
    .delete()
    .eq('id', exId)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})
