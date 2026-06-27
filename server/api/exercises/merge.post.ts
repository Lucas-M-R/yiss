import { useSupabaseClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  const sourceId = body.source_id as string
  const targetId = body.target_id as string
  if (!sourceId || !targetId) throw createError({ statusCode: 400, message: 'source_id et target_id requis' })
  if (sourceId === targetId) throw createError({ statusCode: 400, message: 'Impossible de fusionner un exercice avec lui-même' })

  const supabase = useSupabaseClient()

  const { data: me, error: meError } = await supabase
    .from('users').select('partner_id').eq('id', session.user.id).single()
  if (meError) throw createError({ statusCode: 500, message: meError.message })
  const allowedOwners = [session.user.id, me?.partner_id].filter(Boolean)

  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises').select('id, created_by').in('id', [sourceId, targetId])
  if (exercisesError) throw createError({ statusCode: 500, message: exercisesError.message })
  const source = exercises?.find(e => e.id === sourceId)
  const target = exercises?.find(e => e.id === targetId)
  if (!source || !target) throw createError({ statusCode: 404, message: 'Exercice introuvable' })
  for (const ex of [source, target]) {
    if (ex.created_by !== null && !allowedOwners.includes(ex.created_by)) {
      throw createError({ statusCode: 403 })
    }
  }

  const { error: mergeError } = await supabase
    .rpc('merge_exercises', { source_id: sourceId, target_id: targetId })
  if (mergeError) throw createError({ statusCode: 500, message: mergeError.message })

  return { success: true }
})
