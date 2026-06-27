import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  if (!body.name?.trim()) throw createError({ statusCode: 400, message: 'Nom requis' })
  if (body.category !== undefined && !['strength', 'cardio'].includes(body.category)) {
    throw createError({ statusCode: 400, message: 'Catégorie invalide' })
  }

  const supabase = useSupabaseClient()

  const { data: me, error: meError } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()
  if (meError) throw createError({ statusCode: 500, message: meError.message })
  const allowedOwners = [session.user.id, me?.partner_id].filter(Boolean)

  const { data: existing, error: existingError } = await supabase
    .from('exercises').select('created_by').eq('id', id).single()
  if (existingError && existingError.code !== 'PGRST116') {
    throw createError({ statusCode: 500, message: existingError.message })
  }
  if (!existing) throw createError({ statusCode: 404, message: 'Exercice introuvable' })
  if (existing.created_by !== null && !allowedOwners.includes(existing.created_by)) {
    throw createError({ statusCode: 403 })
  }

  const { data, error } = await supabase
    .from('exercises')
    .update({ name: body.name.trim(), category: body.category ?? 'strength' })
    .eq('id', id)
    .select().single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
