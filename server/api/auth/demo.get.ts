import { isDemoMode } from '../../utils/demo'

// Tells the login page whether to show the demo login (Vercel previews only)
export default defineEventHandler(() => ({ enabled: isDemoMode() }))
