export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)
  const config = useRuntimeConfig()

  if (!email || !password || email !== config.authEmail || password !== config.authPassword) {
    throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
  }

  const name = email.split('@')[0]

  // Upsert user in Supabase (best effort — schema may not exist yet)
  try {
    const supabase = useSupabaseClient()
    await supabase.from('users').upsert(
      { id: email, email, display_name: name, avatar_url: null },
      { onConflict: 'id', ignoreDuplicates: false }
    )
  } catch {
    // Ignore if Supabase isn't configured yet
  }

  await setUserSession(event, {
    user: { id: email, email, name, avatar: null }
  }, {
    maxAge: 60 * 60 * 24 * 30 // 30 jours
  })

  return { ok: true }
})
