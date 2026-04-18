import { Resend } from 'resend'
import { randomUUID } from 'uncrypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body.email !== 'string' || !body.email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Email invalide' })
  }

  const { email } = body
  const config = useRuntimeConfig()

  const token = randomUUID()

  const storage = useStorage('magic-links')
  await storage.setItem(token, {
    email,
    createdAt: Date.now()
  }, {
    ttl: 15 * 60
  })

  const baseUrl = config.public.appUrl || getRequestURL(event).origin
  const magicLink = `${baseUrl}/auth/verify?token=${token}`

  const resend = new Resend(config.resendApiKey)

  const { data, error } = await resend.emails.send({
    from: config.emailFrom || 'Spor <onboarding@resend.dev>',
    to: email,
    subject: 'Connexion à Spor',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #18181b; border-radius: 16px; padding: 48px; text-align: center;">
          <div style="width: 80px; height: 80px; background: #7c3aed; border-radius: 20px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 40px;">💪</span>
          </div>
          <h1 style="color: #fff; font-size: 28px; margin-bottom: 16px;">Connexion à Spor</h1>
          <p style="color: #a1a1aa; font-size: 16px; margin-bottom: 32px;">
            Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien expire dans 15 minutes.
          </p>
          <a href="${magicLink}" style="display: inline-block; background: #7c3aed; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Se connecter
          </a>
          <p style="color: #71717a; font-size: 14px; margin-top: 32px;">
            Si vous n'avez pas demandé cette connexion, ignorez cet email.
          </p>
        </div>
      </div>
    `
  })

  if (error) {
    console.error('❌ Erreur Resend:', error)
    throw createError({ statusCode: 502, message: 'Impossible d\'envoyer l\'email' })
  }

  return { ok: true, id: data?.id }
})
