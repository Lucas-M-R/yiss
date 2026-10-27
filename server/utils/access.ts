import type { SupabaseClient } from '@supabase/supabase-js'

// A session is accessible to its creator, its participants and the creator's partner
// (same rule as GET /api/sessions/:date, which shows the partner's session).
export async function assertSessionExerciseAccess(
  supabase: SupabaseClient,
  sessionExerciseId: string | undefined,
  userId: string
) {
  const { data: se } = await supabase
    .from('session_exercises')
    .select('session_id, sessions!inner(created_by)')
    .eq('id', sessionExerciseId)
    .maybeSingle()

  if (!se) throw createError({ statusCode: 404 })

  const createdBy = (se.sessions as unknown as { created_by: string }).created_by
  if (createdBy === userId) return

  const [{ data: participant }, { data: me }] = await Promise.all([
    supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', se.session_id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('users').select('partner_id').eq('id', userId).single()
  ])

  if (!participant && me?.partner_id !== createdBy) throw createError({ statusCode: 403 })
}

// Programs are readable by their owner, and by the owner's partner when shared
export async function assertProgramAccess(
  supabase: SupabaseClient,
  programId: string | undefined,
  userId: string,
  { write = false } = {}
) {
  const { data: program } = await supabase
    .from('programs')
    .select('owner_id, is_shared')
    .eq('id', programId)
    .maybeSingle()

  if (!program) throw createError({ statusCode: 404 })
  if (program.owner_id === userId) return
  if (write) throw createError({ statusCode: 403 })

  const { data: me } = await supabase.from('users').select('partner_id').eq('id', userId).single()
  if (!program.is_shared || me?.partner_id !== program.owner_id) throw createError({ statusCode: 403 })
}

// Program days can only be edited by the owner of their program
export async function assertProgramDayOwner(
  supabase: SupabaseClient,
  programDayId: string | undefined,
  userId: string
) {
  const { data: day } = await supabase
    .from('program_days')
    .select('program_id')
    .eq('id', programDayId)
    .maybeSingle()

  if (!day) throw createError({ statusCode: 404 })
  await assertProgramAccess(supabase, day.program_id, userId, { write: true })
}
