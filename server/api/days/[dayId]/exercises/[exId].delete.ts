import { useSupabaseClient } from '../../../../utils/supabase'
import { assertProgramDayOwner } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const dayId = getRouterParam(event, 'dayId')
  const exId = getRouterParam(event, 'exId')
  const supabase = useSupabaseClient()
  await assertProgramDayOwner(supabase, dayId, session.user.id)

  const { error } = await supabase
    .from('program_day_exercises')
    .delete()
    .eq('id', exId)
    .eq('program_day_id', dayId)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})
