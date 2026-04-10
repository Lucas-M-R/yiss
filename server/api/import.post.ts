import { useSupabaseClient } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const body = await readBody(event)
  if (!Array.isArray(body)) throw createError({ statusCode: 400, message: 'Le JSON doit être un tableau' })

  const supabase = useSupabaseClient()

  const { data: me } = await supabase
    .from('users')
    .select('id, partner_id')
    .eq('id', session.user.id)
    .single()

  if (!me) throw createError({ statusCode: 401, message: 'Utilisateur introuvable' })

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Cache exercise name → id to avoid redundant lookups
  const exerciseCache: Record<string, string> = {}

  async function findOrCreateExercise(name: string): Promise<string> {
    const key = name.toLowerCase().trim()
    if (exerciseCache[key]) return exerciseCache[key]

    // Try to find existing (case-insensitive)
    const { data: existing } = await supabase
      .from('exercises')
      .select('id')
      .ilike('name', name.trim())
      .limit(1)
      .maybeSingle()

    if (existing) {
      exerciseCache[key] = existing.id
      return existing.id
    }

    // Detect category: cardio keywords
    const cardioKeywords = ['tapis', 'vélo', 'elliptique', 'escalier', 'rameur', 'cardio', 'course']
    const isCardio = cardioKeywords.some(k => key.includes(k))

    const { data: created } = await supabase
      .from('exercises')
      .insert({ name: name.trim(), category: isCardio ? 'cardio' : 'strength', created_by: session.user.id })
      .select('id')
      .single()

    exerciseCache[key] = created!.id
    return created!.id
  }

  for (let i = 0; i < body.length; i++) {
    const item = body[i]
    try {
      if (!item.date || !item.exercises?.length) {
        skipped++
        continue
      }

      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('session_date', item.date)
        .eq('created_by', me.id)
        .maybeSingle()

      if (existingSession) {
        skipped++
        continue
      }

      // Create session
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({ session_date: item.date, created_by: me.id, notes: item.program_day ?? null })
        .select('id')
        .single()

      if (sessionError || !newSession) {
        errors.push(`${item.date}: ${sessionError?.message ?? 'Erreur création séance'}`)
        continue
      }

      // Add participants
      const participants: { session_id: string; user_id: string }[] = [
        { session_id: newSession.id, user_id: me.id },
      ]
      if (me.partner_id) {
        participants.push({ session_id: newSession.id, user_id: me.partner_id })
      }
      await supabase.from('session_participants').insert(participants)

      // Process exercises
      for (let j = 0; j < item.exercises.length; j++) {
        const ex = item.exercises[j]
        if (!ex.name || !ex.sets?.length) continue

        const exerciseId = await findOrCreateExercise(ex.name)

        const { data: sessionExercise } = await supabase
          .from('session_exercises')
          .insert({
            session_id: newSession.id,
            exercise_id: exerciseId,
            sets_count: ex.sets.length,
            sort_order: j,
          })
          .select('id')
          .single()

        if (!sessionExercise) continue

        // Insert sets for p1 (current user) and p2 (partner)
        const setsToInsert: {
          session_exercise_id: string
          user_id: string
          set_number: number
          reps: number | null
          weight_kg: number | null
          duration_sec: number | null
        }[] = []

        for (const s of ex.sets) {
          // p1 sets
          setsToInsert.push({
            session_exercise_id: sessionExercise.id,
            user_id: me.id,
            set_number: s.set,
            reps: s.p1_reps ?? null,
            weight_kg: s.p1_weight ?? null,
            duration_sec: s.p1_duration_sec ?? null,
          })
          // p2 sets (only if partner exists)
          if (me.partner_id) {
            setsToInsert.push({
              session_exercise_id: sessionExercise.id,
              user_id: me.partner_id,
              set_number: s.set,
              reps: s.p2_reps ?? null,
              weight_kg: s.p2_weight ?? null,
              duration_sec: s.p2_duration_sec ?? null,
            })
          }
        }

        if (setsToInsert.length) {
          await supabase.from('session_sets').insert(setsToInsert)
        }
      }

      imported++
    } catch (err: any) {
      errors.push(`${item.date ?? `ligne ${i}`}: ${err.message}`)
    }
  }

  return { imported, skipped, errors }
})
