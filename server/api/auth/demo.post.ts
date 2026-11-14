import { useSupabaseClient } from '../../utils/supabase'
import { DEMO_PARTNER_ID, DEMO_USER_ID, isDemoMode, prepareDemoData } from '../../utils/demo'

// Logs in as the demo user on preview deployments; body.reset recreates its data
export default defineEventHandler(async (event) => {
  if (!isDemoMode()) throw createError({ statusCode: 404 })

  const body = await readBody(event).catch(() => null)
  const supabase = useSupabaseClient()
  await prepareDemoData(supabase, { reset: body?.reset === true })

  await setUserSession(event, {
    user: {
      id: DEMO_USER_ID,
      email: 'demo@spor.invalid',
      name: 'Alex (démo)',
      avatar: null,
      partner_id: DEMO_PARTNER_ID
    }
  }, {
    maxAge: 60 * 60 * 24
  })

  return { ok: true }
})
