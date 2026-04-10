import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!body.name?.trim()) throw createError({ statusCode: 400, message: 'Nom requis' })

  const supabase = useSupabaseClient()
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: body.name.trim(), category: body.category ?? 'strength', created_by: session.user.id })
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
