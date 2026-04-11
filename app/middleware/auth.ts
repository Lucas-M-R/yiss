export default defineNuxtRouteMiddleware((to) => {
  // Skip auth check if page explicitly sets auth: false
  if (to.meta.auth === false) {
    return
  }

  const { loggedIn } = useUserSession()
  if (!loggedIn.value && to.path !== '/login' && !to.path.startsWith('/invite') && !to.path.startsWith('/auth')) {
    return navigateTo('/login')
  }
})
