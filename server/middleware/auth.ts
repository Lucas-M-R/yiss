export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only protect /api/* routes (except auth endpoints)
  if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return

  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non autorisé'
    })
  }
})
