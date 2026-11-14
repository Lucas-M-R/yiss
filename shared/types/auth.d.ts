// Shape of session.user, as set by the login routes (Google, password, magic link, demo)
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    avatar?: string | null
    partner_id?: string | null
  }
}

export {}
