import { useSupabaseClient } from '../../../utils/supabase'

// Rewrites the order of the session's exercises: body.ids is the full list of session_exercise ids, in display order
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const date = getRouterParam(event, 'date')
  const body = await readBody(event)
  const ids: unknown = body?.ids
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length)
    throw createError({ statusCode: 400, message: 'Liste d\'exercices invalide' })

  const supabase = useSupabaseClient()

  // Find session for this date (created by current user or their partner)
  const { data: me } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, created_by, exercises:session_exercises(id)')
    .eq('session_date', date)
    .in('created_by', [session.user.id, me?.partner_id].filter(Boolean))

  const sess = sessions?.find(s => s.created_by === session.user.id) ?? sessions?.[0]
  if (!sess) throw createError({ statusCode: 404, message: 'Séance introuvable' })

  // The list must be exactly the session's exercises, so no id from another session can be touched
  const existing = new Set((sess.exercises ?? []).map(e => e.id))
  if (ids.length !== existing.size || !ids.every(id => existing.has(id)))
    throw createError({ statusCode: 409, message: 'Les exercices de la séance ont changé, recharge la page' })

  const results = await Promise.all(ids.map((id, index) =>
    supabase.from('session_exercises').update({ sort_order: index }).eq('id', id).eq('session_id', sess.id)
  ))
  const failed = results.find(r => r.error)
  if (failed?.error) throw createError({ statusCode: 500, message: failed.error.message })

  return { success: true }
})
