import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const name = body?.name?.trim()
  if (!name) throw createError({ statusCode: 400, message: 'Nom requis' })

  const supabase = useSupabaseClient()

  // Own exercises and partner's (shared in the duo); global ones stay read-only
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()
  const userIds = [session.user.id, me?.partner_id].filter(Boolean)

  const { data, error } = await supabase
    .from('exercises')
    .update({ name })
    .eq('id', id)
    .in('created_by', userIds)
    .select()
    .maybeSingle()

  if (error?.code === '23505') throw createError({ statusCode: 409, message: 'Un exercice porte déjà ce nom' })
  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Exercice introuvable ou non modifiable' })
  return data
})
