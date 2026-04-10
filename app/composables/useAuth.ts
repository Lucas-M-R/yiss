export const useAuth = () => {
  const { loggedIn, user, clear } = useUserSession()

  const logout = async () => {
    await clear()
    await navigateTo('/login')
  }

  return { loggedIn, user, logout }
}
