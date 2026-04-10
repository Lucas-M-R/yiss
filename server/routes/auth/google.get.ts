export default defineOAuthGoogleEventHandler({
  config: { scope: ['openid', 'email', 'profile'] },
  async onSuccess(event, { user }) {
    const supabase = useSupabaseClient()
    await supabase.from('users').upsert({
      id: user.sub,
      email: user.email,
      display_name: user.name,
      avatar_url: user.picture
    }, { onConflict: 'id', ignoreDuplicates: false })

    await setUserSession(event, {
      user: {
        id: user.sub,
        email: user.email,
        name: user.name,
        avatar: user.picture
      }
    }, { maxAge: 60 * 60 * 24 * 30 })
    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/login')
  }
})
