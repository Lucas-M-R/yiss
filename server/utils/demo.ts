import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database.types'

// Demo duo used to test Vercel preview deployments, where Google OAuth can't redirect.
// Its data only belongs to these two ids, so it never mixes with real users' data.
export const DEMO_USER_ID = 'demo-user'
export const DEMO_PARTNER_ID = 'demo-partner'
export const DEMO_IDS = [DEMO_USER_ID, DEMO_PARTNER_ID]

// Enabled on Vercel preview deployments only, or locally with NUXT_DEMO_MODE=true.
// Read at runtime (not baked at build time) so a preview promoted to production loses it.
export function isDemoMode() {
  // Not a NUXT_ variable, so it can't go through useRuntimeConfig (and @types/node isn't installed)
  const vercelEnv = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VERCEL_ENV
  if (vercelEnv) return vercelEnv === 'preview'
  return String(useRuntimeConfig().demoMode) === 'true'
}

type Db = SupabaseClient<Database>

function check<T>({ data, error }: { data: T; error: { message: string } | null }, step: string): T {
  if (error) throw createError({ statusCode: 500, message: `Données démo (${step}) : ${error.message}` })
  return data
}

function isoDate(daysFromToday: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

async function upsertDemoUsers(supabase: Db) {
  check(await supabase.from('users').upsert([
    { id: DEMO_USER_ID, email: 'demo@spor.invalid', display_name: 'Alex (démo)', avatar_url: null },
    { id: DEMO_PARTNER_ID, email: 'demo-partenaire@spor.invalid', display_name: 'Sam (démo)', avatar_url: null }
  ], { onConflict: 'id' }), 'utilisateurs')
  // Linked in a second step: partner_id references users(id)
  check(await supabase.from('users').update({ partner_id: DEMO_PARTNER_ID }).eq('id', DEMO_USER_ID), 'partenaire')
  check(await supabase.from('users').update({ partner_id: DEMO_USER_ID }).eq('id', DEMO_PARTNER_ID), 'partenaire')
}

async function deleteDemoData(supabase: Db) {
  // Sessions cascade to participants, exercises and sets; programs to days and their exercises
  check(await supabase.from('sessions').delete().in('created_by', DEMO_IDS), 'suppression séances')
  check(await supabase.from('programs').delete().in('owner_id', DEMO_IDS), 'suppression programmes')
  check(await supabase.from('exercises').delete().in('created_by', DEMO_IDS), 'suppression exercices')
  check(await supabase.from('partner_invitations').delete().in('inviter_id', DEMO_IDS), 'suppression invitations')
}

const EXERCISES = {
  bench: { name: 'Développé couché', category: 'strength', base: 60, partnerBase: 40 },
  row: { name: 'Rowing barre', category: 'strength', base: 55, partnerBase: 35 },
  ohp: { name: 'Développé militaire', category: 'strength', base: 40, partnerBase: 25 },
  curl: { name: 'Curl biceps', category: 'strength', base: 14, partnerBase: 8 },
  squat: { name: 'Squat', category: 'strength', base: 80, partnerBase: 55 },
  deadlift: { name: 'Soulevé de terre', category: 'strength', base: 100, partnerBase: 70 },
  lunges: { name: 'Fentes', category: 'strength', base: 20, partnerBase: 14 },
  rower: { name: 'Rameur', category: 'cardio', base: 0, partnerBase: 0 }
} as const
type ExerciseKey = keyof typeof EXERCISES

const UPPER: ExerciseKey[] = ['bench', 'row', 'ohp', 'curl']
const LOWER: ExerciseKey[] = ['squat', 'deadlift', 'lunges', 'rower']
const WEEKS_OF_HISTORY = 6

// Global exercises are reused when they exist; missing ones are created for the demo user
async function resolveExercises(supabase: Db) {
  const names = Object.values(EXERCISES).map(e => e.name)
  const globals = check(
    await supabase.from('exercises').select('id, name').is('created_by', null).in('name', names),
    'exercices'
  ) ?? []
  const missing = Object.values(EXERCISES).filter(e => !globals.some(g => g.name === e.name))
  const created = missing.length
    ? check(await supabase.from('exercises')
        .insert(missing.map(e => ({ name: e.name, category: e.category, created_by: DEMO_USER_ID })))
        .select('id, name'), 'création exercices') ?? []
    : []
  const byName = new Map([...globals, ...created].map(e => [e.name, e.id as string]))
  return Object.fromEntries(
    (Object.keys(EXERCISES) as ExerciseKey[]).map(k => [k, byName.get(EXERCISES[k].name)!])
  ) as Record<ExerciseKey, string>
}

async function seedDemoData(supabase: Db) {
  const exerciseIds = await resolveExercises(supabase)

  // Shared program: one upper body day, one lower body day
  const program = check(await supabase.from('programs')
    .insert({ name: 'Programme démo', owner_id: DEMO_USER_ID, is_shared: true })
    .select('id').single(), 'programme')!
  const days = check(await supabase.from('program_days')
    .insert([
      { program_id: program.id, label: 'Haut du corps', sort_order: 0 },
      { program_id: program.id, label: 'Bas du corps', sort_order: 1 }
    ])
    .select('id, label'), 'jours')!
  const upperDayId = days.find(d => d.label === 'Haut du corps')!.id
  const lowerDayId = days.find(d => d.label === 'Bas du corps')!.id
  check(await supabase.from('program_day_exercises').insert([
    ...UPPER.map((k, i) => ({ program_day_id: upperDayId, exercise_id: exerciseIds[k], default_sets: 3, sort_order: i })),
    ...LOWER.map((k, i) => ({ program_day_id: lowerDayId, exercise_id: exerciseIds[k], default_sets: 3, sort_order: i }))
  ]), 'exercices du programme')

  // Two sessions a week in the past weeks (with sets), plus today's session (without sets)
  const plans: { date: string; dayId: string; exercises: ExerciseKey[]; week: number | null; notes: string | null }[] = []
  for (let week = WEEKS_OF_HISTORY; week >= 1; week--) {
    plans.push({ date: isoDate(-7 * week), dayId: upperDayId, exercises: UPPER, week: WEEKS_OF_HISTORY - week, notes: null })
    plans.push({ date: isoDate(-7 * week + 3), dayId: lowerDayId, exercises: LOWER, week: WEEKS_OF_HISTORY - week, notes: week === 1 ? 'Bonne séance, squat facile' : null })
  }
  plans.push({ date: isoDate(0), dayId: upperDayId, exercises: UPPER, week: null, notes: null })

  const sessions = check(await supabase.from('sessions')
    .insert(plans.map(p => ({ session_date: p.date, program_day_id: p.dayId, created_by: DEMO_USER_ID, notes: p.notes })))
    .select('id, session_date'), 'séances')!
  const sessionIdByDate = new Map(sessions.map(s => [s.session_date as string, s.id as string]))

  check(await supabase.from('session_participants').insert(
    sessions.flatMap(s => DEMO_IDS.map(user_id => ({ session_id: s.id, user_id })))
  ), 'participants')

  const sessionExercises = check(await supabase.from('session_exercises')
    .insert(plans.flatMap(p => p.exercises.map((k, i) => ({
      session_id: sessionIdByDate.get(p.date)!,
      exercise_id: exerciseIds[k],
      sets_count: 3,
      sort_order: i
    }))))
    .select('id, session_id, exercise_id'), 'exercices des séances')!

  // Progression: +2.5 kg every week for me, +1.25 kg for the partner; 10 min of rowing growing by 30 s
  const sets = sessionExercises.flatMap((se) => {
    const plan = plans.find(p => sessionIdByDate.get(p.date) === se.session_id)!
    if (plan.week === null) return []
    const key = plan.exercises.find(k => exerciseIds[k] === se.exercise_id)!
    const ex = EXERCISES[key]
    return DEMO_IDS.flatMap(userId => [1, 2, 3].map(setNumber => {
      if (ex.category === 'cardio') {
        return { session_exercise_id: se.id, user_id: userId, set_number: setNumber, reps: null, weight_kg: null, duration_sec: 600 + plan.week! * 30, rest_sec: null }
      }
      const isMe = userId === DEMO_USER_ID
      const weight = (isMe ? ex.base : ex.partnerBase) + plan.week! * (isMe ? 2.5 : 1.25)
      return { session_exercise_id: se.id, user_id: userId, set_number: setNumber, reps: 10 - setNumber, weight_kg: weight, duration_sec: null, rest_sec: null }
    }))
  })
  check(await supabase.from('session_sets').insert(sets), 'séries')
}

// Creates the demo duo, and its data on first use or when a reset is asked
export async function prepareDemoData(supabase: Db, { reset = false } = {}) {
  await upsertDemoUsers(supabase)
  const existing = check(
    await supabase.from('sessions').select('id').eq('created_by', DEMO_USER_ID).limit(1),
    'lecture séances'
  ) ?? []
  if (existing.length && !reset) return
  await deleteDemoData(supabase)
  await seedDemoData(supabase)
}
