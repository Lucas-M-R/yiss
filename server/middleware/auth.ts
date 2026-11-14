import { DEMO_IDS } from '../utils/demo'

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

  // Anyone with a preview URL can log in as the demo duo: keep it away from real users
  if (DEMO_IDS.includes(session.user.id) && (path.startsWith('/api/invitations') || path.startsWith('/api/users/search'))) {
    throw createError({ statusCode: 403, message: 'Indisponible avec le compte démo' })
  }
})
