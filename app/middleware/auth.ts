export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value && to.path !== '/login' && !to.path.startsWith('/invite') && !to.path.startsWith('/auth')) {
    return navigateTo('/login')
  }
})
